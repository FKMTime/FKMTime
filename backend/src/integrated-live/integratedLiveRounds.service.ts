import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  Attempt,
  LiveSyncStatus,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { IntegratedLiveConnectionService } from 'src/competition/integratedLiveConnection.service';
import { DbService } from 'src/db/db.service';
import { getAttemptsWaitingForExtra } from 'src/result/helpers';
import { getOfficialResultsDestination } from 'src/results-destination';
import { WcaService } from 'src/wca/wca.service';
import { Competition as Wcif, getRoundInfoFromWcif } from 'wcif-helpers';

import { IntegratedLiveService } from './integratedLive.service';
import { LiveAttempt, toLiveAttempts } from './liveAttempts';
import {
  advancingLabel,
  LiveRoundDot,
  LiveRoundState,
  liveValues,
  NEEDS_ATTENTION,
  ON_THE_WAY,
  ROUND_NOT_OPEN,
  roundDot,
  sameValues,
  STUCK_AFTER_MS,
  waitingReason,
} from './liveRoundView';

export type IntegratedLiveRound = LiveRoundState;

/** Rounds with results that aren't getting through, for Home's alert */
export interface IntegratedLiveProblems {
  /** On their way for more than a few minutes */
  stuck: { roundId: string; count: number }[];
  /** Refused by the WCA, or not in its round */
  refused: { roundId: string; count: number }[];
}

/** What the WCA says about adding events and on-site registration */
export interface RegistrationRules {
  /** The deadline for adding events (WCRP 6.4), if there is one */
  eventChangeDeadline: string | null;
  /** Whether on-site registration was advertised (WCRP 5.2.1) */
  onTheSpotRegistration: boolean;
  competitorLimit: number | null;
}

/** A round in the Results page's round strip */
export interface IntegratedLiveRoundSummary extends IntegratedLiveRound {
  dot: LiveRoundDot;
  /** Results the WCA won't take until someone acts */
  needsAttention: number;
}

/** One FKMTime result of a round, next to the WCA's copy of it */
export interface IntegratedLiveResultView {
  resultId: string;
  personId: string;
  registrationId: number | null;
  status: LiveSyncStatus | null;
  error: string | null;
  sentAt: Date | null;
  advancing: 'advances' | 'mayAdvance' | null;
  /** The WCA's attempts, or null when the WCA has no result for them */
  wcaAttempts: number[] | null;
  /** The WCA holds other attempts than FKMTime, and nothing is on its way */
  differs: boolean;
}

/** A result the WCA holds that FKMTime has no result for */
export interface IntegratedLiveOnlyInWca {
  registrationId: number;
  name: string | null;
  wcaId: string | null;
  attempts: number[];
}

/** What the Results page shows about one round (SPEC-006 section 5) */
export interface IntegratedLiveRoundDetails {
  roundId: string;
  state: string;
  totalCompetitors: number | null;
  completedCompetitors: number | null;
  /** Why it can't open yet, in plain words */
  waitingReason: string | null;
  onTheWay: number;
  needsAttention: number;
  results: IntegratedLiveResultView[];
  onlyInWca: IntegratedLiveOnlyInWca[];
}

export interface NoShow {
  personId: string;
  name: string;
  registrationId: number;
}

export interface NextInLine {
  registrationId: number;
  name: string | null;
  personId: string | null;
}

interface AddableRegistration {
  id: number;
  user?: { name?: string; wca_id?: string | null };
  competing?: { event_ids?: string[] };
}

const roundNumber = (roundId: string) => Number(roundId.split('-r')[1]);

/**
 * Runs rounds in WCA Integrated Live Results from FKMTime (SPEC-006 section
 * 4): opening and closing them, and adding competitors by hand.
 */
@Injectable()
export class IntegratedLiveRoundsService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => IntegratedLiveConnectionService))
    private readonly connection: IntegratedLiveConnectionService,
    @Inject(forwardRef(() => IntegratedLiveService))
    private readonly sender: IntegratedLiveService,
    private readonly appGateway: AppGateway,
    private readonly wcaService: WcaService,
  ) {}

  private logger = new Logger(IntegratedLiveRoundsService.name);

  /** Every round's state on the WCA; empty without a working connection */
  async getRounds(): Promise<IntegratedLiveRound[]> {
    const base = await this.base();
    if (!base) return [];
    const response = await this.connection
      .authorizedFetch(`${base}/rounds`)
      .catch(() => null);
    if (!response?.ok) return [];
    const body = await response.json();
    return (body.rounds ?? []).map(
      (round: Record<string, unknown>): IntegratedLiveRound => ({
        roundId: round.id as string,
        state: round.state as string,
        totalCompetitors: round.total_competitors as number | undefined,
        completedCompetitors: round.completed_competitors as number | undefined,
        competitorCountNeeded: round.competitor_count_needed as
          number | undefined,
      }),
    );
  }

  /**
   * Results that aren't getting through, by round (SPEC-006 section 5):
   * on their way for more than a few minutes, or refused. Results waiting
   * for their round to open aren't a problem; Home suggests opening it.
   */
  async getProblems(): Promise<IntegratedLiveProblems> {
    if (!(await this.base())) return { stuck: [], refused: [] };
    const stuckSince = new Date(Date.now() - STUCK_AFTER_MS);
    const rows = await this.prisma.liveSync.findMany({
      where: {
        OR: [
          { status: { in: ON_THE_WAY }, updatedAt: { lt: stuckSince } },
          { status: { in: NEEDS_ATTENTION } },
        ],
      },
      select: {
        status: true,
        error: true,
        result: { select: { roundId: true } },
      },
    });
    const count = (filter: (row: (typeof rows)[number]) => boolean) => {
      const byRound = new Map<string, number>();
      for (const row of rows.filter(filter)) {
        byRound.set(
          row.result.roundId,
          (byRound.get(row.result.roundId) ?? 0) + 1,
        );
      }
      return [...byRound].map(([roundId, n]) => ({ roundId, count: n }));
    };
    return {
      stuck: count((row) => ON_THE_WAY.includes(row.status)),
      refused: count(
        (row) =>
          NEEDS_ATTENTION.includes(row.status) && row.error !== ROUND_NOT_OPEN,
      ),
    };
  }

  /**
   * The WCA's facts behind the hints for results whose competitor isn't
   * registered: the deadline for adding events, and whether on-site
   * registration was advertised. Read fresh; null when the WCA can't be
   * reached.
   */
  async getRegistrationRules(): Promise<RegistrationRules | null> {
    const competition = await this.prisma.competition.findFirst();
    if (!competition) return null;
    const info = await this.wcaService
      .getCompetitionInfo(competition.wcaId)
      .catch(() => null);
    if (!info || info.error) return null;
    return {
      eventChangeDeadline: info.event_change_deadline_date ?? null,
      onTheSpotRegistration: !!info.on_the_spot_registration,
      competitorLimit: info.competitor_limit ?? null,
    };
  }

  /** Every round with its strip dot: the WCA state, or needs attention */
  async getRoundSummaries(): Promise<IntegratedLiveRoundSummary[]> {
    const rounds = await this.getRounds();
    if (rounds.length === 0) return [];
    const problems = await this.prisma.liveSync.findMany({
      where: { status: { in: NEEDS_ATTENTION } },
      select: { error: true, result: { select: { roundId: true } } },
    });
    const byRound = new Map<string, number>();
    // Waiting for the round to open isn't something to fix
    for (const { result } of problems.filter(
      (p) => p.error !== ROUND_NOT_OPEN,
    )) {
      byRound.set(result.roundId, (byRound.get(result.roundId) ?? 0) + 1);
    }
    return rounds.map((round) => {
      const needsAttention = byRound.get(round.roundId) ?? 0;
      return {
        ...round,
        needsAttention,
        dot: roundDot(round.state, needsAttention),
      };
    });
  }

  /**
   * The round as the Results page shows it: the WCA state and why it can't
   * open, each FKMTime result's sync status, advancing flag and the WCA's
   * attempts, and results only the WCA has. Null when results don't go to
   * WCA Integrated Live Results or it can't be read.
   */
  async getRoundDetails(
    roundId: string,
  ): Promise<IntegratedLiveRoundDetails | null> {
    const base = await this.base();
    if (!base) return null;
    const [rounds, live, results, competition] = await Promise.all([
      this.getRounds(),
      this.getJson(`${base}/rounds/${roundId}`),
      this.prisma.result.findMany({
        where: { roundId },
        include: { attempts: true, liveSync: true, person: true },
      }),
      this.prisma.competition.findFirst(),
    ]);
    const round = rounds.find((r) => r.roundId === roundId);
    if (!round) return null;
    const previousRoundId = this.previousRoundId(
      roundId,
      competition.wcif as unknown as Wcif,
    );
    const previous = rounds.find((r) => r.roundId === previousRoundId);

    type LiveResult = {
      registration_id: number;
      attempts?: LiveAttempt[];
      advancing?: boolean;
      advancing_questionable?: boolean;
    };
    const liveResults = new Map<number, LiveResult>(
      ((live?.results ?? []) as LiveResult[]).map((r) => [
        r.registration_id,
        r,
      ]),
    );
    const views = results.map((result): IntegratedLiveResultView => {
      const registrationId = result.person.wcaRegistrationId;
      const inWca =
        registrationId !== null ? liveResults.get(registrationId) : undefined;
      const status = result.liveSync?.status ?? null;
      const wcaAttempts = inWca ? liveValues(inWca.attempts) : null;
      const ours = toLiveAttempts(result.attempts).map((a) => a.value);
      return {
        resultId: result.id,
        personId: result.personId,
        registrationId,
        status,
        error: result.liveSync?.error ?? null,
        sentAt: result.liveSync?.sentAt ?? null,
        advancing: inWca
          ? advancingLabel(inWca.advancing, inWca.advancing_questionable)
          : null,
        wcaAttempts,
        differs:
          wcaAttempts !== null &&
          !(status && ON_THE_WAY.includes(status)) &&
          !sameValues(wcaAttempts, ours),
      };
    });

    const ourRegistrations = new Set(
      results.map((r) => r.person.wcaRegistrationId).filter((id) => id),
    );
    type LiveCompetitor = {
      id: number;
      name?: string;
      wca_id?: string | null;
    };
    const competitors = new Map<number, LiveCompetitor>(
      ((live?.competitors ?? []) as LiveCompetitor[]).map((c) => [c.id, c]),
    );
    const onlyInWca = [...liveResults.values()]
      .filter(
        (r) =>
          (r.attempts ?? []).length > 0 &&
          !ourRegistrations.has(r.registration_id),
      )
      .map((r) => ({
        registrationId: r.registration_id,
        name: competitors.get(r.registration_id)?.name ?? null,
        wcaId: competitors.get(r.registration_id)?.wca_id ?? null,
        attempts: liveValues(r.attempts),
      }));

    return {
      roundId,
      state: round.state,
      totalCompetitors: round.totalCompetitors ?? null,
      completedCompetitors: round.completedCompetitors ?? null,
      waitingReason: waitingReason(round, previous, previousRoundId),
      onTheWay: views.filter((v) => v.status && ON_THE_WAY.includes(v.status))
        .length,
      needsAttention: views.filter(
        (v) =>
          v.status &&
          NEEDS_ATTENTION.includes(v.status) &&
          v.error !== ROUND_NOT_OPEN,
      ).length,
      results: views,
      onlyInWca,
    };
  }

  /**
   * Empties one competitor's result in the WCA. When FKMTime has a result
   * for them it is sent again, so the WCA ends up matching FKMTime; a result
   * only the WCA had stays empty.
   */
  async clearResult(roundId: string, registrationId: number) {
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
      };
    }
    const response = await this.connection
      .authorizedFetch(`${base}/rounds/${roundId}/${registrationId}/clear`, {
        method: 'PUT',
      })
      .catch(() => null);
    if (!response?.ok) {
      return { ok: false, message: await this.reason(response) };
    }
    const ours = await this.prisma.result.findFirst({
      where: { roundId, person: { wcaRegistrationId: registrationId } },
      select: { id: true },
    });
    if (ours) await this.sender.markDirty([ours.id]);
    this.appGateway.handleIntegratedLiveRoundsChanged();
    return {
      ok: true,
      message: ours ? 'Cleared, and sending it again' : 'Cleared',
    };
  }

  /** The round a later round's competitors come from */
  private previousRoundId(roundId: string, wcif: Wcif | null): string | null {
    const number = roundNumber(roundId);
    if (number <= 1) return null;
    const source = (
      wcif?.events
        ?.flatMap((event) => event.rounds)
        .find((r) => r.id === roundId) as
        | {
            participationRuleset?: {
              participationSource?: { roundId?: string };
            };
          }
        | undefined
    )?.participationRuleset?.participationSource?.roundId;
    return source ?? `${roundId.split('-r')[0]}-r${number - 1}`;
  }

  async openRound(roundId: string) {
    return this.changeRound(roundId, 'PUT', 'open', 'opened');
  }

  /** Undoes an opening by mistake; the WCA refuses once results are in */
  async closeRound(roundId: string) {
    return this.changeRound(roundId, 'DELETE', 'close', 'closed');
  }

  /**
   * What argues against opening a later round yet: opening it locks the
   * previous round, and the WCA stops recomputing who advances from it
   */
  async getOpeningBlockers(roundId: string): Promise<string[]> {
    const number = roundNumber(roundId);
    if (number <= 1) return [];
    const previousRoundId = `${roundId.split('-r')[0]}-r${number - 1}`;
    const results = await this.prisma.result.findMany({
      where: { roundId: previousRoundId },
      include: { attempts: true, liveSync: true },
    });
    const notConfirmed = results.filter(
      (result) => result.liveSync?.status !== LiveSyncStatus.CONFIRMED,
    ).length;
    const waitingForExtra = results.filter(
      (result) =>
        getAttemptsWaitingForExtra(result.attempts as Attempt[]).length > 0,
    ).length;
    const blockers: string[] = [];
    if (notConfirmed > 0) {
      blockers.push(
        `${notConfirmed} ${notConfirmed === 1 ? 'result' : 'results'} of ${previousRoundId} not confirmed in WCA Integrated Live Results`,
      );
    }
    if (waitingForExtra > 0) {
      blockers.push(
        `${waitingForExtra} ${waitingForExtra === 1 ? 'result' : 'results'} of ${previousRoundId} waiting for an extra`,
      );
    }
    return blockers;
  }

  /**
   * A group of the round became current. First rounds open straight away;
   * a later round is suggested, or opened when the competition opted in and
   * nothing argues against it.
   */
  async onRoundStarted(roundId: string) {
    const competition = await this.prisma.competition.findFirst();
    if (
      !competition ||
      getOfficialResultsDestination(competition) !== 'WCA_INTEGRATED_LIVE'
    ) {
      return;
    }
    const round = (await this.getRounds()).find((r) => r.roundId === roundId);
    if (!round || round.state === 'open' || round.state === 'locked') return;
    if (round.state !== 'ready') {
      this.appGateway.handleRoundShouldBeOpened(roundId, [
        round.state === 'pending'
          ? 'The WCA is waiting for the previous round to be complete'
          : 'Too few competitors for this round (regulation 9m)',
      ]);
      return;
    }
    if (roundNumber(roundId) === 1) {
      await this.openRound(roundId);
      return;
    }
    const blockers = await this.getOpeningBlockers(roundId);
    if (competition.openRoundsAutomatically && blockers.length === 0) {
      await this.openRound(roundId);
      return;
    }
    this.appGateway.handleRoundShouldBeOpened(roundId, blockers);
  }

  /**
   * People FKMTime can add to a first round: an accepted WCA registration
   * that includes the event, and not in the round yet
   */
  async getAddableCompetitors(roundId: string) {
    const base = await this.base();
    if (!base || roundNumber(roundId) !== 1) return [];
    const [addable, round] = await Promise.all([
      this.getJson(`${base}/rounds/${roundId}/addable_competitors`),
      this.getJson(`${base}/rounds/${roundId}`),
    ]);
    const inRound = new Set<number>(
      (round?.results ?? []).map(
        (result: { registration_id: number }) => result.registration_id,
      ),
    );
    const eventId = roundId.split('-r')[0];
    return ((addable?.registrations ?? []) as AddableRegistration[])
      .filter(
        (registration) =>
          !inRound.has(registration.id) &&
          registration.competing?.event_ids?.includes(eventId),
      )
      .map((registration) => ({
        registrationId: registration.id,
        name: registration.user?.name ?? null,
        wcaId: registration.user?.wca_id ?? null,
      }));
  }

  async addCompetitor(roundId: string, registrationId: number) {
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
      };
    }
    const response = await this.connection
      .authorizedFetch(`${base}/rounds/${roundId}/${registrationId}`, {
        method: 'PUT',
      })
      .catch(() => null);
    if (!response?.ok) {
      return { ok: false, message: await this.reason(response) };
    }
    // Their result, if any, can go now
    const results = await this.prisma.result.findMany({
      where: { roundId, person: { wcaRegistrationId: registrationId } },
      select: { id: true },
    });
    await this.sender.markDirty(results.map((result) => result.id));
    this.appGateway.handleIntegratedLiveRoundsChanged();
    // So the panel can offer to put them in a group
    const person = await this.prisma.person.findFirst({
      where: { wcaRegistrationId: registrationId },
      select: { id: true },
    });
    return {
      ok: true,
      message: 'Added to the round',
      personId: person?.id ?? null,
    };
  }

  /** Empties every result of an open round on the WCA, then sends FKMTime's again */
  async clearRound(roundId: string) {
    return this.changeRound(roundId, 'PUT', 'clear', 'cleared');
  }

  /**
   * Open rounds whose groups have all run, with the competitors who never
   * came: assigned, absent in every group of the round they were in, no
   * attempts, and still in the WCA's round with nothing entered. They keep
   * the WCA's next round pending until they are removed.
   *
   * A round paused between groups (another event in between, lunch) isn't
   * over: until every group with competitors in it has been started, and none
   * is running, nobody is listed.
   */
  async getNoShows(
    onlyRoundId?: string,
  ): Promise<{ roundId: string; competitors: NoShow[] }[]> {
    const base = await this.base();
    if (!base) return [];
    const rooms = await this.prisma.room.findMany();
    const running = new Set(
      rooms.flatMap((room) =>
        room.currentGroupIds.map((groupId) => groupId.split('-g')[0]),
      ),
    );
    const started = new Set(rooms.flatMap((room) => room.startedGroupIds));
    const openRounds = (await this.getRounds()).filter(
      (round) =>
        round.state === 'open' &&
        !running.has(round.roundId) &&
        (!onlyRoundId || round.roundId === onlyRoundId),
    );
    const found: { roundId: string; competitors: NoShow[] }[] = [];
    for (const round of openRounds) {
      const absent = await this.findAbsentCompetitors(round.roundId, started);
      if (absent.length === 0) continue;
      const live = await this.getJson(`${base}/rounds/${round.roundId}`);
      const emptyInWca = new Set<number>(
        (live?.results ?? [])
          .filter(
            (result: { attempts?: unknown[] }) =>
              (result.attempts ?? []).length === 0,
          )
          .map((result: { registration_id: number }) => result.registration_id),
      );
      const competitors = absent.filter((c) =>
        emptyInWca.has(c.registrationId),
      );
      if (competitors.length > 0) {
        found.push({ roundId: round.roundId, competitors });
      }
    }
    return found;
  }

  /**
   * Removes them all in one call, with nobody moving up: the round is over.
   * Only people the no-shows list names right now, so a stale list or a
   * hand-made request can't quit someone whose group hasn't run.
   */
  async removeNoShows(roundId: string, registrationIds: number[]) {
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
      };
    }
    const [listed] = await this.getNoShows(roundId);
    const noShowIds = new Set(
      (listed?.competitors ?? []).map((c) => c.registrationId),
    );
    if (
      registrationIds.length === 0 ||
      registrationIds.some((id) => !noShowIds.has(id))
    ) {
      return {
        ok: false,
        message:
          "Only competitors who didn't come to a finished round can be removed. Check the list again.",
      };
    }
    const response = await this.connection
      .authorizedFetch(`${base}/rounds/${roundId}/bulk_quit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_ids: registrationIds }),
      })
      .catch(() => null);
    if (!response?.ok) {
      return { ok: false, message: await this.reason(response) };
    }
    this.appGateway.handleIntegratedLiveRoundsChanged();
    return {
      ok: true,
      message: `${registrationIds.length} removed from ${roundId}`,
    };
  }

  /**
   * Who would take a withdrawing competitor's place (Regulation 9p3), as the
   * WCA works it out. FKMTime only shows it; the person chooses.
   */
  async previewWithdrawal(roundId: string, personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person?.wcaRegistrationId) {
      return { ok: false, message: 'No WCA registration' };
    }
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
      };
    }
    const round = (await this.getRounds()).find((r) => r.roundId === roundId);
    if (round?.state !== 'open') {
      return {
        ok: true,
        name: person.name,
        roundOpen: false,
        roundState: round?.state ?? null,
      };
    }
    const preview = await this.getJson(
      `${base}/rounds/${roundId}/next_if_quit?registration_id=${person.wcaRegistrationId}`,
    );
    if (!preview) {
      return {
        ok: false,
        message: 'Could not ask the WCA who is next in line',
      };
    }
    const next = await this.toNextInLine(preview.next_advancing ?? []);
    return {
      ok: true,
      name: person.name,
      roundOpen: true,
      next,
      nobodyReason: next.length === 0 ? await this.nobodyReason(roundId) : null,
    };
  }

  /**
   * Withdraws a competitor from a later round. advancingIds must be exactly
   * the WCA's next in line, or empty for nobody; if the WCA's answer changed
   * meanwhile, it comes back as changed with the new next in line.
   */
  async withdraw(roundId: string, personId: string, advancingIds: number[]) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    const base = await this.base();
    if (!person?.wcaRegistrationId || !base) {
      return { ok: false, message: 'Not connected, or no WCA registration' };
    }
    const response = await this.connection
      .authorizedFetch(
        `${base}/rounds/${roundId}/${person.wcaRegistrationId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            advancingIds.length > 0 ? { advancing_ids: advancingIds } : {},
          ),
        },
      )
      .catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      if (response && Array.isArray(body?.should_advance)) {
        return {
          ok: false,
          changed: true,
          message: 'Who is next in line changed: choose again',
          next: await this.toNextInLine(body.should_advance),
        };
      }
      return {
        ok: false,
        message:
          body?.status ?? body?.error ?? 'Could not reach the WCA website',
      };
    }
    this.appGateway.handleIntegratedLiveRoundsChanged();
    // The withdrawing competitor's group is where a replacement fits best
    const group = await this.prisma.staffActivity.findFirst({
      where: {
        personId,
        role: StaffRole.COMPETITOR,
        groupId: { startsWith: `${roundId}-g` },
      },
    });
    const replacements = await this.prisma.person.findMany({
      where: { wcaRegistrationId: { in: advancingIds } },
      select: { id: true, name: true },
    });
    return {
      ok: true,
      message: `${person.name} withdrew from ${roundId}`,
      replacements: replacements.map((replacement) => ({
        personId: replacement.id,
        name: replacement.name,
        suggestedGroupId: group?.groupId ?? null,
      })),
    };
  }

  private async findAbsentCompetitors(
    roundId: string,
    startedGroupIds: Set<string>,
  ): Promise<NoShow[]> {
    const results = await this.prisma.result.findMany({
      where: { roundId },
      include: { attempts: true },
    });
    // A round with no results at all never ran
    if (results.length === 0) return [];
    const competed = new Set(
      results.filter((r) => r.attempts.length > 0).map((r) => r.personId),
    );
    const activities = await this.prisma.staffActivity.findMany({
      where: {
        role: StaffRole.COMPETITOR,
        groupId: { startsWith: `${roundId}-g` },
      },
      include: { person: true },
    });
    // Status defaults to ABSENT, so a group that never started looks like
    // everyone in it stayed away
    if (activities.some((a) => !startedGroupIds.has(a.groupId))) return [];
    const byPerson = new Map<string, typeof activities>();
    for (const activity of activities) {
      const list = byPerson.get(activity.personId) ?? [];
      list.push(activity);
      byPerson.set(activity.personId, list);
    }
    return [...byPerson.values()]
      .filter(
        (list) =>
          list.every((a) => a.status === StaffActivityStatus.ABSENT) &&
          !competed.has(list[0].personId) &&
          list[0].person.wcaRegistrationId !== null,
      )
      .map((list) => ({
        personId: list[0].personId,
        name: list[0].person.name,
        registrationId: list[0].person.wcaRegistrationId,
      }));
  }

  /** The WCA's next in line, with their FKMTime person where there is one */
  private async toNextInLine(
    entries: { id?: number; registration_id?: number; name?: string }[],
  ): Promise<NextInLine[]> {
    const ids = entries.map((e) => e.registration_id ?? e.id);
    const persons = await this.prisma.person.findMany({
      where: { wcaRegistrationId: { in: ids } },
      select: { id: true, name: true, wcaRegistrationId: true },
    });
    return entries.map((entry) => {
      const registrationId = entry.registration_id ?? entry.id;
      const person = persons.find(
        (p) => p.wcaRegistrationId === registrationId,
      );
      return {
        registrationId,
        name: person?.name ?? entry.name ?? null,
        personId: person?.id ?? null,
      };
    });
  }

  /** The likeliest reason, from the round's advancement condition */
  private async nobodyReason(roundId: string) {
    const competition = await this.prisma.competition.findFirst();
    const round = competition?.wcif
      ? getRoundInfoFromWcif(roundId, competition.wcif as unknown as Wcif)
      : null;
    const condition = (
      round as unknown as {
        participationRuleset?: {
          participationSource?: { resultCondition?: { type?: string } };
        };
      }
    )?.participationRuleset?.participationSource?.resultCondition;
    if (condition?.type === 'resultAchieved') {
      return 'Advancement is by result, not by ranking, so a withdrawal frees no place';
    }
    return 'Nobody is left to move up: everyone else from the previous round already advances, has withdrawn, or has only DNF/DNS (Regulation 9p4)';
  }

  private async changeRound(
    roundId: string,
    method: 'PUT' | 'DELETE',
    action: 'open' | 'close' | 'clear',
    done: string,
  ) {
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
      };
    }
    const response = await this.connection
      .authorizedFetch(`${base}/rounds/${roundId}/${action}`, { method })
      .catch(() => null);
    if (!response?.ok) {
      const message = await this.reason(response);
      this.logger.warn(`Could not ${action} ${roundId}: ${message}`);
      return { ok: false, message };
    }
    this.logger.log(`${roundId} ${done} in WCA Integrated Live Results`);
    if (action === 'open' || action === 'clear') {
      // Results that waited for the round go now; after a clear, FKMTime's
      // results replace whatever the WCA held
      await this.sender.markRoundDirty(roundId);
    }
    this.appGateway.handleIntegratedLiveRoundsChanged();
    return { ok: true, message: `${roundId} ${done}` };
  }

  private async reason(response: Response | null) {
    if (!response) return 'Could not reach the WCA website';
    const body = await response.json().catch(() => ({}));
    return body?.status ?? body?.error ?? `The WCA answered ${response.status}`;
  }

  private async getJson(url: string) {
    const response = await this.connection
      .authorizedFetch(url)
      .catch(() => null);
    return response?.ok ? response.json() : null;
  }

  /** The live results API base, or null when results don't go there */
  private async base() {
    const competition = await this.prisma.competition.findFirst();
    if (
      !competition ||
      getOfficialResultsDestination(competition) !== 'WCA_INTEGRATED_LIVE'
    ) {
      return null;
    }
    return `${process.env.WCA_ORIGIN}/api/v1/competitions/${competition.wcaId}/live`;
  }
}
