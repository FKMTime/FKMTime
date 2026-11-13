import { createHash } from 'crypto';
import { Attempt } from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';
import { getCountingAttempts } from 'src/result/helpers';
import { Cutoff, TimeLimit } from 'wcif-helpers';

/** One attempt as WCA Integrated Live Results takes it */
export interface LiveAttempt {
  value: number;
  attempt_number: number;
}

/**
 * The counted attempts, encoded as for WCA Live: centiseconds, -1 DNF, -2
 * DNS. Numbers are 1-based positions among counted attempts. A 0 means not
 * done yet; the WCA rejects it, so it is left out.
 */
export const toLiveAttempts = (attempts: Attempt[]): LiveAttempt[] =>
  getCountingAttempts(attempts)
    .map((attempt, index) => ({
      attempt_number: index + 1,
      value:
        attempt.penalty === DNS_VALUE
          ? DNS_VALUE
          : attempt.penalty === DNF_VALUE
            ? DNF_VALUE
            : attempt.penalty * 100 + attempt.value,
    }))
    .filter((attempt) => attempt.value !== 0);

/**
 * The round's rules that the WCA doesn't check itself (SPEC-006): attempt
 * count, cutoff and a non-cumulative time limit. Null when the attempts keep
 * to them, otherwise the reason. The station enforces these for live solves;
 * this catches panel edits that would break them.
 */
export const breaksRoundRules = (
  attempts: LiveAttempt[],
  round: {
    maxAttempts: number;
    cutoff: Cutoff | null;
    timeLimit: TimeLimit | null;
  },
): string | null => {
  const last = Math.max(0, ...attempts.map((a) => a.attempt_number));
  if (last > round.maxAttempts) {
    return `More attempts than the round's ${round.maxAttempts}`;
  }
  if (round.cutoff) {
    const { numberOfAttempts, resultValue } = round.cutoff;
    const madeCutoff = attempts.some(
      (a) =>
        a.attempt_number <= numberOfAttempts &&
        a.value > 0 &&
        a.value < resultValue,
    );
    if (!madeCutoff && last > numberOfAttempts) {
      return 'Attempts after a missed cutoff';
    }
  }
  const limit = round.timeLimit;
  // A cumulative limit spans attempts, sometimes across rounds: the station
  // handles it, and checking it here would need every linked round
  if (limit && limit.cumulativeRoundIds.length === 0) {
    const over = attempts.find((a) => a.value > limit.centiseconds);
    if (over) {
      return `Attempt ${over.attempt_number} is over the time limit`;
    }
  }
  return null;
};

/** Compares what was sent with what the WCA holds, ignoring order */
export const liveAttemptsHash = (attempts: LiveAttempt[]) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        [...attempts]
          .sort((a, b) => a.attempt_number - b.attempt_number)
          .map((a) => [a.attempt_number, a.value]),
      ),
    )
    .digest('hex');
