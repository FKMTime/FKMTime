import { DbService } from './../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { eventsData } from 'src/events';

const WCA_ORIGIN = `${process.env.WCA_ORIGIN}/api/v0/competitions/`;
@Injectable()
export class CompetitionService {
  constructor(private readonly prisma: DbService) {}

  async importCompetition(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    const competition = await this.prisma.competition.create({
      data: {
        name: wcif.name,
        wcaId: wcif.id,
        shortName: wcif.shortName,
        countryIso2: wcif.countryIso2,
        wcif: wcif,
      },
    });
    await this.prisma.person.createMany({
      data: wcif.persons.map((person) => ({
        wcaId: person.wcaId,
        name: person.name,
        registrantId: person.registrantId,
        gender: person.gender,
        countryIso2: person.countryIso2,
      })),
    });
    return competition;
  }

  async updateWcif(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    await this.prisma.competition.updateMany({
      where: { wcaId },
      data: {
        name: wcif.name,
        shortName: wcif.shortName,
        countryIso2: wcif.countryIso2,
        wcif: wcif,
      },
    });
  }

  async getCompetitionInfo() {
    const competition = await this.prisma.competition.findFirst({
      select: {
        id: true,
        name: true,
        shortName: true,
        wcaId: true,
        countryIso2: true,
        wcif: true,
        currentGroupId: true,
      },
    });
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }

  async getCompetitionSettings() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }

  async getRoundsInfo() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));

    const rounds = [];
    wcif.events.forEach((event) => {
      event.rounds.forEach((round) => {
        const eventName = eventsData.find((e) => e.id === event.id).name;
        rounds.push({
          id: round.id,
          number: round.id.split('-r')[1],
          name: `${eventName} - Round ${round.id.split('-r')[1]}`,
          eventId: event.id,
          format: round.format,
          timeLimit: round.timeLimit,
          cutoff: round.cutoff,
          advancementCondition: round.advancementCondition,
        });
      });
    });
    return rounds;
  }

  async getAllGroups() {
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const groups = [];
    wcif.events.forEach((event) => {
      event.rounds.forEach((round) => {
        const roundGroups = wcif.schedule.venues[0].rooms[0].activities.find(
          (activity) => activity.activityCode === round.id,
        ).childActivities;
        roundGroups.forEach((group) => {
          groups.push({
            name: group.name,
            groupId: group.activityCode,
            eventId: event.id,
            roundId: round.id,
            isCurrent: competition.currentGroupId === group.activityCode,
          });
        });
      });
    });
    return groups;
  }

  async updateCurrentGroup(groupId: string) {
    await this.prisma.competition.updateMany({
      data: {
        currentGroupId: groupId,
      },
    });
    return {
      message: 'Current group updated successfully',
    };
  }

  async updateCompetition(id: number, dto: UpdateCompetitionDto) {
    return await this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        scoretakingToken: dto.scoretakingToken,
        currentGroupId: dto.currentGroupId,
        usesWcaProduction: dto.usesWcaProduction,
      },
    });
  }
}
