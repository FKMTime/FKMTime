import { AppGateway } from 'src/app.gateway';
import { DNF_VALUE } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { DelegateGrantService } from 'src/delegate-grant/delegateGrant.service';
import { DeviceService } from 'src/device/device.service';
import { IntegratedLiveRoundsService } from 'src/integrated-live/integratedLiveRounds.service';
import { ResultService } from 'src/result/result.service';
import { SocketController } from 'src/socket/socket.controller';
import { Competition as Wcif } from 'wcif-helpers';

import {
  Attempt,
  AttemptStatus,
  AttemptType,
  StaffActivityStatus,
  StaffRole,
} from '../generated/prisma/client';
import { found } from '../test-utils/found';
import { unusedDependency } from '../test-utils/unused-dependency';
import {
  CompetitionService,
  GROUP_CHANGE_CHECK_DELAY_MS,
} from './competition.service';
import {
  canLeaveGroup,
  CompetitorRow,
  getFirstGroupOfNextRoundInRoom,
  getGroupStatus,
  getMovesOnAt,
  getQuietSince,
  GROUP_IDLE_BEFORE_CHANGE_MS,
  planNextGroups,
  RoundRules,
} from './groupChange';
import { RoomsService } from './rooms.service';

// All times are on one day, around noon UTC
const at = (hour: number, minute = 0, second = 0) =>
  new Date(Date.UTC(2026, 8, 30, hour, minute, second)).toISOString();

let nextActivityId = 1;
const group = (activityCode: string, start: number, end: number) => ({
  id: nextActivityId++,
  activityCode,
  startTime: at(12, start),
  endTime: at(12, end),
  childActivities: [],
});
const round = (
  activityCode: string,
  groups: ReturnType<typeof group>[],
  start = groups[0]?.startTime ?? at(12),
  end = groups[groups.length - 1]?.endTime ?? at(13),
) => ({
  id: nextActivityId++,
  activityCode,
  startTime: start,
  endTime: end,
  childActivities: groups,
});
type Schedule = Record<string, ReturnType<typeof round>[]>;

/** A WCIF with the rooms given, each room in its own venue unless grouped */
const buildWcif = (
  venues: Schedule[],
  assignments: Record<number, string[]>,
  formats: Record<string, { format: string; cutoff?: unknown }> = {},
) => {
  const activities = venues.flatMap((venue) =>
    Object.values(venue).flatMap((rounds) =>
      rounds.flatMap((r) => [r, ...r.childActivities]),
    ),
  );
  const roundIds = [
    ...new Set(
      activities
        .map((a) => a.activityCode)
        .filter((code) => !code.includes('-g')),
    ),
  ];
  const eventIds = [...new Set(roundIds.map((id) => id.split('-')[0]))];
  return {
    events: eventIds.map((id) => ({
      id,
      rounds: roundIds
        .filter((r) => r.startsWith(`${id}-`))
        .map((r) => ({
          id: r,
          format: formats[r]?.format ?? '3',
          cutoff: formats[r]?.cutoff ?? null,
          timeLimit: null,
        })),
    })),
    persons: Object.entries(assignments).map(([registrantId, groupIds]) => ({
      registrantId: +registrantId,
      assignments: groupIds.map((groupId) => ({
        assignmentCode: 'competitor',
        activityId: found(
          activities.find((a) => a.activityCode === groupId),
          `activity ${groupId}`,
        ).id,
      })),
    })),
    schedule: {
      venues: venues.map((rooms, i) => ({
        id: i + 1,
        rooms: Object.entries(rooms).map(([name, rounds], j) => ({
          id: (i + 1) * 10 + j,
          name,
          activities: rounds,
        })),
      })),
    },
  } as unknown as Wcif;
};

const attempt = (attemptNumber: number, overrides: Partial<Attempt> = {}) =>
  ({
    id: `a${attemptNumber}-${Math.random()}`,
    attemptNumber,
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    extraGrantId: null,
    penalty: 0,
    value: 1500,
    solvedAt: new Date(at(12, 10)),
    ...overrides,
  }) as Attempt;
const solves = (count: number, solvedAt = new Date(at(12, 10))) =>
  Array.from({ length: count }, (_, i) => attempt(i + 1, { solvedAt }));

interface TestResult {
  roundId: string;
  /** Null for someone added locally, who then needs personId */
  registrantId: number | null;
  personId?: string;
  attempts: Attempt[];
  removedAt?: Date;
}
const toDbResult = (r: TestResult) => {
  const personId = r.personId ?? `p${r.registrantId}`;
  return {
    id: `r-${r.roundId}-${personId}`,
    roundId: r.roundId,
    eventId: r.roundId.split('-')[0],
    personId,
    person: { id: personId, registrantId: r.registrantId },
    attempts: r.attempts,
    removedAt: r.removedAt ?? null,
  };
};

/** A COMPETITOR attendance row; by default someone marked present */
interface TestRow {
  personId: string;
  groupId: string;
  role?: StaffRole;
  isAssigned?: boolean;
  status?: StaffActivityStatus;
  registrantId?: number | null;
  noShow?: boolean;
}
type RowWhere = {
  role?: StaffRole;
  isAssigned?: boolean;
  status?: { in: StaffActivityStatus[] };
  groupId?: { in?: string[]; startsWith?: string };
};
type RowsWhere = RowWhere & { OR?: RowWhere[] };
/** Applies a staffActivity where clause, refusing filters it doesn't know */
const matchesRow = (row: Required<TestRow>, where: RowsWhere) => {
  const known = ['role', 'isAssigned', 'status', 'groupId'];
  const unknown = Object.keys(where).filter(
    (key) => !known.includes(key) && where[key] !== undefined,
  );
  if (unknown.length) throw new Error(`Unmocked filter: ${unknown}`);
  return (
    (where.role === undefined || row.role === where.role) &&
    (where.isAssigned === undefined || row.isAssigned === where.isAssigned) &&
    (!where.status || where.status.in.includes(row.status)) &&
    (!where.groupId?.in || where.groupId.in.includes(row.groupId)) &&
    (!where.groupId?.startsWith ||
      row.groupId.startsWith(where.groupId.startsWith))
  );
};

const setup = ({
  wcif,
  rooms,
  results = [],
  attendance = [],
  freshSetGrantIds = [],
  competition = {},
}: {
  wcif: Wcif;
  rooms: { id: string; name: string; currentGroupIds: string[] }[];
  results?: TestResult[];
  attendance?: TestRow[];
  freshSetGrantIds?: string[];
  competition?: Record<string, unknown>;
}) => {
  const state = {
    rooms: rooms.map((room) => ({
      startedGroupIds: [...room.currentGroupIds],
      ...room,
    })),
    results: results.map(toDbResult),
  };
  const findRoom = (id: string) => state.rooms.find((r) => r.id === id);
  // For a room the test set up, so it's there
  const roomById = (id: string) => found(findRoom(id), `room ${id}`);
  // A read is a snapshot, as from the database
  const readRoom = async ({ where }) => {
    const room = findRoom(where.id);
    return room ? structuredClone(room) : null;
  };
  const readCompetition = jest.fn(async () => ({
    wcif,
    useFkmTimeDevices: true,
    shouldChangeGroupsAutomatically: true,
    sendingResultsFrequency: 'NEVER',
    ...competition,
  }));
  const prisma = {
    competition: {
      findFirst: readCompetition,
      findFirstOrThrow: readCompetition,
    },
    room: {
      findMany: jest.fn(
        async (args?: { where?: { id?: { in: string[] } } }) => {
          const ids = args?.where?.id?.in;
          return ids
            ? state.rooms.filter((r) => ids.includes(r.id))
            : state.rooms;
        },
      ),
      findFirst: jest.fn(readRoom),
      findUnique: jest.fn(readRoom),
      update: jest.fn((args) => args),
      // Only writes while the room still runs the groups the caller read
      updateMany: jest.fn(async ({ where, data }) => {
        const room = findRoom(where.id);
        const unchanged =
          room &&
          (!where.currentGroupIds ||
            JSON.stringify(room.currentGroupIds) ===
              JSON.stringify(where.currentGroupIds.equals));
        if (!unchanged) return { count: 0 };
        Object.assign(room, data);
        return { count: 1 };
      }),
    },
    result: {
      // Like the database, which leaves removed results out unless asked
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { roundId: { in: string[] }; removedAt?: unknown };
        }) =>
          state.results.filter(
            (r) =>
              where.roundId.in.includes(r.roundId) &&
              (where.removedAt ? r.removedAt !== null : !r.removedAt),
          ),
      ),
    },
    extraGrant: {
      // Open in whichever round is asked about
      findMany: jest.fn(async ({ where }) =>
        where.result.roundId.in.flatMap((roundId: string) =>
          freshSetGrantIds.map((id) => ({ id, result: { roundId } })),
        ),
      ),
    },
    staffActivity: {
      findMany: jest.fn(async ({ where }: { where: RowsWhere }) =>
        attendance
          .map((row) => ({
            role: StaffRole.COMPETITOR,
            isAssigned: false,
            status: StaffActivityStatus.PRESENT,
            noShow: false,
            registrantId: Number(row.personId.slice(1)) || null,
            ...row,
          }))
          .filter((row) =>
            (where.OR ?? [{}]).some((or) =>
              matchesRow(row, { ...where, OR: undefined, ...or }),
            ),
          )
          .map((row) => ({
            ...row,
            person: { registrantId: row.registrantId },
          })),
      ),
    },
    $transaction: jest.fn(async (updates) => {
      for (const { where, data } of updates) {
        Object.assign(roomById(where.id), data);
      }
    }),
  };
  const emit = jest.fn();
  const appGateway = { server: { to: () => ({ emit }) } };
  const resultService = {};
  const socketController = { sendServerStatus: jest.fn() };
  const onRoundStarted = jest.fn().mockResolvedValue(undefined);
  const roomsService = new RoomsService(
    prisma as unknown as DbService,
    socketController as unknown as SocketController,
    { onRoundStarted } as unknown as IntegratedLiveRoundsService,
    { handleRoomGroupsStarted: jest.fn() } as unknown as DeviceService,
    {
      syncWithRooms: jest.fn().mockResolvedValue(undefined),
      announceUncoveredGroups: jest.fn().mockResolvedValue(undefined),
      useGroupEnteredAt: jest.fn(),
    } as unknown as DelegateGrantService,
  );
  const service = new CompetitionService(
    prisma as unknown as DbService,
    appGateway as unknown as AppGateway,
    resultService as unknown as ResultService,
    unusedDependency(),
    socketController as unknown as SocketController,
    roomsService,
  );
  const messages = () => emit.mock.calls.map(([, payload]) => payload.message);
  return {
    service,
    state,
    prisma,
    roomById,
    messages,
    socketController,
    onRoundStarted,
    roomsService,
    addResult: (r: TestResult) => state.results.push(toDbResult(r)),
  };
};

describe('CompetitionService group change with a redo outstanding', () => {
  const wcif = buildWcif(
    [
      {
        Main: [
          round('333-r1', [
            group('333-r1-g1', 0, 30),
            group('333-r1-g2', 30, 60),
          ]),
        ],
      },
    ],
    { 1: ['333-r1-g1'], 2: ['333-r1-g2'] },
    { '333-r1': { format: 'a' } },
  );
  const redo = (id: string, attemptNumber: number, overrides = {}) =>
    attempt(attemptNumber, {
      id,
      status: AttemptStatus.EXTRA_GIVEN,
      extraGrantId: 'fresh',
      ...overrides,
    });

  const canChange = async (currentGroupId: string, attempts: Attempt[]) => {
    const { service } = setup({
      wcif,
      rooms: [{ id: 'room', name: 'Main', currentGroupIds: [currentGroupId] }],
      results: [
        { roundId: '333-r1', registrantId: 1, attempts },
        { roundId: '333-r1', registrantId: 2, attempts: solves(5) },
      ],
      freshSetGrantIds: ['fresh'],
    });
    const changeGroup = jest
      .spyOn(service, 'changeGroup')
      .mockResolvedValue(undefined);
    await service.checkIfGroupCanBeChanged('room');
    return changeGroup.mock.calls.length > 0;
  };

  const notStarted = [redo('s1', 1), redo('s2', 2)];
  const started = [
    redo('s1', 1, { replacedBy: 1 }),
    redo('s2', 2),
    attempt(1, {
      id: 'e1',
      type: AttemptType.EXTRA_ATTEMPT,
      status: AttemptStatus.STANDARD,
    }),
  ];

  it('moves on when a fresh-set redo is planned for the next group', async () => {
    expect(await canChange('333-r1-g1', notStarted)).toBe(true);
  });

  it('skips a partial grant the same way', async () => {
    const partial = [
      attempt(1, { id: 's1', status: AttemptStatus.STANDARD }),
      redo('s2', 2),
    ];
    expect(await canChange('333-r1-g1', partial)).toBe(true);
  });

  it('waits once the redo has started', async () => {
    expect(await canChange('333-r1-g1', started)).toBe(false);
  });

  it('waits for any redo in the last group', async () => {
    expect(await canChange('333-r1-g2', notStarted)).toBe(false);
  });

  it('lets the last group go once the earlier group has no redo left', async () => {
    expect(await canChange('333-r1-g2', solves(5))).toBe(true);
  });
});

describe('automatic group change', () => {
  // Main runs 333-r1 g1-g2 then 222-r1; Side runs 333-r1 g3 at the same time
  const schedule = () => [
    {
      Main: [
        round('333-r1', [
          group('333-r1-g1', 0, 20),
          group('333-r1-g2', 20, 40),
        ]),
        round('222-r1', [group('222-r1-g1', 45, 59)]),
      ],
      Side: [round('333-r1', [group('333-r1-g3', 0, 40)])],
    },
  ];
  const assignments = {
    1: ['333-r1-g1'],
    2: ['333-r1-g1'],
    3: ['333-r1-g2'],
    4: ['333-r1-g3'],
    5: ['222-r1-g1'],
  };
  const mainAndSide = () => [
    { id: 'main', name: 'Main', currentGroupIds: ['333-r1-g1'] },
    { id: 'side', name: 'Side', currentGroupIds: ['333-r1-g3'] },
  ];

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(at(12, 15)) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('after an attempt', () => {
    it('moves the room on shortly after the last attempt of the group', async () => {
      const { service, roomById, addResult } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [{ roundId: '333-r1', registrantId: 1, attempts: solves(3) }],
      });
      addResult({ roundId: '333-r1', registrantId: 2, attempts: solves(3) });

      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS - 1);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
      await jest.advanceTimersByTimeAsync(1);

      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('does not wait for the group to go quiet', async () => {
      // The last attempt was a second ago; the old check wanted 5 minutes
      const now = new Date(at(12, 15));
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3, now) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3, now) },
        ],
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('waits for a competitor who has not started yet', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [{ roundId: '333-r1', registrantId: 1, attempts: solves(3) }],
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
    });

    it('does not wait for a competitor marked as not coming', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [{ roundId: '333-r1', registrantId: 1, attempts: solves(3) }],
        attendance: [
          {
            personId: 'p2',
            groupId: '333-r1-g1',
            isAssigned: true,
            status: StaffActivityStatus.ABSENT,
            noShow: true,
          },
        ],
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('waits for someone marked as not coming who started after all', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(1) },
        ],
        attendance: [
          {
            personId: 'p2',
            groupId: '333-r1-g1',
            isAssigned: true,
            status: StaffActivityStatus.ABSENT,
            noShow: true,
          },
        ],
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
    });

    it('waits for an open incident, then moves on once it is resolved', async () => {
      const { service, roomById, state } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          {
            roundId: '333-r1',
            registrantId: 2,
            attempts: [
              ...solves(2),
              attempt(3, { status: AttemptStatus.UNRESOLVED }),
            ],
          },
        ],
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);

      state.results[1].attempts[2].status = AttemptStatus.RESOLVED;
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('takes a burst of attempts in one check per room', async () => {
      const { service, prisma } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
      });
      const check = jest.spyOn(service, 'checkIfGroupCanBeChanged');

      for (let i = 0; i < 5; i++) {
        service.requestGroupChangeCheck('333-r1');
        await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS / 5);
      }
      // Main and Side both run 333-r1: one check each
      expect(check.mock.calls).toEqual([
        ['main', 'event'],
        ['side', 'event'],
      ]);
      expect(prisma.room.findMany).toHaveBeenCalledTimes(5);

      // An attempt after the window opens a new one
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(check).toHaveBeenCalledTimes(4);
    });

    it('only checks the rooms running the round', async () => {
      const { service } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [
          { id: 'main', name: 'Main', currentGroupIds: ['222-r1-g1'] },
          { id: 'side', name: 'Side', currentGroupIds: ['333-r1-g3'] },
        ],
      });
      const check = jest.spyOn(service, 'checkIfGroupCanBeChanged');
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(check.mock.calls).toEqual([['side', 'event']]);
    });

    it('never runs two checks of one room at once', async () => {
      const { service } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
      });
      let running = 0;
      let mostAtOnce = 0;
      jest
        .spyOn(service, 'checkIfGroupCanBeChanged')
        .mockImplementation(async () => {
          running++;
          mostAtOnce = Math.max(mostAtOnce, running);
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          running--;
        });

      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      // The periodic check and another attempt arrive mid-check
      const cron = service.checkIfGroupShouldBeChanged();
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(40_000);
      await cron;

      expect(service.checkIfGroupCanBeChanged).toHaveBeenCalledTimes(3);
      expect(mostAtOnce).toBe(1);
    });

    it('does nothing with automatic group change off', async () => {
      const { service, roomById, messages } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
        ],
        competition: { shouldChangeGroupsAutomatically: false },
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
      expect(messages()).toEqual([]);
    });

    it('does nothing without FKMTime devices', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
        ],
        competition: { useFkmTimeDevices: false },
      });
      service.requestGroupChangeCheck('333-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
    });
  });

  describe('judging a group by its own competitors', () => {
    it('is not held back by the same round in another room', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          // Side's competitor is mid-average
          { roundId: '333-r1', registrantId: 4, attempts: solves(1) },
        ],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      await service.checkIfGroupCanBeChanged('side', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
      expect(roomById('side').currentGroupIds).toEqual(['333-r1-g3']);
    });

    it('counts someone who competed in the group without an assignment', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          // Assigned to g2, but competing in g1
          { roundId: '333-r1', registrantId: 3, attempts: solves(1) },
        ],
        attendance: [{ personId: 'p3', groupId: '333-r1-g1' }],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
    });

    it('lets a group with a no-show go once the group has been quiet a while', async () => {
      // Competitor 2 never showed up; 1 finished at 12:10
      const results = [
        { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
      ];
      // Running since well before the group, which the room has been in
      jest.setSystemTime(new Date(at(12, 0)));
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results,
      });
      jest.setSystemTime(new Date(at(12, 14)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);

      jest.setSystemTime(new Date(at(12, 16)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it("goes by the room's own last attempt, not the round's", async () => {
      // Side's competitor solved a minute ago; Main's group has been quiet
      jest.setSystemTime(new Date(at(12, 0)));
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), {
          ...assignments,
          6: ['333-r1-g3'],
        }),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          {
            roundId: '333-r1',
            registrantId: 4,
            attempts: solves(3, new Date(at(12, 19))),
          },
        ],
      });
      jest.setSystemTime(new Date(at(12, 20)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
      expect(roomById('side').currentGroupIds).toEqual(['333-r1-g3']);
    });

    it('does not leave a group nobody has started', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
      });
      jest.setSystemTime(new Date(at(13, 30)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
    });

    it('does not skip a group the room just reached because someone in it solved early', async () => {
      jest.setSystemTime(new Date(at(12, 0)));
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), { ...assignments, 6: ['333-r1-g2'] }),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          // In g2, but done early during g1; 6 hasn't started
          {
            roundId: '333-r1',
            registrantId: 3,
            attempts: solves(3, new Date(at(12, 5))),
          },
        ],
      });
      jest.setSystemTime(new Date(at(12, 30)));
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);

      // The periodic check right after the switch
      jest.setSystemTime(new Date(at(12, 31)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);

      // Quiet for the whole spell since the room got there: a no-show
      jest.setSystemTime(new Date(at(12, 35, 1)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
    });

    it('after a restart, waits a whole quiet spell before giving up on a group', async () => {
      // The room was already in g2 when the backend started at 12:30
      jest.setSystemTime(new Date(at(12, 30)));
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), { ...assignments, 6: ['333-r1-g2'] }),
        rooms: [{ id: 'main', name: 'Main', currentGroupIds: ['333-r1-g2'] }],
        results: [
          {
            roundId: '333-r1',
            registrantId: 3,
            attempts: solves(3, new Date(at(12, 5))),
          },
        ],
      });
      jest.setSystemTime(new Date(at(12, 31)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);

      jest.setSystemTime(new Date(at(12, 35, 1)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
    });

    it('waits in the last group for a competitor added by hand', async () => {
      const { service, roomById, addResult } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [{ id: 'main', name: 'Main', currentGroupIds: ['333-r1-g2'] }],
        results: [{ roundId: '333-r1', registrantId: 3, attempts: solves(3) }],
        // Not assigned anywhere, added to g2 in the attendance page
        attendance: [{ personId: 'p7', groupId: '333-r1-g2' }],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);

      addResult({ roundId: '333-r1', registrantId: 7, attempts: solves(3) });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
    });

    it('follows a competitor moved to another group on the competitor page', async () => {
      // The stored WCIF still has competitor 8 in g1; their row says g2
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), { ...assignments, 8: ['333-r1-g1'] }),
        rooms: [mainAndSide()[0]],
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 3, attempts: solves(3) },
        ],
        attendance: [
          {
            personId: 'p8',
            groupId: '333-r1-g2',
            isAssigned: true,
            status: StaffActivityStatus.ABSENT,
          },
        ],
      });
      // No longer held by g1
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);

      // Held by g2, though not marked present yet
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('is not misled by a removed result of someone without a registrant id', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          // Added locally, competed in g1 and finished
          {
            roundId: '333-r1',
            registrantId: null,
            personId: 'local-a',
            attempts: solves(3),
          },
          // Also added locally, removed after one attempt
          {
            roundId: '333-r1',
            registrantId: null,
            personId: 'local-b',
            attempts: solves(1),
            removedAt: new Date(at(12, 12)),
          },
        ],
        attendance: [
          { personId: 'local-a', groupId: '333-r1-g1', registrantId: null },
        ],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('moves on once a scrambled attempt is entered by hand', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          {
            roundId: '333-r1',
            registrantId: 2,
            attempts: [
              ...solves(2),
              // Edited from SCRAMBLED in the panel: no solvedAt is written
              attempt(3, {
                status: AttemptStatus.STANDARD,
                scrambledAt: new Date(at(12, 11)),
                solvedAt: null,
              }),
            ],
          },
        ],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('counts a competitor with only a scramble in hand as started', async () => {
      jest.setSystemTime(new Date(at(12, 0)));
      const { service, roomById, messages } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          {
            roundId: '333-r1',
            registrantId: 2,
            attempts: [
              attempt(1, {
                status: AttemptStatus.SCRAMBLED,
                scrambledAt: new Date(at(12, 14)),
                solvedAt: null,
              }),
            ],
          },
        ],
      });
      // Scrambled at 12:14: not quiet yet at 12:16, though the last solve
      // was at 12:10
      jest.setSystemTime(new Date(at(12, 16)));
      await service.checkIfGroupCanBeChanged('main', 'event');
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
      expect(messages()).toEqual([]);

      // Quiet for a whole spell after the scramble: still not finished
      jest.setSystemTime(new Date(at(12, 20)));
      await service.checkIfGroupShouldBeChanged();
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g1']);
      expect(messages()).toEqual([
        'Group in room Main should be changed, but not all results are entered.',
      ]);
    });

    it('is not held back by a removed result', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          // Removed under Regulation 9t after one attempt
          {
            roundId: '333-r1',
            registrantId: 2,
            attempts: solves(1),
            removedAt: new Date(at(12, 12)),
          },
        ],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
    });
  });

  describe('what the home page shows', () => {
    const roomsProgress = async (competition: Record<string, unknown> = {}) => {
      // Running since before the group; competitor 1 finished at 12:11
      jest.setSystemTime(new Date(at(12, 0)));
      const { service, prisma } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: mainAndSide(),
        results: [
          {
            roundId: '333-r1',
            registrantId: 1,
            attempts: solves(3, new Date(at(12, 11))),
          },
        ],
        attendance: [
          {
            personId: 'p2',
            groupId: '333-r1-g1',
            isAssigned: true,
            status: StaffActivityStatus.ABSENT,
          },
        ],
        competition,
      });
      (prisma as Record<string, unknown>).person = {
        findMany: jest.fn(async () => [
          { id: 'p2', name: 'Competitor Two', registrantId: 2 },
        ]),
      };
      jest.setSystemTime(new Date(at(12, 14)));
      const [main] = await service.getRoomsProgress();
      return main.groups[0];
    };

    it('counts the results entered in the group', async () => {
      expect(await roomsProgress()).toMatchObject({
        groupId: '333-r1-g1',
        roundId: '333-r1',
        competitors: 2,
        finished: 1,
        entered: 3,
        expected: 6,
        expectedIsFinal: true,
      });
    });

    it('says who the group waits for and when it moves on by itself', async () => {
      expect((await roomsProgress()).wait).toEqual({
        state: 'waitingForCompetitors',
        notStarted: [{ personId: 'p2', name: 'Competitor Two' }],
        solving: 0,
        incidents: 0,
        extras: 0,
        // Quiet from 12:16, then the next periodic check
        movesOnAt: at(12, 20),
      });
    });

    it('gives no time when the room does not move on by itself', async () => {
      expect(
        (await roomsProgress({ shouldChangeGroupsAutomatically: false })).wait,
      ).toMatchObject({ state: 'waitingForCompetitors', movesOnAt: null });
    });
  });

  describe('a room running several groups', () => {
    const parallel = () => [
      {
        Hall: [
          round('444-r1', [
            group('444-r1-g1', 0, 15),
            group('444-r1-g2', 15, 30),
          ]),
          round('555-r1', [group('555-r1-g1', 0, 30)]),
          round('666-r1', [group('666-r1-g1', 35, 50)]),
        ],
      },
    ];
    const parallelAssignments = {
      1: ['444-r1-g1'],
      2: ['444-r1-g2'],
      3: ['555-r1-g1'],
    };
    const hall = (currentGroupIds: string[]) => [
      { id: 'hall', name: 'Hall', currentGroupIds },
    ];

    it('moves a finished group on and keeps the other running', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(parallel(), parallelAssignments),
        rooms: hall(['444-r1-g1', '555-r1-g1']),
        results: [
          { roundId: '444-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '555-r1', registrantId: 3, attempts: solves(1) },
        ],
      });
      service.requestGroupChangeCheck('444-r1');
      await jest.advanceTimersByTimeAsync(GROUP_CHANGE_CHECK_DELAY_MS);
      expect(roomById('hall').currentGroupIds).toEqual([
        '444-r1-g2',
        '555-r1-g1',
      ]);
    });

    it('drops a round that is over while another group still runs', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(parallel(), parallelAssignments),
        rooms: hall(['444-r1-g2', '555-r1-g1']),
        results: [
          { roundId: '444-r1', registrantId: 2, attempts: solves(3) },
          { roundId: '555-r1', registrantId: 3, attempts: solves(1) },
        ],
      });
      await service.checkIfGroupCanBeChanged('hall', 'event');
      expect(roomById('hall').currentGroupIds).toEqual(['555-r1-g1']);
    });

    it('starts the next round once every group is over', async () => {
      const { service, roomById } = setup({
        wcif: buildWcif(parallel(), parallelAssignments),
        rooms: hall(['444-r1-g2', '555-r1-g1']),
        results: [
          { roundId: '444-r1', registrantId: 2, attempts: solves(3) },
          { roundId: '555-r1', registrantId: 3, attempts: solves(3) },
        ],
      });
      await service.checkIfGroupCanBeChanged('hall', 'event');
      expect(roomById('hall').currentGroupIds).toEqual(['666-r1-g1']);
    });
  });

  describe('moving on', () => {
    it('records the new group as started, like starting it from the panel', async () => {
      const { service, roomById, socketController, onRoundStarted, messages } =
        setup({
          wcif: buildWcif(schedule(), assignments),
          rooms: mainAndSide(),
          results: [
            { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
            { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
          ],
        });
      await service.checkIfGroupCanBeChanged('main', 'event');

      expect(roomById('main').startedGroupIds).toEqual([
        '333-r1-g1',
        '333-r1-g2',
      ]);
      expect(socketController.sendServerStatus).toHaveBeenCalled();
      expect(onRoundStarted).toHaveBeenCalledWith('333-r1');
      expect(messages()).toEqual([
        'Group in room Main was changed to 333-r1-g2',
      ]);
    });

    it("starts the room's next round after its last group", async () => {
      const { service, roomById, onRoundStarted } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [{ id: 'main', name: 'Main', currentGroupIds: ['333-r1-g2'] }],
        results: [{ roundId: '333-r1', registrantId: 3, attempts: solves(3) }],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
      expect(roomById('main').startedGroupIds).toContain('222-r1-g1');
      expect(onRoundStarted).toHaveBeenCalledWith('222-r1');
    });

    it('finds the next round when another venue has no room of that name', async () => {
      const wcif = buildWcif(
        [
          { Annex: [round('777-r1', [group('777-r1-g1', 0, 30)])] },
          {
            Main: [
              round('333-r1', [group('333-r1-g1', 0, 20)]),
              round('222-r1', [group('222-r1-g1', 30, 50)]),
            ],
          },
        ],
        { 1: ['333-r1-g1'] },
      );
      const { service, roomById } = setup({
        wcif,
        rooms: [{ id: 'main', name: 'Main', currentGroupIds: ['333-r1-g1'] }],
        results: [{ roundId: '333-r1', registrantId: 1, attempts: solves(3) }],
      });
      await service.checkIfGroupCanBeChanged('main', 'event');
      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
      await expect(
        service.getNextGroupsFromScheduleForRoom('main', ['333-r1-g1']),
      ).resolves.toEqual(['222-r1-g1']);
      await expect(
        service.getPreviousGroupsFromScheduleForRoom('main', ['222-r1-g1']),
      ).resolves.toEqual(['333-r1-g1']);
    });

    it('keeps a change made in the panel while the room was being moved on', async () => {
      const { service, roomById, prisma, socketController, messages } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
        ],
      });
      const write = found(
        prisma.room.updateMany.getMockImplementation(),
        'the updateMany mock',
      );
      prisma.room.updateMany.mockImplementationOnce(async (args) => {
        // A delegate's change lands between the read and the write
        roomById('main').currentGroupIds = ['222-r1-g1'];
        return write(args);
      });

      await service.checkIfGroupCanBeChanged('main', 'event');

      expect(roomById('main').currentGroupIds).toEqual(['222-r1-g1']);
      expect(roomById('main').startedGroupIds).toEqual(['333-r1-g1']);
      expect(socketController.sendServerStatus).not.toHaveBeenCalled();
      expect(messages()).toEqual([]);
    });

    it('leaves the room alone if its groups were changed by hand meanwhile', async () => {
      const { service, roomById, socketController } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [{ id: 'main', name: 'Main', currentGroupIds: ['333-r1-g2'] }],
      });
      await service.changeGroup('main', ['333-r1-g1']);
      expect(roomById('main').currentGroupIds).toEqual(['333-r1-g2']);
      expect(socketController.sendServerStatus).not.toHaveBeenCalled();
    });
  });

  describe('warnings', () => {
    it('says once that a group should be changed while the setting is off', async () => {
      const { service, messages, state } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
        results: [
          { roundId: '333-r1', registrantId: 1, attempts: solves(3) },
          { roundId: '333-r1', registrantId: 2, attempts: solves(3) },
        ],
        competition: { shouldChangeGroupsAutomatically: false },
      });
      await service.checkIfGroupShouldBeChanged();
      await service.checkIfGroupShouldBeChanged();
      await service.checkIfGroupShouldBeChanged();
      expect(messages()).toEqual([
        'Group in room Main should be changed, but automatic group change is disabled.',
      ]);

      // Once the group changes, the next one gets its own warning
      state.rooms[0].currentGroupIds = ['333-r1-g2'];
      state.results.push(
        toDbResult({
          roundId: '333-r1',
          registrantId: 3,
          attempts: solves(3),
        }),
      );
      await service.checkIfGroupShouldBeChanged();
      await service.checkIfGroupShouldBeChanged();
      expect(messages()).toHaveLength(2);
    });

    it('says once that results are missing in a quiet group', async () => {
      const { service, messages } = setup({
        wcif: buildWcif(schedule(), assignments),
        rooms: [mainAndSide()[0]],
        results: [{ roundId: '333-r1', registrantId: 1, attempts: solves(2) }],
      });
      jest.setSystemTime(new Date(at(12, 30)));
      await service.checkIfGroupShouldBeChanged();
      await service.checkIfGroupShouldBeChanged();
      expect(messages()).toEqual([
        'Group in room Main should be changed, but not all results are entered.',
      ]);
    });
  });
});

describe('group change helpers', () => {
  const rules: RoundRules = {
    maxAttempts: 5,
    cutoff: null,
    freshSetGrantIds: [],
    hasNextGroup: true,
  };
  const result = (registrantId: number, attempts: Attempt[]) => ({
    personId: `p${registrantId}`,
    person: { registrantId },
    attempts,
  });
  const row = (
    personId: string,
    groupId: string,
    overrides: Partial<CompetitorRow> = {},
  ): CompetitorRow => ({
    personId,
    registrantId: Number(personId.slice(1)) || null,
    groupId,
    isAssigned: false,
    status: StaffActivityStatus.PRESENT,
    ...overrides,
  });

  it('waits for the attempts left before the cutoff', () => {
    const status = getGroupStatus({
      results: [result(1, solves(1))],
      assignedRegistrantIds: [1],
      groupId: '333-r1-g1',
      rules: { ...rules, cutoff: { numberOfAttempts: 2, resultValue: 1000 } },
    });
    expect(status.state).toBe('inProgress');
  });

  it('is done after the cutoff attempts when the cutoff was missed', () => {
    const status = getGroupStatus({
      results: [result(1, solves(2))],
      assignedRegistrantIds: [1],
      groupId: '333-r1-g1',
      rules: { ...rules, cutoff: { numberOfAttempts: 2, resultValue: 1000 } },
    });
    expect(status.state).toBe('finished');
  });

  it('takes the last attempt from the group only', () => {
    const status = getGroupStatus({
      results: [
        result(1, solves(5, new Date(at(12, 5)))),
        result(9, solves(1, new Date(at(12, 30)))),
      ],
      assignedRegistrantIds: [1],
      groupId: '333-r1-g1',
      rules,
    });
    expect(status).toMatchObject({
      state: 'finished',
      lastAttemptAt: +new Date(at(12, 5)),
    });
  });

  it('lets a group with missing competitors go only from the periodic check, after a quiet spell', () => {
    const status = {
      state: 'waitingForCompetitors' as const,
      lastAttemptAt: 0,
    };
    const later = GROUP_IDLE_BEFORE_CHANGE_MS + 1;
    expect(canLeaveGroup(status, 'event', later, 0)).toBe(false);
    expect(canLeaveGroup(status, 'cron', later - 2, 0)).toBe(false);
    expect(canLeaveGroup(status, 'cron', later, 0)).toBe(true);
  });

  it('counts the quiet spell from when the room reached the group', () => {
    const status = {
      state: 'waitingForCompetitors' as const,
      lastAttemptAt: 1_000,
    };
    const enteredAt = 60_000;
    expect(getQuietSince(status, enteredAt)).toBe(enteredAt);
    expect(
      canLeaveGroup(
        status,
        'cron',
        enteredAt + GROUP_IDLE_BEFORE_CHANGE_MS,
        enteredAt,
      ),
    ).toBe(false);
    expect(
      canLeaveGroup(
        status,
        'cron',
        enteredAt + GROUP_IDLE_BEFORE_CHANGE_MS + 1,
        enteredAt,
      ),
    ).toBe(true);
    // An attempt after the room got there counts from that attempt
    expect(getQuietSince({ ...status, lastAttemptAt: 90_000 }, enteredAt)).toBe(
      90_000,
    );
  });

  it('times the move on to the periodic check after the quiet spell', () => {
    const minute = 60_000;
    const waiting = {
      state: 'waitingForCompetitors' as const,
      lastAttemptAt: 11 * minute,
    };
    // Quiet enough at 16:00, so the check at 20:00
    expect(getMovesOnAt(waiting, 0, 5 * minute)).toBe(20 * minute);
    // A check right on the mark takes it
    expect(
      getMovesOnAt({ ...waiting, lastAttemptAt: 10 * minute }, 0, 5 * minute),
    ).toBe(15 * minute);
    expect(
      getMovesOnAt({ ...waiting, state: 'inProgress' }, 0, 5 * minute),
    ).toBe(null);
  });

  it('does not wait for someone absent and marked as not coming', () => {
    const status = getGroupStatus({
      groupId: '333-r1-g1',
      results: [result(1, solves(5))],
      assignedRegistrantIds: [1, 2],
      competitorRows: [
        row('p2', '333-r1-g1', {
          isAssigned: true,
          status: StaffActivityStatus.ABSENT,
          noShow: true,
        }),
      ],
      rules,
    });
    expect(status.state).toBe('finished');
  });

  it('waits for someone marked as not coming who is here after all', () => {
    const status = getGroupStatus({
      groupId: '333-r1-g1',
      results: [result(1, solves(5))],
      assignedRegistrantIds: [1, 2],
      competitorRows: [
        row('p2', '333-r1-g1', { isAssigned: true, noShow: true }),
      ],
      rules,
    });
    expect(status.state).toBe('waitingForCompetitors');
  });

  it('says who the group waits for and what is left to do', () => {
    const status = getGroupStatus({
      groupId: '333-r1-g1',
      results: [
        result(1, solves(2)),
        result(3, [attempt(1, { status: AttemptStatus.UNRESOLVED })]),
        result(4, [
          attempt(1, { status: AttemptStatus.EXTRA_GIVEN }),
          ...solves(5).slice(1),
        ]),
        result(6, solves(5)),
      ],
      // 5 has no attendance row yet
      assignedRegistrantIds: [1, 2, 3, 4, 5, 6],
      competitorRows: [
        row('p2', '333-r1-g1', {
          isAssigned: true,
          status: StaffActivityStatus.ABSENT,
        }),
        // Marked present, not assigned, not started
        row('p7', '333-r1-g1'),
      ],
      rules,
    });
    expect(status.state).toBe('inProgress');
    expect(status.blockers).toEqual({
      notStarted: [
        { personId: 'p2', registrantId: 2 },
        { personId: null, registrantId: 5 },
        { personId: 'p7', registrantId: 7 },
      ],
      solving: 1,
      incidents: 1,
      extras: 1,
    });
  });

  it('leaves out a removed result and its competitor', () => {
    const status = getGroupStatus({
      results: [
        result(1, solves(5)),
        { ...result(2, solves(1)), removedAt: new Date(at(12, 20)) },
      ],
      assignedRegistrantIds: [1, 2],
      groupId: '333-r1-g1',
      competitorRows: [row('p2', '333-r1-g1')],
      removed: [{ personId: 'p2', registrantId: 2 }],
      rules,
    });
    expect(status.state).toBe('finished');
  });

  describe('a scrambled attempt finished some other way', () => {
    // Scrambled at 12:09, then given a time by hand or ruled DNF: STANDARD,
    // still with its scrambledAt and never a solvedAt
    const finishedFromScramble = (overrides: Partial<Attempt>) =>
      attempt(5, {
        status: AttemptStatus.STANDARD,
        scrambledAt: new Date(at(12, 9)),
        solvedAt: null,
        ...overrides,
      });
    const statusWith = (fifth: Attempt) =>
      getGroupStatus({
        groupId: '333-r1-g1',
        results: [result(1, [...solves(4), fifth])],
        assignedRegistrantIds: [1],
        rules,
      });

    it('is done once entered by hand', () => {
      expect(statusWith(finishedFromScramble({ value: 1700 })).state).toBe(
        'finished',
      );
    });

    it('is done once ruled DNF', () => {
      expect(
        statusWith(finishedFromScramble({ value: 0, penalty: DNF_VALUE }))
          .state,
      ).toBe('finished');
    });

    it('still waits while the attempt is only scrambled', () => {
      expect(
        statusWith(finishedFromScramble({ status: AttemptStatus.SCRAMBLED }))
          .state,
      ).toBe('inProgress');
    });
  });

  it('takes a scramble as activity and its competitor as started', () => {
    const status = getGroupStatus({
      groupId: '333-r1-g1',
      results: [
        result(1, solves(5, new Date(at(12, 5)))),
        result(2, [
          attempt(1, {
            status: AttemptStatus.SCRAMBLED,
            scrambledAt: new Date(at(12, 9)),
            solvedAt: null,
          }),
        ]),
      ],
      assignedRegistrantIds: [1, 2],
      rules,
    });
    expect(status).toMatchObject({
      state: 'inProgress',
      lastAttemptAt: +new Date(at(12, 9)),
    });
  });

  it('keeps an assigned row whatever its attendance, and drops a stale WCIF assignment', () => {
    const rows = [
      row('p8', '333-r1-g2', {
        isAssigned: true,
        status: StaffActivityStatus.ABSENT,
      }),
    ];
    const inG1 = getGroupStatus({
      groupId: '333-r1-g1',
      results: [result(1, solves(5))],
      assignedRegistrantIds: [1, 8],
      competitorRows: rows,
      rules,
    });
    const inG2 = getGroupStatus({
      groupId: '333-r1-g2',
      results: [result(3, solves(5))],
      assignedRegistrantIds: [3],
      competitorRows: rows,
      rules,
    });
    expect(inG1.state).toBe('finished');
    expect(inG2.state).toBe('waitingForCompetitors');
  });

  it('leaves out an absent row nobody assigned', () => {
    const status = getGroupStatus({
      groupId: '333-r1-g1',
      results: [result(1, solves(5))],
      assignedRegistrantIds: [1],
      competitorRows: [
        row('p7', '333-r1-g1', { status: StaffActivityStatus.ABSENT }),
      ],
      rules,
    });
    expect(status.state).toBe('finished');
  });

  it('waits for someone marked present who has no attempt yet', () => {
    const status = getGroupStatus({
      results: [result(1, solves(5))],
      assignedRegistrantIds: [1],
      groupId: '333-r1-g1',
      competitorRows: [row('p7', '333-r1-g1')],
      rules,
    });
    expect(status.state).toBe('waitingForCompetitors');
  });

  it('plans nothing when there is nothing to start', () => {
    const wcif = buildWcif(
      [{ Main: [round('333-r1', [group('333-r1-g1', 0, 20)])] }],
      {},
    );
    expect(planNextGroups(['333-r1-g1'], ['333-r1-g1'], 'Main', wcif)).toBe(
      null,
    );
    expect(getFirstGroupOfNextRoundInRoom('333-r1', 'Nowhere', wcif)).toBe(
      null,
    );
  });
});
