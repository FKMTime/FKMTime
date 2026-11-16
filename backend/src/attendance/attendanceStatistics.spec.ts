import { StaffActivityStatus, StaffRole } from '@prisma/client';

import { AppGateway } from '../app.gateway';
import { DbService } from '../db/db.service';
import { AttendanceService } from './attendance.service';
import {
  computeAttendanceStatistics,
  happenedGroups,
  StatisticsActivity,
} from './attendanceStatistics';

const { PRESENT, ABSENT, LATE, REPLACED } = StaffActivityStatus;

const activity = (
  overrides: Partial<StatisticsActivity> & { personId: string },
): StatisticsActivity => ({
  person: { name: overrides.personId.toUpperCase() },
  groupId: '333-r1-g1',
  role: StaffRole.JUDGE,
  status: PRESENT,
  isAssigned: true,
  leftEarly: false,
  noShow: false,
  ...overrides,
});

const wcif = {
  schedule: {
    venues: [
      {
        rooms: [
          {
            activities: [
              { activityCode: '222-r1', startTime: '2026-11-14T09:00:00Z' },
              { activityCode: '333-r1', startTime: '2026-11-14T10:00:00Z' },
            ],
          },
        ],
      },
    ],
  },
};

describe('computeAttendanceStatistics', () => {
  it('keeps unassigned presence out of the percentage, as extra help', () => {
    // Used to be 3 present over 2 assigned: 150%
    const stats = computeAttendanceStatistics(
      [
        activity({ personId: 'ada', groupId: '333-r1-g1' }),
        activity({ personId: 'ada', groupId: '333-r1-g2', status: ABSENT }),
        activity({ personId: 'ada', groupId: '333-r1-g3', isAssigned: false }),
        activity({
          personId: 'ada',
          groupId: '333-r1-g4',
          role: StaffRole.RUNNER,
          isAssigned: false,
        }),
      ],
      new Set(['333-r1-g1', '333-r1-g2', '333-r1-g3', '333-r1-g4']),
    );

    expect(stats.summary).toMatchObject({
      covered: 1,
      expected: 2,
      attendancePct: 50,
      extraHelp: 2,
      absent: 1,
    });
    expect(stats.persons).toEqual([
      expect.objectContaining({
        personId: 'ada',
        assigned: 2,
        present: 1,
        extraHelp: 2,
        attendancePct: 50,
        roles: [StaffRole.JUDGE, StaffRole.RUNNER],
      }),
    ]);
  });

  it('ignores groups that have not happened, even in a running round', () => {
    const stats = computeAttendanceStatistics(
      [
        activity({ personId: 'ada', groupId: '333-r1-g1' }),
        // Later group of the same round, not started yet: default ABSENT
        activity({ personId: 'ada', groupId: '333-r1-g2', status: ABSENT }),
        activity({ personId: 'ben', groupId: '333-r1-g2', status: ABSENT }),
      ],
      new Set(['333-r1-g1']),
    );

    expect(stats.summary).toMatchObject({
      expected: 1,
      covered: 1,
      absent: 0,
      attendancePct: 100,
    });
    // Nothing in a group that happened: hidden
    expect(stats.persons.map((p) => p.personId)).toEqual(['ada']);
  });

  it('counts late as attended, reports late, replaced, left early and no-shows apart', () => {
    const stats = computeAttendanceStatistics(
      [
        activity({ personId: 'ada', status: LATE }),
        activity({ personId: 'ben', status: PRESENT, leftEarly: true }),
        activity({ personId: 'cy', status: REPLACED }),
        activity({ personId: 'dee', status: ABSENT, noShow: true }),
        activity({ personId: 'eve', status: ABSENT }),
        activity({ personId: 'fay', role: StaffRole.COMPETITOR }),
      ],
      new Set(['333-r1-g1']),
    );

    expect(stats.summary).toEqual({
      attendancePct: 40,
      covered: 2,
      expected: 5,
      late: 1,
      replaced: 1,
      absent: 2,
      leftEarly: 1,
      noShows: 1,
      extraHelp: 0,
    });
    const ada = stats.persons.find((p) => p.personId === 'ada');
    expect(ada).toMatchObject({ present: 1, late: 1, attendancePct: 100 });
    const cy = stats.persons.find((p) => p.personId === 'cy');
    expect(cy).toMatchObject({ present: 0, replaced: 1, attendancePct: 0 });
    // Competing isn't staffing
    expect(stats.persons.some((p) => p.personId === 'fay')).toBe(false);
  });

  it('breaks down by round in schedule order and by role', () => {
    const stats = computeAttendanceStatistics(
      [
        activity({ personId: 'ada', groupId: '333-r1-g1' }),
        activity({
          personId: 'ben',
          groupId: '333-r1-g1',
          role: StaffRole.SCRAMBLER,
          status: ABSENT,
        }),
        activity({ personId: 'ada', groupId: '222-r1-g1' }),
      ],
      new Set(['333-r1-g1', '222-r1-g1']),
      wcif,
    );

    expect(stats.rounds).toEqual([
      {
        roundId: '222-r1',
        roundName: '2x2 - R1',
        expected: 1,
        covered: 1,
        attendancePct: 100,
      },
      {
        roundId: '333-r1',
        roundName: '3x3 - R1',
        expected: 2,
        covered: 1,
        attendancePct: 50,
      },
    ]);
    expect(Object.keys(stats.byRole)).toEqual([
      StaffRole.JUDGE,
      StaffRole.SCRAMBLER,
    ]);
    expect(stats.byRole.SCRAMBLER?.summary).toMatchObject({
      expected: 1,
      covered: 0,
      attendancePct: 0,
    });
    expect(stats.byRole.JUDGE?.persons.map((p) => p.personId)).toEqual(['ada']);
  });

  it('has no percentage while nothing assigned has happened', () => {
    const stats = computeAttendanceStatistics(
      [activity({ personId: 'ada', isAssigned: false })],
      new Set(['333-r1-g1']),
    );
    expect(stats.summary.attendancePct).toBeNull();
    expect(stats.persons[0].attendancePct).toBeNull();
    expect(stats.rounds).toEqual([]);
  });
});

describe('happenedGroups', () => {
  it('takes started and running groups from rooms plus any group someone attended', () => {
    expect(
      happenedGroups(
        [
          { startedGroupIds: ['333-r1-g1'], currentGroupIds: ['333-r1-g2'] },
          { startedGroupIds: [], currentGroupIds: [] },
        ],
        ['222-r1-g1'],
      ),
    ).toEqual(new Set(['333-r1-g1', '333-r1-g2', '222-r1-g1']));
  });
});

describe('AttendanceService.getAttendanceStatistics', () => {
  it('counts only groups rooms started or someone attended', async () => {
    const db = {
      staffActivity: {
        findMany: jest
          .fn()
          // Staffing rows
          .mockResolvedValueOnce([
            activity({ personId: 'ada', groupId: '333-r1-g1' }),
            activity({ personId: 'ada', groupId: '333-r1-g2', status: ABSENT }),
            activity({ personId: 'ada', groupId: '333-r1-g3', status: ABSENT }),
          ])
          // Groups anyone was present or late in
          .mockResolvedValueOnce([{ groupId: '333-r1-g1' }]),
      },
      room: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { startedGroupIds: [], currentGroupIds: ['333-r1-g2'] },
          ]),
      },
      competition: { findFirst: jest.fn().mockResolvedValue({ wcif }) },
    };
    const service = new AttendanceService(
      db as unknown as DbService,
      {} as AppGateway,
    );

    const stats = await service.getAttendanceStatistics();

    expect(stats.summary).toMatchObject({
      expected: 2,
      covered: 1,
      absent: 1,
      attendancePct: 50,
    });
    expect(db.staffActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { not: StaffRole.COMPETITOR } },
      }),
    );
  });
});
