import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';

import { IntegratedLiveConnectionService } from './integratedLiveConnection.service';

/** A WCA user who may enter results for the competition */
export interface Scoretaker {
  wcaUserId: number;
  name: string;
}

export interface ScoretakersList {
  ok: boolean;
  scoretakers: Scoretaker[];
  message?: string;
  /** The user has to sign in with WCA (again) for this */
  needsWcaSignIn?: boolean;
}

export interface ScoretakerChange {
  ok: boolean;
  message: string;
  needsWcaSignIn?: boolean;
}

const SIGN_IN_AS_MANAGER =
  'Sign in with WCA as someone who manages the competition to change scoretakers';

/**
 * The WCA users who may enter results besides the competition's managers
 * (SPEC-006 section 5), so someone other than an organiser can be the
 * connected person. Changing them needs someone who manages the
 * competition: the connected person if they do, otherwise the WCA sign-in
 * of the FKMTime user making the change.
 */
@Injectable()
export class ScoretakersService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => IntegratedLiveConnectionService))
    private readonly connection: IntegratedLiveConnectionService,
  ) {}

  private logger = new Logger(ScoretakersService.name);

  /** Anyone signed in to the WCA may list them */
  async list(userId: string): Promise<ScoretakersList> {
    const token =
      (await this.connection.getAccessToken()) ??
      (await this.userToken(userId));
    if (!token) {
      return {
        ok: false,
        scoretakers: [],
        needsWcaSignIn: true,
        message: 'Connect, or sign in with WCA, to see the scoretakers',
      };
    }
    const response = await this.call(token, '', 'GET');
    if (response?.status === 401) {
      return {
        ok: false,
        scoretakers: [],
        needsWcaSignIn: true,
        message: 'Sign in with WCA again to see the scoretakers',
      };
    }
    if (!response?.ok) {
      return {
        ok: false,
        scoretakers: [],
        message: await this.reason(response),
      };
    }
    const body: { user_id: number; name: string }[] = await response.json();
    return {
      ok: true,
      scoretakers: body.map((s) => ({ wcaUserId: s.user_id, name: s.name })),
    };
  }

  /** Adds someone by WCA ID; people without one can't be added here */
  async add(userId: string, wcaId: string): Promise<ScoretakerChange> {
    const info = await this.wcaService
      .getUserInfoByWcaId(wcaId.trim().toUpperCase())
      .catch(() => null);
    const wcaUserId: number | undefined = info?.user?.id;
    if (!wcaUserId) {
      return { ok: false, message: `No WCA account with WCA ID ${wcaId}` };
    }
    return this.change(
      userId,
      '',
      'POST',
      { user_id: wcaUserId },
      () => `${info.user.name ?? wcaId} can now enter results`,
    );
  }

  async remove(userId: string, wcaUserId: number): Promise<ScoretakerChange> {
    return this.change(
      userId,
      `/${wcaUserId}`,
      'DELETE',
      undefined,
      () => 'Removed from the scoretakers',
    );
  }

  private async change(
    userId: string,
    path: string,
    method: 'POST' | 'DELETE',
    body: unknown,
    done: () => string,
  ): Promise<ScoretakerChange> {
    const token = await this.managingToken(userId);
    if (!token) {
      return { ok: false, message: SIGN_IN_AS_MANAGER, needsWcaSignIn: true };
    }
    const response = await this.call(token, path, method, body);
    if (response?.status === 401) {
      return {
        ok: false,
        message: 'Sign in with WCA again to change scoretakers',
        needsWcaSignIn: true,
      };
    }
    if (response?.status === 403) {
      return { ok: false, message: SIGN_IN_AS_MANAGER, needsWcaSignIn: true };
    }
    if (!response?.ok) {
      return { ok: false, message: await this.reason(response) };
    }
    this.logger.log(`Scoretakers changed: ${method} ${path || '(add)'}`);
    return { ok: true, message: done() };
  }

  /**
   * A token of someone who manages the competition: the connection's when
   * the connected person manages it, otherwise the user's own WCA sign-in
   */
  private async managingToken(userId: string): Promise<string | null> {
    const competition = await this.prisma.competition.findFirst();
    const connectionToken = await this.connection.getAccessToken();
    if (
      connectionToken &&
      (await this.wcaService.managesCompetition(
        connectionToken,
        competition.wcaId,
      )) === true
    ) {
      return connectionToken;
    }
    return this.userToken(userId);
  }

  private async userToken(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.wcaAccessToken ?? null;
  }

  private async call(
    token: string,
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
  ): Promise<Response | null> {
    const competition = await this.prisma.competition.findFirst();
    return fetch(
      `${process.env.WCA_ORIGIN}/api/v1/competitions/${competition.wcaId}/scoretakers${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    ).catch(() => null);
  }

  private async reason(response: Response | null) {
    if (!response) return 'Could not reach the WCA website';
    const body = await response.json().catch(() => ({}));
    return body?.error ?? body?.status ?? `The WCA answered ${response.status}`;
  }
}
