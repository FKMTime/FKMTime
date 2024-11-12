import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';

const CUBING_CONTESTS_API_ORIGIN = process.env.CUBING_CONTESTS_API_ORIGIN;

@Injectable()
export class ContestsService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
  ) {}
  private cubingContestLogger = new Logger(`CubingContests`);

  async enterAttemptToCubingContests(
    competitionId: string,
    apiToken: string,
    eventId: string,
    roundNumber: number,
    wcaId: string,
    attemptNumber: number,
    attemptResult: number,
  ) {
    try {
      const response = await fetch(
        `${CUBING_CONTESTS_API_ORIGIN}/enter-attempt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            competitionWcaId: competitionId,
            eventId: eventId,
            roundNumber: roundNumber,
            wcaId: wcaId,
            attemptNumber: attemptNumber,
            attemptResult: attemptResult,
          }),
        },
      );
      const data = await response.json();
      this.cubingContestLogger.log(
        `Sending attempt to CubingContests: ${eventId}-r${roundNumber} competitorId: ${wcaId} attemptNumber: ${attemptNumber} attemptResult: ${attemptResult} status ${response.status} data ${JSON.stringify(data)}`,
      );
    } catch (error) {
      this.cubingContestLogger.error(
        `Error sending attempt to CubingContests: ${eventId}-r${roundNumber} competitorId: ${wcaId} attemptNumber: ${attemptNumber} attemptResult: ${attemptResult} error ${error}`,
      );
    }
  }

  async enterWholeScorecardToCubingContests(result: any) {
    const competition = await this.prisma.competition.findFirst();
    const { competitionId, eventId, roundNumber, apiToken, results } =
      await this.wcaService.getAttemptsToEnterToWcaLive(result, competition);
    try {
      const response = await fetch(
        `${CUBING_CONTESTS_API_ORIGIN}/enter-results`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            competitionWcaId: competitionId,
            eventId: eventId,
            roundNumber: roundNumber,
            results: this.mapResults(results),
          }),
        },
      );
      let data: any;
      if (response.status !== 201) {
        data = await response.json();
      }
      this.cubingContestLogger.log(
        `Sending scorecard to CubingContests ${eventId}-r${roundNumber}, WCA ID: ${results[0].wcaId} status ${response.status} data ${JSON.stringify(data)}`,
      );
    } catch (error) {
      this.cubingContestLogger.error(
        `Error sending scorecard to CubingContests: ${eventId}-r${roundNumber}, WCA ID: ${results[0].wcaId} error ${error}`,
      );
    }
    return {
      message: 'Scorecard submitted',
    };
  }

  async enterRoundToCubingContests(resultsToEnter: any) {
    const competition = await this.prisma.competition.findFirst();
    const eventIdToSubmit = resultsToEnter[0].eventId;
    const roundNumberToSubmit = +resultsToEnter[0].roundId.split('-r')[1];

    const resultsToSubmit = [];
    for (const result of resultsToEnter) {
      const { results } = await this.wcaService.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      resultsToSubmit.push(...results);
    }
    const response = await fetch(
      `${CUBING_CONTESTS_API_ORIGIN}/enter-results`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${competition.cubingContestsToken}`,
        },
        body: JSON.stringify({
          competitionWcaId: competition.wcaId,
          eventId: eventIdToSubmit,
          roundNumber: roundNumberToSubmit,
          results: this.mapResults(resultsToSubmit),
        }),
      },
    );
    let data: any;
    if (response.status !== 201) {
      data = await response.json();
    }
    this.cubingContestLogger.log(
      `Sending round to CubingContests: ${eventIdToSubmit}-r${roundNumberToSubmit} status ${response.status} data ${JSON.stringify(data)}`,
    );
    if (response.status !== 201) {
      throw new HttpException('CubingContests error', 500);
    } else {
      return {
        message: 'Round resubmitted',
      };
    }
  }

  private mapResults(results: any) {
    return results.map((result: any) => {
      return {
        wcaId: result.wcaId,
        attempts: this.mapAttempts(result.attempts),
      };
    });
  }

  private mapAttempts(attempts: any) {
    return attempts.map((attempt: any) => {
      return {
        result: attempt.result,
      };
    });
  }
}
