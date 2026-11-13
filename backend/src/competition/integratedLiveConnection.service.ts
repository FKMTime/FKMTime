import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { decryptSecret, encryptSecret } from 'src/secret-box';
import { WcaService, WcaTokens } from 'src/wca/wca.service';

import { CompetitionService } from './competition.service';

/** Refresh this long before the token expires, so no send meets a dead one */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type IntegratedLiveConnectionState =
  'NOT_CONNECTED' | 'CONNECTED' | 'BROKEN';

const disconnected = {
  wcaLiveConnectedById: null,
  wcaLiveConnectedWcaUserId: null,
  wcaLiveConnectedName: null,
  wcaLiveCanEnterScores: null,
  wcaLiveAccessToken: null,
  wcaLiveRefreshToken: null,
  wcaLiveTokenExpiresAt: null,
  wcaLiveConnectionBrokenAt: null,
};

export const getIntegratedLiveConnectionState = (competition: {
  wcaLiveAccessToken: string | null;
  wcaLiveConnectionBrokenAt: Date | null;
}): IntegratedLiveConnectionState => {
  if (!competition.wcaLiveAccessToken) return 'NOT_CONNECTED';
  return competition.wcaLiveConnectionBrokenAt ? 'BROKEN' : 'CONNECTED';
};

/**
 * The competition's connection to the WCA's integrated live results
 * (SPEC-006 section 2). It belongs to the competition, not to a signed-in
 * user: results are sent from crons and station events with nobody signed
 * in. Everything sent is entered on the WCA side as the connected person.
 */
@Injectable()
export class IntegratedLiveConnectionService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => CompetitionService))
    private readonly competitionService: CompetitionService,
    private readonly appGateway: AppGateway,
  ) {}

  private logger = new Logger(IntegratedLiveConnectionService.name);
  // The refresh in progress: a refresh token works once, so concurrent
  // sends must share one refresh rather than each start their own
  private refreshing: Promise<string | null> | null = null;

  async connect(userId: string, code: string, redirectUri: string) {
    const competition = await this.getCompetition();
    const tokens = await this.wcaService.exchangeCodeForTokens(
      code,
      redirectUri,
    );
    if (!tokens) {
      throw new HttpException('The WCA did not accept the sign-in', 400);
    }
    const userInfo = await this.wcaService
      .getUserInfo(tokens.accessToken)
      .catch(() => null);
    const wcaUser = userInfo?.me;
    if (!wcaUser?.id) {
      throw new HttpException('Could not read the WCA account', 502);
    }
    // Fresh, in case the competition was switched on the WCA in between
    await this.competitionService
      .refreshWcaScoretakingSoftware()
      .catch(() => undefined);
    const canEnterScores = await this.checkCanEnterScores(
      tokens.accessToken,
      competition.wcaId,
      wcaUser.id,
    );
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: {
        ...this.storedTokens(tokens),
        wcaLiveConnectedById: userId,
        wcaLiveConnectedWcaUserId: wcaUser.id,
        wcaLiveConnectedName: wcaUser.name ?? null,
        wcaLiveCanEnterScores: canEnterScores,
        wcaLiveConnectionBrokenAt: null,
      },
    });
    this.logger.log(`Connected to WCA live results as WCA user ${wcaUser.id}`);
    this.appGateway.handleIntegratedLiveConnectionChanged();
    return this.getStatus();
  }

  async disconnect() {
    const competition = await this.getCompetition();
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: disconnected,
    });
    this.appGateway.handleIntegratedLiveConnectionChanged();
    return this.getStatus();
  }

  async getStatus() {
    const competition = await this.getCompetition();
    return {
      state: getIntegratedLiveConnectionState(competition),
      connectedAs: competition.wcaLiveConnectedName,
      /** Null when the WCA couldn't tell at connect time */
      canEnterScores: competition.wcaLiveCanEnterScores,
      brokenAt: competition.wcaLiveConnectionBrokenAt,
      usesIntegratedLive: competition.wcaScoretakingSoftware === 'internal',
    };
  }

  /**
   * A working access token, refreshed when it is about to expire; null when
   * there is no connection or it is broken
   */
  async getAccessToken(): Promise<string | null> {
    const competition = await this.prisma.competition.findFirst();
    if (
      !competition?.wcaLiveAccessToken ||
      competition.wcaLiveConnectionBrokenAt
    ) {
      return null;
    }
    const expiresAt = competition.wcaLiveTokenExpiresAt?.getTime() ?? 0;
    if (expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      const token = decryptSecret(competition.wcaLiveAccessToken);
      if (token) return token;
    }
    return this.refresh();
  }

  /** Calls the WCA as the connected person; refreshes and retries once on 401 */
  async authorizedFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<Response | null> {
    const token = await this.getAccessToken();
    if (!token) return null;
    const response = await fetch(url, this.withToken(init, token));
    if (response.status !== 401) return response;
    const fresh = await this.refresh();
    if (!fresh) return response;
    return fetch(url, this.withToken(init, fresh));
  }

  /** One refresh at a time; callers arriving meanwhile share its result */
  refresh(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.refreshOnce().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async refreshOnce(): Promise<string | null> {
    const competition = await this.prisma.competition.findFirst();
    const refreshToken =
      competition?.wcaLiveRefreshToken &&
      decryptSecret(competition.wcaLiveRefreshToken);
    if (!competition || !refreshToken) {
      if (competition?.wcaLiveAccessToken) await this.markBroken(competition);
      return null;
    }
    const tokens = await this.wcaService.refreshTokens(refreshToken);
    if (!tokens) {
      await this.markBroken(competition);
      return null;
    }
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: this.storedTokens(tokens),
    });
    return tokens.accessToken;
  }

  private async markBroken(competition: {
    id: string;
    wcaLiveConnectionBrokenAt: Date | null;
  }) {
    if (competition.wcaLiveConnectionBrokenAt) return;
    this.logger.warn('The WCA live results connection broke: reconnect it');
    await this.prisma.competition.update({
      where: { id: competition.id },
      data: { wcaLiveConnectionBrokenAt: new Date() },
    });
    this.appGateway.handleIntegratedLiveConnectionChanged();
  }

  /** Managers and the competition's scoretakers; null when the WCA can't tell */
  private async checkCanEnterScores(
    token: string,
    competitionId: string,
    wcaUserId: number,
  ): Promise<boolean | null> {
    const manages = await this.wcaService.managesCompetition(
      token,
      competitionId,
    );
    if (manages) return true;
    const scoretaker = await this.wcaService.isScoretaker(
      token,
      competitionId,
      wcaUserId,
    );
    if (scoretaker) return true;
    return manages === null || scoretaker === null ? null : false;
  }

  private storedTokens(tokens: WcaTokens) {
    return {
      wcaLiveAccessToken: encryptSecret(tokens.accessToken),
      wcaLiveRefreshToken: encryptSecret(tokens.refreshToken),
      wcaLiveTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };
  }

  private withToken(init: RequestInit, token: string): RequestInit {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
  }

  private async getCompetition() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }
}
