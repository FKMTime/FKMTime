import { Competition } from 'wcif-helpers';

import { getFirstGroupInRoom } from './wcif-helpers';

describe('getFirstGroupInRoom', () => {
  const group = (activityCode: string, startTime: string) => ({
    activityCode,
    startTime,
  });
  const wcif = {
    schedule: {
      venues: [
        {
          rooms: [
            {
              name: 'Main',
              activities: [
                {
                  activityCode: 'pyram-r1',
                  startTime: '2026-05-02T09:00:00',
                  childActivities: [
                    group('pyram-r1-g1', '2026-05-02T09:00:00'),
                  ],
                },
                {
                  activityCode: '333-r1',
                  startTime: '2026-05-01T09:00:00',
                  childActivities: [
                    group('333-r1-g2', '2026-05-01T09:30:00'),
                    group('333-r1-g1', '2026-05-01T09:00:00'),
                  ],
                },
                {
                  activityCode: 'other-registration',
                  startTime: '2026-05-01T08:00:00',
                  childActivities: [],
                },
              ],
            },
            {
              name: 'Without groups',
              activities: [
                {
                  activityCode: '222-r1',
                  startTime: '2026-05-01T09:00:00',
                  childActivities: [],
                },
              ],
            },
            {
              name: 'Only breaks',
              activities: [
                {
                  activityCode: 'other-lunch',
                  startTime: '2026-05-01T12:00:00',
                  childActivities: [],
                },
              ],
            },
          ],
        },
      ],
    },
  } as unknown as Competition;

  it.each([
    ['before the competition', '2026-04-20T12:00:00', '333-r1-g1'],
    ['late on the first day', '2026-05-01T18:00:00', '333-r1-g1'],
    ['on the second day', '2026-05-02T07:00:00', 'pyram-r1-g1'],
    ['after the competition', '2026-05-10T12:00:00', '333-r1-g1'],
  ])('picks the group for a room %s', (_, now, expected) => {
    expect(getFirstGroupInRoom('Main', wcif, new Date(now))).toBe(expected);
  });

  it('falls back to group 1 for a round scheduled without groups', () => {
    expect(
      getFirstGroupInRoom(
        'Without groups',
        wcif,
        new Date('2026-05-01T07:00:00'),
      ),
    ).toBe('222-r1-g1');
  });

  it('finds nothing in a room without rounds', () => {
    expect(getFirstGroupInRoom('Only breaks', wcif)).toBeNull();
    expect(getFirstGroupInRoom('Unknown', wcif)).toBeNull();
  });
});
