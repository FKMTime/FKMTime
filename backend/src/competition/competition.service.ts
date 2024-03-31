import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { eventsData } from 'src/events';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { Activity, Event, Person, Room as WCIFRoom, Venue } from '@wca/helpers';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import { Room } from '@prisma/client';
import { CompetitionGateway } from './competition.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sha512 } from 'js-sha512';
import { convertPolishToLatin } from '../translations';
import * as crypto from 'crypto';

const WCA_ORIGIN = `${process.env.WCA_ORIGIN}/api/v0/competitions`;
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || '123456';

@Injectable()
export class CompetitionService {
  constructor(
    private readonly prisma: DbService,
    private readonly competitionGateway: CompetitionGateway,
  ) {}

  async importCompetition(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}/${wcaId}/wcif/public`);
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
        canCompete: person.registration && person.registration.isCompeting,
      })),
    });
    const delegates = wcif.persons.filter((person: Person) =>
      person.roles.includes('delegate'),
    );
    const organizers = wcif.persons.filter((person: Person) =>
      person.roles.includes('organizer'),
    );
    await this.prisma.account.createMany({
      data: [
        ...delegates.map((delegate: Person) => ({
          username: this.getUsername(delegate.name),
          password: sha512(DEFAULT_PASSWORD),
          role: 'DELEGATE',
        })),
        ...organizers.map((organizer: Person) => ({
          username: this.getUsername(organizer.name),
          password: sha512(DEFAULT_PASSWORD),
          role: 'ADMIN',
        })),
      ],
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

  getUsername(fullName: string) {
    return convertPolishToLatin(
      (fullName[0] + fullName.split(' ')[1]).toLowerCase(),
    );
  }

  async updateWcif(wcaId: string) {
    const wcifRes = await fetch(`${WCA_ORIGIN}/${wcaId}/wcif/public`);
    const wcif = await wcifRes.json();
    const transactions = [];

    wcif.persons.forEach((person: Person) => {
      if (person.registrantId) {
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
      }
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
    const allDevices = [];
    rooms.forEach((room) => {
      allDevices.push(...room.devices);
    });
    return {
      shouldUpdate: competition.shouldUpdateDevices,
      releaseChannel: competition.releaseChannel,
      devices: allDevices.map((d) => d.espId),
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
            devices: room.devices
              .filter((d) => d.type === 'STATION')
              .map((device) => device.espId),
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
        sendResultsToWcaLive: dto.sendResultsToWcaLive,
      },
    });
  }

  async getDevicesSettings() {
    return this.prisma.competition.findFirst({
      select: {
        id: true,
        shouldUpdateDevices: true,
        releaseChannel: true,
        wifiSsid: true,
        wifiPassword: true,
      },
    });
  }

  async generateApiToken() {
    const competition = await this.prisma.competition.findFirst();
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.competition.update({
      where: {
        id: competition.id,
      },
      data: {
        apiToken: sha512(token),
      },
    });
    return {
      token: token,
    };
  }

  async getWifiSettings() {
    return this.prisma.competition.findFirst({
      select: {
        wifiSsid: true,
        wifiPassword: true,
      },
    });
  }

  async updateDevicesSettings(id: string, data: UpdateDevicesSettingsDto) {
    return this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        shouldUpdateDevices: data.shouldUpdateDevices,
        releaseChannel: data.releaseChannel,
        wifiSsid: data.wifiSsid,
        wifiPassword: data.wifiPassword,
      },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkIfGroupShouldBeChanged() {
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const rooms = await this.prisma.room.findMany({
      include: {
        devices: true,
      },
    });
    rooms.forEach((room: Room) => {
      let currentGroupIdInSchedule = '';
      wcif.schedule.venues.forEach((venue: Venue) => {
        venue.rooms.forEach((r: WCIFRoom) => {
          if (r.name === room.name && room.currentGroupId) {
            r.activities.forEach((activity: Activity) => {
              activity.childActivities.forEach((childActivity: Activity) => {
                const startTime = new Date(childActivity.startTime).getTime();
                const endTime = new Date(childActivity.endTime).getTime();
                const now = new Date().getTime();
                if (startTime <= now && now <= endTime) {
                  currentGroupIdInSchedule = childActivity.activityCode;
                }
              });
            });
            if (
              currentGroupIdInSchedule !== room.currentGroupId &&
              currentGroupIdInSchedule !== ''
            ) {
              this.competitionGateway.server
                .to(`competition`)
                .emit('groupShouldBeChanged', {
                  message: `Group in room ${room.name} should be changed`,
                });
            }
          }
        });
      });
    });
  }
}
