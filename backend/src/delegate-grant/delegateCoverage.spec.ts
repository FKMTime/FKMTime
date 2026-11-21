import { Competition as Wcif } from 'wcif-helpers';

import {
  delegatesAllCompetingIn,
  findUncoveredGroups,
} from './delegateCoverage';

// Two rooms run 333-r1-g1 (activities 11 and 31); 333-r1-g2 is in the first
const person = (
  name: string,
  roles: string[],
  competesIn: number[] = [],
  staffs: number[] = [],
) => ({
  name,
  roles,
  assignments: [
    ...competesIn.map((activityId) => ({
      activityId,
      assignmentCode: 'competitor',
    })),
    ...staffs.map((activityId) => ({
      activityId,
      assignmentCode: 'staff-judge',
    })),
  ],
});

const makeWcif = (persons: ReturnType<typeof person>[]) =>
  ({
    persons,
    schedule: {
      venues: [
        {
          rooms: [
            {
              name: 'Main',
              activities: [
                {
                  id: 1,
                  activityCode: '333-r1',
                  childActivities: [
                    { id: 11, activityCode: '333-r1-g1', childActivities: [] },
                    { id: 12, activityCode: '333-r1-g2', childActivities: [] },
                  ],
                },
              ],
            },
            {
              name: 'Side',
              activities: [
                {
                  id: 3,
                  activityCode: '333-r1',
                  childActivities: [
                    { id: 31, activityCode: '333-r1-g1', childActivities: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }) as unknown as Wcif;

describe('delegatesAllCompetingIn', () => {
  it('names the delegates when every one of them competes in the group', () => {
    const wcif = makeWcif([
      person('Delegate One', ['delegate'], [11]),
      person('Trainee Two', ['trainee-delegate', 'organizer'], [31]),
      person('Competitor', [], [12]),
    ]);
    expect(delegatesAllCompetingIn(wcif, '333-r1-g1')).toEqual([
      'Delegate One',
      'Trainee Two',
    ]);
  });

  it('is null while one delegate is free', () => {
    const wcif = makeWcif([
      person('Delegate One', ['delegate'], [11]),
      person('Delegate Two', ['delegate'], [12]),
    ]);
    expect(delegatesAllCompetingIn(wcif, '333-r1-g1')).toBeNull();
  });

  it('counts a delegate judging the group as free: only competing counts', () => {
    const wcif = makeWcif([
      person('Delegate One', ['delegate'], [11]),
      person('Delegate Two', ['delegate'], [], [11]),
    ]);
    expect(delegatesAllCompetingIn(wcif, '333-r1-g1')).toBeNull();
  });

  it('is null when the WCIF lists no delegates', () => {
    const wcif = makeWcif([person('Organizer', ['organizer'], [11])]);
    expect(delegatesAllCompetingIn(wcif, '333-r1-g1')).toBeNull();
  });
});

describe('findUncoveredGroups', () => {
  const wcif = makeWcif([
    person('Delegate One', ['delegate'], [11, 12]),
    person('Delegate Two', ['delegate'], [31, 12]),
  ]);

  it('lists running and next groups, running first, each once', () => {
    const groups = findUncoveredGroups(
      wcif,
      [
        { name: 'Main', currentGroupIds: [], nextGroupIds: ['333-r1-g2'] },
        {
          name: 'Side',
          currentGroupIds: ['333-r1-g1'],
          nextGroupIds: [],
        },
        {
          name: 'Main',
          currentGroupIds: ['333-r1-g1'],
          nextGroupIds: ['333-r1-g2'],
        },
      ],
      new Set(),
    );
    expect(groups).toEqual([
      {
        groupId: '333-r1-g1',
        groupName: expect.stringContaining('Group 1'),
        running: true,
        roomNames: ['Side', 'Main'],
        competingDelegates: ['Delegate One', 'Delegate Two'],
      },
      {
        groupId: '333-r1-g2',
        groupName: expect.stringContaining('Group 2'),
        running: false,
        roomNames: ['Main'],
        competingDelegates: ['Delegate One', 'Delegate Two'],
      },
    ]);
  });

  it('leaves out a group someone already has delegate access for', () => {
    const groups = findUncoveredGroups(
      wcif,
      [
        {
          name: 'Main',
          currentGroupIds: ['333-r1-g1'],
          nextGroupIds: ['333-r1-g2'],
        },
      ],
      new Set(['333-r1-g2']),
    );
    expect(groups.map((group) => group.groupId)).toEqual(['333-r1-g1']);
  });

  it('leaves out a group a delegate is free for', () => {
    const groups = findUncoveredGroups(
      makeWcif([
        person('Delegate One', ['delegate'], [11]),
        person('Delegate Two', ['delegate'], [12]),
      ]),
      [
        {
          name: 'Main',
          currentGroupIds: ['333-r1-g1'],
          nextGroupIds: ['333-r1-g2'],
        },
      ],
      new Set(),
    );
    expect(groups).toEqual([]);
  });
});
