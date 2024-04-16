import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  Attempt,
  AttemptStatus,
  AttemptType,
  Competition,
} from '@prisma/client';

const WCA_LIVE_API_ORIGIN = process.env.WCA_LIVE_API_ORIGIN;
const WCA_ORIGIN = process.env.WCA_ORIGIN;

@Injectable()
export class WcaService {
  constructor(private readonly prisma: DbService) {}

  private wcaLogger = new Logger(`WCA`);
  private wcaLiveLogger = new Logger(`WCA-Live`);

  async enterAttemptToWcaLive(
    competitionId: string,
    scoretakingToken: string,
    eventId: string,
    roundNumber: number,
    registrantId: number,
    attemptNumber: number,
    attemptResult: number,
  ) {
    try {
      const response = await fetch(`${WCA_LIVE_API_ORIGIN}/enter-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scoretakingToken}`,
        },
        body: JSON.stringify({
          competitionWcaId: competitionId,
          eventId: eventId,
          roundNumber: roundNumber,
          registrantId: registrantId,
          attemptNumber: attemptNumber,
          attemptResult: attemptResult,
        }),
      });
      const data = await response.json();
      this.wcaLiveLogger.log(
        `Sending attempt to WCA Live: ${eventId}-r${roundNumber} competitorId: ${registrantId} attemptNumber: ${attemptNumber} attemptResult: ${attemptResult} status ${response.status} data ${JSON.stringify(data)}`,
      );
    } catch (error) {
      this.wcaLiveLogger.error(
        `Error sending attempt to WCA Live: ${eventId}-r${roundNumber} competitorId: ${registrantId} attemptNumber: ${attemptNumber} attemptResult: ${attemptResult} error ${error}`,
      );
    }
  }

  async enterWholeScorecardToWcaLive(result: any) {
    const competition = await this.prisma.competition.findFirst();
    const { competitionId, eventId, roundNumber, scoretakingToken, results } =
      await this.getAttemptsToEnterToWcaLive(result, competition);
    if (!competition.sendResultsToWcaLive) {
      return;
    }
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
    if (response.status !== 200) {
      throw new HttpException('WCA Live error', 500);
    } else {
      return {
        message: 'Scorecard submitted',
      };
    }
  }

  async enterRoundToWcaLive(results: any) {
    const competition = await this.prisma.competition.findFirst();
    const eventIdToSubmit = results[0].eventId;
    const roundNumberToSubmit = +results[0].roundId.split('-r')[1];

    const resultsToSubmit = [];
    for (const result of results) {
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

  async getAttemptsToEnterToWcaLive(result: any, competition: Competition) {
    const attemptsToReturn = [];
    const sortedAttempts = result.attempts.sort(
      (a: Attempt, b: Attempt) => a.attemptNumber - b.attemptNumber,
    );
    sortedAttempts.forEach((attempt) => {
      if (
        attempt.replacedBy === null &&
        attempt.type === AttemptType.STANDARD_ATTEMPT &&
        attempt.status === AttemptStatus.STANDARD &&
        !attemptsToReturn.some((a) => a.id === attempt.id)
      ) {
        attemptsToReturn.push({
          ...attempt,
          number: attemptsToReturn.length + 1,
        });
      } else if (
        attempt.replacedBy !== null &&
        attempt.status === AttemptStatus.EXTRA_GIVEN
      ) {
        const extraAttempt = this.getExtra(attempt.id, sortedAttempts);
        if (
          extraAttempt &&
          !attemptsToReturn.some((a) => a.id === extraAttempt.id) &&
          extraAttempt.status === AttemptStatus.STANDARD
        ) {
          attemptsToReturn.push({
            ...extraAttempt,
            number: attempt.attemptNumber,
          });
        }
      }
    });
    const timesToSubmit = attemptsToReturn.map((attempt) => {
      return {
        result:
          attempt.penalty === -2
            ? -2
            : attempt.penalty === -1
              ? -1
              : attempt.penalty * 100 + attempt.value,
      };
    });
    return {
      competitionId: competition.wcaId,
      scoretakingToken: competition.scoretakingToken,
      eventId: result.eventId,
      roundNumber: parseInt(result.roundId.split('-r')[1]),
      results: [
        {
          registrantId: result.person.registrantId,
          attempts: timesToSubmit,
        },
      ],
    };
  }

  getExtra(originalAttemptId: string, attempts: Attempt[]) {
    const originalAttempt = attempts.find((a) => a.id === originalAttemptId);
    const extraAttempt = attempts.find(
      (a) =>
        a.attemptNumber === originalAttempt?.replacedBy &&
        a.type === AttemptType.EXTRA_ATTEMPT,
    );
    if (extraAttempt && extraAttempt.replacedBy) {
      const furtherExtraAttempt = this.getExtra(extraAttempt.id, attempts);
      return furtherExtraAttempt || extraAttempt;
    }
    return extraAttempt;
  }

  async getPublicWcif(competitionId: string) {
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions/${competitionId}/wcif/public`,
    );
    this.wcaLogger.log(`Fetching public WCIF ${response.status}`);
    return await response.json();
  }

  async getWcif(competitionId: string, token: string) {
    const response = await fetch(
      `${WCA_ORIGIN}/api/v0/competitions/${competitionId}/wcif`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    this.wcaLogger.log(`Fetching WCIF ${response.status}`);
    return await response.json();
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
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
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
