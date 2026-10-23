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
  /** Counting attempts entered for those competitors */
  entered: number;
  /** Attempts the group will have once everyone is done */
  expected: number;
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
  /** WCIF names it attemptResult; wcif-helpers types call it resultValue */
  attemptResult?: number;
  resultValue?: number;
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
  const cutoffValue = cutoff?.attemptResult ?? cutoff?.resultValue;
  if (!cutoff || cutoffValue === undefined) return maxAttempts;
  const cutoffAttempts = counting.slice(0, cutoff.numberOfAttempts);
  if (cutoffAttempts.length < cutoff.numberOfAttempts) return maxAttempts;
  return cutoffAttempts.some((a) => beatsCutoff(a, cutoffValue))
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
    expected += competitorExpected;
    entered += Math.min(counting.length, competitorExpected);
  }
  return {
    groupId,
    roundId,
    competitors: competitorIds.length,
    entered,
    expected,
  };
};
