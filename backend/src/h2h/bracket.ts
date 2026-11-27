import { H2hOutcome, H2hStage } from '../generated/prisma/client';

/** The bracket sizes Article I allows (I1a) */
export const BRACKET_SIZES = [4, 8, 12, 16] as const;
export type BracketSize = (typeof BRACKET_SIZES)[number];

export const isBracketSize = (size: number): size is BracketSize =>
  BRACKET_SIZES.some((allowed) => allowed === size);

/** X in Regulation I3a: a match goes to the first to win X sets */
export const MAX_SETS_TO_WIN = 3;

export type SetsToWinByStage = Partial<Record<H2hStage, number>>;

/** A side of a match: seeded straight in, or filled from an earlier match */
export type BracketSlot =
  | { kind: 'seed'; seed: number }
  | { kind: 'match'; matchNumber: number; outcome: H2hOutcome };

export interface BracketMatch {
  matchNumber: number;
  stage: H2hStage;
  setsToWin: number;
  /** The side the higher seed would take if every higher seed won */
  a: BracketSlot;
  b: BracketSlot;
}

/** How the stages are named to people (I2a) */
export const STAGE_LABELS: Record<H2hStage, string> = {
  STAGE_OF_16: 'Stage of 16',
  STAGE_OF_12: 'Stage of 12',
  QUARTERFINAL: 'Quarterfinal',
  SEMIFINAL: 'Semifinal',
  THIRD_PLACE: 'Third-place match',
  FINAL: 'Final',
};

/**
 * The stages a bracket plays, in order. The third-place match comes before
 * the final, so the final is the last match of the round.
 */
export const getStages = (size: BracketSize): H2hStage[] => {
  const finalStage: H2hStage[] = [H2hStage.THIRD_PLACE, H2hStage.FINAL];
  switch (size) {
    case 4:
      return [H2hStage.SEMIFINAL, ...finalStage];
    case 8:
      return [H2hStage.QUARTERFINAL, H2hStage.SEMIFINAL, ...finalStage];
    case 12:
      return [
        H2hStage.STAGE_OF_12,
        H2hStage.QUARTERFINAL,
        H2hStage.SEMIFINAL,
        ...finalStage,
      ];
    case 16:
      return [
        H2hStage.STAGE_OF_16,
        H2hStage.QUARTERFINAL,
        H2hStage.SEMIFINAL,
        ...finalStage,
      ];
  }
};

/**
 * What's wrong with the sets to win per stage, as messages for the delegate;
 * empty when they are valid. Every stage needs a value, and no stage may be
 * lower than the one before it (I3a1). The final may be higher than the
 * third-place match, never lower (I3a2).
 */
export const validateSetsToWin = (
  size: BracketSize,
  setsToWin: SetsToWinByStage,
): string[] => {
  const errors: string[] = [];
  let previous: { stage: H2hStage; value: number } | null = null;
  for (const stage of getStages(size)) {
    const value = setsToWin[stage];
    if (
      value == null ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > MAX_SETS_TO_WIN
    ) {
      errors.push(
        `Sets to win in the ${STAGE_LABELS[stage]} must be between 1 and ${MAX_SETS_TO_WIN}`,
      );
      continue;
    }
    if (previous !== null && value < previous.value) {
      errors.push(
        `Sets to win in the ${STAGE_LABELS[stage]} can't be lower than in the ${STAGE_LABELS[previous.stage]}`,
      );
    }
    previous = { stage, value };
  }
  return errors;
};

/**
 * Seeds top to bottom of a full bracket of this power-of-two size, so that
 * neighbours meet and the seeds of every match add up to the number of
 * competitors left + 1 when the higher seed always wins (I2f). Seed 1 is at
 * the top and seed 2 at the bottom.
 */
const bracketOrder = (size: number): number[] => {
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed, i) =>
      i % 2 === 0 ? [seed, next + 1 - seed] : [next + 1 - seed, seed],
    );
  }
  return order;
};

interface Entry {
  slot: BracketSlot;
  /** The seed in this slot if every higher seed won */
  expectedSeed: number;
}

/**
 * Every match of the round with where its two sides come from (I2c, I2f).
 * Match numbers run in stage order, top to bottom within a stage. With 12
 * competitors, seeds 1 to 4 skip the Stage of 12 (I2c1). Semifinal losers
 * meet in the third-place match (I2e). Expects sets to win that passed
 * validateSetsToWin.
 */
export const buildBracket = (
  size: BracketSize,
  setsToWin: SetsToWinByStage,
): BracketMatch[] => {
  const stages = getStages(size);
  const matches: BracketMatch[] = [];
  const addMatch = (stage: H2hStage, first: Entry, second: Entry) => {
    const [a, b] =
      first.expectedSeed < second.expectedSeed
        ? [first, second]
        : [second, first];
    const stageSetsToWin = setsToWin[stage];
    if (stageSetsToWin === undefined) {
      throw new Error(`No sets to win for the ${STAGE_LABELS[stage]}`);
    }
    const match: BracketMatch = {
      matchNumber: matches.length + 1,
      stage,
      setsToWin: stageSetsToWin,
      a: a.slot,
      b: b.slot,
    };
    matches.push(match);
    const fromMatch = (outcome: H2hOutcome, expectedSeed: number): Entry => ({
      slot: { kind: 'match', matchNumber: match.matchNumber, outcome },
      expectedSeed,
    });
    return {
      winner: fromMatch(H2hOutcome.WINNER, a.expectedSeed),
      loser: fromMatch(H2hOutcome.LOSER, b.expectedSeed),
    };
  };

  const fullSize = 2 ** Math.ceil(Math.log2(size));
  // Seeds past the bracket's size are byes: their opponent goes straight on
  let entries: (Entry | null)[] = bracketOrder(fullSize).map((seed) =>
    seed <= size ? { slot: { kind: 'seed', seed }, expectedSeed: seed } : null,
  );
  let semifinalLosers: Entry[] = [];
  for (const stage of stages.filter(
    (s) => s !== H2hStage.THIRD_PLACE && s !== H2hStage.FINAL,
  )) {
    const next: Entry[] = [];
    const losers: Entry[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const [first, second] = [entries[i], entries[i + 1]];
      if (first === null || second === null) {
        // At most half the bracket are byes, so a bye never meets a bye
        const advancing = first ?? second;
        if (advancing === null) throw new Error('Two byes met in the bracket');
        next.push(advancing);
        continue;
      }
      const { winner, loser } = addMatch(stage, first, second);
      next.push(winner);
      losers.push(loser);
    }
    entries = next;
    semifinalLosers = losers;
  }
  const [firstLoser, secondLoser] = semifinalLosers;
  addMatch(H2hStage.THIRD_PLACE, firstLoser, secondLoser);
  const [firstFinalist, secondFinalist] = entries;
  if (firstFinalist === null || secondFinalist === null) {
    throw new Error('The final has a bye');
  }
  addMatch(H2hStage.FINAL, firstFinalist, secondFinalist);
  return matches;
};
