import { HttpException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Room, SendingResultsFrequency, StaffRole } from '@prisma/client';
import {
  Activity,
  Assignment,
  Event,
  Person,
  Room as WCIFRoom,
  Venue,
} from '@wca/helpers';
import { DbService } from '../db/db.service';
import { eventsData } from '../events';
import { SocketController } from '../socket/socket.controller';
import { WcaService } from '../wca/wca.service';
import {
  getGroupInfoByActivityId,
  wcifRoleToAttendanceRole,
} from '../wcif-helpers';
import { CompetitionGateway } from './competition.gateway';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import { ResultService } from 'src/result/result.service';

@Injectable()
export class CompetitionService {
  constructor(
    private readonly prisma: DbService,
    private readonly competitionGateway: CompetitionGateway,
    private readonly resultService: ResultService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
  ) {}

  async importCompetition(wcaId: string, userId: string) {
    const existingCompetition = await this.prisma.competition.findFirst();
    if (existingCompetition) {
      throw new HttpException('Competition already exists', 400);
    }
    const user = await this.prisma.account.findFirst({
      where: {
        id: userId,
      },
    });
    const wcifPublic = await this.wcaService.getPublicWcif(wcaId);
    const wcif = await this.wcaService.getWcif(wcaId, user.wcaAccessToken);
    const competition = await this.prisma.competition.create({
      data: {
        name: wcifPublic.name,
        wcaId: wcifPublic.id,
        countryIso2: wcifPublic.countryIso2,
        wcif: wcifPublic,
        sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
      },
    });
    await this.prisma.person.createMany({
      data: wcif.persons
        .filter((p: Person) => p.registration.status === 'accepted')
        .map((person: Person) => ({
          wcaId: person.wcaId,
          name: person.name,
          registrantId: person.registrantId,
          gender: person.gender,
          countryIso2: person.countryIso2,
          canCompete: person.registration && person.registration.isCompeting,
          birthdate: person.wcaId
            ? null
            : person.birthdate && new Date(person.birthdate),
        })),
    });
    const rooms = [];

    for (const venue of wcifPublic.schedule.venues) {
      for (const room of venue.rooms) {
        rooms.push({
          name: room.name,
          color: room.color,
        });
      }
    }
    const staffActivitiesTransactions = [];

    wcifPublic.persons.forEach((person: Person) => {
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        staffActivitiesTransactions.push(
          this.prisma.staffActivity.create({
            data: {
              person: {
                connect: {
                  registrantId: person.registrantId,
                },
              },
              role: wcifRoleToAttendanceRole(assignment.assignmentCode),
              groupId: group.activityCode,
              isAssigned: true,
            },
          }),
        );
      });
    });
    await this.prisma.$transaction(staffActivitiesTransactions);
    await this.prisma.room.createMany({
      data: rooms,
    });
    return competition;
  }

  async updateWcif(wcaId: string, userId: string) {
    const user = await this.prisma.account.findFirst({
      where: {
        id: userId,
      },
    });
    const wcifPublic = await this.wcaService.getPublicWcif(wcaId);
    const transactions = [];
    if (user.wcaUserId) {
      const wcif = await this.wcaService.getWcif(wcaId, user.wcaAccessToken);
      wcif.persons.forEach((person: Person) => {
        if (person.registrantId && person.registration.status === 'accepted') {
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
                birthdate: person.wcaId
                  ? null
                  : person.birthdate && new Date(person.birthdate),
              },
              create: {
                name: person.name,
                wcaId: person.wcaId,
                registrantId: person.registrantId,
                gender: person.gender,
                countryIso2: person.countryIso2,
                birthdate: person.wcaId
                  ? null
                  : person.birthdate && new Date(person.birthdate),
              },
            }),
          );
        }
      });
      wcif.persons
        .filter((p) => p.registration.status !== 'accepted')
        .forEach((p) => {
          transactions.push(
            this.prisma.person.deleteMany({
              where: {
                registrantId: p.registrantId,
              },
            }),
          );
        });
    } else {
      wcifPublic.persons.forEach((person: Person) => {
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
    }
    const activitiesTransactions = [];
    const persons = await this.prisma.person.findMany();
    wcifPublic.persons.forEach((person: Person) => {
      person.assignments.forEach((assignment: Assignment) => {
        const group = getGroupInfoByActivityId(
          assignment.activityId,
          wcifPublic,
        );
        const personData = persons.find(
          (p) => p.registrantId === person.registrantId,
        );
        activitiesTransactions.push(
          this.prisma.staffActivity.upsert({
            where: {
              personId_groupId_role: {
                groupId: group.activityCode,
                personId: personData.id,
                role: wcifRoleToAttendanceRole(assignment.assignmentCode),
              },
            },
            update: {
              isAssigned: true,
            },
            create: {
              person: {
                connect: {
                  registrantId: person.registrantId,
                },
              },
              role: wcifRoleToAttendanceRole(
                assignment.assignmentCode,
              ) as StaffRole,
              groupId: group.activityCode,
              isAssigned: true,
            },
          }),
        );
      });
    });
    await this.prisma.$transaction(transactions);
    await this.prisma.$transaction(activitiesTransactions);
    await this.prisma.competition.updateMany({
      where: { wcaId },
      data: {
        name: wcifPublic.name,
        countryIso2: wcifPublic.countryIso2,
        wcif: wcifPublic,
      },
    });
  }

  async getCompetitionInfo() {
    const competition = await this.prisma.competition.findFirst({
      select: {
        id: true,
        name: true,
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

  async getActivitiesWithRealEndTime(
    venueId: number,
    roomId: number,
    date: Date,
  ) {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const activities = wcif.schedule.venues
      .find((venue: Venue) => venue.id === venueId)
      ?.rooms.find((room: WCIFRoom) => room.id === roomId)
      ?.activities.filter((a: Activity) => {
        if (new Date(a.startTime).getDay() === date.getDay()) {
          return true;
        }
      })
      .sort((a: Activity, b: Activity) => {
        if (new Date(a.startTime).getTime() < new Date(b.startTime).getTime()) {
          return -1;
        }
        if (new Date(a.startTime).getTime() > new Date(b.startTime).getTime()) {
          return 1;
        }
        return 0;
      });
    if (!activities) {
      return [];
    }
    const activitiesToReturn = [];
    const startTimeTransactions = [];
    const endTimeTransactions = [];
    activities.forEach((activity: Activity) => {
      startTimeTransactions.push(
        this.prisma.attempt.findFirst({
          where: {
            result: {
              roundId: activity.activityCode,
            },
          },
          orderBy: {
            solvedAt: 'asc',
          },
          include: {
            result: true,
          },
        }),
      );
    });
    activities.forEach((activity: Activity) => {
      endTimeTransactions.push(
        this.prisma.attempt.findFirst({
          where: {
            result: {
              roundId: activity.activityCode,
            },
          },
          orderBy: {
            solvedAt: 'desc',
          },
          include: {
            result: true,
          },
        }),
      );
    });
    const firstRoundAttempts = await this.prisma.$transaction(
      startTimeTransactions,
    );
    const lastRoundAttempts =
      await this.prisma.$transaction(endTimeTransactions);
    activities.forEach((activity: Activity) => {
      const firstAttempt = firstRoundAttempts.find(
        (a) => a?.result.roundId === activity.activityCode,
      );
      const lastAttempt = lastRoundAttempts.find(
        (a) => a?.result.roundId === activity.activityCode,
      );
      activitiesToReturn.push({
        ...activity,
        realStartTime: firstAttempt ? new Date(firstAttempt.solvedAt) : null,
        realEndTime:
          lastAttempt && lastAttempt.id !== firstAttempt.id
            ? new Date(lastAttempt.solvedAt)
            : null,
      });
    });
    return activitiesToReturn;
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
    await this.prisma.$transaction(transactions);
    await this.socketController.sendServerStatus();
    return {
      message: 'Rooms updated',
    };
  }

  async getCompetitionStatistics() {
    const allAttempts = await this.prisma.attempt.count();
    const attemptsEnteredManually = await this.prisma.attempt.count({
      where: {
        sessionId: null,
      },
    });
    return {
      allAttempts,
      attemptsEnteredManually,
    };
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
      return {
        message: 'Competition not found',
        status: 404,
        error: true,
      };
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
        sendingResultsFrequency: dto.sendingResultsFrequency,
      },
    });
  }

  async getDevicesSettings() {
    return this.prisma.competition.findFirst({
      select: {
        id: true,
        shouldUpdateDevices: true,
        wifiSsid: true,
        wifiPassword: true,
      },
    });
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
    await this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        shouldUpdateDevices: data.shouldUpdateDevices,
        wifiSsid: data.wifiSsid,
        wifiPassword: data.wifiPassword,
      },
    });
    await this.socketController.sendServerStatus();
    return {
      message: 'Devices settings updated',
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkIfGroupShouldBeChanged() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      return;
    }
    if (
      competition.sendingResultsFrequency ===
      SendingResultsFrequency.EVERY_5_MINUTES
    ) {
      this.sendResultsToWcaLive();
    }
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

  async sendResultsToWcaLive() {
    const rooms = await this.prisma.room.findMany();
    for (const room of rooms) {
      if (room.currentGroupId) {
        const roundId = room.currentGroupId.split('-g')[0];
        const results = await this.resultService.getAllResultsByRound(roundId);
        await this.wcaService.enterRoundToWcaLive(results);
      }
    }
  }
}
