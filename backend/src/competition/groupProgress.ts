import { Attempt } from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';
import { getCountingAttempts } from 'src/result/helpers';
import {
  Competition as Wcif,
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

export interface GroupProgress {
  groupId: string;
  roundId: string;
  /** Competitors assigned to the group */
  competitors: number;
  /** Competitors whose result is complete (every attempt they will do is in) */
  finished: number;
  /** Counting attempts entered for those competitors */
  entered: number;
  /** Attempts the group will have once everyone is done */
  expected: number;
  /**
   * Whether expected is final: in a round with a cutoff, every competitor
   * has done the cutoff attempts, so nobody's total can still grow
   */
  expectedIsFinal: boolean;
}

interface WcifActivity {
  id: number;
  activityCode: string;
  childActivities?: WcifActivity[];
}

/** Registrant IDs of everyone assigned to compete in the group */
export const getGroupCompetitorIds = (wcif: Wcif, groupId: string) => {
  const activityIds = new Set<number>();
  const visit = (activity: WcifActivity) => {
    if (activity.activityCode === groupId) activityIds.add(activity.id);
    activity.childActivities?.forEach(visit);
  };
  wcif.schedule.venues.forEach((venue) =>
    venue.rooms.forEach((room) =>
      (room.activities as unknown as WcifActivity[]).forEach(visit),
    ),
  );
  return wcif.persons
    .filter((person) =>
      person.assignments?.some(
        (assignment) =>
          assignment.assignmentCode === 'competitor' &&
          activityIds.has(assignment.activityId),
      ),
    )
    .map((person) => person.registrantId);
};

interface Cutoff {
  numberOfAttempts: number;
  resultValue: number;
}

const beatsCutoff = (attempt: Attempt, cutoffValue: number) =>
  attempt.penalty !== DNF_VALUE &&
  attempt.penalty !== DNS_VALUE &&
  attempt.value + (attempt.penalty > 0 ? attempt.penalty * 100 : 0) <
    cutoffValue;

/**
 * How many attempts a competitor will end up with: the full format, unless
 * they have done the cutoff attempts without making the cutoff.
 */
export const getExpectedAttempts = (
  counting: Attempt[],
  maxAttempts: number,
  cutoff?: Cutoff | null,
) => {
  if (!cutoff) return maxAttempts;
  const cutoffAttempts = counting.slice(0, cutoff.numberOfAttempts);
  if (cutoffAttempts.length < cutoff.numberOfAttempts) return maxAttempts;
  return cutoffAttempts.some((a) => beatsCutoff(a, cutoff.resultValue))
    ? maxAttempts
    : cutoff.numberOfAttempts;
};

export const calculateGroupProgress = (
  wcif: Wcif,
  groupId: string,
  attemptsByRegistrantId: Map<number, Attempt[]>,
): GroupProgress => {
  const roundId = groupId.split('-g')[0];
  const maxAttempts = getNumberOfAttemptsForRound(roundId, wcif);
  const cutoff = getRoundInfoFromWcif(roundId, wcif)?.cutoff as
    Cutoff | undefined;
  const competitorIds = getGroupCompetitorIds(wcif, groupId);

  let finished = 0;
  let expectedIsFinal = true;
  let entered = 0;
  let expected = 0;
  for (const registrantId of competitorIds) {
    const counting = getCountingAttempts(
      attemptsByRegistrantId.get(registrantId) ?? [],
    );
    const competitorExpected = getExpectedAttempts(
      counting,
      maxAttempts,
      cutoff,
    );
    const competitorEntered = Math.min(counting.length, competitorExpected);
    expected += competitorExpected;
    entered += competitorEntered;
    if (competitorEntered >= competitorExpected) finished++;
    if (cutoff && counting.length < cutoff.numberOfAttempts) {
      expectedIsFinal = false;
    }
  }
  return {
    groupId,
    roundId,
    competitors: competitorIds.length,
    finished,
    entered,
    expected,
    expectedIsFinal,
  };
};
