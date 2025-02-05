import { Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { eventsData } from 'src/events';
import { convertToLatin, getTranslation } from 'src/translations';
import { getGroupInfoByActivityId, getPersonFromWcif } from 'wcif-helpers';

import { PersonService } from './person.service';

@Injectable()
export class PersonForDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
  ) {}

  async getPersonInfo(cardId: string, espId: number) {
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
    const possibleGroups = device.room.currentGroupIds;
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
    const finalGroups = possibleGroups
      .filter((g) => competitorGroups.includes(g))
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

  computeSecondaryText(groupId?: string) {
    if (!groupId) return '';
    const roundId = groupId.split('-g')[0];
    const eventId = roundId.split('-r')[0];
    const roundNumber = roundId.split('-r')[1];
    const eventData = eventsData.find((e) => e.id === eventId);
    return `${eventData.shortName ? eventData.shortName : eventData.name} - R${roundNumber}`;
  }
}
