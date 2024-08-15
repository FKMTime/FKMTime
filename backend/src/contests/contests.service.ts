import { Injectable, Logger } from '@nestjs/common';
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
            roundNumber: roundNumber.toString(),
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
    //I know this is a bit weird, but we need this feature for the upcoming competition. Will change that later if enter-multiple-attempts endpoint will be available
    for (const result of results) {
      await this.enterAttemptToCubingContests(
        competitionId,
        apiToken,
        eventId,
        roundNumber,
        result.wcaId,
        result.attempts.length,
        result.attempts[result.attempts.length - 1].result,
      );
    }
    return {
      message: 'Scorecard submitted',
    };
  }
}
