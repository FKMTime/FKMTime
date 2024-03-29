import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Attempt, AttemptStatus, Competition } from '@prisma/client';

const WCA_LIVE_API_ORIGIN = process.env.WCA_LIVE_API_ORIGIN;

@Injectable()
export class WcaService {
  constructor(private readonly prisma: DbService) {}

  private logger = new Logger(`WCA-Live`);

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
      this.logger.log(
        `Sending attempt to WCA Live: ${eventId}-r${roundNumber} competitorId: ${registrantId} attemptNumber: ${attemptNumber} attemptResult: ${attemptResult} status ${response.status} data ${JSON.stringify(data)}`,
      );
    } catch (error) {
      this.logger.error(
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
    this.logger.log(
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
    this.logger.log(
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
    sortedAttempts.forEach((attempt: Attempt) => {
      if (
        !attemptsToReturn.some((a) => a.id === attempt.id) &&
        attempt.replacedBy === null &&
        attempt.status !== AttemptStatus.EXTRA_ATTEMPT &&
        attempt.status !== AttemptStatus.EXTRA_GIVEN &&
        attempt.status !== AttemptStatus.UNRESOLVED
      )
        attemptsToReturn.push(attempt);
      if (
        attempt.replacedBy !== null &&
        attempt.status === AttemptStatus.EXTRA_GIVEN
      ) {
        const extraAttempt = result.attempts.find(
          (a: Attempt) =>
            a.attemptNumber === attempt.replacedBy &&
            a.status === AttemptStatus.EXTRA_ATTEMPT,
        );
        if (
          extraAttempt &&
          !attemptsToReturn.some((a) => a.id === extraAttempt.id)
        ) {
          attemptsToReturn.push(extraAttempt);
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
}
