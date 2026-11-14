import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LiveSyncStatus, Prisma } from '@prisma/client';
import { IntegratedLiveConnectionService } from 'src/competition/integratedLiveConnection.service';
import { DbService, INCLUDING_REMOVED } from 'src/db/db.service';
import { getOfficialResultsDestination } from 'src/results-destination';
import {
  Competition as Wcif,
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import {
  breaksRoundRules,
  LiveAttempt,
  liveAttemptsHash,
  toLiveAttempts,
} from './liveAttempts';
import { ROUND_NOT_OPEN } from './liveRoundView';

/** Not a documented WCA limit, just a size that keeps requests small */
const BATCH_SIZE = 100;
/** The WCA allows 60 a minute per IP; leave room for WCIF syncs and imports */
const MAX_REQUESTS_PER_MINUTE = 30;
/** A 202 only queues the write: give the WCA's job time before reading back */
const READ_BACK_AFTER_MS = 10_000;
const MAX_READ_BACKS = 3;
const MAX_BACKOFF_MS = 60_000;
/** People not in the round, or without a registration, are tried again */
const RETRY_UNSENDABLE_AFTER_MS = 5 * 60_000;

type SyncWithResult = Prisma.LiveSyncGetPayload<{
  include: { result: { include: { attempts: true; person: true } } };
}>;

interface AddableRegistration {
  id: number;
  competing?: { event_ids?: string[] };
}

interface LiveRound {
  results?: {
    registration_id: number;
    attempts: LiveAttempt[];
  }[];
}

/**
 * Sends results to WCA Integrated Live Results (SPEC-006 section 3). Send
 * paths only mark results dirty; this worker sends them in batches per round,
 * within the WCA's rate limit, and confirms each write by reading the round
 * back, because the WCA answers 202 and writes later.
 */
@Injectable()
export class IntegratedLiveService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => IntegratedLiveConnectionService))
    private readonly connection: IntegratedLiveConnectionService,
  ) {}

  private logger = new Logger(IntegratedLiveService.name);
  private requestTimes: number[] = [];
  private pausedUntil = 0;
  private failures = 0;
  private running: Promise<void> | null = null;

  /** Queues results to be sent; the worker picks them up within seconds */
  async markDirty(resultIds: string[]) {
    if (resultIds.length === 0) return;
    await this.prisma.$transaction(
      resultIds.map((resultId) =>
        this.prisma.liveSync.upsert({
          where: { resultId },
          create: { resultId, status: LiveSyncStatus.DIRTY },
          update: { status: LiveSyncStatus.DIRTY, checks: 0, error: null },
        }),
      ),
    );
  }

  async markRoundDirty(roundId: string) {
    const results = await this.prisma.result.findMany({
      where: { roundId, ...INCLUDING_REMOVED },
      select: { id: true },
    });
    await this.markDirty(results.map((result) => result.id));
  }

  /** A result deleted in FKMTime: its copy on the WCA has to be emptied */
  async queueClear(roundId: string, wcaRegistrationId: number | null) {
    if (wcaRegistrationId === null) return;
    await this.prisma.liveClear.upsert({
      where: { roundId_wcaRegistrationId: { roundId, wcaRegistrationId } },
      create: { roundId, wcaRegistrationId },
      update: {},
    });
  }

  /** "Resubmit round": sends it straight away and says how it went */
  async sendRoundNow(roundId: string) {
    await this.markRoundDirty(roundId);
    await this.run();
    const syncs = await this.prisma.liveSync.findMany({
      where: { result: { roundId } },
      select: { status: true },
    });
    const count = (status: LiveSyncStatus) =>
      syncs.filter((sync) => sync.status === status).length;
    const accepted =
      count(LiveSyncStatus.SENT) + count(LiveSyncStatus.CONFIRMED);
    const notAccepted = syncs.length - accepted - count(LiveSyncStatus.DIRTY);
    return {
      message: `${accepted} of ${syncs.length} results accepted by WCA Integrated Live Results`,
      accepted,
      waiting: count(LiveSyncStatus.DIRTY),
      notAccepted,
    };
  }

  @Interval(3000)
  async onInterval() {
    await this.run();
  }

  /** One run at a time; a caller arriving meanwhile waits for it */
  run(): Promise<void> {
    if (!this.running) {
      this.running = this.runOnce()
        .catch((e) => this.logger.error(`Sending failed: ${e}`))
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  private async runOnce() {
    const competition = await this.prisma.competition.findFirst();
    if (
      !competition ||
      getOfficialResultsDestination(competition) !== 'WCA_INTEGRATED_LIVE' ||
      Date.now() < this.pausedUntil
    ) {
      return;
    }
    // Not connected, or broken: results wait, dirty, until someone reconnects
    if (!(await this.connection.getAccessToken())) return;
    await this.prisma.liveSync.updateMany({
      where: {
        status: {
          in: [LiveSyncStatus.NOT_IN_ROUND, LiveSyncStatus.NOT_SENDABLE],
        },
        updatedAt: { lte: new Date(Date.now() - RETRY_UNSENDABLE_AFTER_MS) },
      },
      data: { status: LiveSyncStatus.DIRTY },
    });
    const base = `${process.env.WCA_ORIGIN}/api/v1/competitions/${competition.wcaId}/live`;
    const wcif = competition.wcif as unknown as Wcif;
    if (!(await this.sendClears(base))) return;
    if (!(await this.sendDirty(base, wcif))) return;
    await this.readBack(base);
  }

  /** False when the run has to stop: out of requests, backing off, or offline */
  private async sendClears(base: string) {
    const clears = await this.prisma.liveClear.findMany({
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const clear of clears) {
      const response = await this.request(
        `${base}/rounds/${clear.roundId}/${clear.wcaRegistrationId}/clear`,
        { method: 'PUT' },
      );
      if (!response) return false;
      // 401/403 are about the connection: keep it for after reconnecting.
      // Anything else (done, or not in the round any more) ends it.
      if (response.status === 401 || response.status === 403) return false;
      await this.prisma.liveClear.delete({ where: { id: clear.id } });
    }
    return true;
  }

  private async sendDirty(base: string, wcif: Wcif) {
    const syncs = await this.prisma.liveSync.findMany({
      where: { status: LiveSyncStatus.DIRTY },
      include: { result: { include: { attempts: true, person: true } } },
      take: 500,
    });
    const byRound = new Map<string, SyncWithResult[]>();
    for (const sync of syncs) {
      const list = byRound.get(sync.result.roundId) ?? [];
      list.push(sync);
      byRound.set(sync.result.roundId, list);
    }
    for (const [roundId, roundSyncs] of byRound) {
      if (!(await this.sendRound(base, wcif, roundId, roundSyncs))) {
        return false;
      }
    }
    return true;
  }

  private async sendRound(
    base: string,
    wcif: Wcif,
    roundId: string,
    syncs: SyncWithResult[],
  ) {
    const round = getRoundInfoFromWcif(roundId, wcif);
    if (!round) {
      await this.setStatus(
        syncs,
        LiveSyncStatus.REJECTED,
        'Round not in the WCIF',
      );
      return true;
    }
    const isFirstRound = Number(roundId.split('-r')[1]) === 1;
    let liveRound = await this.getLiveRound(base, roundId);
    if (!liveRound) return false;
    // A first round touches no other round when it opens, so the first
    // result to send opens it if the group start didn't
    if ((liveRound.results ?? []).length === 0 && isFirstRound) {
      const opened = await this.request(`${base}/rounds/${roundId}/open`, {
        method: 'PUT',
      });
      if (!opened) return false;
      if (opened.ok) {
        liveRound = await this.getLiveRound(base, roundId);
        if (!liveRound) return false;
      }
    }
    const inRound = new Set(
      (liveRound.results ?? []).map((result) => result.registration_id),
    );
    // Fetched once per round, only if someone turns out to be missing
    let addable: AddableRegistration[] | null = null;
    const getAddable = async () => {
      if (addable === null) {
        const found = await this.request(
          `${base}/rounds/${roundId}/addable_competitors`,
        );
        if (!found) return null;
        addable = found.ok ? ((await found.json()).registrations ?? []) : [];
      }
      return addable;
    };
    const rules = {
      maxAttempts: getNumberOfAttemptsForRound(roundId, wcif),
      cutoff: round.cutoff,
      timeLimit: round.timeLimit,
    };

    const batch: { sync: SyncWithResult; attempts: LiveAttempt[] }[] = [];
    for (const sync of syncs) {
      const registrationId = sync.result.person.wcaRegistrationId;
      if (registrationId === null) {
        await this.setStatus(
          [sync],
          LiveSyncStatus.NOT_SENDABLE,
          'No WCA registration',
        );
        continue;
      }
      if (!inRound.has(registrationId)) {
        if (sync.result.removedAt) {
          // Removed under Regulation 9t and already out of the round
          await this.prisma.liveSync.update({
            where: { resultId: sync.resultId },
            data: {
              status: LiveSyncStatus.CONFIRMED,
              removedFromRound: true,
              error: null,
            },
          });
          continue;
        }
        if (inRound.size === 0) {
          await this.setStatus(
            [sync],
            LiveSyncStatus.NOT_IN_ROUND,
            ROUND_NOT_OPEN,
          );
          continue;
        }
        const added = await this.addToRound(
          base,
          roundId,
          sync,
          isFirstRound,
          getAddable,
        );
        if (added === null) return false;
        if (added !== true) {
          await this.setStatus([sync], LiveSyncStatus.NOT_IN_ROUND, added);
          continue;
        }
        inRound.add(registrationId);
      }
      // A removed result's times come off the public results
      const attempts = sync.result.removedAt
        ? []
        : toLiveAttempts(sync.result.attempts);
      const broken = breaksRoundRules(attempts, rules);
      if (broken) {
        await this.setStatus([sync], LiveSyncStatus.REJECTED, broken);
        continue;
      }
      if (attempts.length === 0) {
        // The write endpoint can't express "no attempts"
        const cleared = await this.request(
          `${base}/rounds/${roundId}/${registrationId}/clear`,
          { method: 'PUT' },
        );
        if (!cleared) return false;
        if (cleared.ok && sync.result.removedAt) {
          // Regulation 9t: they wouldn't have advanced, so they leave the
          // round, with nobody moving up in their place
          const quit = await this.request(
            `${base}/rounds/${roundId}/${registrationId}`,
            { method: 'DELETE' },
          );
          if (!quit) return false;
          if (quit.ok) {
            await this.prisma.liveSync.update({
              where: { resultId: sync.resultId },
              data: {
                status: LiveSyncStatus.CONFIRMED,
                removedFromRound: true,
                error: null,
              },
            });
          } else {
            // Left in the round with an empty result, they'd keep the next
            // round pending on the WCA: say so rather than look done
            const body = await quit.json().catch(() => ({}));
            await this.setStatus(
              [sync],
              LiveSyncStatus.REJECTED,
              `Emptied, but not removed from the round: ${body?.status ?? body?.error ?? `the WCA answered ${quit.status}`}`,
            );
          }
          continue;
        }
        await this.afterWrite([{ sync, attempts }], cleared);
        continue;
      }
      batch.push({ sync, attempts });
    }

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const chunk = batch.slice(i, i + BATCH_SIZE);
      const sent = await this.request(`${base}/rounds/${roundId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: chunk.map(({ sync, attempts }) => ({
            registration_id: sync.result.person.wcaRegistrationId,
            attempts,
          })),
        }),
      });
      if (!sent) return false;
      if (!(await this.afterWrite(chunk, sent))) return false;
    }
    return true;
  }

  /**
   * Puts someone missing from the WCA's round into it when the rules allow:
   * in a first round, an accepted registration for the event; in a later
   * round, only a competitor FKMTime itself removed (a restored Regulation 9t
   * ruling). True when added, null when the run has to stop, otherwise the
   * reason they weren't.
   */
  private async addToRound(
    base: string,
    roundId: string,
    sync: SyncWithResult,
    isFirstRound: boolean,
    getAddable: () => Promise<AddableRegistration[] | null>,
  ): Promise<true | string | null> {
    const registrationId = sync.result.person.wcaRegistrationId;
    if (!isFirstRound && !sync.removedFromRound) {
      return `Didn't advance to ${roundId} in WCA Integrated Live Results`;
    }
    if (isFirstRound) {
      const addable = await getAddable();
      if (addable === null) return null;
      const registration = addable.find((r) => r.id === registrationId);
      if (!registration) return 'No accepted WCA registration';
      const eventId = roundId.split('-r')[0];
      if (!registration.competing?.event_ids?.includes(eventId)) {
        return `Not registered for ${eventId} on the WCA website`;
      }
    }
    const added = await this.request(
      `${base}/rounds/${roundId}/${registrationId}`,
      { method: 'PUT' },
    );
    if (!added) return null;
    if (!added.ok) {
      const body = await added.json().catch(() => ({}));
      return body?.status ?? body?.error ?? `The WCA answered ${added.status}`;
    }
    if (sync.removedFromRound) {
      await this.prisma.liveSync.update({
        where: { resultId: sync.resultId },
        data: { removedFromRound: false },
      });
    }
    return true;
  }

  private async getLiveRound(
    base: string,
    roundId: string,
  ): Promise<LiveRound | null> {
    const response = await this.request(`${base}/rounds/${roundId}`);
    if (!response) return null;
    return response.ok ? await response.json() : {};
  }

  /** False when the connection itself was refused and the run should stop */
  private async afterWrite(
    entries: { sync: SyncWithResult; attempts: LiveAttempt[] }[],
    response: Response,
  ) {
    if (response.ok) {
      const sentAt = new Date();
      await this.prisma.$transaction(
        entries.map(({ sync, attempts }) =>
          this.prisma.liveSync.update({
            where: { resultId: sync.resultId },
            data: {
              status: LiveSyncStatus.SENT,
              sentHash: liveAttemptsHash(attempts),
              sentAt,
              checks: 0,
              error: null,
            },
          }),
        ),
      );
      return true;
    }
    const body = await response.json().catch(() => ({}));
    const reason: string =
      body?.status ?? body?.error ?? `The WCA answered ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      await this.setError(
        entries.map((e) => e.sync),
        reason,
      );
      return false;
    }
    const status =
      reason === 'round is not open' ||
      reason.includes('not part of this round')
        ? LiveSyncStatus.NOT_IN_ROUND
        : LiveSyncStatus.REJECTED;
    // The WCA refuses the whole batch at the first bad entry: mark that one,
    // and the rest go again on the next run
    const culprit = entries.find(
      (e) => e.sync.result.person.wcaRegistrationId === body?.registration_id,
    );
    if (culprit && entries.length > 1) {
      await this.setStatus([culprit.sync], status, reason);
      return true;
    }
    await this.setStatus(
      entries.map((e) => e.sync),
      status,
      reason,
    );
    return true;
  }

  /** Confirms SENT results whose write had time to happen, by reading back */
  private async readBack(base: string) {
    const sent = await this.prisma.liveSync.findMany({
      where: {
        status: LiveSyncStatus.SENT,
        sentAt: { lte: new Date(Date.now() - READ_BACK_AFTER_MS) },
      },
      include: { result: { include: { person: true } } },
    });
    const roundIds = [...new Set(sent.map((sync) => sync.result.roundId))];
    for (const roundId of roundIds) {
      const response = await this.request(`${base}/rounds/${roundId}`);
      if (!response) return;
      if (!response.ok) continue;
      const liveRound: LiveRound = await response.json();
      const held = new Map(
        (liveRound.results ?? []).map((result) => [
          result.registration_id,
          liveAttemptsHash(result.attempts ?? []),
        ]),
      );
      for (const sync of sent.filter((s) => s.result.roundId === roundId)) {
        const registrationId = sync.result.person.wcaRegistrationId;
        if (held.get(registrationId) === sync.sentHash) {
          await this.prisma.liveSync.update({
            where: { resultId: sync.resultId },
            data: { status: LiveSyncStatus.CONFIRMED },
          });
          continue;
        }
        // Not there yet, or an older write overtook it in the WCA's queue
        const checks = sync.checks + 1;
        await this.prisma.liveSync.update({
          where: { resultId: sync.resultId },
          data:
            checks >= MAX_READ_BACKS
              ? { status: LiveSyncStatus.DIRTY, checks: 0 }
              : { checks },
        });
      }
    }
  }

  /** Null when the run has to stop: out of requests, backing off, or offline */
  private async request(
    url: string,
    init: RequestInit = {},
  ): Promise<Response | null> {
    if (!this.takeRequestSlot()) return null;
    const response = await this.connection
      .authorizedFetch(url, init)
      .catch((e) => {
        this.logger.error(`Request to the WCA failed: ${e}`);
        return null;
      });
    if (!response) return null;
    if (response.status === 429 || response.status >= 500) {
      this.backOff(response.status);
      return null;
    }
    this.failures = 0;
    return response;
  }

  private takeRequestSlot() {
    const minuteAgo = Date.now() - 60_000;
    this.requestTimes = this.requestTimes.filter((time) => time > minuteAgo);
    if (this.requestTimes.length >= MAX_REQUESTS_PER_MINUTE) return false;
    this.requestTimes.push(Date.now());
    return true;
  }

  private backOff(status: number) {
    this.failures += 1;
    const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.failures);
    this.pausedUntil = Date.now() + wait;
    this.logger.warn(`The WCA answered ${status}: waiting ${wait / 1000} s`);
  }

  private async setStatus(
    syncs: { resultId: string }[],
    status: LiveSyncStatus,
    error: string | null,
  ) {
    await this.prisma.liveSync.updateMany({
      where: { resultId: { in: syncs.map((sync) => sync.resultId) } },
      data: { status, error },
    });
  }

  private async setError(syncs: { resultId: string }[], error: string) {
    await this.prisma.liveSync.updateMany({
      where: { resultId: { in: syncs.map((sync) => sync.resultId) } },
      data: { error },
    });
  }
}
