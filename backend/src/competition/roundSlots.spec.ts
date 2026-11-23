import { Activity, Competition } from 'wcif-helpers';

import { getRoundSlotsForDay } from './roundSlots';

const activity = (
  activityCode: string,
  startTime: string,
  endTime: string,
): Activity => ({
  id: 0,
  name: activityCode,
  activityCode,
  startTime,
  endTime,
  childActivities: [],
  scrambleSetId: null,
  extensions: [],
});

const wcifWithRooms = (...rooms: Activity[][]): Pick<Competition, 'schedule'> =>
  ({
    schedule: {
      startDate: '2026-05-02',
      numberOfDays: 2,
      venues: [
        {
          rooms: rooms.map((activities, i) => ({
            id: i + 1,
            name: `Room ${i + 1}`,
            activities,
          })),
        },
      ],
    },
  }) as unknown as Pick<Competition, 'schedule'>;

const day = new Date('2026-05-02T12:00:00');

describe('getRoundSlotsForDay', () => {
  it('lists a round scheduled in two rooms once, spanning both', () => {
    const wcif = wcifWithRooms(
      [activity('333-r1', '2026-05-02T10:00:00', '2026-05-02T11:00:00')],
      [activity('333-r1', '2026-05-02T10:15:00', '2026-05-02T11:30:00')],
    );

    expect(getRoundSlotsForDay(wcif, day)).toEqual([
      {
        activityCode: '333-r1',
        startTime: new Date('2026-05-02T10:00:00'),
        endTime: new Date('2026-05-02T11:30:00'),
      },
    ]);
  });

  it('keeps distinct rounds sorted by start and skips other days', () => {
    const wcif = wcifWithRooms(
      [
        activity('222-r1', '2026-05-02T12:00:00', '2026-05-02T12:30:00'),
        activity('444-r1', '2026-05-03T10:00:00', '2026-05-03T11:00:00'),
      ],
      [activity('333-r1', '2026-05-02T09:00:00', '2026-05-02T10:00:00')],
    );

    expect(
      getRoundSlotsForDay(wcif, day).map((slot) => slot.activityCode),
    ).toEqual(['333-r1', '222-r1']);
  });
});
