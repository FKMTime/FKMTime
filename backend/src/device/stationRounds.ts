import {
  Activity,
  Competition as WCIF,
  getGroupInfoByActivityId,
  getPersonFromWcif,
} from 'wcif-helpers';

/** "333-r1-g2" → "333-r1" */
export const groupIdToRoundId = (groupId: string) => groupId.split('-g')[0];

export interface StationForRounds {
  customRoundId: string | null;
  room: { currentGroupIds: string[] };
}

/** Whether the station runs a round of its own instead of its room's (SPEC-007) */
export const isPointedStation = (device: StationForRounds) =>
  !!device.customRoundId;

/**
 * The rounds a station takes attempts for: its own round when a delegate
 * pointed it at one, otherwise the rounds running in its room.
 */
export const getStationRoundIds = (device: StationForRounds): string[] =>
  device.customRoundId
    ? [device.customRoundId]
    : [...new Set(device.room.currentGroupIds.map(groupIdToRoundId))];

const byStartTime = (a: Activity, b: Activity) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

/** The competitor's own group in the round, from their WCIF assignments */
export const getCompetitorGroupInRound = (
  roundId: string,
  registrantId: number | null | undefined,
  wcif: WCIF,
): string | null => {
  if (registrantId == null) return null;
  const person = getPersonFromWcif(registrantId, wcif);
  for (const assignment of person?.assignments ?? []) {
    if (assignment.assignmentCode !== 'competitor') continue;
    const group = getGroupInfoByActivityId(assignment.activityId, wcif);
    if (group && groupIdToRoundId(group.activityCode) === roundId) {
      return group.activityCode;
    }
  }
  return null;
};

/** The round's last group in the schedule, across every room */
export const getLastGroupOfRound = (roundId: string, wcif: WCIF): string => {
  const groups = wcif.schedule.venues
    .flatMap((venue) => venue.rooms)
    .flatMap((room) => room.activities)
    .filter((activity) => activity.activityCode === roundId)
    .flatMap((round) => round.childActivities ?? [])
    .sort(byStartTime);
  return groups[groups.length - 1]?.activityCode ?? `${roundId}-g1`;
};

/**
 * The group a pointed station reports for a competitor: their own group in
 * the round, or the round's last group when they have none. Only attendance
 * and live solving use it; the round decides the attempt.
 */
export const getPointedStationGroupId = (
  roundId: string,
  registrantId: number | null | undefined,
  wcif: WCIF,
) =>
  getCompetitorGroupInRound(roundId, registrantId, wcif) ??
  getLastGroupOfRound(roundId, wcif);

/** The groups a station offers a competitor at the card scan */
export const getStationGroupIds = (
  device: StationForRounds,
  registrantId: number | null | undefined,
  wcif: WCIF,
): string[] =>
  device.customRoundId
    ? [getPointedStationGroupId(device.customRoundId, registrantId, wcif)]
    : device.room.currentGroupIds;
