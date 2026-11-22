import {
  Activity,
  Competition,
  getActivityInfoFromScheduleWithRoom,
  getEventInfoFromWcif,
} from 'wcif-helpers';

import { roundFormatMap } from './constants';
import { StaffRole } from './generated/prisma/client';

export const wcifRoleToAttendanceRole = (role: string): StaffRole => {
  switch (role) {
    case 'staff-judge':
      return StaffRole.JUDGE;
    case 'staff-runner':
      return StaffRole.RUNNER;
    case 'staff-scrambler':
      return StaffRole.SCRAMBLER;
    case 'staff-delegate':
      return StaffRole.DELEGATE;
    case 'competitor':
      return StaffRole.COMPETITOR;
    default:
      return StaffRole.STAFF_OTHER;
  }
};

/**
 * Whether the round's time limit is cumulative. A round without a time limit
 * (multi-blind's is null) or missing from the WCIF has none.
 */
export const isCumulativeLimit = (roundId: string, wcif: Competition) => {
  const eventId = roundId.split('-')[0];
  const round = getEventInfoFromWcif(eventId, wcif)?.rounds.find(
    (r) => r.id === roundId,
  );
  return (round?.timeLimit?.cumulativeRoundIds.length ?? 0) > 0;
};

/** The group after this one in the round, in this room, if there is one */
export const getNextGroupInRoom = (
  groupId: string,
  roomName: string,
  wcif: Competition,
): Activity | null => {
  const round = getActivityInfoFromScheduleWithRoom(
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

/**
 * The group a room with nothing running should start: the first one today or
 * on the next competition day, or the room's very first once the schedule is
 * over.
 */
export const getFirstGroupInRoom = (
  roomName: string,
  wcif: Competition,
  now = new Date(),
): string | null => {
  const byStartTime = (a: Activity, b: Activity) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  const rounds = wcif.schedule.venues
    .flatMap((venue) => venue.rooms)
    .filter((room) => room.name === roomName)
    .flatMap((room) => room.activities)
    .filter((activity) => !activity.activityCode.startsWith('other'))
    .sort(byStartTime);
  const round =
    rounds.find((activity) => {
      const start = new Date(activity.startTime);
      return isSameDay(start, now) || start.getTime() > now.getTime();
    }) ?? rounds[0];
  if (!round) return null;
  const [firstGroup] = [...round.childActivities].sort(byStartTime);
  return firstGroup?.activityCode ?? `${round.activityCode}-g1`;
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
