import { Competition } from '@wca/helpers';

import { localDate, shiftWcifDates } from './shift-wcif-dates';

/** Two days in summer time (UTC+2 in Europe/Warsaw) */
const buildWcif = () =>
  ({
    id: 'ExampleOpen2024',
    name: 'Example Open 2024',
    shortName: 'Example 2024',
    registrationInfo: {
      openTime: '2024-04-01T10:00:00Z',
      closeTime: '2024-05-01T00:00:00Z',
    },
    schedule: {
      startDate: '2024-05-24',
      numberOfDays: 2,
      venues: [
        {
          id: 1,
          timezone: 'Europe/Warsaw',
          rooms: [
            {
              id: 1,
              activities: [
                {
                  id: 1,
                  activityCode: '333-r1',
                  // 09:30–10:30 local
                  startTime: '2024-05-24T07:30:00Z',
                  endTime: '2024-05-24T08:30:00Z',
                  childActivities: [
                    {
                      id: 2,
                      activityCode: '333-r1-g1',
                      startTime: '2024-05-24T07:30:00Z',
                      endTime: '2024-05-24T08:00:00Z',
                      childActivities: [],
                    },
                  ],
                },
                {
                  id: 3,
                  activityCode: '333-r2',
                  // Day 2, 14:00–15:00 local
                  startTime: '2024-05-25T12:00:00Z',
                  endTime: '2024-05-25T13:00:00Z',
                  childActivities: [],
                },
              ],
            },
          ],
        },
      ],
    },
  }) as unknown as Competition;

const activities = (wcif: Competition) =>
  wcif.schedule.venues[0].rooms[0].activities;

describe('shiftWcifDates', () => {
  it('moves the start date, activities and child activities by whole days', () => {
    const shifted = shiftWcifDates(buildWcif(), '2026-06-12');

    expect(shifted.schedule.startDate).toBe('2026-06-12');
    const [first, second] = activities(shifted);
    expect(first.startTime).toBe('2026-06-12T07:30:00Z');
    expect(first.endTime).toBe('2026-06-12T08:30:00Z');
    expect(first.childActivities[0].startTime).toBe('2026-06-12T07:30:00Z');
    expect(first.childActivities[0].endTime).toBe('2026-06-12T08:00:00Z');
    expect(second.startTime).toBe('2026-06-13T12:00:00Z');
    expect(second.endTime).toBe('2026-06-13T13:00:00Z');
  });

  it('keeps the local time of day when moving from summer to winter time', () => {
    const shifted = shiftWcifDates(buildWcif(), '2026-11-20');

    // 09:30 local is 08:30 UTC in winter (UTC+1)
    const [first, second] = activities(shifted);
    expect(first.startTime).toBe('2026-11-20T08:30:00Z');
    expect(first.childActivities[0].endTime).toBe('2026-11-20T09:00:00Z');
    expect(second.startTime).toBe('2026-11-21T13:00:00Z');
  });

  it('keeps the local time of day on the day the clocks change', () => {
    // Summer time ends at 03:00 on 2026-10-25 in Europe/Warsaw
    const shifted = shiftWcifDates(buildWcif(), '2026-10-24');

    const [first, second] = activities(shifted);
    expect(first.startTime).toBe('2026-10-24T07:30:00Z');
    expect(second.startTime).toBe('2026-10-25T13:00:00Z');
  });

  it('moves the competition back in time too', () => {
    const shifted = shiftWcifDates(buildWcif(), '2023-01-10');

    expect(shifted.schedule.startDate).toBe('2023-01-10');
    expect(activities(shifted)[0].startTime).toBe('2023-01-10T08:30:00Z');
  });

  it('moves the registration window by the same number of days', () => {
    const shifted = shiftWcifDates(buildWcif(), '2026-06-12');

    expect(shifted.registrationInfo.openTime).toBe('2026-04-20T10:00:00Z');
    expect(shifted.registrationInfo.closeTime).toBe('2026-05-20T00:00:00Z');
  });

  it('moves the year in the id, name and short name to the new year', () => {
    const shifted = shiftWcifDates(buildWcif(), '2026-06-12');

    expect(shifted.id).toBe('ExampleOpen2026');
    expect(shifted.name).toBe('Example Open 2026');
    expect(shifted.shortName).toBe('Example 2026');
  });

  it('keeps the id and name within the same year', () => {
    const shifted = shiftWcifDates(buildWcif(), '2024-11-08');

    expect(shifted.id).toBe('ExampleOpen2024');
    expect(shifted.name).toBe('Example Open 2024');
  });

  it('leaves numbers that only contain the year alone', () => {
    const wcif = {
      ...buildWcif(),
      id: 'Open20245',
      name: 'Open 12024',
    } as Competition;

    const shifted = shiftWcifDates(wcif, '2026-06-12');

    expect(shifted.id).toBe('Open20245');
    expect(shifted.name).toBe('Open 12024');
  });

  it('returns an unchanged copy for the original start date', () => {
    const wcif = buildWcif();

    const shifted = shiftWcifDates(wcif, '2024-05-24');

    expect(shifted).toEqual(wcif);
    expect(shifted).not.toBe(wcif);
  });

  it('leaves the given WCIF untouched', () => {
    const wcif = buildWcif();

    shiftWcifDates(wcif, '2026-06-12');

    expect(wcif).toEqual(buildWcif());
  });

  it.each(['24-05-2026', '2026-02-30', 'today', ''])(
    'rejects %p as a start date',
    (date) => {
      expect(() => shiftWcifDates(buildWcif(), date)).toThrow(
        'Expected a date like 2024-05-24',
      );
    },
  );
});

describe('localDate', () => {
  it('formats the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
