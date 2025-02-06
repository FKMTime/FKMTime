import { Attempt, AttemptType } from '@prisma/client';
import { EventId, Person } from '@wca/helpers';
import { DNF_VALUE } from 'src/constants';

export const isCompetitorSignedInForEvent = (
  competitorWcif: Person,
  eventId: string,
) => {
  if (!competitorWcif || !competitorWcif.registration) return false;
  return competitorWcif.registration.eventIds.includes(eventId as EventId);
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
