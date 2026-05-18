import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Competition } from '@prisma/client';
import { Competition as WCIF, formatCentiseconds } from '@wca/helpers';
import { publicPersonSelect } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { eventsData } from 'src/events';
import { checkCutoff } from 'src/result/helpers';
import { ResultService } from 'src/result/result.service';
import { convertToLatin, getTranslation } from 'src/translations/translations';
import { WcaService } from 'src/wca/wca.service';
import { getMaxAttempts } from 'src/wcif-helpers';
import {
  getGroupInfoByActivityId,
  getPersonFromWcif,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { PersonService } from './person.service';

@Injectable()
export class PersonForDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
  ) {}

  async getPersonInfo(
    cardId: string,
    espId: number,
    isCompetitor: boolean = false,
  ) {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', 'en'),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }
    const person = await this.personService.getPersonByCardId(cardId);
    if (!person) {
      return {
        message: getTranslation(
          'competitorNotFound',
          competition.defaultLocale,
        ),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    const device = await this.prisma.device.findFirst({
      where: {
        espId: espId,
      },
      include: {
        room: true,
      },
    });
    const possibleGroups = device?.room.currentGroupIds || [];
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const competitorWcifInfo = getPersonFromWcif(person.registrantId, wcif);
    const competingAssignments = competitorWcifInfo.assignments.filter(
      (a) => a.assignmentCode === 'competitor',
    );
    const competitorGroups = [];
    for (const assignment of competingAssignments) {
      const activityFromSchedule = getGroupInfoByActivityId(
        assignment.activityId,
        wcif,
      );
      competitorGroups.push(activityFromSchedule.activityCode);
    }
    const finishedRoundsIds = await this.getFinishedRoundIds(
      person.id,
      competition,
      wcif,
    );

    if (possibleGroups.length === 1) {
      if (
        competitorGroups.some(
          (g) => g.split('-g')[0] === possibleGroups[0].split('-g')[0],
        )
      ) {
        if (
          isCompetitor &&
          !this.competitorHasAnyPossibleRounds(
            possibleGroups,
            competitorGroups,
            finishedRoundsIds,
          )
        ) {
          return {
            message: getTranslation('noAttemptsLeft', person.countryIso2),
            shouldResetTime: true,
            status: 400,
            error: true,
          };
        }
        return {
          ...person,
          name: convertToLatin(person.name),
          possibleGroups: await Promise.all(
            possibleGroups.map(async (g) => ({
              groupId: g,
              useInspection: eventsData.find((e) => e.id === g.split('-')[0])
                .useInspection,
              secondaryText: await this.computeSecondaryText(
                g,
                wcif,
                person.id,
              ),
            })),
          ),
        };
      }
    }

    const finalGroups = possibleGroups
      .filter(
        (g) =>
          competitorGroups.some(
            (group) =>
              group.split('-g')[0] === possibleGroups[0].split('-g')[0],
          ) || eventsData.find((e) => e.id === g.split('-')[0]).isUnofficial,
      )
      .filter((g) => !finishedRoundsIds.includes(g.split('-g')[0]))
      .map(async (g) => {
        const eventId = g.split('-')[0];
        return {
          groupId: g,
          useInspection: eventsData.find((e) => e.id === eventId).useInspection,
          secondaryText: await this.computeSecondaryText(g, wcif, person.id),
        };
      });
    return {
      ...person,
      name: convertToLatin(person.name),
      possibleGroups: await Promise.all(finalGroups),
    };
  }

  private competitorHasAnyPossibleRounds(
    possibleGroups: string[],
    competitorGroups: string[],
    finishedRoundsIds: string[],
  ) {
    return possibleGroups.some(
      (g) =>
        competitorGroups.some((cg) => cg.split('-g')[0] === g.split('-g')[0]) &&
        !finishedRoundsIds.some((fr) => fr === g.split('-g')[0]),
    );
  }

  private async getFinishedRoundIds(
    personId: string,
    competition: Competition,
    wcif: WCIF,
  ) {
    const results = await this.prisma.result.findMany({
      where: {
        personId: personId,
      },
      select: {
        roundId: true,
        attempts: true,
        person: publicPersonSelect,
      },
    });
    const finishedRoundsIds = [];
    for (const result of results) {
      if (result.attempts.length === 0) {
        continue;
      }
      const roundInfo = getRoundInfoFromWcif(result.roundId, wcif);
      let maxAttempts = getMaxAttempts(roundInfo.format);
      if (roundInfo.cutoff) {
        const cutoffPassed = checkCutoff(
          result.attempts,
          roundInfo.cutoff.attemptResult,
          roundInfo.cutoff.numberOfAttempts,
        );
        if (!cutoffPassed) maxAttempts = roundInfo.cutoff.numberOfAttempts;
      }
      const submittedAttempts = this.wcaService.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      if (submittedAttempts.results[0].attempts.length === maxAttempts) {
        finishedRoundsIds.push(result.roundId);
      }
    }
    return finishedRoundsIds;
  }

  async computeSecondaryText(
    groupId: string | undefined,
    wcif: WCIF,
    personId: string,
  ) {
    if (!groupId) return '';
    const roundId = groupId.split('-g')[0];
    const eventId = roundId.split('-r')[0];
    const roundNumber = roundId.split('-r')[1];
    const eventData = eventsData.find((e) => e.id === eventId);
    const eventName = eventData.shortName ?? eventData.name;
    let text = `${eventName} - R${roundNumber}`;

    const roundInfo = getRoundInfoFromWcif(roundId, wcif);
    if (
      roundInfo?.timeLimit &&
      roundInfo.timeLimit.cumulativeRoundIds.length > 0
    ) {
      const roundsIds =
        roundInfo.timeLimit.cumulativeRoundIds.length > 1
          ? roundInfo.timeLimit.cumulativeRoundIds
          : [roundId];
      let used = 0;
      for (const rId of roundsIds) {
        const submittedAttempts = await this.resultService.getSubmittedAttempts(
          rId,
          personId,
        );
        submittedAttempts.forEach((a) => {
          used += a.penalty !== -1 ? a.value + a.penalty * 100 : a.value;
        });
      }
      const limit = roundInfo.timeLimit.centiseconds;
      const remaining = Math.max(0, limit - used);
      text += `\nRemaining: ${formatCentiseconds(remaining)}`;
    }

    return text;
  }
}
