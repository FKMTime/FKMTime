/**
 * Writes a bracket's rows (SPEC-001). Plain functions over a Prisma client,
 * so the API and the test seed build brackets the same way.
 */
import {
  H2hBracketStatus,
  H2hMatchStatus,
  H2hStage,
  Prisma,
} from '../generated/prisma/client';
import {
  BracketSize,
  buildBracket,
  isBracketSize,
  SetsToWinByStage,
  STAGE_LABELS,
} from './bracket';
import { buildPlanRows, matchScrambleSets } from './scramblePlan';

type Db = Prisma.TransactionClient;

/** A competitor for a seed, in seed order */
export interface SeedEntry {
  personId: string;
  seedTieBroken: boolean;
}

/** Matches that haven't started can still change */
export const NOT_STARTED: H2hMatchStatus[] = [
  H2hMatchStatus.WAITING,
  H2hMatchStatus.READY,
];

/**
 * Serialises changes to one round's bracket and scramble plan, so a scramble
 * import and a delegate's edit can't interleave
 */
export const lockBracket = (db: Db, roundId: string) =>
  db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`h2h-bracket:${roundId}`}))`;

/** Sets to win per stage, read back from the matches */
export const setsToWinOf = (
  matches: { stage: H2hStage; setsToWin: number }[],
): SetsToWinByStage =>
  Object.fromEntries(matches.map((match) => [match.stage, match.setsToWin]));

/** "Quarterfinal 2", or "Final" for a stage with one match */
export const matchLabels = (
  matches: { id: string; stage: H2hStage; matchNumber: number }[],
): Map<string, string> => {
  const labels = new Map<string, string>();
  const sorted = [...matches].sort((x, y) => x.matchNumber - y.matchNumber);
  for (const match of sorted) {
    const inStage = sorted.filter((m) => m.stage === match.stage);
    labels.set(
      match.id,
      inStage.length === 1
        ? STAGE_LABELS[match.stage]
        : `${STAGE_LABELS[match.stage]} ${inStage.indexOf(match) + 1}`,
    );
  }
  return labels;
};

/**
 * Puts these competitors in the bracket as seeds 1, 2, …, and fills the
 * matches they play straight away. A match whose two sides are both known
 * is ready. The bracket is seeded once every seed has a competitor.
 */
export const applySeeds = async (
  db: Db,
  bracketId: string,
  seeds: SeedEntry[],
) => {
  const bracket = await db.h2hBracket.findUniqueOrThrow({
    where: { id: bracketId },
    include: { matches: true },
  });
  if (!isBracketSize(bracket.size)) {
    throw new Error(`Bracket ${bracketId} has size ${bracket.size}`);
  }
  await db.h2hEntrant.deleteMany({ where: { bracketId } });
  await db.h2hEntrant.createMany({
    data: seeds.map((entry, i) => ({
      bracketId,
      personId: entry.personId,
      seed: i + 1,
      seedTieBroken: entry.seedTieBroken,
    })),
  });
  const entrants = await db.h2hEntrant.findMany({ where: { bracketId } });
  const entrantBySeed = new Map(entrants.map((e) => [e.seed, e.id]));
  const layout = buildBracket(bracket.size, setsToWinOf(bracket.matches));
  for (const match of bracket.matches) {
    const planned = layout.find((m) => m.matchNumber === match.matchNumber);
    if (!planned) {
      throw new Error(`Match ${match.matchNumber} is not in the bracket`);
    }
    const entrantA =
      planned.a.kind === 'seed'
        ? (entrantBySeed.get(planned.a.seed) ?? null)
        : null;
    const entrantB =
      planned.b.kind === 'seed'
        ? (entrantBySeed.get(planned.b.seed) ?? null)
        : null;
    await db.h2hMatch.update({
      where: { id: match.id },
      data: {
        entrantAId: entrantA,
        entrantBId: entrantB,
        status:
          entrantA !== null && entrantB !== null
            ? H2hMatchStatus.READY
            : H2hMatchStatus.WAITING,
      },
    });
  }
  await db.h2hBracket.update({
    where: { id: bracketId },
    data: {
      status:
        seeds.length === bracket.size
          ? H2hBracketStatus.SEEDED
          : H2hBracketStatus.DRAFT,
    },
  });
};

/**
 * Fills the scramble plan's empty rows with the round's sets nobody races
 * yet, in letter order. Rows that have a set keep it (SPEC-001, Scrambles),
 * and rows of finished matches are skipped. Does nothing for a round
 * without a bracket.
 */
export const rematchScramblePlan = async (db: Db, roundId: string) => {
  await lockBracket(db, roundId);
  const bracket = await db.h2hBracket.findUnique({
    where: { roundId },
    include: { matches: { include: { scrambleAssignments: true } } },
  });
  if (!bracket) return;
  const sets = await db.scrambleSet.findMany({
    where: {
      roundId,
      // A set already raced, as a planned set or as a spare, is not free
      h2hSet: { is: null },
      scrambles: { none: { h2hPoint: { isNot: null } } },
    },
    select: { id: true, set: true },
  });
  const finished = new Set(
    bracket.matches
      .filter((match) => match.status === H2hMatchStatus.FINISHED)
      .map((match) => match.id),
  );
  // A finished match needs no more sets: its empty rows stay empty, while
  // the sets its rows hold stay taken
  const rows = bracket.matches
    .flatMap((match) => match.scrambleAssignments)
    .filter((row) => row.scrambleSetId !== null || !finished.has(row.matchId));
  const matched = matchScrambleSets(
    bracket.matches.map((match) => ({
      matchId: match.id,
      matchNumber: match.matchNumber,
      setsToWin: match.setsToWin,
    })),
    rows,
    sets,
  );
  for (const row of matched) {
    const before = rows.find(
      (r) => r.matchId === row.matchId && r.setNumber === row.setNumber,
    );
    if (before && before.scrambleSetId !== row.scrambleSetId) {
      await db.h2hScrambleAssignment.update({
        where: { id: before.id },
        data: { scrambleSetId: row.scrambleSetId },
      });
      // A set that opened while its row was empty races on what the row
      // gets now, so importing more sets unblocks it
      if (row.scrambleSetId !== null) {
        await db.h2hSet.updateMany({
          where: {
            matchId: row.matchId,
            setNumber: row.setNumber,
            scrambleSetId: null,
          },
          data: { scrambleSetId: row.scrambleSetId },
        });
      }
    }
  }
};

/**
 * Gives each match one plan row per set it could need (2X − 1), adding or
 * removing rows after its sets to win changed
 */
export const resizePlan = async (
  db: Db,
  matches: { id: string; matchNumber: number; setsToWin: number }[],
) => {
  const rows = buildPlanRows(
    matches.map((match) => ({
      matchId: match.id,
      matchNumber: match.matchNumber,
      setsToWin: match.setsToWin,
    })),
  );
  for (const match of matches) {
    const wanted = rows.filter((row) => row.matchId === match.id).length;
    await db.h2hScrambleAssignment.deleteMany({
      where: { matchId: match.id, setNumber: { gt: wanted } },
    });
  }
  await db.h2hScrambleAssignment.createMany({
    data: rows,
    skipDuplicates: true,
  });
};

export interface NewBracket {
  roundId: string;
  eventId: string;
  size: BracketSize;
  /** Must have passed validateSetsToWin */
  setsToWin: SetsToWinByStage;
  seeds: SeedEntry[];
}

/**
 * Creates the bracket: its matches with where each side comes from, its
 * seeds, and its scramble plan matched to the round's sets
 */
export const createBracket = async (db: Db, input: NewBracket) => {
  await lockBracket(db, input.roundId);
  const bracket = await db.h2hBracket.create({
    data: {
      roundId: input.roundId,
      eventId: input.eventId,
      size: input.size,
    },
  });
  const layout = buildBracket(input.size, input.setsToWin);
  await db.h2hMatch.createMany({
    data: layout.map((match) => ({
      bracketId: bracket.id,
      stage: match.stage,
      matchNumber: match.matchNumber,
      setsToWin: match.setsToWin,
    })),
  });
  const matches = await db.h2hMatch.findMany({
    where: { bracketId: bracket.id },
  });
  const idOf = new Map(matches.map((m) => [m.matchNumber, m.id]));
  const sourceId = (matchNumber: number) => {
    const id = idOf.get(matchNumber);
    if (id === undefined) throw new Error(`No match ${matchNumber}`);
    return id;
  };
  for (const planned of layout) {
    if (planned.a.kind === 'seed' && planned.b.kind === 'seed') continue;
    await db.h2hMatch.update({
      where: { id: sourceId(planned.matchNumber) },
      data: {
        ...(planned.a.kind === 'match' && {
          sourceAMatchId: sourceId(planned.a.matchNumber),
          sourceAOutcome: planned.a.outcome,
        }),
        ...(planned.b.kind === 'match' && {
          sourceBMatchId: sourceId(planned.b.matchNumber),
          sourceBOutcome: planned.b.outcome,
        }),
      },
    });
  }
  await resizePlan(db, matches);
  await applySeeds(db, bracket.id, input.seeds);
  await rematchScramblePlan(db, input.roundId);
  return bracket;
};
