import { activityCodeToName } from '@wca/helpers';
import {
  Competition,
  getEventInfoFromWcif,
  Result,
  ResultCondition,
  Round,
} from 'wcif-helpers';

import { BracketSize, isBracketSize } from './bracket';

/** A competitor's place in the bracket, by WCIF registrant id */
export interface SeedPick {
  registrantId: number;
  /** Tied with someone else in the previous round and ordered randomly (I1d) */
  tieBroken: boolean;
}

export interface Seeding {
  /** Seed 1 first; fewer than the bracket's size when too few advanced */
  seeds: SeedPick[];
  /** Why the seeds need the delegate's attention, or null when they don't */
  notice: string | null;
}

const findRound = (roundId: string, wcif: Competition): Round | undefined =>
  getEventInfoFromWcif(roundId.split('-r')[0], wcif)?.rounds.find(
    (round) => round.id === roundId,
  );

/**
 * The round this one's competitors come from, and the condition for
 * advancing from it. Linked rounds rank together; their last one is used.
 */
const getSource = (
  roundId: string,
  wcif: Competition,
): { round: Round; condition: ResultCondition | null } | null => {
  const source = findRound(roundId, wcif)?.participationRuleset
    ?.participationSource;
  if (source?.type === 'round') {
    const round = findRound(source.roundId, wcif);
    return round ? { round, condition: source.resultCondition } : null;
  }
  if (source?.type === 'linkedRounds') {
    const round = findRound(source.roundIds[source.roundIds.length - 1], wcif);
    return round ? { round, condition: source.resultCondition } : null;
  }
  if (source?.type === 'registrations') return null;
  // An older WCIF without a participation ruleset: the round before
  const number = Number(roundId.split('-r')[1]);
  if (number <= 1) return null;
  const round = findRound(`${roundId.split('-r')[0]}-r${number - 1}`, wcif);
  return round ? { round, condition: null } : null;
};

/**
 * The bracket size the round's advancement suggests: the previous round's
 * top N, when N is a bracket size (4, 8, 12 or 16)
 */
export const suggestBracketSize = (
  roundId: string,
  wcif: Competition,
): BracketSize | null => {
  const condition = getSource(roundId, wcif)?.condition;
  return condition?.type === 'ranking' && isBracketSize(condition.value)
    ? condition.value
    : null;
};

const isSuccess = (value: number) => value > 0;

type Ranked = Result & { ranking: number };

/**
 * Whether a ranked result of the previous round advances: it meets the
 * round's condition, and at least 25% of the round is eliminated (9p1).
 * A tie that would take more than 75% of the round through drops out whole.
 */
const advances = (
  result: Ranked,
  condition: ResultCondition | null,
  ranked: Ranked[],
) => meetsCondition(result, condition, ranked) && within9p1(result, ranked);

/** At most 75% of a round advances; a tie crossing that line drops whole */
const within9p1 = (result: Ranked, ranked: Ranked[]) =>
  ranked.filter((r) => r.ranking <= result.ranking).length <=
  Math.floor(ranked.length * 0.75);

const meetsCondition = (
  result: Ranked,
  condition: ResultCondition | null,
  ranked: Ranked[],
) => {
  if (!isSuccess(result.best)) return false;
  if (condition === null) return true;
  const rankedCount = ranked.length;
  switch (condition.type) {
    case 'ranking':
      return result.ranking <= condition.value;
    case 'percent':
      return (
        result.ranking <= Math.floor((rankedCount * condition.value) / 100)
      );
    case 'resultAchieved': {
      const value =
        condition.scope === 'average' ? result.average : result.best;
      return (
        isSuccess(value) &&
        (condition.value === null || value < condition.value)
      );
    }
  }
};

/** Shuffles a copy (Fisher–Yates) */
const shuffle = <T>(items: T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Seeds from the previous round's ranking (I1b), limited to the people who
 * advanced. People tied in the ranking are ordered randomly and flagged
 * (I1d). Without a previous round or its ranking the bracket gets no seeds,
 * and the notice says the delegate orders it by hand (I1c).
 */
export const seedFromPreviousRound = (
  roundId: string,
  wcif: Competition,
  size: number,
  random: () => number = Math.random,
): Seeding => {
  const source = getSource(roundId, wcif);
  if (!source) {
    return {
      seeds: [],
      notice:
        'This round has no previous round to seed from. Add the competitors in seed order.',
    };
  }
  const previousName = activityCodeToName(source.round.id);
  const ranked = (source.round.results ?? []).filter(
    (result): result is Ranked =>
      result.ranking !== null && result.ranking !== undefined,
  );
  if (ranked.length === 0) {
    return {
      seeds: [],
      notice: `${previousName} has no ranking yet, so the bracket has no seeds. Add the competitors in seed order.`,
    };
  }
  const advancing = ranked.filter((result) =>
    advances(result, source.condition, ranked),
  );
  const byRanking = new Map<number, number[]>();
  for (const result of advancing) {
    byRanking.set(result.ranking, [
      ...(byRanking.get(result.ranking) ?? []),
      result.personId,
    ]);
  }
  const seeds = [...byRanking.entries()]
    .sort(([x], [y]) => x - y)
    .flatMap(([, registrantIds]) =>
      shuffle(registrantIds, random).map((registrantId) => ({
        registrantId,
        tieBroken: registrantIds.length > 1,
      })),
    )
    .slice(0, size);

  const notices: string[] = [];
  const cutBy9p1 = ranked.some(
    (result) =>
      meetsCondition(result, source.condition, ranked) &&
      !within9p1(result, ranked),
  );
  if (cutBy9p1) {
    notices.push(
      `At most 75% of ${previousName} may advance (Regulation 9p1), so ${advancing.length} of its ${ranked.length} competitors did.`,
    );
  }
  if (advancing.length < size) {
    // Filling the places with people who didn't advance would break 9p
    notices.push(
      `Only ${advancing.length} competitors advanced from ${previousName}, fewer than the bracket's ${size} places. Choose a smaller bracket, or fill the empty seeds by hand only where the regulations allow it, such as reserved places.`,
    );
  } else if (advancing.length > size) {
    notices.push(
      `${advancing.length} competitors advanced from ${previousName}, and the bracket takes the top ${size}. Check the last seeds.`,
    );
  }
  if (findRound(roundId, wcif)?.participationRuleset?.reservedPlaces) {
    notices.push(
      'This round reserves places for some competitors. Check the seeds and swap competitors where needed.',
    );
  }
  return { seeds, notice: notices.length > 0 ? notices.join(' ') : null };
};
