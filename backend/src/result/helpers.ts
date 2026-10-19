import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { DNF_VALUE } from 'src/constants';
import { Person } from 'wcif-helpers';

export const isCompetitorSignedInForEvent = (
  competitorWcif: Person,
  eventId: string,
) => {
  if (!competitorWcif || !competitorWcif.registration) return false;
  return competitorWcif.registration.eventIds.includes(eventId);
};

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
        attempt.value + attempt.penalty * 100 < cutoff,
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
      attempt.status !== AttemptStatus.SCRAMBLED
    ) {
      counting.push(attempt);
    } else if (
      attempt.replacedBy !== null &&
      attempt.status === AttemptStatus.EXTRA_GIVEN
    ) {
      const extraAttempt = getFinalExtraAttempt(attempt.id, attempts);
      if (extraAttempt && !counting.includes(extraAttempt)) {
        counting.push(extraAttempt);
      }
    }
  });
  return counting;
};
