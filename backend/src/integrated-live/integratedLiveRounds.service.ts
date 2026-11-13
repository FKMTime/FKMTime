import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Attempt, LiveSyncStatus } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { IntegratedLiveConnectionService } from 'src/competition/integratedLiveConnection.service';
import { DbService } from 'src/db/db.service';
import { getAttemptsWaitingForExtra } from 'src/result/helpers';
import { getOfficialResultsDestination } from 'src/results-destination';

import { IntegratedLiveService } from './integratedLive.service';

export interface IntegratedLiveRound {
  roundId: string;
  /** pending, blocked, ready, open or locked, as the WCA says */
  state: string;
  totalCompetitors?: number;
  completedCompetitors?: number;
  competitorCountNeeded?: number;
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
    return { ok: true, message: 'Added to the round' };
  }

  private async changeRound(
    roundId: string,
    method: 'PUT' | 'DELETE',
    action: 'open' | 'close',
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
    if (action === 'open') {
      // Results that waited for the round, or for people in it, go now
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
