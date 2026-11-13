import { Competition } from 'wcif-helpers';

import {
  getCompetitorGroupInRound,
  getLastGroupOfRound,
  getStationGroupIds,
  getStationRoundIds,
} from './stationRounds';

describe('station rounds (SPEC-007)', () => {
  const group = (id: number, activityCode: string, startTime: string) => ({
    id,
    activityCode,
    startTime,
    childActivities: [],
  });
  const wcif = {
    persons: [
      {
        registrantId: 1,
        assignments: [
          { activityId: 12, assignmentCode: 'competitor' },
          { activityId: 21, assignmentCode: 'staff-judge' },
        ],
      },
      { registrantId: 2, assignments: [] },
    ],
    schedule: {
      venues: [
        {
          rooms: [
            {
              name: 'Main',
              activities: [
                {
                  id: 10,
                  activityCode: '333-r1',
                  startTime: '2026-05-01T09:00:00',
                  childActivities: [
                    group(11, '333-r1-g1', '2026-05-01T09:00:00'),
                    group(12, '333-r1-g2', '2026-05-01T09:30:00'),
                  ],
                },
                {
                  id: 20,
                  activityCode: 'pyram-r1',
                  startTime: '2026-05-01T11:00:00',
                  childActivities: [
                    group(21, 'pyram-r1-g1', '2026-05-01T11:00:00'),
                  ],
                },
              ],
            },
            {
              name: 'Side',
              activities: [
                {
                  id: 30,
                  activityCode: '333-r1',
                  startTime: '2026-05-01T09:00:00',
                  childActivities: [
                    group(31, '333-r1-g3', '2026-05-01T10:00:00'),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  } as unknown as Competition;

  const station = (
    customRoundId: string | null,
    currentGroupIds: string[],
  ) => ({
    customRoundId,
    room: { currentGroupIds },
  });

  describe('getStationRoundIds', () => {
    it("follows the room's rounds, once each", () => {
      expect(
        getStationRoundIds(
          station(null, ['333-r1-g1', '333-r1-g2', 'pyram-r1-g1']),
        ),
      ).toEqual(['333-r1', 'pyram-r1']);
    });

    it('takes only its own round once pointed, whatever the room runs', () => {
      expect(getStationRoundIds(station('333-r1', ['pyram-r1-g1']))).toEqual([
        '333-r1',
      ]);
      expect(getStationRoundIds(station('333-r1', []))).toEqual(['333-r1']);
    });
  });

  describe('getCompetitorGroupInRound', () => {
    it("finds the competitor's own group, ignoring staff assignments", () => {
      expect(getCompetitorGroupInRound('333-r1', 1, wcif)).toBe('333-r1-g2');
      expect(getCompetitorGroupInRound('pyram-r1', 1, wcif)).toBeNull();
    });

    it('has nothing for someone without an assignment', () => {
      expect(getCompetitorGroupInRound('333-r1', 2, wcif)).toBeNull();
      expect(getCompetitorGroupInRound('333-r1', null, wcif)).toBeNull();
    });
  });

  describe('getLastGroupOfRound', () => {
    it('takes the latest group across rooms', () => {
      expect(getLastGroupOfRound('333-r1', wcif)).toBe('333-r1-g3');
    });

    it('falls back to the first group for a round with no groups', () => {
      expect(getLastGroupOfRound('222-r1', wcif)).toBe('222-r1-g1');
    });
  });

  describe('getStationGroupIds', () => {
    it("offers the room's groups while following the room", () => {
      expect(
        getStationGroupIds(station(null, ['pyram-r1-g1']), 1, wcif),
      ).toEqual(['pyram-r1-g1']);
    });

    it("offers one group of its round once pointed: the competitor's own, else the last", () => {
      const pointed = station('333-r1', ['pyram-r1-g1']);
      expect(getStationGroupIds(pointed, 1, wcif)).toEqual(['333-r1-g2']);
      expect(getStationGroupIds(pointed, 2, wcif)).toEqual(['333-r1-g3']);
    });
  });
});
