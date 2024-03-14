import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { eventsData } from 'src/events';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { Event, Person } from '@wca/helpers';

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
      data: wcif.persons.map((person: Person) => ({
        wcaId: person.wcaId,
        name: person.name,
        registrantId: person.registrantId,
        gender: person.gender,
        countryIso2: person.countryIso2,
      })),
    });
    const rooms = [];

    for (const venue of wcif.schedule.venues) {
      for (const room of venue.rooms) {
        rooms.push({
          name: room.name,
          color: room.color,
        });
      }
    }
    await this.prisma.room.createMany({
      data: rooms,
    });
    return competition;
  }

  async updateWcif(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    const transactions = [];

    wcif.persons.forEach((person: Person) => {
      transactions.push(
        this.prisma.person.upsert({
          where: {
            registrantId: person.registrantId,
          },
          update: {
            name: person.name,
            wcaId: person.wcaId,
            gender: person.gender,
            countryIso2: person.countryIso2,
          },
          create: {
            name: person.name,
            wcaId: person.wcaId,
            registrantId: person.registrantId,
            gender: person.gender,
            countryIso2: person.countryIso2,
          },
        }),
      );
    });
    await this.prisma.$transaction(transactions);
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
      },
    });
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }

  async getAllRooms() {
    return this.prisma.room.findMany();
  }

  async updateRooms(data: UpdateRoomsDto) {
    const transactions = [];
    for (const room of data.rooms) {
      transactions.push(
        this.prisma.room.update({
          where: {
            id: room.id,
          },
          data: {
            currentGroupId: room.currentGroupId,
          },
        }),
      );
    }
    return this.prisma.$transaction(transactions);
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
    wcif.events.forEach((event: Event) => {
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

  async serverStatus() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const rooms = await this.prisma.room.findMany({
      include: {
        devices: true,
      },
    });
    return {
      shouldUpdate: competition.shouldUpdateDevices,
      releaseChannel: competition.releaseChannel,
      rooms: rooms
        .filter((r) => r.currentGroupId)
        .map((room) => {
          const eventId = room.currentGroupId.split('-')[0];
          const useInspection = eventsData.find(
            (e) => e.id === eventId,
          ).useInspection;
          return {
            id: room.id,
            name: room.name,
            useInspection: useInspection,
            devices: room.devices.filter((d) => d.type === "STATION").map((device) => device.espId),
          };
        }),
    };
  }

  async updateCompetition(id: string, dto: UpdateCompetitionDto) {
    const competition = await this.prisma.competition.findFirst({
      where: {
        id: id,
      },
    });
    return this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        scoretakingToken: dto.scoretakingToken,
        scoretakingTokenUpdatedAt:
          competition.scoretakingToken !== dto.scoretakingToken
            ? new Date()
            : competition.scoretakingTokenUpdatedAt,
        usesWcaProduction: dto.usesWcaProduction,
        shouldUpdateDevices: dto.shouldUpdateDevices,
        releaseChannel: dto.releaseChannel,
      },
    });
  }
}
