import {
  INCLUDING_REMOVED,
  withoutRemovedResultAttempts,
  withoutRemovedResults,
} from './db.service';

describe('leaving out results removed under Regulation 9t', () => {
  it('adds the filter to a result query', () => {
    expect(withoutRemovedResults({ roundId: '333-r2' })).toEqual({
      roundId: '333-r2',
      removedAt: null,
    });
    expect(withoutRemovedResults(undefined)).toEqual({ removedAt: null });
  });

  it('lets a query opt back in', () => {
    const where = { personId: 'p1', ...INCLUDING_REMOVED };

    expect(withoutRemovedResults(where)).toBe(where);
  });

  it('keeps an attempt query filter on its result', () => {
    expect(
      withoutRemovedResultAttempts({ result: { roundId: '333-r2' } }),
    ).toEqual({ result: { roundId: '333-r2', removedAt: null } });
    expect(withoutRemovedResultAttempts({ status: 'UNRESOLVED' })).toEqual({
      status: 'UNRESOLVED',
      result: { removedAt: null },
    });
  });

  it("leaves a query about one result's or attempt's own rows alone", () => {
    const byResult = { resultId: 'r1' };
    const byId = { id: { in: ['a1'] } };

    expect(withoutRemovedResultAttempts(byResult)).toBe(byResult);
    expect(withoutRemovedResultAttempts(byId)).toBe(byId);
  });
});
