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
import { DbService, runInTransaction } from 'src/db/db.service';
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
import { matchesFedBy, otherSide } from './matchEngine';
import { finishMatch, resolveWalkovers } from './matchStore';

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
  ) {}

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
   * scramble (or the next scramble nobody has raced, once those run out). Only the last point raced, while the match plays, once
   * both results are in: the opponent's attempt must be on the old
   * scramble too.
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
        if (match.status !== H2hMatchStatus.IN_PROGRESS) {
          throw new ConflictException(
            `${label} isn't playing, so its points can't get an extra. A finished match keeps its points (Regulation 11l).`,
          );
        }
        const { attemptA, attemptB } = point;
        if (!attemptA || !attemptB) {
          throw new ConflictException(
            `Both results of ${where} must be in before an extra: both competitors race it again. Enter the missing one first.`,
          );
        }
        const later = await db.h2hPoint.count({
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
        if (later > 0) {
          throw new ConflictException(
            `Only the last point raced can get an extra, and ${where} has been followed by another.`,
          );
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
        for (const attempt of [attemptA, attemptB]) {
          const updated = await db.attempt.update({
            where: { id: attempt.id },
            data: {
              status: AttemptStatus.EXTRA_GIVEN,
              replacedBy: null,
              ...(comment?.trim() && { comment: comment.trim() }),
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
    this.appGateway.handleH2hUpdated(roundId, matchId);
    this.appGateway.handleAttemptUpdated();
    this.appGateway.handleResultEntered(roundId);
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
        data: { withdrawnAt: new Date() },
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
      tx.afterCommit(() =>
        this.appGateway.handleH2hUpdated(match.bracket.roundId, matchId),
      );
      return match.bracket.roundId;
    });
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
      await finishMatch(
        db,
        match,
        otherSide(side),
        solved ? H2hMatchEnd.RETIRED : H2hMatchEnd.WALKOVER,
      );
      await db.h2hEntrant.update({
        where: { id: entrant.id },
        data: { withdrawnAt: new Date() },
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
      tx.afterCommit(() =>
        this.appGateway.handleH2hUpdated(match.bracket.roundId, matchId),
      );
      return match.bracket.roundId;
    });
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
      const { reset, started } = matchesFedBy(matches, match.id);
      if (started) {
        const startedLabel = await labelOfMatch(
          db,
          match.bracketId,
          started.id,
        );
        throw new ConflictException(
          `${label} can't be reopened: ${startedLabel}, which follows from it, has started`,
        );
      }

      const loserSide = otherSide(match.winnerSide);
      const loser = loserSide === H2hSide.A ? match.entrantA : match.entrantB;
      if (loser?.withdrawnAt) {
        // Undo the withdrawal only where it happened: a walkover that
        // follows from an earlier one is reopened there
        const left = await db.h2hMatchLog.findFirst({
          where: { matchId, side: loserSide },
          orderBy: { createdAt: 'desc' },
        });
        if (
          !left ||
          (left.action !== H2hMatchAction.WITHDRAW &&
            left.action !== H2hMatchAction.RETIRE)
        ) {
          throw new ConflictException(
            `${loser.person.name} withdrew before ${label}, so its walkover follows from that. Reopen the match they withdrew or retired from instead.`,
          );
        }
        await db.h2hEntrant.update({
          where: { id: loser.id },
          data: { withdrawnAt: null },
        });
      }

      await db.h2hMatch.update({
        where: { id: match.id },
        data: {
          status:
            match.startedAt === null
              ? H2hMatchStatus.READY
              : H2hMatchStatus.IN_PROGRESS,
          winnerSide: null,
          endedBy: null,
          finishedAt: null,
        },
      });
      const taken = new Set([match.id, ...reset.map((m) => m.id)]);
      for (const fed of reset) {
        await db.h2hMatch.update({
          where: { id: fed.id },
          data: {
            ...(fed.sourceAMatchId !== null &&
              taken.has(fed.sourceAMatchId) && { entrantAId: null }),
            ...(fed.sourceBMatchId !== null &&
              taken.has(fed.sourceBMatchId) && { entrantBId: null }),
            status: H2hMatchStatus.WAITING,
            winnerSide: null,
            endedBy: null,
            finishedAt: null,
          },
        });
      }
      await db.h2hBracket.update({
        where: { id: match.bracketId },
        data: { status: H2hBracketStatus.IN_PROGRESS },
      });
      await db.h2hMatchLog.create({
        data: {
          matchId,
          action: H2hMatchAction.REOPEN,
          comment: why,
          createdById: userId,
        },
      });
      // Decides it again: it may finish straight away, on amended times
      await this.h2hMatchService.settle(db, match.id);
      await resolveWalkovers(db, match.bracketId);
      tx.afterCommit(() =>
        this.appGateway.handleH2hUpdated(match.bracket.roundId, matchId),
      );
      return match.bracket.roundId;
    });
    return { roundId };
  }
}
