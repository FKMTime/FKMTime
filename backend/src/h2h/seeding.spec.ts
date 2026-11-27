import { Competition, ResultCondition } from 'wcif-helpers';

import { seedFromPreviousRound, suggestBracketSize } from './seeding';

interface Ranked {
  personId: number;
  ranking: number | null;
  best?: number;
  average?: number;
}

/** A 333oh event: round 1 with these results, then the H2H final */
const competition = (
  results: Ranked[],
  condition: ResultCondition | null = {
    type: 'ranking',
    scope: 'average',
    value: 8,
  },
  extra: Record<string, unknown> = {},
) =>
  ({
    events: [
      {
        id: '333oh',
        rounds: [
          {
            id: '333oh-r1',
            format: 'a',
            results: results.map((r) => ({
              attempts: [],
              best: r.best ?? 1500 + r.personId,
              average: r.average ?? 2000 + r.personId,
              ...r,
            })),
          },
          {
            id: '333oh-r2',
            format: 'h',
            results: [],
            participationRuleset: {
              participationSource: condition && {
                type: 'round',
                roundId: '333oh-r1',
                resultCondition: condition,
              },
              reservedPlaces: null,
            },
            ...extra,
          },
        ],
      },
    ],
  }) as unknown as Competition;

/** People 1..n ranked 1..n */
const rankedInOrder = (count: number): Ranked[] =>
  Array.from({ length: count }, (_, i) => ({
    personId: i + 1,
    ranking: i + 1,
  }));

const ids = (seeding: ReturnType<typeof seedFromPreviousRound>) =>
  seeding.seeds.map((seed) => seed.registrantId);

describe('suggestBracketSize', () => {
  it.each([4, 8, 12, 16])('suggests %i from a top %i advancement', (value) => {
    const wcif = competition([], { type: 'ranking', scope: 'average', value });
    expect(suggestBracketSize('333oh-r2', wcif)).toBe(value);
  });

  it.each([
    ['a top 10', { type: 'ranking', scope: 'average', value: 10 }],
    ['a percentage', { type: 'percent', scope: 'average', value: 16 }],
  ] as [string, ResultCondition][])(
    'suggests nothing from %s',
    (_, condition) => {
      expect(
        suggestBracketSize('333oh-r2', competition([], condition)),
      ).toBeNull();
    },
  );
});

describe('seedFromPreviousRound', () => {
  it('seeds by the previous ranking, limited to the people who advanced', () => {
    const wcif = competition(rankedInOrder(12));

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 8);

    expect(ids(seeding)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seeding.seeds.every((seed) => !seed.tieBroken)).toBe(true);
    expect(seeding.notice).toBeNull();
  });

  it('orders people by ranking, not by the order of the results', () => {
    const wcif = competition([...rankedInOrder(11)].reverse());

    expect(ids(seedFromPreviousRound('333oh-r2', wcif, 8))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('breaks a tie randomly and flags everyone in it', () => {
    const results = rankedInOrder(11);
    results[3].ranking = 3; // people 3 and 4 share 3rd place
    const wcif = competition(results);

    const first = seedFromPreviousRound('333oh-r2', wcif, 8, () => 0);
    const second = seedFromPreviousRound('333oh-r2', wcif, 8, () => 0.99);

    expect(ids(first).slice(2, 4)).toEqual([4, 3]);
    expect(ids(second).slice(2, 4)).toEqual([3, 4]);
    expect(first.seeds.filter((s) => s.tieBroken)).toEqual([
      { registrantId: 4, tieBroken: true },
      { registrantId: 3, tieBroken: true },
    ]);
    expect(ids(first).slice(4)).toEqual([5, 6, 7, 8]);
  });

  it('leaves out people with no successful result', () => {
    const results = rankedInOrder(6);
    results[2].best = -1;
    const wcif = competition(results, {
      type: 'ranking',
      scope: 'average',
      value: 4,
    });

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 4);

    expect(ids(seeding)).toEqual([1, 2, 4]);
    expect(seeding.notice).toBe(
      "Only 3 competitors advanced from 3x3x3 One-Handed, Round 1, fewer than the bracket's 4 places. Delete the bracket and create a smaller one: the empty seeds can't go to people who didn't advance.",
    );
  });

  it('takes the top of the bracket when a tie lets more people advance', () => {
    const results = rankedInOrder(12);
    results[8].ranking = 8;
    const wcif = competition(results);

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 8, () => 0.99);

    expect(seeding.seeds).toHaveLength(8);
    expect(seeding.notice).toContain(
      '9 competitors advanced from 3x3x3 One-Handed, Round 1, and the bracket takes the top 8',
    );
  });

  it('applies a percentage advancement', () => {
    const wcif = competition(rankedInOrder(20), {
      type: 'percent',
      scope: 'average',
      value: 60,
    });

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 16);

    expect(ids(seeding)).toEqual(rankedInOrder(12).map((r) => r.personId));
    expect(seeding.notice).toContain('Only 12 competitors advanced');
  });

  it('applies a result advancement on the chosen scope', () => {
    const results = rankedInOrder(10).map((r) => ({
      ...r,
      average: 1000 * r.personId,
    }));
    const wcif = competition(results, {
      type: 'resultAchieved',
      scope: 'average',
      value: 4500,
    });

    expect(ids(seedFromPreviousRound('333oh-r2', wcif, 8))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('lets at most 75% of the previous round through (9p1)', () => {
    const wcif = competition(rankedInOrder(10));

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 8);

    expect(ids(seeding)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(seeding.notice).toContain(
      'At most 75% of 3x3x3 One-Handed, Round 1 may advance (Regulation 9p1), so 7 of its 10 competitors did.',
    );
    expect(seeding.notice).toContain('create a smaller one');
  });

  it('drops a tie that would take more than 75% of the round through', () => {
    const results = rankedInOrder(8);
    results[6].ranking = 6; // people 6 and 7 share 6th place; 6 may advance

    const seeding = seedFromPreviousRound('333oh-r2', competition(results), 8);

    expect(ids(seeding)).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives no seeds, and says so, when the previous round has no ranking', () => {
    const wcif = competition([
      { personId: 1, ranking: null },
      { personId: 2, ranking: null },
    ]);

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 8);

    expect(seeding.seeds).toEqual([]);
    expect(seeding.notice).toBe(
      '3x3x3 One-Handed, Round 1 has no ranking yet, so the bracket has no seeds. Add the competitors in seed order.',
    );
  });

  it('gives no seeds to a round with no previous round', () => {
    const wcif = competition(rankedInOrder(8), null);
    wcif.events[0].rounds[1].participationRuleset = {
      participationSource: { type: 'registrations' },
      reservedPlaces: null,
    };

    const seeding = seedFromPreviousRound('333oh-r2', wcif, 8);

    expect(seeding.seeds).toEqual([]);
    expect(seeding.notice).toContain('no previous round');
  });

  it('falls back to the round before when the WCIF has no participation ruleset', () => {
    const wcif = competition(rankedInOrder(6), null, {
      participationRuleset: null,
    });

    expect(ids(seedFromPreviousRound('333oh-r2', wcif, 4))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('asks for a check when the round reserves places', () => {
    const wcif = competition(rankedInOrder(8));
    const final = wcif.events[0].rounds[1];
    if (!final.participationRuleset) throw new Error('No ruleset');
    final.participationRuleset.reservedPlaces = {
      nationalities: ['PL'],
      count: 2,
    };

    expect(seedFromPreviousRound('333oh-r2', wcif, 8).notice).toContain(
      'reserves places',
    );
  });
});
