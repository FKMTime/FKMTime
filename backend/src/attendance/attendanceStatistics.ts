import { getEventShortName } from 'src/events';

import { StaffActivityStatus, StaffRole } from '../generated/prisma/client';

export type StaffingRole = Exclude<StaffRole, 'COMPETITOR'>;

export interface AttendanceSummary {
  /** covered / expected × 100; null while nothing assigned has happened */
  attendancePct: number | null;
  /** Assigned slots the person did themselves: present or late */
  covered: number;
  /** Assigned slots in groups that happened */
  expected: number;
  /** Covered, but late; already counted in covered */
  late: number;
  /** Came, but someone else did the job */
  replaced: number;
  absent: number;
  /** Covered, but left before the group ended */
  leftEarly: number;
  /** Absent and not coming for the rest of the day; already counted in absent */
  noShows: number;
  /** Present or late without an assignment; outside the percentage */
  extraHelp: number;
}

export interface PersonAttendance {
  personId: string;
  personName: string;
  /** Every staffing role they had or helped with in groups that happened */
  roles: StaffingRole[];
  assigned: number;
  /** Present or late, so late is part of it */
  present: number;
  late: number;
  absent: number;
  replaced: number;
  leftEarly: number;
  noShow: number;
  extraHelp: number;
  attendancePct: number | null;
}

export interface RoundAttendance {
  roundId: string;
  roundName: string;
  expected: number;
  covered: number;
  attendancePct: number | null;
}

export interface AttendanceStatisticsView {
  summary: AttendanceSummary;
  /** Only people with an assignment or extra help in a group that happened */
  persons: PersonAttendance[];
  /** Rounds with assigned staffing that happened, in schedule order */
  rounds: RoundAttendance[];
}

export interface AttendanceStatistics extends AttendanceStatisticsView {
  /** The same statistics for one role at a time, for roles that have any */
  byRole: Partial<Record<StaffingRole, AttendanceStatisticsView>>;
}

export interface StatisticsActivity {
  personId: string;
  person: { name: string };
  groupId: string;
  role: StaffRole;
  status: StaffActivityStatus;
  isAssigned: boolean;
  leftEarly: boolean;
  noShow: boolean;
}

export interface ScheduleWcif {
  schedule?: {
    venues?: {
      rooms?: { activities?: { activityCode: string; startTime: string }[] }[];
    }[];
  };
}

const STAFFING_ROLES: StaffingRole[] = [
  StaffRole.JUDGE,
  StaffRole.SCRAMBLER,
  StaffRole.RUNNER,
  StaffRole.DELEGATE,
  StaffRole.STAFF_OTHER,
];

const roundIdOf = (groupId: string) => groupId.split('-g')[0];

const isCovered = (status: StaffActivityStatus) =>
  status === StaffActivityStatus.PRESENT || status === StaffActivityStatus.LATE;

const percentage = (covered: number, expected: number) =>
  expected > 0 ? (covered / expected) * 100 : null;

/** "333-r2" → "3x3 - R2", like the competition statistics */
export const attendanceRoundName = (roundId: string) => {
  const [eventId, round] = roundId.split('-r');
  return `${getEventShortName(eventId) ?? eventId} - R${round}`;
};

/**
 * Rounds by the earliest start of the round in any room; rounds missing from
 * the schedule come last, by id
 */
export const scheduleOrder = (wcif: ScheduleWcif | null | undefined) => {
  const starts = new Map<string, number>();
  for (const venue of wcif?.schedule?.venues ?? []) {
    for (const room of venue.rooms ?? []) {
      for (const activity of room.activities ?? []) {
        const start = new Date(activity.startTime).getTime();
        const known = starts.get(activity.activityCode);
        if (known === undefined || start < known)
          starts.set(activity.activityCode, start);
      }
    }
  }
  return (a: string, b: string) => {
    const left = starts.get(a) ?? Infinity;
    const right = starts.get(b) ?? Infinity;
    return left === right ? a.localeCompare(b) : left - right;
  };
};

/**
 * Whether a group actually happened, so its assignments count.
 *
 * A group counts once a room started it (startedGroupIds, or currentGroupIds
 * for the one running now), or once anyone in it was recorded present or
 * late: a competitor's attempt marks them present in their group, and staff
 * scan in for the room's current groups. The second signal covers groups
 * started before startedGroupIds existed and groups the automatic group
 * change moved to, which only sets currentGroupIds. A round having results
 * is not enough: its later groups may not have run yet.
 */
export const happenedGroups = (
  rooms: { startedGroupIds: string[]; currentGroupIds: string[] }[],
  attendedGroupIds: string[],
) =>
  new Set([
    ...rooms.flatMap((room) => [
      ...room.startedGroupIds,
      ...room.currentGroupIds,
    ]),
    ...attendedGroupIds,
  ]);

const emptySummary = (): AttendanceSummary => ({
  attendancePct: null,
  covered: 0,
  expected: 0,
  late: 0,
  replaced: 0,
  absent: 0,
  leftEarly: 0,
  noShows: 0,
  extraHelp: 0,
});

const buildView = (
  activities: StatisticsActivity[],
  compareRounds: (a: string, b: string) => number,
): AttendanceStatisticsView => {
  const summary = emptySummary();
  const persons = new Map<
    string,
    PersonAttendance & { roleSet: Set<StaffingRole> }
  >();
  const rounds = new Map<string, { expected: number; covered: number }>();

  for (const activity of activities) {
    const role = activity.role as StaffingRole;
    const person = persons.get(activity.personId) ?? {
      personId: activity.personId,
      personName: activity.person.name,
      roles: [],
      roleSet: new Set<StaffingRole>(),
      assigned: 0,
      present: 0,
      late: 0,
      absent: 0,
      replaced: 0,
      leftEarly: 0,
      noShow: 0,
      extraHelp: 0,
      attendancePct: null,
    };
    persons.set(activity.personId, person);

    if (!activity.isAssigned) {
      // Unassigned rows are only ever help on top of the plan
      if (isCovered(activity.status)) {
        summary.extraHelp++;
        person.extraHelp++;
        person.roleSet.add(role);
      }
      continue;
    }

    person.roleSet.add(role);
    const roundId = roundIdOf(activity.groupId);
    const round = rounds.get(roundId) ?? { expected: 0, covered: 0 };
    rounds.set(roundId, round);

    summary.expected++;
    person.assigned++;
    round.expected++;
    if (isCovered(activity.status)) {
      summary.covered++;
      person.present++;
      round.covered++;
      if (activity.leftEarly) {
        summary.leftEarly++;
        person.leftEarly++;
      }
    }
    if (activity.status === StaffActivityStatus.LATE) {
      summary.late++;
      person.late++;
    }
    if (activity.status === StaffActivityStatus.REPLACED) {
      summary.replaced++;
      person.replaced++;
    }
    if (activity.status === StaffActivityStatus.ABSENT) {
      summary.absent++;
      person.absent++;
      if (activity.noShow) {
        summary.noShows++;
        person.noShow++;
      }
    }
  }

  summary.attendancePct = percentage(summary.covered, summary.expected);
  return {
    summary,
    persons: [...persons.values()]
      .filter((person) => person.assigned > 0 || person.extraHelp > 0)
      .map(({ roleSet, ...person }) => ({
        ...person,
        roles: STAFFING_ROLES.filter((role) => roleSet.has(role)),
        attendancePct: percentage(person.present, person.assigned),
      }))
      .sort((a, b) => a.personName.localeCompare(b.personName)),
    rounds: [...rounds.entries()]
      .sort(([a], [b]) => compareRounds(a, b))
      .map(([roundId, round]) => ({
        roundId,
        roundName: attendanceRoundName(roundId),
        expected: round.expected,
        covered: round.covered,
        attendancePct: percentage(round.covered, round.expected),
      })),
  };
};

/**
 * Staffing attendance over groups that happened. The percentage is covered
 * over assigned slots only; unassigned presence is extra help, counted apart
 * so it can't push anyone past 100%. Competing is not staffing.
 */
export const computeAttendanceStatistics = (
  activities: StatisticsActivity[],
  happened: Set<string>,
  wcif?: ScheduleWcif | null,
): AttendanceStatistics => {
  const compareRounds = scheduleOrder(wcif);
  const counted = activities.filter(
    (activity) =>
      activity.role !== StaffRole.COMPETITOR && happened.has(activity.groupId),
  );
  const byRole: AttendanceStatistics['byRole'] = {};
  for (const role of STAFFING_ROLES) {
    const ofRole = counted.filter((activity) => activity.role === role);
    if (ofRole.length > 0) {
      const view = buildView(ofRole, compareRounds);
      if (view.persons.length > 0) byRole[role] = view;
    }
  }
  return { ...buildView(counted, compareRounds), byRole };
};
