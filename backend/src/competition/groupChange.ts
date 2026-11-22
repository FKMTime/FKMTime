import {
  getAttemptsWaitingForExtra,
  getCountingAttempts,
  isRedoNotStarted,
} from 'src/result/helpers';
import {
  getFirstGroupInRoom,
  getNextGroupInRoom,
  isSameDay,
} from 'src/wcif-helpers';
import {
  Activity,
  Competition as Wcif,
  getActivityInfoFromScheduleWithRoom,
} from 'wcif-helpers';

import {
  Attempt,
  AttemptStatus,
  StaffActivityStatus,
} from '../generated/prisma/client';
import { getExpectedAttempts } from './groupProgress';

/** Quiet time after an attempt before a group's no-shows are given up on */
export const GROUP_IDLE_BEFORE_CHANGE_MS = 5 * 60 * 1000;

export interface GroupChangeResult {
  personId: string;
  /** Null for someone added locally rather than from the WCIF */
  person: { registrantId: number | null };
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

/**
 * Scrambled and handed to the competitor, not solved yet. Only the status
 * says so: a scrambled attempt entered by hand or ruled DNF becomes STANDARD
 * but keeps its scrambledAt without ever getting a solvedAt.
 */
const isBeingSolved = (attempt: Attempt) =>
  attempt.status === AttemptStatus.SCRAMBLED;

/**
 * The last time anything happened with the attempt: scrambled or solved. A
 * scrambledAt is a fixed moment, so on an attempt finished some other way it
 * only dates the activity and can't keep the group from going quiet.
 */
const lastActivityAt = (attempt: Attempt) =>
  Math.max(
    ...[attempt.solvedAt, attempt.scrambledAt]
      .map((at) => (at ? +new Date(at) : NaN))
      .filter((at) => !Number.isNaN(at)),
    -Infinity,
  );

/** What keeps a started result from being done */
export type PendingReason = 'incident' | 'extra' | 'solving';

interface ResultStanding {
  state: ResultState;
  /** Only for a pending result */
  reason?: PendingReason;
}

const pending = (reason: PendingReason): ResultStanding => ({
  state: 'pending',
  reason,
});

/** Where one competitor's result stands, and what it is waiting for */
const getResultStanding = (
  attempts: Attempt[],
  rules: RoundRules,
): ResultStanding => {
  // Stations can't take attempts for an earlier round, so the last group
  // has to wait for any redo, while earlier ones can leave it to the next
  if (!rules.hasNextGroup && getAttemptsWaitingForExtra(attempts).length > 0) {
    return pending('extra');
  }
  if (
    rules.hasNextGroup &&
    isRedoNotStarted(attempts, rules.freshSetGrantIds)
  ) {
    return { state: 'done' };
  }
  if (attempts.some((a) => a.status === AttemptStatus.UNRESOLVED)) {
    return pending('incident');
  }
  if (
    attempts.some(
      (a) => a.status === AttemptStatus.EXTRA_GIVEN && !a.replacedBy,
    )
  ) {
    return pending('extra');
  }
  // Someone with a scramble in hand has started, even before a solve
  if (attempts.some(isBeingSolved)) return pending('solving');
  const counting = getCountingAttempts(attempts);
  if (counting.length === 0) return { state: 'notStarted' };
  const expected = getExpectedAttempts(
    counting,
    rules.maxAttempts,
    rules.cutoff,
  );
  return counting.length >= expected ? { state: 'done' } : pending('solving');
};

/** Where one competitor's result stands as far as leaving the group goes */
export const getResultState = (
  attempts: Attempt[],
  rules: RoundRules,
): ResultState => getResultStanding(attempts, rules).state;

/**
 * - notStarted: nobody in the group has an attempt yet
 * - inProgress: someone who started still has attempts to do
 * - waitingForCompetitors: everyone who started is done, but someone assigned
 *   hasn't started; they may be a no-show or still queueing for a station
 * - finished: everyone in the group is done
 */
export type GroupState =
  'notStarted' | 'inProgress' | 'waitingForCompetitors' | 'finished';

/** Someone the group waits for who hasn't started */
export interface MissingCompetitor {
  /** Null for someone the stored WCIF assigns who has no row or result yet */
  personId: string | null;
  registrantId: number | null;
}

/** What keeps the group from being finished */
export interface GroupBlockers {
  /** Not started and not marked as not coming */
  notStarted: MissingCompetitor[];
  /** Competitors with attempts still to do */
  solving: number;
  /** Competitors with an incident to resolve */
  incidents: number;
  /** Competitors with an extra attempt still to do */
  extras: number;
}

export interface GroupStatus {
  state: GroupState;
  /** When the group's competitors last solved or were handed a scramble (ms) */
  lastAttemptAt: number | null;
  blockers: GroupBlockers;
}

/** A COMPETITOR attendance row, for any group of the round */
export interface CompetitorRow {
  personId: string;
  registrantId: number | null;
  groupId: string;
  isAssigned: boolean;
  status: StaffActivityStatus;
  /** Marked as not coming to the group */
  noShow?: boolean;
}

const countsInItsGroup = (row: CompetitorRow) =>
  row.isAssigned ||
  row.status === StaffActivityStatus.PRESENT ||
  row.status === StaffActivityStatus.LATE;

/**
 * Where a group stands, from its own competitors only:
 * - those the stored WCIF assigns to it,
 * - those with an assigned attendance row for it, whatever their attendance
 *   (a move on the competitor page updates the row at once, the stored WCIF
 *   only at the next sync),
 * - those marked present in it, competitors added by hand included.
 * Someone the stored WCIF still assigns here but whose assigned row is now in
 * another group of the round has moved, and is left out. Someone absent and
 * marked as not coming isn't waited for, unless they start after all. Other
 * groups and rooms of the same round don't hold the group back, and neither
 * does anyone whose result in the round was removed (Regulation 9t). The
 * last group of the round in the room also waits for redos of anyone from
 * the room's earlier groups (roomRoundRegistrantIds / roomRoundGroupIds).
 */
export const getGroupStatus = (input: {
  groupId: string;
  results: GroupChangeResult[];
  assignedRegistrantIds: number[];
  /** COMPETITOR rows of every group of the round */
  competitorRows?: CompetitorRow[];
  /** Competitors whose result in the round was removed */
  removed?: { personId: string; registrantId: number | null }[];
  roomRoundRegistrantIds?: number[];
  roomRoundGroupIds?: string[];
  rules: RoundRules;
}): GroupStatus => {
  const rows = input.competitorRows ?? [];
  const removed = input.removed ?? [];
  const removedPersonIds = new Set(removed.map((r) => r.personId));
  // Someone without a registrant id is only known by their person id
  const removedRegistrantIds = new Set(
    removed.map((r) => r.registrantId).filter((id) => id !== null),
  );
  const results = input.results.filter(
    (r) => !r.removedAt && !removedPersonIds.has(r.personId),
  );

  const isHere = (row: CompetitorRow) => row.groupId === input.groupId;
  const personIdsWithRowHere = new Set(
    rows.filter(isHere).map((r) => r.personId),
  );
  const movedAway = new Set(
    rows
      .filter(
        (row) =>
          !isHere(row) &&
          row.isAssigned &&
          row.registrantId !== null &&
          !personIdsWithRowHere.has(row.personId),
      )
      .map((row) => row.registrantId),
  );
  const assigned = new Set(
    input.assignedRegistrantIds.filter(
      (id) => !removedRegistrantIds.has(id) && !movedAway.has(id),
    ),
  );
  const memberPersonIds = new Set(
    rows
      .filter((row) => isHere(row) && countsInItsGroup(row))
      .map((row) => row.personId)
      .filter((id) => !removedPersonIds.has(id)),
  );
  const isAssignedHere = (r: GroupChangeResult) =>
    r.person.registrantId !== null && assigned.has(r.person.registrantId);
  const members = results.filter(
    (r) => isAssignedHere(r) || memberPersonIds.has(r.personId),
  );

  let started = false;
  let isPending = false;
  let lastAttemptAt: number | null = null;
  const blockers: GroupBlockers = {
    notStarted: [],
    solving: 0,
    incidents: 0,
    extras: 0,
  };
  const startedRegistrantIds = new Set<number>();
  const startedPersonIds = new Set<string>();
  for (const result of members) {
    const standing = getResultStanding(result.attempts, input.rules);
    for (const attempt of result.attempts) {
      const at = lastActivityAt(attempt);
      if (at !== -Infinity && (lastAttemptAt ?? -Infinity) < at) {
        lastAttemptAt = at;
      }
    }
    if (standing.state === 'notStarted') continue;
    started = true;
    if (result.person.registrantId !== null) {
      startedRegistrantIds.add(result.person.registrantId);
    }
    startedPersonIds.add(result.personId);
    if (standing.state === 'pending') {
      isPending = true;
      if (standing.reason === 'incident') blockers.incidents++;
      else if (standing.reason === 'extra') blockers.extras++;
      else blockers.solving++;
    }
  }

  if (!input.rules.hasNextGroup) {
    const roomAssigned = new Set(input.roomRoundRegistrantIds ?? []);
    const roomGroupIds = new Set(input.roomRoundGroupIds ?? []);
    const roomPersonIds = new Set(
      rows
        .filter((row) => roomGroupIds.has(row.groupId) && countsInItsGroup(row))
        .map((row) => row.personId),
    );
    const memberIds = new Set(members.map((r) => r.personId));
    for (const r of results) {
      const isInRoom =
        (r.person.registrantId !== null &&
          roomAssigned.has(r.person.registrantId)) ||
        roomPersonIds.has(r.personId);
      if (isInRoom && getAttemptsWaitingForExtra(r.attempts).length > 0) {
        isPending = true;
        // Members waiting for a redo are already counted above
        if (!memberIds.has(r.personId)) blockers.extras++;
      }
    }
  }

  // Absent and not coming: nobody waits for them, unless they start after all
  const notComingRows = rows.filter(
    (row) =>
      isHere(row) && row.noShow && row.status === StaffActivityStatus.ABSENT,
  );
  const notComingPersonIds = new Set(notComingRows.map((row) => row.personId));
  const notComingRegistrantIds = new Set(
    notComingRows.map((row) => row.registrantId).filter((id) => id !== null),
  );
  // Only a row in this group can be marked as not coming
  const personIdByRegistrantId = new Map(
    rows
      .filter((row) => isHere(row) && row.registrantId !== null)
      .map((row) => [row.registrantId, row.personId]),
  );
  for (const id of assigned) {
    if (startedRegistrantIds.has(id) || notComingRegistrantIds.has(id)) {
      continue;
    }
    blockers.notStarted.push({
      personId: personIdByRegistrantId.get(id) ?? null,
      registrantId: id,
    });
  }
  const listedPersonIds = new Set(
    blockers.notStarted.map((m) => m.personId).filter((id) => id !== null),
  );
  const registrantIdByPersonId = new Map(
    rows.map((row) => [row.personId, row.registrantId]),
  );
  for (const id of memberPersonIds) {
    if (
      startedPersonIds.has(id) ||
      notComingPersonIds.has(id) ||
      listedPersonIds.has(id)
    ) {
      continue;
    }
    const registrantId = registrantIdByPersonId.get(id) ?? null;
    // Someone assigned is listed already, under their registrant id
    if (registrantId !== null && assigned.has(registrantId)) continue;
    blockers.notStarted.push({ personId: id, registrantId });
  }

  const status = (state: GroupState): GroupStatus => ({
    state,
    lastAttemptAt,
    blockers,
  });
  if (!started) return status('notStarted');
  if (isPending) return status('inProgress');
  return status(
    blockers.notStarted.length > 0 ? 'waitingForCompetitors' : 'finished',
  );
};

/** What the timing of a group change goes by */
type GroupTiming = Pick<GroupStatus, 'state' | 'lastAttemptAt'>;

/**
 * Since when the group has been quiet in the room: the later of the room
 * reaching the group and the group's last attempt. Attempts made before the
 * room got there (a competitor solving early during an earlier group) don't
 * make a group the room only just reached look quiet.
 */
export const getQuietSince = (status: GroupTiming, enteredAt: number) =>
  Math.max(enteredAt, status.lastAttemptAt ?? enteredAt);

/** Whether nobody in the group has entered an attempt for a while */
export const isGroupQuiet = (
  status: GroupTiming,
  enteredAt: number,
  now: number,
) => now - getQuietSince(status, enteredAt) > GROUP_IDLE_BEFORE_CHANGE_MS;

/**
 * When the periodic check, run every intervalMs, would let a group that only
 * waits for competitors who haven't started go, if nobody solves before then
 */
export const getMovesOnAt = (
  status: GroupTiming,
  enteredAt: number,
  intervalMs: number,
) => {
  if (status.state !== 'waitingForCompetitors') return null;
  const quietEnough =
    getQuietSince(status, enteredAt) + GROUP_IDLE_BEFORE_CHANGE_MS;
  // The first run at or after that moment, as it runs a moment past the mark
  return Math.ceil(quietEnough / intervalMs) * intervalMs;
};

/**
 * Whether the room can leave the group. Right after an attempt only a group
 * everyone in it finished can go. The periodic check also lets a group go
 * whose missing competitors haven't started once it has been quiet for a
 * while (see getQuietSince): nothing else tells a no-show from someone still
 * waiting for a station.
 */
export const canLeaveGroup = (
  status: GroupTiming,
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
  const round = getActivityInfoFromScheduleWithRoom(roundId, roomName, wcif);
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
      const round = getActivityInfoFromScheduleWithRoom(
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

/**
 * What "Start next" in a room starts: each group's next group in the room,
 * or the first group of the round after it. A room with nothing running
 * starts its first group of the day. Empty when a group's round isn't in
 * the room's schedule.
 */
export const getNextGroupsInRoom = (
  currentGroupIds: string[],
  roomName: string,
  wcif: Wcif,
  now = new Date(),
): string[] => {
  if (currentGroupIds.length === 0) {
    const firstGroup = getFirstGroupInRoom(roomName, wcif, now);
    return firstGroup ? [firstGroup] : [];
  }
  const nextGroups: string[] = [];
  for (const currentGroupId of currentGroupIds) {
    const roundId = currentGroupId.split('-g')[0];
    if (!getActivityInfoFromScheduleWithRoom(roundId, roomName, wcif)) {
      return [];
    }
    const nextGroupId =
      getNextGroupInRoom(currentGroupId, roomName, wcif)?.activityCode ??
      getFirstGroupOfNextRoundInRoom(roundId, roomName, wcif);
    if (nextGroupId) nextGroups.push(nextGroupId);
  }
  return nextGroups;
};
