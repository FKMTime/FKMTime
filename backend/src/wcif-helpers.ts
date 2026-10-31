import {
  Activity,
  Competition,
  Event,
  getActivityInfoFromScheduleWithRoom,
  getEventInfoFromWcif,
  Round,
} from 'wcif-helpers';

import { roundFormatMap } from './constants';

export const wcifRoleToAttendanceRole = (role: string) => {
  switch (role) {
    case 'staff-judge':
      return 'JUDGE';
    case 'staff-runner':
      return 'RUNNER';
    case 'staff-scrambler':
      return 'SCRAMBLER';
    case 'staff-delegate':
      return 'DELEGATE';
    case 'competitor':
      return 'COMPETITOR';
    default:
      return 'STAFF_OTHER';
  }
};

export const isCumulativeLimit = (roundId: string, wcif: Competition) => {
  const eventId = roundId.split('-')[0];
  const event: Event = getEventInfoFromWcif(eventId, wcif);
  const round: Round = event.rounds.find((r) => r.id === roundId);
  return round.timeLimit.cumulativeRoundIds.length > 0;
};

/** The group after this one in the round, in this room, if there is one */
export const getNextGroupInRoom = (
  groupId: string,
  roomName: string,
  wcif: Competition,
): Activity | null => {
  const round: Activity = getActivityInfoFromScheduleWithRoom(
    groupId.split('-g')[0],
    roomName,
    wcif,
  );
  if (!round) return null;
  const groups = [...round.childActivities].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const currentIndex = groups.findIndex((a) => a.activityCode === groupId);
  return currentIndex === -1 ? null : (groups[currentIndex + 1] ?? null);
};

export const getMaxAttempts = (roundFormat: string) => {
  return roundFormatMap[roundFormat] || 5;
};

/**
 * Whether two moments fall on the same calendar day (server time). Comparing
 * getDay() alone matched any date on the same weekday, a week apart too.
 */
export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
