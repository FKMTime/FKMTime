import { Injectable } from '@nestjs/common';
import { Competition } from '@prisma/client';
import { Competition as WCIF } from '@wca/helpers';
import { publicPersonSelect } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { eventsData } from 'src/events';
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
  ) {}

  async getPersonInfo(
    cardId: string,
    espId: number,
    isCompetitor: boolean = false,
  ) {
    const person = await this.personService.getPersonByCardId(cardId);
    if (!person) {
      return {
        message: getTranslation('competitorNotFound', 'en'),
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
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', 'en'),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }
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
          possibleGroups.length === finishedRoundsIds.length &&
          isCompetitor
        ) {
          // return {
          //   message: getTranslation('noAttemptsLeft', person.countryIso2),
          //   shouldResetTime: true,
          //   status: 400,
          //   error: true,
          // };
        }
        return {
          ...person,
          name: convertToLatin(person.name),
          possibleGroups: possibleGroups.map((g) => ({
            groupId: g,
            useInspection: eventsData.find((e) => e.id === g.split('-')[0])
              .useInspection,
            secondaryText: this.computeSecondaryText(g),
          })),
        };
      }
    }

    const finalGroups = possibleGroups
      .filter(
        (g) =>
          competitorGroups.includes(g) ||
          eventsData.find((e) => e.id === g.split('-')[0]).isUnofficial,
      )
      .filter((g) => !finishedRoundsIds.includes(g.split('-g')[0]))
      .map((g) => {
        const eventId = g.split('-')[0];
        return {
          groupId: g,
          useInspection: eventsData.find((e) => e.id === eventId).useInspection,
          secondaryText: this.computeSecondaryText(g),
        };
      });
    return {
      ...person,
      name: convertToLatin(person.name),
      possibleGroups: finalGroups,
    };
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
      const maxAttempts = getMaxAttempts(roundInfo.format);
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

  computeSecondaryText(groupId?: string) {
    if (!groupId) return '';
    const roundId = groupId.split('-g')[0];
    const eventId = roundId.split('-r')[0];
    const roundNumber = roundId.split('-r')[1];
    const eventData = eventsData.find((e) => e.id === eventId);
    return `${eventData.shortName ? eventData.shortName : eventData.name} - R${roundNumber}`;
  }
}
