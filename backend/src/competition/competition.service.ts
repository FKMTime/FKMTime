import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Attempt,
  AttemptStatus,
  HardwareVersion,
  SendingResultsFrequency,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import {
  getAttemptsWaitingForExtra,
  isRedoNotStarted,
} from 'src/result/helpers';
import { ResultService } from 'src/result/result.service';
import { getOfficialResultsDestination } from 'src/results-destination';
import {
  getLocales,
  getStationTranslations,
} from 'src/translations/translations';
import { LIVE_LOOKUP_TTL_MS, TtlCache } from 'src/ttl-cache';
import {
  getFirstGroupInRoom,
  getNextGroupInRoom,
  isSameDay,
} from 'src/wcif-helpers';
import {
  Activity,
  Competition,
  Event,
  Room as WCIFRoom,
  Venue,
} from 'wcif-helpers';
import {
  getActivityInfoFromSchedule,
  getActivityInfoFromScheduleWithRoom,
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { eventsData, isUnofficialEvent } from '../events';
import { SocketController } from '../socket/socket.controller';
import { WcaService } from '../wca/wca.service';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import { getIntegratedLiveConnectionState } from './integratedLiveConnection.service';

const autoSetupSettingsSelect = {
  id: true,
  wifiSsid: true,
  wifiPassword: true,
  mdns: true,
  wsUrl: true,
};

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
  // Last heartbeat of every panel running auto setup, by socket id. It stays
  // on until the last one stops, so nobody's screen says on while it is off.
  private autoSetupHeartbeats = new Map<string, number>();
  // The stored WCIF for live solving updates. Callers only read it, so it is
  // shared rather than copied.
  private wcifCache = new TtlCache<'wcif', Competition>(LIVE_LOOKUP_TTL_MS);

  private get autoSetup() {
    return this.autoSetupHeartbeats.size > 0;
  }

  private async hasWifiDetails() {
    const competition = await this.prisma.competition.findFirst({
      select: autoSetupSettingsSelect,
    });
    return Boolean(competition?.wifiSsid && competition?.wifiPassword);
  }

  async handleAutoSetupHeartbeat(clientId: string) {
    if (!this.autoSetup && !(await this.hasWifiDetails())) {
      return;
    }

    const wasRunning = this.autoSetup;
    this.autoSetupHeartbeats.set(clientId, Date.now());

    if (!wasRunning) {
      await this.socketController.sendServerStatus();
    }
  }

  async stopAutoSetup(clientId: string) {
    if (this.autoSetupHeartbeats.delete(clientId) && !this.autoSetup) {
      await this.socketController.sendServerStatus();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkHeartbeat() {
    const wasRunning = this.autoSetup;
    const now = Date.now();
    for (const [clientId, lastHeartbeat] of this.autoSetupHeartbeats) {
      if (now - lastHeartbeat > 10000) {
        this.autoSetupHeartbeats.delete(clientId);
      }
    }

    if (wasRunning && !this.autoSetup) {
      await this.socketController.sendServerStatus();
    }
  }

  async getCompetitionInfo() {
    const competition = await this.prisma.competition.findFirst({
      select: {
        id: true,
        name: true,
        wcaId: true,
        countryIso2: true,
        wcif: true,
        useFkmTimeDevices: true,
        soundEnabled: true,
      },
    });
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    return competition;
  }

  /** The stored WCIF, cached; callers must not mutate it */
  async getWcifCached() {
    return this.wcifCache.getOrLoad(
      'wcif',
      async () =>
        (await this.getCompetitionInfo()).wcif as unknown as Competition,
    );
  }

  invalidateWcifCache() {
    this.wcifCache.clear();
  }

  async getInfoForLoginPage() {
    const competition = await this.prisma.competition.findFirst({
      select: {
        id: true,
        name: true,
        wcaId: true,
        countryIso2: true,
        useFkmTimeDevices: true,
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
        if (isSameDay(new Date(a.startTime), date)) {
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
            NOT: {
              sessionId: null,
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
            NOT: {
              sessionId: null,
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

  async getCompetitionSettings() {
    // The connection's tokens never leave the backend
    const competition = await this.prisma.competition.findFirst({
      omit: { wcaLiveRefreshToken: true },
    });
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const { wcaLiveAccessToken, ...settings } = competition;
    return {
      ...settings,
      officialResultsDestination: getOfficialResultsDestination(competition),
      integratedLiveConnection: getIntegratedLiveConnectionState({
        wcaLiveAccessToken,
        wcaLiveConnectionBrokenAt: competition.wcaLiveConnectionBrokenAt,
      }),
      hilTesting: this.socketController.hilRunning(),
    };
  }

  /** The panel's competition data, with where official results go */
  async getCompetitionForPanel() {
    const info = await this.getCompetitionInfo();
    const destinationInput = await this.prisma.competition.findFirst({
      select: {
        wcaScoretakingSoftware: true,
        scoretakingToken: true,
        wcaLiveAccessToken: true,
        wcaLiveConnectionBrokenAt: true,
      },
    });
    return {
      ...info,
      officialResultsDestination:
        getOfficialResultsDestination(destinationInput),
      integratedLiveConnection:
        getIntegratedLiveConnectionState(destinationInput),
    };
  }

  /**
   * Reads the competition's scoretaking software from the WCA website, which
   * decides where official results go (SPEC-006). A switch tells the panel
   * and sends every entered result to the new destination.
   */
  async refreshWcaScoretakingSoftware() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const software = await this.wcaService.getScoretakingSoftware(
      competition.wcaId,
    );
    if (software === null) {
      // The WCA couldn't be reached: keep the last value
      return this.scoretakingStatus(competition);
    }
    const updated = await this.prisma.competition.update({
      where: { id: competition.id },
      data: {
        wcaScoretakingSoftware: software,
        wcaScoretakingCheckedAt: new Date(),
      },
    });
    const previous = competition.wcaScoretakingSoftware;
    // The first read only replaces the guess made before it
    if (previous !== null && previous !== software) {
      this.logger.log(
        `The WCA scoretaking software changed from ${previous} to ${software}`,
      );
      this.appGateway.handleScoretakingSoftwareChanged(
        getOfficialResultsDestination(updated),
      );
      if (updated.sendingResultsFrequency !== SendingResultsFrequency.NEVER) {
        await this.sendAllOfficialRounds();
      }
    }
    return this.scoretakingStatus(updated);
  }

  private scoretakingStatus(competition: {
    wcaScoretakingSoftware: string | null;
    wcaScoretakingCheckedAt: Date | null;
    scoretakingToken: string | null;
  }) {
    return {
      wcaScoretakingSoftware: competition.wcaScoretakingSoftware,
      wcaScoretakingCheckedAt: competition.wcaScoretakingCheckedAt,
      officialResultsDestination: getOfficialResultsDestination(competition),
    };
  }

  /** After a switch, so nothing entered before it is missing there */
  private async sendAllOfficialRounds() {
    const rounds = await this.prisma.result.findMany({
      distinct: ['roundId'],
      select: { roundId: true },
    });
    for (const { roundId } of rounds) {
      if (isUnofficialEvent(roundId.split('-')[0])) continue;
      try {
        await this.resultService.sendRound(roundId);
      } catch (e) {
        this.logger.error(`Sending ${roundId} after the switch failed: ${e}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshWcaScoretakingSoftwareOnSchedule() {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) return;
    try {
      await this.refreshWcaScoretakingSoftware();
    } catch (e) {
      this.logger.error(`Reading the WCA scoretaking software failed: ${e}`);
    }
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
        const nextRound = event.rounds.find(
          (r) => r.id === `${event.id}-r${+round.id.split('-r')[1] + 1}`,
        );
        rounds.push({
          id: round.id,
          number: round.id.split('-r')[1],
          name: `${eventName} - Round ${round.id.split('-r')[1]}`,
          eventId: event.id,
          format: round.format,
          timeLimit: round.timeLimit,
          cutoff: round.cutoff,
          linkedRounds: round.linkedRounds,
          nextRoundParticipationRuleset: nextRound?.participationRuleset,
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
    const devices = await this.prisma.device.findMany({
      where: { retiredAt: null },
      omit: { signKey: false },
    });
    return {
      shouldUpdate: competition.shouldUpdateDevices,
      devices: devices.map((d) => ({
        espId: d.espId,
        signKey: d.signKey,
      })),
      translations: getStationTranslations(),
      defaultLocale: competition.defaultLocale,
      fkmToken: competition.fkmToken,
      secureRfid: competition.secureRfid,
      soundEnabled: competition.soundEnabled,
      autoSetup: this.autoSetup,
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
      omit: { wcaLiveAccessToken: true, wcaLiveRefreshToken: true },
      data: {
        scoretakingToken: dto.scoretakingToken,
        scoretakingTokenUpdatedAt:
          competition.scoretakingToken !== dto.scoretakingToken
            ? new Date()
            : competition.scoretakingTokenUpdatedAt,
        cubingContestsToken: dto.cubingContestsToken,
        sendingResultsFrequency: dto.sendingResultsFrequency,
        shouldChangeGroupsAutomatically: dto.shouldChangeGroupsAutomatically,
        useFkmTimeDevices: dto.useFkmTimeDevices,
      },
    });
  }

  async getDevicesSettings() {
    return this.prisma.competition.findFirst({
      select: autoSetupSettingsSelect,
    });
  }

  async getAvailableLocales() {
    return getLocales();
  }

  async getAutoSetupSettings() {
    const competition = await this.prisma.competition.findFirst({
      select: autoSetupSettingsSelect,
    });
    return {
      ssid: competition.wifiSsid,
      psk: competition.wifiPassword,
      data: {
        mdns: competition.mdns,
        wsUrl: competition.wsUrl,
      },
    };
  }

  async updateDevicesSettings(id: string, data: UpdateDevicesSettingsDto) {
    this.socketController.toggleHil(data.hilTesting);
    await this.prisma.competition.update({
      where: {
        id: id,
      },
      data: {
        shouldUpdateDevices: data.shouldUpdateDevices,
        wifiSsid: data.wifiSsid,
        wifiPassword: data.wifiPassword,
        mdns: data.mdns,
        wsUrl: data.wsUrl,
        defaultLocale: data.defaultLocale,
        secureRfid: data.secureRfid,
        soundEnabled: data.soundEnabled,
        buzzerVolume: data.buzzerVolume ?? null,
      },
    });

    await this.socketController.sendServerStatus();
    await this.sendBuzzerVolume();
    return {
      message: 'Devices settings updated',
    };
  }

  // The volume reaches a station only while it is connected, so it is sent
  // again whenever one connects. Without espId it goes to every V4 station.
  async sendBuzzerVolume(espId?: number) {
    const competition = await this.prisma.competition.findFirst({
      select: { buzzerVolume: true },
    });
    if (competition?.buzzerVolume == null) return;

    const devices = await this.prisma.device.findMany({
      where: {
        espId: espId ?? { not: null },
        hwVersion: HardwareVersion.V4,
        retiredAt: null,
      },
      select: { espId: true },
    });
    if (devices.length === 0) return;

    this.socketController.sendDeviceSettings(
      devices.map((d) => d.espId),
      competition.buzzerVolume,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkIfGroupShouldBeChanged() {
    this.logger.log('Checking if group should be changed');
    const competition = await this.prisma.competition.findFirst();
    if (!competition || !competition.useFkmTimeDevices) {
      return;
    }
    if (
      competition.sendingResultsFrequency ===
      SendingResultsFrequency.EVERY_5_MINUTES
    ) {
      this.sendActiveRounds();
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const rooms = await this.prisma.room.findMany({
      include: {
        devices: true,
      },
    });
    for (const room of rooms) {
      let currentGroupIdInSchedule = '';
      if (room.currentGroupIds.length > 1) {
        continue;
      }
      const currentGroupId = room.currentGroupIds[0];
      const activity: Activity | null = getActivityInfoFromSchedule(
        currentGroupId,
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
            roundId: currentGroupId.split('-g')[0],
          },
        },
        orderBy: {
          solvedAt: 'desc',
        },
      });
      if (!lastAttemptEntered) {
        continue;
      }
      const isLastAttemptMoreThan5MinutesAgo =
        new Date().getTime() - new Date(lastAttemptEntered.solvedAt).getTime() >
        300000;
      if (
        (currentGroupIdInSchedule !== currentGroupId &&
          currentGroupIdInSchedule !== '') ||
        isLastAttemptMoreThan5MinutesAgo
      ) {
        if (competition.shouldChangeGroupsAutomatically) {
          await this.checkIfGroupCanBeChanged(room.id);
        } else {
          const message = `Group in room ${room.name} should be changed, but automatic group change is disabled.`;
          this.appGateway.server
            .to(`competition`)
            .emit('groupShouldBeChanged', {
              message: message,
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
    if (room.currentGroupIds.length > 1) {
      return;
    }
    const currentGroupId = room.currentGroupIds[0];

    const roundId = currentGroupId.split('-g')[0];

    const resultsFromDb =
      await this.resultService.getAllResultsByRound(roundId);

    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const roundInfo = getRoundInfoFromWcif(currentGroupId.split('-g')[0], wcif);
    const maxAttempts = getNumberOfAttemptsForRound(
      currentGroupId.split('-g')[0],
      wcif,
    );
    // Stations can't take attempts for an earlier round, so the last group
    // has to wait for any redo, while earlier ones can leave it to the next
    const hasNextGroup = !!getNextGroupInRoom(currentGroupId, room.name, wcif);
    const freshSetGrants = await this.prisma.extraGrant.findMany({
      where: {
        useFreshSet: true,
        restoredAt: null,
        result: { roundId, removedAt: null },
      },
      select: { id: true },
    });
    const freshSetGrantIds = freshSetGrants.map((grant) => grant.id);
    let finished = true;
    for (const result of resultsFromDb) {
      const attempts = result.attempts as Attempt[];
      if (!hasNextGroup && getAttemptsWaitingForExtra(attempts).length > 0) {
        finished = false;
        break;
      }
      if (hasNextGroup && isRedoNotStarted(attempts, freshSetGrantIds)) {
        continue;
      }
      const { results } = this.wcaService.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      if (results[0].attempts.length === 0) continue;
      if (results[0].attempts.length !== maxAttempts) {
        if (roundInfo.cutoff) {
          if (
            results[0].attempts.some(
              (a) => a.result < roundInfo.cutoff.resultValue && a.result > 0,
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
      await this.changeGroup(room.id, currentGroupId);
    } else {
      const message = `Group in room ${room.name} should be changed, but not all results are entered.`;
      this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
        message: message,
      });
      this.logger.log(message);
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
    const nextGroup = getNextGroupInRoom(currentGroupId, room.name, wcif);

    if (nextGroup) {
      await this.prisma.room.update({
        where: {
          id: roomId,
        },
        data: {
          currentGroupIds: [nextGroup.activityCode],
        },
      });
      const message = `Group in room ${room.name} was changed to ${nextGroup.activityCode}`;
      this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
        message: message,
      });
      this.logger.log(message);
    } else {
      const endTime = new Date(roundInfoFromSchedule.endTime);
      let nextRoundActivity: Activity | null = null;
      wcif.schedule.venues.forEach((venue: Venue) => {
        const r = venue.rooms.find((item: WCIFRoom) => item.name === room.name);
        r.activities.forEach((a: Activity) => {
          if (
            isSameDay(new Date(a.startTime), endTime) &&
            new Date(a.startTime).getTime() >= endTime.getTime() &&
            !a.activityCode.startsWith('other') &&
            (!nextRoundActivity ||
              new Date(a.startTime).getTime() <
                new Date(nextRoundActivity.startTime).getTime())
          ) {
            nextRoundActivity = a;
          }
        });
      });
      if (nextRoundActivity) {
        const sortedGroups = nextRoundActivity.childActivities.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        const nextGroupId =
          sortedGroups.length > 0
            ? sortedGroups[0].activityCode
            : nextRoundActivity.activityCode + '-g1';
        await this.prisma.room.update({
          where: {
            id: roomId,
          },
          data: {
            currentGroupIds: [nextGroupId],
          },
        });
        const message = `Group in room ${room.name} was changed to ${nextGroupId}`;
        this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
          message: message,
        });
        this.logger.log(message);
      }
    }
  }

  /** Steps from the given groups, or the room's saved ones without them */
  async getNextGroupsFromScheduleForRoom(roomId: string, groupIds?: string[]) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new HttpException('Room not found', 404);
    }
    const currentGroups = groupIds ?? room.currentGroupIds;
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    if (currentGroups.length === 0) {
      const firstGroup = getFirstGroupInRoom(room.name, wcif);
      return firstGroup ? [firstGroup] : [];
    }
    const nextGroups = [];
    if (currentGroups.length === 1) {
      const currentRoundId = currentGroups[0].split('-g')[0];
      const roundInfoFromSchedule: Activity =
        getActivityInfoFromScheduleWithRoom(currentRoundId, room.name, wcif);
      if (!roundInfoFromSchedule) return [];
      const sortedActivities = roundInfoFromSchedule.childActivities.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      const currentIndex = sortedActivities.findIndex(
        (a) => a.activityCode === currentGroups[0],
      );
      const nextGroup =
        currentIndex !== -1 ? sortedActivities[currentIndex + 1] : null;

      if (nextGroup) {
        nextGroups.push(nextGroup.activityCode);
      } else {
        const endTime = new Date(roundInfoFromSchedule.endTime);
        let nextRoundActivity: Activity | null = null;
        wcif.schedule.venues.forEach((venue: Venue) => {
          const r = venue.rooms.find(
            (item: WCIFRoom) => item.name === room.name,
          );
          r.activities.forEach((a: Activity) => {
            if (
              isSameDay(new Date(a.startTime), endTime) &&
              new Date(a.startTime).getTime() >= endTime.getTime() &&
              !a.activityCode.startsWith('other') &&
              (!nextRoundActivity ||
                new Date(a.startTime).getTime() <
                  new Date(nextRoundActivity.startTime).getTime())
            ) {
              nextRoundActivity = a;
            }
          });
        });
        if (nextRoundActivity) {
          const sortedGroups = nextRoundActivity.childActivities.sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );
          const nextGroupId =
            sortedGroups.length > 0
              ? sortedGroups[0].activityCode
              : nextRoundActivity.activityCode + '-g1';
          nextGroups.push(nextGroupId);
        }
      }
    } else {
      for (const currentGroupId of currentGroups) {
        const roundId = currentGroupId.split('-g')[0];
        const roundInfoFromSchedule: Activity =
          getActivityInfoFromScheduleWithRoom(roundId, room.name, wcif);
        if (!roundInfoFromSchedule) return [];
        const sortedActivities = roundInfoFromSchedule.childActivities.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        const currentIndex = sortedActivities.findIndex(
          (a) => a.activityCode === currentGroupId,
        );
        const nextGroup =
          currentIndex !== -1 ? sortedActivities[currentIndex + 1] : null;

        if (nextGroup) {
          nextGroups.push(nextGroup.activityCode);
        } else {
          const endTime = new Date(roundInfoFromSchedule.endTime);
          let nextRoundActivity: Activity | null = null;
          wcif.schedule.venues.forEach((venue: Venue) => {
            const r = venue.rooms.find(
              (item: WCIFRoom) => item.name === room.name,
            );
            r.activities.forEach((a: Activity) => {
              if (
                isSameDay(new Date(a.startTime), endTime) &&
                new Date(a.startTime).getTime() >= endTime.getTime() &&
                !a.activityCode.startsWith('other') &&
                (!nextRoundActivity ||
                  new Date(a.startTime).getTime() <
                    new Date(nextRoundActivity.startTime).getTime())
              ) {
                nextRoundActivity = a;
              }
            });
          });
          if (nextRoundActivity) {
            const sortedGroups = nextRoundActivity.childActivities.sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            );
            const nextGroupId =
              sortedGroups.length > 0
                ? sortedGroups[0].activityCode
                : nextRoundActivity.activityCode + '-g1';
            nextGroups.push(nextGroupId);
          }
        }
      }
    }
    return nextGroups;
  }

  /** Steps from the given groups, or the room's saved ones without them */
  async getPreviousGroupsFromScheduleForRoom(
    roomId: string,
    groupIds?: string[],
  ) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new HttpException('Room not found', 404);
    }
    const currentGroups = groupIds ?? room.currentGroupIds;
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const previousGroups = [];
    if (currentGroups.length === 1) {
      const currentRoundId = currentGroups[0].split('-g')[0];
      const roundInfoFromSchedule: Activity =
        getActivityInfoFromScheduleWithRoom(currentRoundId, room.name, wcif);
      if (!roundInfoFromSchedule) return [];
      const sortedActivities = roundInfoFromSchedule.childActivities.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      const currentIndex = sortedActivities.findIndex(
        (a) => a.activityCode === currentGroups[0],
      );
      const previousGroup =
        currentIndex !== -1 ? sortedActivities[currentIndex - 1] : null;

      if (previousGroup) {
        previousGroups.push(previousGroup.activityCode);
      } else {
        const startTime = new Date(roundInfoFromSchedule.startTime);
        let previousRoundActivity: Activity | null = null;
        wcif.schedule.venues.forEach((venue: Venue) => {
          const r = venue.rooms.find(
            (item: WCIFRoom) => item.name === room.name,
          );
          r.activities.forEach((a: Activity) => {
            if (
              isSameDay(new Date(a.endTime), startTime) &&
              new Date(a.endTime).getTime() <= startTime.getTime() &&
              !a.activityCode.startsWith('other') &&
              (!previousRoundActivity ||
                new Date(a.endTime).getTime() >
                  new Date(previousRoundActivity.endTime).getTime())
            ) {
              previousRoundActivity = a;
            }
          });
        });
        if (previousRoundActivity) {
          const sortedGroups = previousRoundActivity.childActivities.sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );
          const previousGroupId =
            sortedGroups.length > 0
              ? sortedGroups[sortedGroups.length - 1].activityCode
              : previousRoundActivity.activityCode + '-g1';
          previousGroups.push(previousGroupId);
        }
      }
    } else {
      for (const currentGroupId of currentGroups) {
        const roundId = currentGroupId.split('-g')[0];
        const roundInfoFromSchedule: Activity =
          getActivityInfoFromScheduleWithRoom(roundId, room.name, wcif);
        if (!roundInfoFromSchedule) return [];
        const sortedActivities = roundInfoFromSchedule.childActivities.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        const currentIndex = sortedActivities.findIndex(
          (a) => a.activityCode === currentGroupId,
        );
        const previousGroup =
          currentIndex !== -1 ? sortedActivities[currentIndex - 1] : null;

        if (previousGroup) {
          previousGroups.push(previousGroup.activityCode);
        } else {
          const startTime = new Date(roundInfoFromSchedule.startTime);
          let previousRoundActivity: Activity | null = null;
          wcif.schedule.venues.forEach((venue: Venue) => {
            const r = venue.rooms.find(
              (item: WCIFRoom) => item.name === room.name,
            );
            r.activities.forEach((a: Activity) => {
              if (
                isSameDay(new Date(a.endTime), startTime) &&
                new Date(a.endTime).getTime() <= startTime.getTime() &&
                !a.activityCode.startsWith('other') &&
                (!previousRoundActivity ||
                  new Date(a.endTime).getTime() >
                    new Date(previousRoundActivity.endTime).getTime())
              ) {
                previousRoundActivity = a;
              }
            });
          });
          if (previousRoundActivity) {
            const sortedGroups = previousRoundActivity.childActivities.sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            );
            const previousGroupId =
              sortedGroups.length > 0
                ? sortedGroups[sortedGroups.length - 1].activityCode
                : previousRoundActivity.activityCode + '-g1';
            previousGroups.push(previousGroupId);
          }
        }
      }
    }
    return previousGroups;
  }

  /** Sends the rounds in progress, for the "every 5 minutes" setting */
  async sendActiveRounds() {
    const rooms = await this.prisma.room.findMany();
    const roundIds = new Set(
      rooms.flatMap((room) =>
        room.currentGroupIds.map((groupId) => groupId.split('-g')[0]),
      ),
    );
    for (const roundId of roundIds) {
      try {
        await this.resultService.sendRound(roundId);
      } catch (e) {
        this.logger.error(`Sending ${roundId} failed: ${e}`);
      }
    }
  }
}
