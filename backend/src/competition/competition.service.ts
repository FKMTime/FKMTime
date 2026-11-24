import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppGateway } from 'src/app.gateway';
import { ResultService } from 'src/result/result.service';
import { getOfficialResultsDestination } from 'src/results-destination';
import {
  getLocales,
  getStationTranslations,
} from 'src/translations/translations';
import { LIVE_LOOKUP_TTL_MS, TtlCache } from 'src/ttl-cache';
import { getNextGroupInRoom, isSameDay } from 'src/wcif-helpers';
import {
  Activity,
  Competition,
  Event,
  getActivityInfoFromScheduleWithRoom,
  Room as WCIFRoom,
  Round,
  Venue,
} from 'wcif-helpers';
import {
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { eventsData, isUnofficialEvent } from '../events';
import {
  Attempt,
  HardwareVersion,
  SendingResultsFrequency,
} from '../generated/prisma/client';
import { SocketController } from '../socket/socket.controller';
import { WcaService } from '../wca/wca.service';
import { AUTO_SETUP_DURATION_MS } from './autoSetup';
import { UpdateCompetitionDto } from './dto/updateCompetition.dto';
import { UpdateDevicesSettingsDto } from './dto/updateDevicesSettings.dto';
import {
  canLeaveGroup,
  getGroupStatus as getGroupStatusFromResults,
  getMovesOnAt,
  getNextGroupsInRoom,
  GroupState,
  GroupStatus,
  isGroupQuiet,
  planNextGroups,
} from './groupChange';
import { calculateGroupProgress, getGroupCompetitorIds } from './groupProgress';
import { getIntegratedLiveConnectionState } from './integratedLiveConnection.service';
import { RoomsService } from './rooms.service';
import { loadRoundStates, roundIdOf, RoundState } from './roundState';

/** How long a room's checks after attempts wait to take in a burst */
export const GROUP_CHANGE_CHECK_DELAY_MS = 5_000;
/** How often the periodic group change check runs (the cron below) */
const GROUP_CHANGE_CRON_INTERVAL_MS = 5 * 60 * 1000;

/** What a running group still waits for before the room can move on */
export interface GroupWait {
  state: GroupState;
  /** Assigned or present, not started, and not marked as not coming */
  notStarted: {
    /** Null when there's no attendance row to mark them on */
    personId: string | null;
    name: string;
  }[];
  solving: number;
  incidents: number;
  extras: number;
  /** When the room moves on by itself if nobody else solves; null if not */
  movesOnAt: string | null;
}

type GroupCheckTrigger = 'event' | 'cron';

const autoSetupSettingsSelect = {
  id: true,
  wifiSsid: true,
  wifiPassword: true,
  mdns: true,
  wsUrl: true,
};

@Injectable()
export class CompetitionService implements OnModuleDestroy {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
  ) {}

  private logger = new Logger(CompetitionService.name);
  // Group change checks after attempts: the pending one per room, and the
  // one running, which a later check waits for
  private groupCheckTimers = new Map<string, NodeJS.Timeout>();
  private groupCheckRuns = new Map<string, Promise<void>>();
  // Warnings already shown, as "roomId|groupId|kind", until the group changes
  private groupChangeWarnings = new Set<string>();
  // Switches auto setup off when its time is up; the deadline itself lives in
  // AppGateway, in memory only, so a restart always leaves it off
  private autoSetupTimeout: NodeJS.Timeout | null = null;
  // The stored WCIF for live solving updates. Callers only read it, so it is
  // shared rather than copied.
  private wcifCache = new TtlCache<'wcif', Competition>(LIVE_LOOKUP_TTL_MS);

  private get autoSetup() {
    return this.appGateway.autoSetupEndsAt !== null;
  }

  private async hasWifiDetails() {
    const competition = await this.prisma.competition.findFirst({
      select: autoSetupSettingsSelect,
    });
    return Boolean(competition?.wifiSsid && competition?.wifiPassword);
  }

  /** Switches auto setup on for AUTO_SETUP_DURATION_MS, or restarts the countdown */
  async startAutoSetup() {
    if (!(await this.hasWifiDetails())) {
      return;
    }

    const wasRunning = this.autoSetup;
    if (this.autoSetupTimeout) clearTimeout(this.autoSetupTimeout);
    this.autoSetupTimeout = setTimeout(
      () => void this.stopAutoSetup(),
      AUTO_SETUP_DURATION_MS,
    );
    this.appGateway.setAutoSetupEndsAt(Date.now() + AUTO_SETUP_DURATION_MS);

    if (!wasRunning) {
      await this.socketController.sendServerStatus();
    }
  }

  async stopAutoSetup() {
    if (this.autoSetupTimeout) clearTimeout(this.autoSetupTimeout);
    this.autoSetupTimeout = null;
    if (!this.autoSetup) {
      return;
    }
    this.appGateway.setAutoSetupEndsAt(null);
    await this.socketController.sendServerStatus();
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
    // A round's first and last solve from a station: when it really ran
    const attemptOfRound = (activity: Activity, solvedAt: 'asc' | 'desc') =>
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
          solvedAt,
        },
        include: {
          result: true,
        },
      });
    const firstRoundAttempts = await this.prisma.$transaction(
      activities.map((activity: Activity) => attemptOfRound(activity, 'asc')),
    );
    const lastRoundAttempts = await this.prisma.$transaction(
      activities.map((activity: Activity) => attemptOfRound(activity, 'desc')),
    );
    const activitiesToReturn = activities.map((activity: Activity) => {
      const firstAttempt = firstRoundAttempts.find(
        (a) => a?.result.roundId === activity.activityCode,
      );
      const lastAttempt = lastRoundAttempts.find(
        (a) => a?.result.roundId === activity.activityCode,
      );
      return {
        ...activity,
        realStartTime: firstAttempt?.solvedAt
          ? new Date(firstAttempt.solvedAt)
          : null,
        realEndTime:
          lastAttempt?.solvedAt && lastAttempt.id !== firstAttempt?.id
            ? new Date(lastAttempt.solvedAt)
            : null,
      };
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
    const destinationInput = await this.prisma.competition.findFirstOrThrow({
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

    const rounds: {
      id: string;
      number: string;
      name: string;
      eventId: string;
      format: Round['format'];
      timeLimit: Round['timeLimit'];
      cutoff: Round['cutoff'];
      linkedRounds?: Round['linkedRounds'];
      nextRoundParticipationRuleset?: Round['participationRuleset'];
    }[] = [];
    wcif.events.forEach((event: Event) => {
      event.rounds.forEach((round) => {
        const eventName =
          eventsData.find((e) => e.id === event.id)?.name ?? event.id;
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
    const competition = await this.prisma.competition.findFirstOrThrow({
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
        openRoundsAutomatically: dto.openRoundsAutomatically,
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
    const competition = await this.prisma.competition.findFirstOrThrow({
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
    // Not awaited; toggleHil never rejects, it logs its own failures
    void this.socketController.toggleHil(data.hilTesting);
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
      // Only stations with an espId were selected
      devices.flatMap((d) => d.espId ?? []),
      competition.buzzerVolume,
    );
  }

  /**
   * Called after anything that can finish a group: an attempt entered on a
   * station or by hand, or an incident resolved. Checks the rooms running
   * the round once things settle, instead of waiting for the periodic check.
   * Never throws: a failed check mustn't fail the attempt.
   */
  requestGroupChangeCheck(roundId: string) {
    this.prisma.room
      .findMany({ select: { id: true, currentGroupIds: true } })
      .then((rooms) => {
        for (const room of rooms) {
          if (room.currentGroupIds.some((g) => g.split('-g')[0] === roundId)) {
            this.scheduleRoomCheck(room.id);
          }
        }
      })
      .catch((e) =>
        this.logger.error(`Scheduling a group change check failed: ${e}`),
      );
  }

  /**
   * The first request opens a short window and later ones join it, so a burst
   * of attempts makes one check. A fixed window rather than a restarting one,
   * so a busy room is still checked.
   */
  private scheduleRoomCheck(roomId: string) {
    if (this.groupCheckTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      this.groupCheckTimers.delete(roomId);
      void this.runRoomCheck(roomId, 'event');
    }, GROUP_CHANGE_CHECK_DELAY_MS);
    timer.unref?.();
    this.groupCheckTimers.set(roomId, timer);
  }

  /** One check per room at a time; a later one waits for the earlier one */
  private runRoomCheck(roomId: string, trigger: GroupCheckTrigger) {
    const previous = this.groupCheckRuns.get(roomId) ?? Promise.resolve();
    const run = previous
      .then(() => this.checkIfGroupCanBeChanged(roomId, trigger))
      .catch((e) =>
        this.logger.error(`Group change check in room ${roomId} failed: ${e}`),
      );
    this.groupCheckRuns.set(roomId, run);
    void run.then(() => {
      if (this.groupCheckRuns.get(roomId) === run) {
        this.groupCheckRuns.delete(roomId);
      }
    });
    return run;
  }

  onModuleDestroy() {
    this.groupCheckTimers.forEach((timer) => clearTimeout(timer));
    this.groupCheckTimers.clear();
  }

  /**
   * The fallback for what the checks after each attempt can't see: groups
   * with no-shows (see canLeaveGroup), results removed or changed some other
   * way, and attempts entered while the backend was down.
   */
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
    const rooms = await this.prisma.room.findMany({ select: { id: true } });
    for (const room of rooms) {
      await this.runRoomCheck(room.id, 'cron');
    }
  }

  /**
   * Moves each of the room's groups that is over on to the room's next one.
   * Each group is judged on its own competitors, so in a room running
   * several groups one can move on while the others carry on.
   */
  async checkIfGroupCanBeChanged(
    roomId: string,
    trigger: GroupCheckTrigger = 'cron',
  ) {
    const competition = await this.prisma.competition.findFirst();
    if (!competition?.useFkmTimeDevices) return;
    // Right after an attempt there's nothing to do with the setting off; the
    // periodic check still tells the panel a group looks finished
    if (trigger === 'event' && !competition.shouldChangeGroupsAutomatically) {
      return;
    }
    const room = await this.prisma.room.findFirst({ where: { id: roomId } });
    if (!room || room.currentGroupIds.length === 0) return;
    this.forgetWarningsForOtherGroups(room.id, room.currentGroupIds);
    this.logger.log(`Checking if group in room ${room.name} can be changed`);

    const wcif = competition.wcif as unknown as Competition;
    const now = Date.now();
    const leaving: string[] = [];
    const stuck: string[] = [];
    const roundState = await loadRoundStates(this.prisma, [
      ...new Set(room.currentGroupIds.map(roundIdOf)),
    ]);
    for (const groupId of room.currentGroupIds) {
      const status = this.getGroupStatus(
        groupId,
        room.name,
        wcif,
        roundState(roundIdOf(groupId)),
      );
      const enteredAt = this.roomsService.getGroupEnteredAt(room.id, groupId);
      if (canLeaveGroup(status, trigger, now, enteredAt)) {
        leaving.push(groupId);
      } else if (
        trigger === 'cron' &&
        status.state !== 'notStarted' &&
        isGroupQuiet(status, enteredAt, now)
      ) {
        stuck.push(groupId);
      }
    }

    if (!competition.shouldChangeGroupsAutomatically) {
      for (const groupId of leaving) {
        this.warnOnce(
          room.id,
          groupId,
          'disabled',
          `Group in room ${room.name} should be changed, but automatic group change is disabled.`,
        );
      }
      return;
    }
    for (const groupId of stuck) {
      this.warnOnce(
        room.id,
        groupId,
        'notAllEntered',
        `Group in room ${room.name} should be changed, but not all results are entered.`,
      );
    }
    if (leaving.length > 0) {
      this.logger.log(`Group in room ${room.name} can be changed`);
      await this.changeGroup(room.id, leaving);
    }
  }

  /** Results entered and what each running group waits for, per room */
  async getRoomsProgress() {
    const [rooms, competition] = await Promise.all([
      this.prisma.room.findMany({
        select: { id: true, name: true, currentGroupIds: true },
      }),
      this.prisma.competition.findFirst(),
    ]);
    if (!competition) return [];
    const wcif = competition.wcif as unknown as Competition;
    const isAutomatic =
      competition.useFkmTimeDevices &&
      competition.shouldChangeGroupsAutomatically;
    // Every running group's numbers come from one read of its round
    const roundState = await loadRoundStates(this.prisma, [
      ...new Set(rooms.flatMap((room) => room.currentGroupIds.map(roundIdOf))),
    ]);
    const attemptsByRegistrantId = new Map<string, Map<number, Attempt[]>>();
    const attemptsOf = (roundId: string) => {
      let byRegistrantId = attemptsByRegistrantId.get(roundId);
      if (!byRegistrantId) {
        // Someone added on site has no registrant id, so no assignment
        byRegistrantId = new Map(
          roundState(roundId).results.flatMap(({ person, attempts }) =>
            person.registrantId === null
              ? []
              : [[person.registrantId, attempts]],
          ),
        );
        attemptsByRegistrantId.set(roundId, byRegistrantId);
      }
      return byRegistrantId;
    };
    const roomGroups = rooms.map((room) => ({
      room,
      groups: room.currentGroupIds.map((groupId) => {
        const roundId = roundIdOf(groupId);
        return {
          progress: calculateGroupProgress(wcif, groupId, attemptsOf(roundId)),
          status: this.getGroupStatus(
            groupId,
            room.name,
            wcif,
            roundState(roundId),
          ),
        };
      }),
    }));
    const notStarted = roomGroups.flatMap(({ groups }) =>
      groups.flatMap(({ status }) => status.blockers.notStarted),
    );
    const persons = notStarted.length
      ? await this.prisma.person.findMany({
          where: {
            OR: [
              {
                id: {
                  in: notStarted
                    .map((m) => m.personId)
                    .filter((id) => id !== null),
                },
              },
              {
                registrantId: {
                  in: notStarted
                    .map((m) => m.registrantId)
                    .filter((id) => id !== null),
                },
              },
            ],
          },
          select: { id: true, name: true, registrantId: true },
        })
      : [];
    return roomGroups.map(({ room, groups }) => ({
      roomId: room.id,
      groups: groups.map(({ progress, status }) => ({
        ...progress,
        wait: this.getGroupWait(
          room.id,
          progress.groupId,
          status,
          persons,
          wcif,
          isAutomatic,
        ),
      })),
    }));
  }

  private getGroupWait(
    roomId: string,
    groupId: string,
    status: GroupStatus,
    persons: { id: string; name: string; registrantId: number | null }[],
    wcif: Competition,
    isAutomatic: boolean,
  ): GroupWait {
    const { notStarted, solving, incidents, extras } = status.blockers;
    const movesOnAt = isAutomatic
      ? getMovesOnAt(
          status,
          this.roomsService.getGroupEnteredAt(roomId, groupId),
          GROUP_CHANGE_CRON_INTERVAL_MS,
        )
      : null;
    return {
      state: status.state,
      notStarted: notStarted.map((missing) => {
        const person = persons.find(
          (p) =>
            p.id === missing.personId ||
            (missing.registrantId !== null &&
              p.registrantId === missing.registrantId),
        );
        return {
          // Only someone with an attendance row here can be marked
          personId: missing.personId,
          name:
            person?.name ??
            wcif.persons.find((p) => p.registrantId === missing.registrantId)
              ?.name ??
            'Unknown competitor',
        };
      }),
      solving,
      incidents,
      extras,
      movesOnAt: movesOnAt === null ? null : new Date(movesOnAt).toISOString(),
    };
  }

  /** Where one of the room's current groups stands (see getGroupStatus) */
  private getGroupStatus(
    groupId: string,
    roomName: string,
    wcif: Competition,
    round: RoundState,
  ) {
    const roundId = roundIdOf(groupId);
    const hasNextGroup = !!getNextGroupInRoom(groupId, roomName, wcif);
    const roundActivity = getActivityInfoFromScheduleWithRoom(
      roundId,
      roomName,
      wcif,
    );
    const roomRoundGroupIds = hasNextGroup
      ? [groupId]
      : (roundActivity?.childActivities ?? []).map(
          (group) => group.activityCode,
        );
    return getGroupStatusFromResults({
      groupId,
      results: round.results,
      assignedRegistrantIds: getGroupCompetitorIds(wcif, groupId),
      competitorRows: round.competitorRows,
      removed: round.removed,
      roomRoundRegistrantIds: roomRoundGroupIds.flatMap((id) =>
        getGroupCompetitorIds(wcif, id),
      ),
      roomRoundGroupIds,
      rules: {
        maxAttempts: getNumberOfAttemptsForRound(roundId, wcif),
        cutoff: getRoundInfoFromWcif(roundId, wcif)?.cutoff,
        freshSetGrantIds: round.freshSetGrantIds,
        hasNextGroup,
      },
    });
  }

  /** Tells the panel once per group, not on every check */
  private warnOnce(
    roomId: string,
    groupId: string,
    kind: 'disabled' | 'notAllEntered',
    message: string,
  ) {
    const key = `${roomId}|${groupId}|${kind}`;
    if (this.groupChangeWarnings.has(key)) return;
    this.groupChangeWarnings.add(key);
    this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
      message,
    });
    this.logger.log(message);
  }

  private forgetWarningsForOtherGroups(roomId: string, groupIds: string[]) {
    for (const key of this.groupChangeWarnings) {
      const [keyRoomId, keyGroupId] = key.split('|');
      if (keyRoomId === roomId && !groupIds.includes(keyGroupId)) {
        this.groupChangeWarnings.delete(key);
      }
    }
  }

  /**
   * Leaves the given groups for the room's next ones (see planNextGroups),
   * the same way as starting groups from the panel, so the room records them
   * as started and the live results hear about it
   */
  async changeGroup(roomId: string, finishedGroupIds: string[]) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId } });
    if (!room) return;
    // Someone may have changed the groups by hand since the check
    const leaving = finishedGroupIds.filter((id) =>
      room.currentGroupIds.includes(id),
    );
    if (leaving.length === 0) return;
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = competition.wcif as unknown as Competition;
    const nextGroupIds = planNextGroups(
      room.currentGroupIds,
      leaving,
      room.name,
      wcif,
    );
    if (!nextGroupIds) return;
    const switched = await this.roomsService.switchRoomGroups(
      room.id,
      room.currentGroupIds,
      nextGroupIds,
    );
    if (!switched) {
      this.logger.log(
        `Groups in room ${room.name} were changed by hand meanwhile; left as they are`,
      );
      return;
    }
    this.forgetWarningsForOtherGroups(room.id, nextGroupIds);
    const message = `Group in room ${room.name} was changed to ${nextGroupIds.join(', ')}`;
    this.appGateway.server.to(`competition`).emit('groupShouldBeChanged', {
      message: message,
    });
    this.logger.log(message);
  }

  /** Steps from the given groups, or the room's saved ones without them */
  async getNextGroupsFromScheduleForRoom(roomId: string, groupIds?: string[]) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new HttpException('Room not found', 404);
    }
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    return getNextGroupsInRoom(
      groupIds ?? room.currentGroupIds,
      room.name,
      wcif,
    );
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
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const previousGroups: string[] = [];
    if (currentGroups.length === 1) {
      const currentRoundId = currentGroups[0].split('-g')[0];
      const roundInfoFromSchedule = getActivityInfoFromScheduleWithRoom(
        currentRoundId,
        room.name,
        wcif,
      );
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
        // Assigned in the callbacks below, which narrowing doesn't follow
        let previousRoundActivity = null as Activity | null;
        wcif.schedule.venues.forEach((venue: Venue) => {
          const r = venue.rooms.find(
            (item: WCIFRoom) => item.name === room.name,
          );
          r?.activities.forEach((a: Activity) => {
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
        const roundInfoFromSchedule = getActivityInfoFromScheduleWithRoom(
          roundId,
          room.name,
          wcif,
        );
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
          // Assigned in the callbacks below, which narrowing doesn't follow
          let previousRoundActivity = null as Activity | null;
          wcif.schedule.venues.forEach((venue: Venue) => {
            const r = venue.rooms.find(
              (item: WCIFRoom) => item.name === room.name,
            );
            r?.activities.forEach((a: Activity) => {
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
