import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttemptStatus, SendingResultsFrequency } from '@prisma/client';
import { Activity, Event, Room as WCIFRoom, Venue } from '@wca/helpers';
import { AppGateway } from 'src/app.gateway';
import { ResultService } from 'src/result/result.service';
import {
  getActivityInfoFromSchedule,
  getActivityInfoFromScheduleWithRoom,
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { eventsData } from '../events';
import { SocketController } from '../socket/socket.controller';
import { WcaService } from '../wca/wca.service';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';

@Injectable()
export class CompetitionService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    private readonly resultService: ResultService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
  ) {}

  private logger = new Logger(CompetitionService.name);

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

  async getCompetitionStatistics() {
    const allAttempts = await this.prisma.attempt.count();
    const attemptsEnteredManually = await this.prisma.attempt.count({
      where: {
        sessionId: null,
      },
    });
    //This is there until we're still using scorecards ;D
    const scorecardsCount = await this.prisma.result.count();
    const personsCompeted = await this.prisma.person.count({
      where: {
        Result: {
          some: {},
        },
      },
    });
    return {
      allAttempts,
      attemptsEnteredManually,
      scorecardsCount,
      personsCompeted,
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
    return {
      shouldUpdate: competition.shouldUpdateDevices,
      rooms: rooms.map((room) => {
        let useInspection = true;
        if (room.currentGroupId) {
          const eventId = room.currentGroupId.split('-')[0];
          useInspection = eventsData.find(
            (e) => e.id === eventId,
          ).useInspection;
        }
        return {
          id: room.id,
          name: room.name,
          useInspection: useInspection,
          secondaryText: this.computeSecondaryText(room.currentGroupId),
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
        cubingContestsToken: dto.cubingContestsToken,
        sendingResultsFrequency: dto.sendingResultsFrequency,
        shouldChangeGroupsAutomatically: dto.shouldChangeGroupsAutomatically,
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
    this.logger.log('Checking if group should be changed');
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
    for (const room of rooms) {
      let currentGroupIdInSchedule = '';
      const activity: Activity | null = getActivityInfoFromSchedule(
        room.currentGroupId,
        wcif,
      );
      if (!activity) {
        continue;
      }
      const startTime = new Date(activity.startTime).getTime();
      const endTime = new Date(activity.endTime).getTime();
      const now = new Date().getTime();
      if (startTime <= now && now <= endTime) {
        currentGroupIdInSchedule = activity.activityCode;
      }
      const lastAttemptEntered = await this.prisma.attempt.findFirst({
        where: {
          result: {
            roundId: room.currentGroupId.split('-g')[0],
          },
        },
        orderBy: {
          solvedAt: 'desc',
        },
      });
      const isLastAttemptMoreThan5MinutesAgo =
        new Date().getTime() - new Date(lastAttemptEntered.solvedAt).getTime() >
        300000;
      if (
        (currentGroupIdInSchedule !== room.currentGroupId &&
          currentGroupIdInSchedule !== '') ||
        isLastAttemptMoreThan5MinutesAgo
      ) {
        if (competition.shouldChangeGroupsAutomatically) {
          await this.checkIfGroupCanBeChanged(room.id);
        } else {
          this.appGateway.server
            .to(`competition`)
            .emit('groupShouldBeChanged', {
              message: `Group in room ${room.name} should be changed, but automatic group change is disabled.`,
            });
        }
      }
    }
  }

  async checkIfGroupCanBeChanged(roomId: string) {
    this.logger.log(`Checking if group in room ${roomId} can be changed`);
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
      },
    });
    const roundId = room.currentGroupId.split('-g')[0];

    const resultsFromDb =
      await this.resultService.getAllResultsByRound(roundId);

    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const roundInfo = getRoundInfoFromWcif(
      room.currentGroupId.split('-g')[0],
      wcif,
    );
    const maxAttempts = getNumberOfAttemptsForRound(
      room.currentGroupId.split('-g')[0],
      wcif,
    );
    let finished = true;
    for (const result of resultsFromDb) {
      const { results } = this.wcaService.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      if (results[0].attempts.length !== maxAttempts) {
        if (roundInfo.cutoff) {
          if (
            results[0].attempts.some(
              (a) => a.result < roundInfo.cutoff.attemptResult && a.result > 0,
            )
          ) {
            finished = false;
          }
        } else {
          finished = false;
        }
      }
      if (
        result.attempts.some((a) => a.status === AttemptStatus.UNRESOLVED) ||
        result.attempts.some(
          (a) => a.status === AttemptStatus.EXTRA_GIVEN && !a.replacedBy,
        )
      ) {
        finished = false;
      }
      if (!finished) {
        break;
      }
    }
    if (finished) {
      this.logger.log(`Group in room ${room.name} can be changed`);
      await this.changeGroup(room.id, room.currentGroupId);
    } else {
      this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
        message: `Group in room ${room.name} should be changed, but not all results are entered.`,
      });
      this.logger.log(
        `Group in room ${room.name} should be changed, but not all results are entered.`,
      );
    }
  }

  async changeGroup(roomId: string, currentGroupId: string) {
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
      },
    });
    if (!room) return;
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const currentRoundId = currentGroupId.split('-g')[0];
    const roundInfoFromSchedule: Activity = getActivityInfoFromScheduleWithRoom(
      currentRoundId,
      room.name,
      wcif,
    );
    if (!roundInfoFromSchedule) return;
    const potentialNextGroupId =
      currentRoundId + '-g' + (+currentGroupId.split('-g')[1] + 1);
    if (
      roundInfoFromSchedule.childActivities.some(
        (a) => a.activityCode === potentialNextGroupId,
      )
    ) {
      await this.prisma.room.update({
        where: {
          id: roomId,
        },
        data: {
          currentGroupId: potentialNextGroupId,
        },
      });
      this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
        message: `Group in room ${room.name} was changed to ${potentialNextGroupId}`,
      });
      this.logger.log(
        `Group in room ${roomId} changed to ${potentialNextGroupId}`,
      );
    } else {
      const endTime = new Date(roundInfoFromSchedule.endTime);
      let nextRoundId = '';
      let nextRoundStartTime = new Date();
      wcif.schedule.venues.forEach((venue: Venue) => {
        const r = venue.rooms.find((item: WCIFRoom) => item.name === room.name);
        r.activities.forEach((a: Activity) => {
          if (
            new Date(a.startTime).getDay() === endTime.getDay() &&
            new Date(a.startTime).getTime() >= endTime.getTime() &&
            new Date(a.startTime).getTime() <= nextRoundStartTime.getTime() &&
            !a.activityCode.startsWith('other')
          ) {
            nextRoundId = a.activityCode;
            nextRoundStartTime = new Date(a.startTime);
          }
        });
      });
      if (nextRoundId) {
        const nextGroupId = nextRoundId + '-g1';
        await this.prisma.room.update({
          where: {
            id: roomId,
          },
          data: {
            currentGroupId: nextGroupId,
          },
        });
        this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
          message: `Group in room ${room.name} was changed to ${nextGroupId}`,
        });
        this.logger.log(`Group in room ${room.name} changed to ${nextGroupId}`);
      }
    }
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

  computeSecondaryText(groupId?: string) {
    if (!groupId) return '';
    const roundId = groupId.split('-g')[0];
    const eventId = roundId.split('-r')[0];
    const roundNumber = roundId.split('-r')[1];
    const eventData = eventsData.find((e) => e.id === eventId);
    return `${eventData.shortName ? eventData.shortName : eventData.name} - R${roundNumber}`;
  }
}
