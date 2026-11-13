import {
  advancingLabel,
  liveValues,
  roundDot,
  sameValues,
  waitingReason,
} from './liveRoundView';

describe('liveRoundView', () => {
  describe('roundDot', () => {
    it.each([
      ['pending', 0, 'notOpen'],
      ['ready', 0, 'notOpen'],
      ['open', 0, 'open'],
      ['locked', 0, 'done'],
      ['open', 2, 'attention'],
      ['locked', 1, 'attention'],
    ])('%s with %i to look at is %s', (state, problems, dot) => {
      expect(roundDot(state, problems)).toBe(dot);
    });
  });

  describe('waitingReason', () => {
    const open = (total: number, completed: number) => ({
      roundId: '333-r1',
      state: 'open',
      totalCompetitors: total,
      completedCompetitors: completed,
    });

    it('counts the empty results of the round before', () => {
      expect(
        waitingReason(
          { roundId: '333-r2', state: 'pending' },
          open(40, 38),
          '333-r1',
        ),
      ).toBe('Waiting for 333-r1: 2 empty results');
      expect(
        waitingReason(
          { roundId: '333-r2', state: 'pending' },
          open(40, 39),
          '333-r1',
        ),
      ).toBe('Waiting for 333-r1: 1 empty result');
    });

    it('waits for a round before that is not open yet', () => {
      expect(
        waitingReason(
          { roundId: '333-r2', state: 'pending' },
          { roundId: '333-r1', state: 'ready' },
          '333-r1',
        ),
      ).toBe('Waiting for 333-r1');
    });

    it('gives regulation 9m when too few competitors are left', () => {
      expect(
        waitingReason(
          { roundId: '333-r2', state: 'blocked', competitorCountNeeded: 8 },
          open(10, 10),
          '333-r1',
        ),
      ).toBe('Needs at least 8 competitors (regulation 9m)');
    });

    it('says nothing for a round that can open or is open', () => {
      for (const state of ['ready', 'open', 'locked']) {
        expect(
          waitingReason({ roundId: '333-r2', state }, open(40, 40), '333-r1'),
        ).toBeNull();
      }
    });
  });

  it('labels the WCA advancing flags', () => {
    expect(advancingLabel(true, true)).toBe('advances');
    expect(advancingLabel(true, false)).toBe('advances');
    expect(advancingLabel(false, true)).toBe('mayAdvance');
    expect(advancingLabel(false, false)).toBeNull();
    expect(advancingLabel(undefined, undefined)).toBeNull();
  });

  it('orders the WCA attempts and compares them', () => {
    const values = liveValues([
      { attempt_number: 2, value: 1200 },
      { attempt_number: 1, value: -1 },
    ]);
    expect(values).toEqual([-1, 1200]);
    expect(sameValues(values, [-1, 1200])).toBe(true);
    expect(sameValues(values, [-1, 1300])).toBe(false);
    expect(sameValues(values, [-1])).toBe(false);
    expect(liveValues(undefined)).toEqual([]);
  });
});
