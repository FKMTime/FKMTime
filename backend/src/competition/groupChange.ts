import { Attempt, AttemptStatus } from '@prisma/client';
import {
  getAttemptsWaitingForExtra,
  getCountingAttempts,
  isRedoNotStarted,
} from 'src/result/helpers';
import { getNextGroupInRoom, isSameDay } from 'src/wcif-helpers';
import {
  Activity,
  Competition as Wcif,
  getActivityInfoFromScheduleWithRoom,
} from 'wcif-helpers';

import { getExpectedAttempts } from './groupProgress';

/** Quiet time after an attempt before a group's no-shows are given up on */
export const GROUP_IDLE_BEFORE_CHANGE_MS = 5 * 60 * 1000;

export interface GroupChangeResult {
  personId: string;
  person: { registrantId: number };
  attempts: Attempt[];
  /** Regulation 9t: such a result counts nowhere */
  removedAt?: Date | null;
}

export interface RoundRules {
  maxAttempts: number;
  cutoff?: { numberOfAttempts: number; resultValue: number } | null;
  /** Fresh-set grants not restored yet, whose redo can wait for a later group */
  freshSetGrantIds: string[];
  /** Whether the room has another group of this round after this one */
  hasNextGroup: boolean;
}

type ResultState = 'notStarted' | 'pending' | 'done';

/** Where one competitor's result stands as far as leaving the group goes */
export const getResultState = (
  attempts: Attempt[],
  rules: RoundRules,
): ResultState => {
  // Stations can't take attempts for an earlier round, so the last group
  // has to wait for any redo, while earlier ones can leave it to the next
  if (!rules.hasNextGroup && getAttemptsWaitingForExtra(attempts).length > 0) {
    return 'pending';
  }
  if (
    rules.hasNextGroup &&
    isRedoNotStarted(attempts, rules.freshSetGrantIds)
  ) {
    return 'done';
  }
  if (
    attempts.some(
      (a) =>
        a.status === AttemptStatus.UNRESOLVED ||
        (a.status === AttemptStatus.EXTRA_GIVEN && !a.replacedBy),
    )
  ) {
    return 'pending';
  }
  const counting = getCountingAttempts(attempts);
  if (counting.length === 0) return 'notStarted';
  const expected = getExpectedAttempts(
    counting,
    rules.maxAttempts,
    rules.cutoff,
  );
  return counting.length >= expected ? 'done' : 'pending';
};

/**
 * - notStarted: nobody in the group has an attempt yet
 * - inProgress: someone who started still has attempts to do
 * - waitingForCompetitors: everyone who started is done, but someone assigned
 *   hasn't started; they may be a no-show or still queueing for a station
 * - finished: everyone in the group is done
 */
export type GroupState =
  'notStarted' | 'inProgress' | 'waitingForCompetitors' | 'finished';

export interface GroupStatus {
  state: GroupState;
  /** When the group's competitors last entered an attempt (ms), if ever */
  lastAttemptAt: number | null;
}

/**
 * Where a group stands, from its own competitors only: those assigned to it
 * and those marked present in it (attendance, which includes competitors
 * added by hand). Other groups and rooms of the same round don't hold it
 * back, and neither does anyone whose result in the round was removed
 * (Regulation 9t). The last group of the round in the room also waits for
 * redos of anyone from the room's earlier groups (roomRoundRegistrantIds /
 * roomRoundPersonIds).
 */
export const getGroupStatus = (input: {
  results: GroupChangeResult[];
  assignedRegistrantIds: number[];
  presentPersonIds: string[];
  /** Competitors whose result in the round was removed */
  removed?: { personId: string; registrantId: number }[];
  roomRoundRegistrantIds?: number[];
  roomRoundPersonIds?: string[];
  rules: RoundRules;
}): GroupStatus => {
  const removed = input.removed ?? [];
  const removedRegistrantIds = new Set(removed.map((r) => r.registrantId));
  const removedPersonIds = new Set(removed.map((r) => r.personId));
  const results = input.results.filter(
    (r) =>
      !r.removedAt &&
      !removedPersonIds.has(r.personId) &&
      !removedRegistrantIds.has(r.person.registrantId),
  );
  const assigned = new Set(
    input.assignedRegistrantIds.filter((id) => !removedRegistrantIds.has(id)),
  );
  const present = new Set(
    input.presentPersonIds.filter((id) => !removedPersonIds.has(id)),
  );
  const members = results.filter(
    (r) => assigned.has(r.person.registrantId) || present.has(r.personId),
  );

  let started = false;
  let pending = false;
  let lastAttemptAt: number | null = null;
  const startedRegistrantIds = new Set<number>();
  const startedPersonIds = new Set<string>();
  for (const result of members) {
    const state = getResultState(result.attempts, input.rules);
    for (const attempt of result.attempts) {
      const solvedAt = attempt.solvedAt ? +new Date(attempt.solvedAt) : NaN;
      if (!Number.isNaN(solvedAt) && (lastAttemptAt ?? 0) < solvedAt) {
        lastAttemptAt = solvedAt;
      }
    }
    if (state === 'notStarted') continue;
    started = true;
    startedRegistrantIds.add(result.person.registrantId);
    startedPersonIds.add(result.personId);
    if (state === 'pending') pending = true;
  }

  if (!input.rules.hasNextGroup) {
    const roomAssigned = new Set(input.roomRoundRegistrantIds ?? []);
    const roomPresent = new Set(input.roomRoundPersonIds ?? []);
    const redoWaiting = results.some(
      (r) =>
        (roomAssigned.has(r.person.registrantId) ||
          roomPresent.has(r.personId)) &&
        getAttemptsWaitingForExtra(r.attempts).length > 0,
    );
    if (redoWaiting) pending = true;
  }

  if (!started) return { state: 'notStarted', lastAttemptAt };
  if (pending) return { state: 'inProgress', lastAttemptAt };
  const someoneNotStarted =
    [...assigned].some((id) => !startedRegistrantIds.has(id)) ||
    [...present].some((id) => !startedPersonIds.has(id));
  return {
    state: someoneNotStarted ? 'waitingForCompetitors' : 'finished',
    lastAttemptAt,
  };
};

/**
 * Since when the group has been quiet in the room: the later of the room
 * reaching the group and the group's last attempt. Attempts made before the
 * room got there (a competitor solving early during an earlier group) don't
 * make a group the room only just reached look quiet.
 */
export const getQuietSince = (status: GroupStatus, enteredAt: number) =>
  Math.max(enteredAt, status.lastAttemptAt ?? enteredAt);

/** Whether nobody in the group has entered an attempt for a while */
export const isGroupQuiet = (
  status: GroupStatus,
  enteredAt: number,
  now: number,
) => now - getQuietSince(status, enteredAt) > GROUP_IDLE_BEFORE_CHANGE_MS;

/**
 * Whether the room can leave the group. Right after an attempt only a group
 * everyone in it finished can go. The periodic check also lets a group go
 * whose missing competitors haven't started once it has been quiet for a
 * while (see getQuietSince): nothing else tells a no-show from someone still
 * waiting for a station.
 */
export const canLeaveGroup = (
  status: GroupStatus,
  trigger: 'event' | 'cron',
  now: number,
  enteredAt: number,
) => {
  if (status.state === 'finished') return true;
  return (
    trigger === 'cron' &&
    status.state === 'waitingForCompetitors' &&
    isGroupQuiet(status, enteredAt, now)
  );
};

const byStartTime = (a: Activity, b: Activity) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

/**
 * The first group of the round the room runs after this one, the same day.
 * Venues without a room of that name are skipped.
 */
export const getFirstGroupOfNextRoundInRoom = (
  roundId: string,
  roomName: string,
  wcif: Wcif,
): string | null => {
  const round: Activity | null = getActivityInfoFromScheduleWithRoom(
    roundId,
    roomName,
    wcif,
  );
  if (!round) return null;
  const endTime = new Date(round.endTime);
  let nextRound: Activity | null = null;
  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      if (room.name !== roomName) continue;
      for (const activity of room.activities) {
        const start = new Date(activity.startTime);
        if (
          isSameDay(start, endTime) &&
          start.getTime() >= endTime.getTime() &&
          !activity.activityCode.startsWith('other') &&
          (!nextRound ||
            start.getTime() < new Date(nextRound.startTime).getTime())
        ) {
          nextRound = activity;
        }
      }
    }
  }
  if (!nextRound) return null;
  const [firstGroup] = [...(nextRound.childActivities ?? [])].sort(byStartTime);
  return firstGroup?.activityCode ?? `${nextRound.activityCode}-g1`;
};

/**
 * The groups the room runs once the finished ones are left: each finished
 * group gives way to the next group of its round in the room. A round with
 * no group left in the room drops out while another group is still running
 * there; once nothing is left, the room starts the round scheduled after the
 * one that ends last. Null when there is nothing to start.
 */
export const planNextGroups = (
  currentGroupIds: string[],
  finishedGroupIds: string[],
  roomName: string,
  wcif: Wcif,
): string[] | null => {
  const finished = new Set(finishedGroupIds);
  const next: string[] = [];
  const endedRoundIds: string[] = [];
  for (const groupId of currentGroupIds) {
    if (!finished.has(groupId)) {
      next.push(groupId);
      continue;
    }
    const nextGroup = getNextGroupInRoom(groupId, roomName, wcif);
    if (nextGroup) next.push(nextGroup.activityCode);
    else endedRoundIds.push(groupId.split('-g')[0]);
  }
  if (next.length === 0 && endedRoundIds.length > 0) {
    const endOf = (roundId: string) => {
      const round: Activity | null = getActivityInfoFromScheduleWithRoom(
        roundId,
        roomName,
        wcif,
      );
      return round ? new Date(round.endTime).getTime() : -Infinity;
    };
    const lastRoundId = endedRoundIds.reduce((a, b) =>
      endOf(b) > endOf(a) ? b : a,
    );
    const firstGroup = getFirstGroupOfNextRoundInRoom(
      lastRoundId,
      roomName,
      wcif,
    );
    if (firstGroup) next.push(firstGroup);
  }
  if (next.length === 0) return null;
  const unchanged =
    next.length === currentGroupIds.length &&
    next.every((id, i) => id === currentGroupIds[i]);
  return unchanged ? null : next;
};
