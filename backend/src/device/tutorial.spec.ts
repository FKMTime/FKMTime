import { Competition as WCIF } from 'wcif-helpers';

import {
  isFirstGroupOfDay,
  isInTutorial,
  TUTORIAL_QUIET_MS,
  tutorialEndsAtFrom,
} from './tutorial';

describe('tutorial mode (SPEC-012)', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');

  it('is on only while its end is in the future', () => {
    expect(isInTutorial({ tutorialEndsAt: new Date(now + 1) }, now)).toBe(true);
    expect(isInTutorial({ tutorialEndsAt: new Date(now) }, now)).toBe(false);
    expect(isInTutorial({ tutorialEndsAt: null }, now)).toBe(false);
    expect(isInTutorial(null, now)).toBe(false);
  });

  it('lasts a quiet spell from now', () => {
    expect(tutorialEndsAtFrom(now).getTime()).toBe(now + TUTORIAL_QUIET_MS);
  });

  describe('first group of the day', () => {
    // A venue an hour ahead of UTC, so the local date can differ from UTC's
    const group = (activityCode: string, startTime: string) => ({
      activityCode,
      startTime,
      childActivities: [],
    });
    const wcif = {
      schedule: {
        venues: [
          {
            timezone: 'Europe/Warsaw',
            rooms: [
              {
                activities: [
                  {
                    activityCode: '333-r1',
                    childActivities: [
                      group('333-r1-g1', '2026-11-16T08:00:00Z'),
                      group('333-r1-g2', '2026-11-16T08:30:00Z'),
                    ],
                  },
                  {
                    activityCode: '222-r1',
                    childActivities: [
                      // 23:30 UTC on the 16th is the 17th in Warsaw
                      group('222-r1-g1', '2026-11-16T23:30:00Z'),
                      group('222-r1-g2', '2026-11-17T09:00:00Z'),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as unknown as WCIF;

    it('is the first when the room has started nothing yet', () => {
      expect(isFirstGroupOfDay(wcif, [], now)).toBe(true);
    });

    it("is the first when the room's groups so far were on earlier days", () => {
      expect(isFirstGroupOfDay(wcif, ['333-r1-g1', '333-r1-g2'], now)).toBe(
        true,
      );
    });

    it("isn't once the room started a group scheduled today", () => {
      expect(isFirstGroupOfDay(wcif, ['333-r1-g1', '222-r1-g2'], now)).toBe(
        false,
      );
    });

    it("counts the venue's date, not UTC's", () => {
      expect(isFirstGroupOfDay(wcif, ['222-r1-g1'], now)).toBe(false);
    });
  });
});
