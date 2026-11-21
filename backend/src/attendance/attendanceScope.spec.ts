import { Competition } from 'wcif-helpers';

import { Role } from '../generated/prisma/client';
import {
  hasFullAttendanceAccess,
  isScopedStageLead,
  outOfScopeMessage,
  roomsGroupIds,
  ScopeRoom,
} from './attendanceScope';

const group = (activityCode: string) => ({ activityCode, childActivities: [] });

const wcif = {
  schedule: {
    venues: [
      {
        rooms: [
          {
            name: 'Main Hall',
            activities: [
              {
                activityCode: '333-r1',
                childActivities: [group('333-r1-g1'), group('333-r1-g2')],
              },
              { activityCode: 'other-lunch', childActivities: [] },
            ],
          },
          {
            name: 'Side Hall',
            activities: [
              {
                activityCode: '222-r1',
                childActivities: [group('222-r1-g1')],
              },
            ],
          },
        ],
      },
    ],
  },
} as unknown as Pick<Competition, 'schedule'>;

const room = (name: string, extra: Partial<ScopeRoom> = {}): ScopeRoom => ({
  id: name,
  name,
  currentGroupIds: [],
  startedGroupIds: [],
  ...extra,
});

describe('roomsGroupIds', () => {
  it("covers the groups the schedule puts in the room, and no other room's", () => {
    expect([...roomsGroupIds([room('Main Hall')], wcif)].sort()).toEqual([
      '333-r1-g1',
      '333-r1-g2',
    ]);
  });

  it('adds groups the room started or is running, wherever they were scheduled', () => {
    const ids = roomsGroupIds(
      [
        room('Main Hall', {
          startedGroupIds: ['222-r1-g1'],
          currentGroupIds: ['444-r1-g1'],
        }),
      ],
      wcif,
    );
    expect(ids.has('222-r1-g1')).toBe(true);
    expect(ids.has('444-r1-g1')).toBe(true);
  });

  it('covers every room given', () => {
    const ids = roomsGroupIds([room('Main Hall'), room('Side Hall')], wcif);
    expect(ids.has('222-r1-g1')).toBe(true);
    expect(ids.has('333-r1-g1')).toBe(true);
  });

  it('works without a WCIF from what the room ran', () => {
    expect([
      ...roomsGroupIds(
        [room('Main Hall', { startedGroupIds: ['x-g1'] })],
        null,
      ),
    ]).toEqual(['x-g1']);
  });
});

describe('who is a scoped stage lead', () => {
  it.each([
    [[Role.ADMIN], true, false],
    [[Role.ORGANIZER], true, false],
    [[Role.DELEGATE], true, false],
    [[Role.STAGE_LEADER, Role.ORGANIZER], true, false],
    [[Role.STAGE_LEADER], false, true],
    [[Role.STAFF], false, false],
  ])('%j: full access %s, scoped %s', (roles, full, scoped) => {
    expect(hasFullAttendanceAccess(roles)).toBe(full);
    expect(isScopedStageLead(roles)).toBe(scoped);
  });
});

describe('outOfScopeMessage', () => {
  it('names the rooms', () => {
    expect(outOfScopeMessage([{ name: 'Main Hall' }])).toBe(
      'You take attendance for Main Hall only',
    );
    expect(
      outOfScopeMessage([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
    ).toBe('You take attendance for A, B and C only');
  });
});
