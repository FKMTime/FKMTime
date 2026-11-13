import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Attempt, Competition } from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';
import { getCountingAttempts, getFinalExtraAttempt } from 'src/result/helpers';
import { Competition as Wcif, Person } from 'wcif-helpers';

import { DbService } from '../db/db.service';

const WCA_LIVE_API_ORIGIN = process.env.WCA_LIVE_API_ORIGIN;
const WCA_ORIGIN = process.env.WCA_ORIGIN;

/** Turns a failed WCIF fetch into an HTTP error instead of a crash further on */
export const assertWcaCompetitionFound = (statusCode: number) => {
  if (statusCode === 404) {
    throw new HttpException(
      'Competition not found on the WCA website',
      HttpStatus.NOT_FOUND,
    );
  }
  if (statusCode !== 200) {
    throw new HttpException(
      `The WCA website answered ${statusCode}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
};

export interface WcaTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds */
  expiresIn: number;
}

@Injectable()
export class WcaService {
  constructor(private readonly prisma: DbService) {}

  private wcaLogger = new Logger(`WCA`);
  private wcaLiveLogger = new Logger(`WCA-Live`);

  async enterWholeScorecardToWcaLive(result: any) {
    const competition = await this.prisma.competition.findFirst();
    const { competitionId, eventId, roundNumber, scoretakingToken, results } =
      await this.getAttemptsToEnterToWcaLive(result, competition);
    try {
      const response = await fetch(`${WCA_LIVE_API_ORIGIN}/enter-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scoretakingToken}`,
        },
        body: JSON.stringify({
          competitionWcaId: competitionId,
          eventId: eventId,
          roundNumber: roundNumber,
          results: results,
        }),
      });
      const data = await response.json();
      this.wcaLiveLogger.log(
        `Sending scorecard to WCA Live: ${eventId}-r${roundNumber} status ${response.status} data ${JSON.stringify(data)}`,
      );
    } catch (err) {
      this.wcaLiveLogger.error(
        `Error sending scorecard to WCA Live: ${eventId}-r${roundNumber} error ${err}`,
      );
    }
    return {
      message: 'Scorecard submitted',
    };
  }

  async enterRoundToWcaLive(roundId: string, resultsFromDb: any) {
    const competition = await this.prisma.competition.findFirst();
    const eventIdToSubmit = roundId.split('-')[0];
    const roundNumberToSubmit = +roundId.split('-r')[1];
    const resultsToSubmit = [];
    for (const result of resultsFromDb) {
      const { results } = await this.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      resultsToSubmit.push(...results);
    }
    const response = await fetch(`${WCA_LIVE_API_ORIGIN}/enter-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${competition.scoretakingToken}`,
      },
      body: JSON.stringify({
        competitionWcaId: competition.wcaId,
        eventId: eventIdToSubmit,
        roundNumber: roundNumberToSubmit,
        results: resultsToSubmit,
      }),
    });
    const data = await response.json();
    this.wcaLiveLogger.log(
      `Sending round to WCA Live: ${eventIdToSubmit}-r${roundNumberToSubmit} status ${response.status} data ${JSON.stringify(data)}`,
    );
    if (response.status !== 200) {
      throw new HttpException('WCA Live error', 500);
    } else {
      return {
        message: 'Round resubmitted',
      };
    }
  }

  getAttemptsToEnterToWcaLive(result: any, competition: Competition) {
    const attemptsToReturn = getCountingAttempts(result.attempts).map(
      (attempt, index) => ({ ...attempt, number: index + 1 }),
    );
    const sorted = attemptsToReturn.sort((a, b) => a.number - b.number);
    const timesToSubmit = sorted.map((attempt) => {
      return {
        result:
          attempt.penalty === DNS_VALUE
            ? DNS_VALUE
            : attempt.penalty === DNF_VALUE
              ? DNF_VALUE
              : attempt.penalty * 100 + attempt.value,
      };
    });
    return {
      competitionId: competition.wcaId,
      scoretakingToken: competition.scoretakingToken,
      apiToken: competition.cubingContestsToken,
      eventId: result.eventId,
      roundNumber: parseInt(result.roundId.split('-r')[1]),
      results: [
        {
          registrantId: result.person.registrantId,
          wcaId: result.person.wcaId,
          attempts: timesToSubmit,
        },
      ],
    };
  }

  getExtra(originalAttemptId: string, attempts: Attempt[]) {
    return getFinalExtraAttempt(originalAttemptId, attempts);
  }

  async getWcif(
    competitionId: string,
    token?: string,
    isPublic: boolean = false,
  ) {
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions/${competitionId}/wcif/version/2`,
      {
        headers: {
          Authorization: isPublic ? undefined : `Bearer ${token}`,
        },
      },
    );
    this.wcaLogger.log(
      `Fetching ${isPublic ? 'public ' : 'private'}WCIF ${response.status}`,
    );
    const data = await response.json();
    return {
      ...data,
      statusCode: response.status,
      public: isPublic,
    };
  }

  async patchWcif(
    competitionId: string,
    wcif: Pick<Wcif, 'id' | 'formatVersion'> & { persons: Person[] },
    token: string,
  ) {
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions/${competitionId}/wcif`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wcif),
      },
    );
    const data = await response.json();
    this.wcaLogger.log(
      `Patching WCIF ${response.status}, ${response.url}, ${JSON.stringify(data)}`,
    );
    return {
      ...data,
      statusCode: response.status,
    };
  }

  async getCompetitionInfo(competitionId: string) {
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions/${competitionId}`,
    );
    this.wcaLogger.log(`Fetching competition info ${response.status}`);
    return await response.json();
  }

  /**
   * How the competition's results are entered, per the WCA website
   * (`external`, `wca_live` or `internal`); null when the WCA can't be reached
   */
  async getScoretakingSoftware(competitionId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${WCA_ORIGIN}/api/v0/competitions/${competitionId}`,
      );
      this.wcaLogger.log(`Fetching scoretaking software ${response.status}`);
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.scoretaking_software === 'string'
        ? data.scoretaking_software
        : null;
    } catch (e) {
      this.wcaLogger.error(`Fetching scoretaking software failed: ${e}`);
      return null;
    }
  }

  async getAccessToken(code: string, redirectUrl: string) {
    const tokenResponse = await fetch(`${WCA_ORIGIN}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUrl,
        client_id: process.env.WCA_CLIENT_ID,
        client_secret: process.env.WCA_CLIENT_SECRET,
        grant_type: 'authorization_code',
      }),
    });
    this.wcaLogger.log(`Fetching access token ${tokenResponse.status}`);
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }

  /** The full token answer for a sign-in code; null if the WCA refuses it */
  async exchangeCodeForTokens(
    code: string,
    redirectUrl: string,
  ): Promise<WcaTokens | null> {
    return this.requestTokens({
      code,
      redirect_uri: redirectUrl,
      grant_type: 'authorization_code',
    });
  }

  /**
   * A new token pair. The WCA rotates refresh tokens, so the one passed in
   * stops working. Null if the WCA refuses it.
   */
  async refreshTokens(refreshToken: string): Promise<WcaTokens | null> {
    return this.requestTokens({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
  }

  private async requestTokens(
    grant: Record<string, string>,
  ): Promise<WcaTokens | null> {
    try {
      const response = await fetch(`${WCA_ORIGIN}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...grant,
          client_id: process.env.WCA_CLIENT_ID,
          client_secret: process.env.WCA_CLIENT_SECRET,
        }),
      });
      this.wcaLogger.log(
        `Requesting tokens (${grant.grant_type}) ${response.status}`,
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.access_token || !data.refresh_token) return null;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 7200,
      };
    } catch (e) {
      this.wcaLogger.error(`Requesting tokens failed: ${e}`);
      return null;
    }
  }

  /** Whether the token's user manages the competition; null if unknown */
  async managesCompetition(
    token: string,
    competitionId: string,
  ): Promise<boolean | null> {
    const competitions = await this.getUpcomingManageableCompetitions(
      token,
    ).catch(() => null);
    if (!Array.isArray(competitions)) return null;
    return competitions.some((c: { id: string }) => c.id === competitionId);
  }

  /** Whether the user is a scoretaker of the competition; null if unknown */
  async isScoretaker(
    token: string,
    competitionId: string,
    wcaUserId: number,
  ): Promise<boolean | null> {
    try {
      const response = await fetch(
        `${WCA_ORIGIN}/api/v1/competitions/${competitionId}/scoretakers`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      this.wcaLogger.log(`Fetching scoretakers ${response.status}`);
      if (!response.ok) return null;
      const scoretakers: { user_id: number }[] = await response.json();
      return scoretakers.some((s) => s.user_id === wcaUserId);
    } catch (e) {
      this.wcaLogger.error(`Fetching scoretakers failed: ${e}`);
      return null;
    }
  }

  async getUserInfo(token: string) {
    const userInfoResponse = await fetch(`${WCA_ORIGIN}/api/v0/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await userInfoResponse.json();
    this.wcaLogger.log(
      `Fetching user info ${userInfoResponse.status}, ${JSON.stringify(data)}`,
    );
    return data;
  }

  async getUserInfoByWcaId(wcaId: string) {
    const userInfoResponse = await fetch(`${WCA_ORIGIN}/api/v0/users/${wcaId}`);
    const data = await userInfoResponse.json();
    this.wcaLogger.log(
      `Fetching user info by WCA ID ${userInfoResponse.status}, ${JSON.stringify(
        data,
      )}`,
    );
    return data;
  }

  async getUpcomingManageableCompetitions(token: string) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const params = `managed_by_me=true&start=${oneWeekAgo.toISOString()}&sort=start_date`;
    this.wcaLogger.log(
      `Fetching manageable competitions with params: ${params}`,
    );
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return await response.json();
  }
}
