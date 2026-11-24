import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import {
  AttemptEditLogService,
  AttemptSnapshot,
} from 'src/attempt-edit-log/attempt-edit-log.service';
import { CompetitionService } from 'src/competition/competition.service';
import { DbService, runInTransaction, Tx } from 'src/db/db.service';
import { SocketController } from 'src/socket/socket.controller';

import {
  AttemptStatus,
  H2hBracketStatus,
  H2hMatchAction,
  H2hMatchEnd,
  H2hMatchStatus,
  H2hSide,
  Prisma,
} from '../generated/prisma/client';
import { labelOfMatch, lockBracket } from './bracketStore';
import { H2hMatchService, lockMatch } from './h2hMatch.service';
import { matchesFedBy, otherSide, whyNoReopen } from './matchEngine';
import { finishMatch, resolveWalkovers, unfinishMatch } from './matchStore';

type Db = Prisma.TransactionClient;

const entrantInclude = {
  include: { person: { select: { name: true } } },
} as const;

/** A comment the action can't go without, trimmed */
const required = (comment: string | undefined, what: string) => {
  const trimmed = comment?.trim() ?? '';
  if (trimmed === '') {
    throw new BadRequestException(`Say why in the comment: ${what}`);
  }
  return trimmed;
};

/**
 * What a delegate does to a match outside its points (SPEC-001): an extra
 * on a point for both competitors, a withdrawal before the match, a
 * retirement during it, and reopening a finished one
 */
@Injectable()
export class H2hMatchActionsService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
    private readonly h2hMatchService: H2hMatchService,
    private readonly attemptEditLogService: AttemptEditLogService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    @Inject(forwardRef(() => CompetitionService))
    private readonly competitionService: CompetitionService,
  ) {}

  /**
   * After an action commits: the Matches tab, the round's results and
   * double check, and the group change, which waits on who still plays
   */
  private announce(roundId: string, matchId: string) {
    this.appGateway.handleH2hUpdated(roundId, matchId);
    this.appGateway.handleAttemptUpdated();
    this.appGateway.handleResultEntered(roundId);
    this.competitionService.requestGroupChangeCheck(roundId);
  }

  /**
   * Moves the attempts replaced by an extra not raced yet, on the points
   * given, between waiting for it (Extra granted) and called off (Voided),
   * with an edit log line saying why: called off when the match ends
   * before the re-race or the point no longer counts, waiting again when
   * a reopened match plays it after all
   */
  private async moveWaitingExtras(
    tx: Tx,
    points: Prisma.H2hPointWhereInput,
    change: { from: AttemptStatus; to: AttemptStatus },
    userId: string,
    why: string,
  ) {
    const attempts = await tx.db.attempt.findMany({
      where: {
        status: change.from,
        replacedBy: null,
        OR: [
          { h2hExtraAsA: { point: points } },
          { h2hExtraAsB: { point: points } },
        ],
      },
    });
    const now = new Date();
    for (const attempt of attempts) {
      const updated = await tx.db.attempt.update({
        where: { id: attempt.id },
        data: { status: change.to, updatedBy: { connect: { id: userId } } },
      });
      await this.attemptEditLogService.log(
        updated as AttemptSnapshot,
        now,
        userId,
        why,
        tx,
      );
    }
  }

  /**
   * The matches an extra on a finished match's last point takes back,
   * refused when one of them has started on its result
   */
  private async fedMatches(
    db: Db,
    match: { id: string; bracketId: string },
    label: string,
  ) {
    const matches = await db.h2hMatch.findMany({
      where: { bracketId: match.bracketId },
    });
    const { reset, started } = matchesFedBy(matches, match.id);
    if (started) {
      const startedLabel = await labelOfMatch(db, match.bracketId, started.id);
      throw new ConflictException(
        `${label} has finished and ${startedLabel}, which follows from it, has started, so its points can't get an extra any more (Regulation 11l)`,
      );
    }
    return reset;
  }

  /**
   * The match with its round, after taking the round's lock and then the
   * match's: the order recording an attempt takes them
   */
  private async lockedMatch(db: Db, matchId: string) {
    const found = await db.h2hMatch.findUnique({
      where: { id: matchId },
      select: { bracket: { select: { roundId: true } } },
    });
    if (!found) throw new NotFoundException('Match not found');
    await lockBracket(db, found.bracket.roundId);
    await lockMatch(db, matchId);
    const match = await db.h2hMatch.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        bracket: { select: { id: true, roundId: true, status: true } },
        entrantA: entrantInclude,
        entrantB: entrantInclude,
      },
    });
    const label = await labelOfMatch(db, match.bracketId, match.id);
    return { match, label };
  }

  /**
   * Extra granted on a point (11k1): both attempts become Extra granted,
   * and the point is cleared to be raced again on the set's next extra
   * scramble (or the next scramble nobody has raced, once those run out).
   * Only the last point raced, once both results are in: the opponent's
   * attempt must be on the old scramble too. That may be the point that
   * finished the match: the match plays again, as long as none of the
   * matches it fed has started.
   */
  async grantExtra(pointId: string, userId: string, comment?: string) {
    const { roundId, matchId, incidents } = await runInTransaction(
      this.prisma,
      async (tx) => {
        const db = tx.db;
        const found = await db.h2hPoint.findUnique({
          where: { id: pointId },
          select: { set: { select: { matchId: true } } },
        });
        if (!found) throw new NotFoundException('Point not found');
        const { match, label } = await this.lockedMatch(db, found.set.matchId);
        const point = await db.h2hPoint.findUniqueOrThrow({
          where: { id: pointId },
          include: {
            set: true,
            attemptA: { include: { device: true } },
            attemptB: { include: { device: true } },
          },
        });
        const where = `${label}, set ${point.set.setNumber}, point ${point.pointNumber}`;
        const playedOut =
          match.status === H2hMatchStatus.FINISHED &&
          match.endedBy === H2hMatchEnd.PLAYED;
        if (match.status !== H2hMatchStatus.IN_PROGRESS && !playedOut) {
          throw new ConflictException(
            `${label} isn't playing, so its points can't get an extra. A finished match keeps its points (Regulation 11l).`,
          );
        }
        if (point.afterEnd) {
          throw new ConflictException(
            `${where} was raced after its set or the match was over, so it doesn't count and can't get an extra`,
          );
        }
        const { attemptA, attemptB } = point;
        if (!attemptA || !attemptB) {
          throw new ConflictException(
            `Both results of ${where} must be in before an extra: both competitors race it again. Enter the missing one first.`,
          );
        }
        const later = await db.h2hPoint.findMany({
          select: {
            pointNumber: true,
            attemptAId: true,
            attemptBId: true,
            set: { select: { setNumber: true } },
          },
          where: {
            OR: [
              { setId: point.setId, pointNumber: { gt: point.pointNumber } },
              {
                set: {
                  matchId: match.id,
                  setNumber: { gt: point.set.setNumber },
                },
              },
            ],
          },
        });
        const [next] = later;
        if (later.length === 1 && (!next.attemptAId || !next.attemptBId)) {
          const name = (next.attemptAId ? match.entrantA : match.entrantB)
            ?.person.name;
          throw new ConflictException(
            `Only the last point raced can get an extra, and ${name ?? 'one competitor'} has started set ${next.set.setNumber}, point ${next.pointNumber} since. Delete that attempt first, then grant the extra; it is raced again after.`,
          );
        }
        if (later.length > 0) {
          throw new ConflictException(
            `Only the last point raced can get an extra, and ${where} has been followed by another.`,
          );
        }
        if (playedOut) {
          // The point that finished the match: it plays again
          const reset = await this.fedMatches(db, match, label);
          await unfinishMatch(db, match, reset);
        }

        await db.h2hPoint.update({
          where: { id: point.id },
          data: {
            attemptAId: null,
            attemptBId: null,
            scrambleId: null,
            winnerSide: null,
            decidedAt: null,
          },
        });
        await db.h2hPointExtra.create({
          data: {
            pointId: point.id,
            attemptAId: attemptA.id,
            attemptBId: attemptB.id,
            scrambleId: point.scrambleId,
          },
        });
        const scrambleId = await this.h2hMatchService.pickScramble(
          db,
          match,
          point.set,
          point.pointNumber,
          { extra: true },
        );
        await db.h2hPoint.update({
          where: { id: point.id },
          data: { scrambleId },
        });
        const now = new Date();
        const why = comment?.trim() ?? '';
        for (const attempt of [attemptA, attemptB]) {
          const updated = await db.attempt.update({
            where: { id: attempt.id },
            data: {
              status: AttemptStatus.EXTRA_GIVEN,
              replacedBy: null,
              // Added to what the judge or delegate wrote already
              ...(why !== '' && {
                comment: attempt.comment ? `${attempt.comment}\n${why}` : why,
              }),
              updatedBy: { connect: { id: userId } },
            },
          });
          await this.attemptEditLogService.log(
            updated as AttemptSnapshot,
            now,
            userId,
            'Extra granted on the point, for both competitors',
            tx,
          );
        }
        // The point may have decided its set: the set is open again, and
        // a next set not raced yet closes
        await this.h2hMatchService.settle(db, match.id);
        return {
          roundId: match.bracket.roundId,
          matchId: match.id,
          // A station waiting on an incident on one of them hears it is
          // resolved
          incidents: [attemptA, attemptB].filter(
            (attempt) => attempt.status === AttemptStatus.UNRESOLVED,
          ),
        };
      },
    );
    for (const attempt of incidents) {
      if (!attempt.device) continue;
      this.socketController.sendResponseToAllSockets({
        type: 'IncidentResolved',
        data: {
          attempt: { ...attempt, status: AttemptStatus.EXTRA_GIVEN },
          espId: attempt.device.espId,
          shouldScanCards: false,
        },
      });
    }
    this.announce(roundId, matchId);
    return { roundId };
  }

  /**
   * A competitor withdraws before their match starts (I2h): the match is a
   * walkover for the opponent, now or once the opponent is known, and so
   * is every later match the competitor would have played
   */
  async withdraw(
    matchId: string,
    side: H2hSide,
    userId: string,
    comment?: string,
  ) {
    const roundId = await runInTransaction(this.prisma, async (tx) => {
      const db = tx.db;
      const { match, label } = await this.lockedMatch(db, matchId);
      if (match.status === H2hMatchStatus.IN_PROGRESS) {
        throw new ConflictException(
          `${label} has started. To stop it for one competitor, use Retire.`,
        );
      }
      if (match.status === H2hMatchStatus.FINISHED) {
        throw new ConflictException(`${label} has finished`);
      }
      if (match.bracket.status === H2hBracketStatus.DRAFT) {
        throw new ConflictException(
          'Fill every seed first. Until the first match starts, change the seeds instead of withdrawing someone.',
        );
      }
      const entrant = side === H2hSide.A ? match.entrantA : match.entrantB;
      if (!entrant) {
        throw new ConflictException(
          `${label} doesn't know this competitor yet`,
        );
      }
      if (entrant.withdrawnAt !== null) {
        throw new ConflictException(
          `${entrant.person.name} has withdrawn already`,
        );
      }
      await db.h2hEntrant.update({
        where: { id: entrant.id },
        data: { withdrawnAt: new Date(), withdrawnInMatchId: matchId },
      });
      await db.h2hMatchLog.create({
        data: {
          matchId,
          action: H2hMatchAction.WITHDRAW,
          side,
          comment: comment?.trim() || null,
          createdById: userId,
        },
      });
      await resolveWalkovers(db, match.bracketId);
      return match.bracket.roundId;
    });
    this.announce(roundId, matchId);
    return { roundId };
  }

  /**
   * A competitor can't go on during their match: the opponent wins it.
   * Decided points and sets keep their winners and every attempt stays;
   * the open point and set get none. With no attempt of the retiring
   * competitor in the match it is a walkover (9f5b). Their later matches
   * are walkovers too.
   */
  async retire(
    matchId: string,
    side: H2hSide,
    userId: string,
    comment: string,
  ) {
    const why = required(comment, 'retiring ends the match');
    const roundId = await runInTransaction(this.prisma, async (tx) => {
      const db = tx.db;
      const { match, label } = await this.lockedMatch(db, matchId);
      if (match.status !== H2hMatchStatus.IN_PROGRESS) {
        throw new ConflictException(
          match.status === H2hMatchStatus.FINISHED
            ? `${label} has finished`
            : `${label} hasn't started. Before it starts, use Withdraw.`,
        );
      }
      const entrant = side === H2hSide.A ? match.entrantA : match.entrantB;
      if (!entrant) {
        throw new Error(`Match ${matchId} is playing without both competitors`);
      }
      const mine =
        side === H2hSide.A
          ? { attemptAId: { not: null } }
          : { attemptBId: { not: null } };
      const solved =
        (await db.h2hPoint.count({
          where: {
            set: { matchId },
            OR: [mine, { extras: { some: {} } }],
          },
        })) > 0;
      // A set opened but never raced was never played
      await db.h2hSet.deleteMany({ where: { matchId, points: { none: {} } } });
      // An extra granted but not raced yet won't be: the attempts it
      // replaced stop waiting for it, so double check and the group
      // change don't wait on them
      await this.moveWaitingExtras(
        tx,
        { set: { matchId } },
        { from: AttemptStatus.EXTRA_GIVEN, to: AttemptStatus.VOIDED },
        userId,
        `No longer needed: ${label} ended when a competitor retired before the extra was raced`,
      );
      await finishMatch(
        db,
        match,
        otherSide(side),
        solved ? H2hMatchEnd.RETIRED : H2hMatchEnd.WALKOVER,
      );
      await db.h2hEntrant.update({
        where: { id: entrant.id },
        data: { withdrawnAt: new Date(), withdrawnInMatchId: matchId },
      });
      await db.h2hMatchLog.create({
        data: {
          matchId,
          action: H2hMatchAction.RETIRE,
          side,
          comment: why,
          createdById: userId,
        },
      });
      await resolveWalkovers(db, match.bracketId);
      return match.bracket.roundId;
    });
    this.announce(roundId, matchId);
    return { roundId };
  }

  /**
   * Unfreezes a finished match and decides it again from its times as they
   * are now (the 11l exception), taking back the matches it fed while none
   * of them has started. Undoes a mistaken Retire or Withdraw on it too.
   */
  async reopen(matchId: string, userId: string, comment: string) {
    const why = required(comment, 'reopening changes a finished match');
    const roundId = await runInTransaction(this.prisma, async (tx) => {
      const db = tx.db;
      const { match, label } = await this.lockedMatch(db, matchId);
      if (match.status !== H2hMatchStatus.FINISHED || !match.winnerSide) {
        throw new ConflictException(`${label} hasn't finished`);
      }
      const matches = await db.h2hMatch.findMany({
        where: { bracketId: match.bracketId },
      });
      const refusal = whyNoReopen(
        match,
        { a: match.entrantA, b: match.entrantB },
        matches,
      );
      if (refusal?.kind === 'fedStarted') {
        const startedLabel = await labelOfMatch(
          db,
          match.bracketId,
          refusal.matchId,
        );
        throw new ConflictException(
          `${label} can't be reopened: ${startedLabel}, which follows from it, has started`,
        );
      }
      const loser =
        match.winnerSide === H2hSide.A ? match.entrantB : match.entrantA;
      if (refusal?.kind === 'withdrewElsewhere') {
        const there = refusal.matchId
          ? await labelOfMatch(db, match.bracketId, refusal.matchId)
          : null;
        throw new ConflictException(
          `${loser?.person.name ?? 'The competitor'} withdrew ${there ? `in ${there}` : 'earlier'}, and this walkover follows from that. Reopen ${there ?? 'the match they withdrew or retired from'} instead.`,
        );
      }
      // A walkover or retirement in this match: the competitor is back
      if (match.endedBy !== H2hMatchEnd.PLAYED && loser?.withdrawnAt) {
        await db.h2hEntrant.update({
          where: { id: loser.id },
          data: { withdrawnAt: null, withdrawnInMatchId: null },
        });
      }

      const { reset } = matchesFedBy(matches, match.id);
      await unfinishMatch(db, match, reset);
      await db.h2hMatchLog.create({
        data: {
          matchId,
          action: H2hMatchAction.REOPEN,
          comment: why,
          createdById: userId,
        },
      });
      // Decides it again: it may finish straight away, on amended times
      await this.h2hMatchService.settle(db, match.id, { reopening: true });
      // An extra a retirement called off is raced after all, unless its
      // point turned out to come after the end: then it stays called off.
      // (Only a retirement leaves a finished match with an extra not raced.)
      await this.moveWaitingExtras(
        tx,
        { set: { matchId }, afterEnd: false },
        { from: AttemptStatus.VOIDED, to: AttemptStatus.EXTRA_GIVEN },
        userId,
        `Waiting for its extra again: ${label} was reopened`,
      );
      await resolveWalkovers(db, match.bracketId);
      return match.bracket.roundId;
    });
    this.announce(roundId, matchId);
    return { roundId };
  }
}
