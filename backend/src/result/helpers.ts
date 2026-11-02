import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { formatCentiseconds } from '@wca/helpers';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';
import { Person } from 'wcif-helpers';

export const isCompetitorSignedInForEvent = (
  competitorWcif: Person,
  eventId: string,
) => {
  if (!competitorWcif || !competitorWcif.registration) return false;
  return competitorWcif.registration.eventIds.includes(eventId);
};

/**
 * Time an attempt took in centiseconds, with +2 penalties added. DNF and DNS
 * carry negative penalty codes, which add nothing: a DNF counts the time it
 * took, a DNS counts nothing (its value is 0).
 */
export const attemptTimeWithPenalty = (
  attempt: Pick<Attempt, 'value' | 'penalty'>,
) => attempt.value + (attempt.penalty > 0 ? attempt.penalty * 100 : 0);

export const checkAttemptLimit = (time: number, limit: number) => {
  return time < limit;
};

export const checkCutoff = (
  attempts: Attempt[],
  cutoff: number,
  attemptsNumber: number,
) => {
  if (attempts.length < attemptsNumber) return true;
  else {
    return attempts.some(
      (attempt) =>
        attempt.penalty !== DNF_VALUE &&
        attempt.penalty !== DNS_VALUE &&
        attemptTimeWithPenalty(attempt) < cutoff,
    );
  }
};

export const getSortedStandardAttempts = (attempts: Attempt[]) => {
  return attempts
    .filter((attempt) => attempt.type === AttemptType.STANDARD_ATTEMPT)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
};

export const getSortedExtraAttempts = (attempts: Attempt[]) => {
  return attempts
    .filter((attempt) => attempt.type === AttemptType.EXTRA_ATTEMPT)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
};

/** The extra attempt that finally replaced an attempt, following chains of extras */
export const getFinalExtraAttempt = (
  originalAttemptId: string,
  attempts: Attempt[],
): Attempt | undefined => {
  const originalAttempt = attempts.find((a) => a.id === originalAttemptId);
  const extraAttempt = attempts.find(
    (a) =>
      a.attemptNumber === originalAttempt?.replacedBy &&
      a.type === AttemptType.EXTRA_ATTEMPT,
  );
  if (extraAttempt && extraAttempt.replacedBy) {
    return getFinalExtraAttempt(extraAttempt.id, attempts) || extraAttempt;
  }
  return extraAttempt;
};

const isWaitingForExtra = (attempt: Attempt) =>
  attempt.status === AttemptStatus.EXTRA_GIVEN && !attempt.replacedBy;

const getAttemptAtPosition = (standard: Attempt, attempts: Attempt[]) =>
  standard.replacedBy ? getFinalExtraAttempt(standard.id, attempts) : standard;

/**
 * Attempts given an extra that hasn't been done yet, in the order of the
 * positions they count for, following chains of extras.
 */
export const getAttemptsWaitingForExtra = <T extends Attempt>(
  attempts: T[],
): T[] => {
  const byPosition = getSortedStandardAttempts(attempts)
    .map((attempt) => getAttemptAtPosition(attempt, attempts))
    .filter((attempt) => attempt && isWaitingForExtra(attempt));
  return [
    ...new Set([...byPosition, ...attempts.filter(isWaitingForExtra)]),
  ] as T[];
};

/** After the highest extra, as extras entered by hand can leave gaps */
export const getNextExtraNumber = (attempts: Attempt[]) =>
  (getSortedExtraAttempts(attempts).at(-1)?.attemptNumber ?? 0) + 1;

/** The standard attempt and each extra that replaced it in turn */
const getChain = (standard: Attempt, attempts: Attempt[]) => {
  const chain = [standard];
  let extra = standard;
  while (extra?.replacedBy) {
    const { replacedBy } = extra;
    extra = attempts.find(
      (a) =>
        a.attemptNumber === replacedBy && a.type === AttemptType.EXTRA_ATTEMPT,
    );
    if (extra && !chain.includes(extra)) chain.push(extra);
    else break;
  }
  return chain;
};

/** Orders attempts by the position each one counts for or replaces */
export const sortByPosition = <T extends Attempt>(
  toSort: T[],
  attempts: Attempt[],
): T[] => {
  const standard = getSortedStandardAttempts(attempts);
  const position = (attempt: Attempt) =>
    standard.findIndex((s) =>
      getChain(s, attempts).some((a) => a.id === attempt.id),
    );
  return [...toSort].sort((a, b) => position(a) - position(b));
};

/** The attempt number a replacing or replaced attempt stands in for */
export const getAttemptPosition = (attempt: Attempt, attempts: Attempt[]) =>
  getSortedStandardAttempts(attempts).find(
    (standard) => getAttemptAtPosition(standard, attempts)?.id === attempt.id,
  )?.attemptNumber;

/**
 * Whether a redo on a fresh set hasn't begun: the competitor is expected in a
 * later group, so this result has no reason to hold the current one back.
 */
export const isRedoNotStarted = (
  attempts: Attempt[],
  freshSetGrantIds: string[],
) => {
  const grantId = getAttemptsWaitingForExtra(attempts)[0]?.extraGrantId;
  return (
    !!grantId &&
    freshSetGrantIds.includes(grantId) &&
    attempts
      .filter((attempt) => attempt.extraGrantId === grantId)
      .every(isWaitingForExtra)
  );
};

/**
 * The attempts that count for a result, in order: standard attempts that
 * are not replaced, unresolved or only scrambled, and for each attempt that
 * was given an extra, the extra that replaced it. This is what gets
 * submitted to WCA Live / CubingContests.
 */
export const getCountingAttempts = (attempts: Attempt[]): Attempt[] => {
  const counting: Attempt[] = [];
  getSortedStandardAttempts(attempts).forEach((attempt) => {
    if (
      attempt.replacedBy === null &&
      attempt.status !== AttemptStatus.UNRESOLVED &&
      attempt.status !== AttemptStatus.EXTRA_GIVEN &&
      attempt.status !== AttemptStatus.SCRAMBLED &&
      attempt.status !== AttemptStatus.VOIDED
    ) {
      counting.push(attempt);
    } else if (
      attempt.replacedBy !== null &&
      attempt.status === AttemptStatus.EXTRA_GIVEN
    ) {
      const extraAttempt = getFinalExtraAttempt(attempt.id, attempts);
      if (
        extraAttempt &&
        !isWaitingForExtra(extraAttempt) &&
        extraAttempt.status !== AttemptStatus.VOIDED &&
        !counting.includes(extraAttempt)
      ) {
        counting.push(extraAttempt);
      }
    }
  });
  return counting;
};

/**
 * Attempts still waiting for an extra that can never come: the counting
 * attempts missed the cutoff, so the round is over. Open incidents can still
 * change the counting attempts, so nothing is decided while there are any.
 */
export const getAttemptsToVoid = (
  attempts: Attempt[],
  cutoff?: { numberOfAttempts: number; resultValue: number } | null,
): Attempt[] => {
  if (
    !cutoff ||
    attempts.some((attempt) => attempt.status === AttemptStatus.UNRESOLVED)
  ) {
    return [];
  }
  const cutoffPassed = checkCutoff(
    getCountingAttempts(attempts),
    cutoff.resultValue,
    cutoff.numberOfAttempts,
  );
  return cutoffPassed ? [] : getAttemptsWaitingForExtra(attempts);
};

/** An attempt as WCA encodes it: centiseconds with +2s added, or DNF/DNS */
const toAttemptResult = (attempt: Pick<Attempt, 'value' | 'penalty'>) =>
  attempt.penalty === DNF_VALUE || attempt.penalty === DNS_VALUE
    ? attempt.penalty
    : attemptTimeWithPenalty(attempt);

const isSolved = (result: number) => result > 0;

/** Averages over 10 minutes are rounded to the second, the rest stay exact */
const roundAverage = (centiseconds: number) =>
  centiseconds > 60000
    ? Math.round(centiseconds / 100) * 100
    : Math.round(centiseconds);

const formatAttemptResult = (result: number) =>
  isSolved(result) ? formatCentiseconds(result) : 'DNF';

const getBest = (results: number[]) => {
  const solved = results.filter(isSolved);
  return solved.length > 0 ? Math.min(...solved) : DNF_VALUE;
};

/** Ao5 drops the best and the worst; a second unsolved attempt makes it DNF */
const getAverageOf5 = (results: number[]) => {
  const solved = results.filter(isSolved).sort((a, b) => a - b);
  if (solved.length < results.length - 1) return DNF_VALUE;
  const counting = solved.slice(1, 4);
  return roundAverage(counting.reduce((sum, r) => sum + r, 0) / 3);
};

const getMeanOf3 = (results: number[]) => {
  if (!results.every(isSolved)) return DNF_VALUE;
  return roundAverage(results.reduce((sum, r) => sum + r, 0) / 3);
};

/**
 * What a competitor's round came to once they have no attempts left, e.g.
 * "Ao5: 12.20" or "Best: 21.37". Rounds cut off before the average is
 * complete show the best, as the official result does. Always two words:
 * the station puts the first two words of a message on the top line.
 */
export const getRoundResultText = (
  countingAttempts: Pick<Attempt, 'value' | 'penalty'>[],
  format: string,
) => {
  const results = countingAttempts.map(toAttemptResult);
  if (format === 'a' && results.length === 5) {
    return `Ao5: ${formatAttemptResult(getAverageOf5(results))}`;
  }
  if (format === 'm' && results.length === 3) {
    return `Mo3: ${formatAttemptResult(getMeanOf3(results))}`;
  }
  return `Best: ${formatAttemptResult(getBest(results))}`;
};
