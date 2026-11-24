/**
 * Ends matches and moves competitors on through the bracket (SPEC-001).
 * Plain functions over a Prisma client, called with the round locked.
 */
import {
  H2hBracketStatus,
  H2hMatchEnd,
  H2hMatchStatus,
  H2hOutcome,
  H2hSide,
  Prisma,
} from '../generated/prisma/client';
import { NOT_STARTED } from './bracketStore';
import { walkoverWinner } from './matchEngine';

type Db = Prisma.TransactionClient;

interface EndingMatch {
  id: string;
  bracketId: string;
  entrantAId: string | null;
  entrantBId: string | null;
}

/**
 * Ends the match and fills the matches it feeds with its winner and
 * loser; one with both sides known is ready to start. The bracket is
 * finished with its last match.
 */
export const finishMatch = async (
  db: Db,
  match: EndingMatch,
  winner: H2hSide,
  endedBy: H2hMatchEnd,
) => {
  await db.h2hMatch.update({
    where: { id: match.id },
    data: {
      status: H2hMatchStatus.FINISHED,
      winnerSide: winner,
      endedBy,
      finishedAt: new Date(),
    },
  });
  const winnerId = winner === H2hSide.A ? match.entrantAId : match.entrantBId;
  const loserId = winner === H2hSide.A ? match.entrantBId : match.entrantAId;
  const pick = (outcome: H2hOutcome | null) =>
    outcome === H2hOutcome.LOSER ? loserId : winnerId;
  const fed = await db.h2hMatch.findMany({
    where: {
      OR: [{ sourceAMatchId: match.id }, { sourceBMatchId: match.id }],
    },
  });
  for (const next of fed) {
    const entrantAId =
      next.sourceAMatchId === match.id
        ? pick(next.sourceAOutcome)
        : next.entrantAId;
    const entrantBId =
      next.sourceBMatchId === match.id
        ? pick(next.sourceBOutcome)
        : next.entrantBId;
    await db.h2hMatch.update({
      where: { id: next.id },
      data: {
        entrantAId,
        entrantBId,
        ...(next.status === H2hMatchStatus.WAITING &&
          entrantAId !== null &&
          entrantBId !== null && { status: H2hMatchStatus.READY }),
      },
    });
  }
  const unfinished = await db.h2hMatch.count({
    where: {
      bracketId: match.bracketId,
      status: { not: H2hMatchStatus.FINISHED },
    },
  });
  await db.h2hBracket.update({
    where: { id: match.bracketId },
    data: {
      status:
        unfinished === 0
          ? H2hBracketStatus.FINISHED
          : H2hBracketStatus.IN_PROGRESS,
    },
  });
};

/**
 * Finishes as walkovers the matches no one has started where a competitor
 * has withdrawn, once both sides are known (I2h), and the matches those
 * feed in turn: a competitor who withdrew from a semifinal gives a walkover
 * in the third-place match too
 */
export const resolveWalkovers = async (db: Db, bracketId: string) => {
  for (;;) {
    const waiting = await db.h2hMatch.findMany({
      where: { bracketId, status: { in: NOT_STARTED }, startedAt: null },
      orderBy: { matchNumber: 'asc' },
      include: {
        entrantA: { select: withdrawalSelect },
        entrantB: { select: withdrawalSelect },
      },
    });
    let next: { match: (typeof waiting)[number]; winner: H2hSide } | null =
      null;
    for (const match of waiting) {
      if (!match.entrantA || !match.entrantB) continue;
      const winner = walkoverWinner(match.entrantA, match.entrantB);
      if (winner !== null) {
        next = { match, winner };
        break;
      }
    }
    if (!next) return;
    await finishMatch(db, next.match, next.winner, H2hMatchEnd.WALKOVER);
    const loser =
      next.winner === H2hSide.A ? next.match.entrantB : next.match.entrantA;
    if (loser) await moveStrandedWithdrawal(db, loser, next.match.id);
  }
};

const withdrawalSelect = {
  id: true,
  seed: true,
  withdrawnAt: true,
  withdrawnInMatchId: true,
} as const;

/**
 * A withdrawal is undone by reopening the match it was made in. When a
 * reopened earlier match has taken the competitor out of that match since
 * (they now lose the semifinal and withdrew from the final), this walkover
 * is where it applies: it becomes the match to reopen.
 */
const moveStrandedWithdrawal = async (
  db: Db,
  loser: { id: string; withdrawnInMatchId: string | null },
  walkoverId: string,
) => {
  const madeIn =
    loser.withdrawnInMatchId === null
      ? null
      : await db.h2hMatch.findUnique({
          where: { id: loser.withdrawnInMatchId },
          select: { entrantAId: true, entrantBId: true },
        });
  if (
    madeIn &&
    (madeIn.entrantAId === loser.id || madeIn.entrantBId === loser.id)
  ) {
    return;
  }
  await db.h2hEntrant.update({
    where: { id: loser.id },
    data: { withdrawnInMatchId: walkoverId },
  });
};

/**
 * Puts a finished match back into play (Ready, for a walkover that never
 * started) and takes back the matches it fed, `reset` (see matchesFedBy):
 * their sides that came from these matches empty again
 */
export const unfinishMatch = async (
  db: Db,
  match: { id: string; bracketId: string; startedAt: Date | null },
  reset: {
    id: string;
    sourceAMatchId: string | null;
    sourceBMatchId: string | null;
  }[],
) => {
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
};
