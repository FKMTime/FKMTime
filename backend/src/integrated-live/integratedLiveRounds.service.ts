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
import { Competition as Wcif, getRoundInfoFromWcif } from 'wcif-helpers';

import { IntegratedLiveService } from './integratedLive.service';

export interface IntegratedLiveRound {
  roundId: string;
  /** pending, blocked, ready, open or locked, as the WCA says */
  state: string;
  totalCompetitors?: number;
  completedCompetitors?: number;
  competitorCountNeeded?: number;
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
   */
  async getNoShows(): Promise<{ roundId: string; competitors: NoShow[] }[]> {
    const base = await this.base();
    if (!base) return [];
    const rooms = await this.prisma.room.findMany();
    const running = new Set(
      rooms.flatMap((room) =>
        room.currentGroupIds.map((groupId) => groupId.split('-g')[0]),
      ),
    );
    const finished = (await this.getRounds()).filter(
      (round) => round.state === 'open' && !running.has(round.roundId),
    );
    const found: { roundId: string; competitors: NoShow[] }[] = [];
    for (const round of finished) {
      const absent = await this.findAbsentCompetitors(round.roundId);
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

  /** Removes them all in one call, with nobody moving up: the round is over */
  async removeNoShows(roundId: string, registrationIds: number[]) {
    const base = await this.base();
    if (!base) {
      return {
        ok: false,
        message: 'Not connected to WCA Integrated Live Results',
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

  private async findAbsentCompetitors(roundId: string): Promise<NoShow[]> {
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
