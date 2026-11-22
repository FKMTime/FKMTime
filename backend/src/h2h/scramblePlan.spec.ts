import { buildBracket, getStages, SetsToWinByStage } from './bracket';
import {
  buildPlanRows,
  countPlannedSets,
  matchScrambleSets,
  PlanMatch,
} from './scramblePlan';

const planMatches = (
  size: 4 | 8 | 12 | 16,
  setsToWin: SetsToWinByStage,
): PlanMatch[] =>
  buildBracket(size, setsToWin).map((m) => ({
    matchId: `m${m.matchNumber}`,
    matchNumber: m.matchNumber,
    setsToWin: m.setsToWin,
  }));

const everyStage = (size: 4 | 8 | 12 | 16, setsToWin: number) =>
  Object.fromEntries(getStages(size).map((stage) => [stage, setsToWin]));

const sets = (letters: string[]) =>
  letters.map((set) => ({ id: `set-${set}`, set }));

const letters = (count: number) =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

describe('countPlannedSets', () => {
  it('needs 10 sets for 8 competitors with a final to 2 sets', () => {
    const matches = planMatches(8, { ...everyStage(8, 1), FINAL: 2 });

    expect(countPlannedSets(matches)).toBe(10);
  });

  it('needs 16 sets for 16 competitors with 1 set everywhere', () => {
    expect(countPlannedSets(planMatches(16, everyStage(16, 1)))).toBe(16);
  });

  it('needs 28 sets for 16 competitors with semifinals to 2 and the final stage to 3', () => {
    const matches = planMatches(16, {
      STAGE_OF_16: 1,
      QUARTERFINAL: 1,
      SEMIFINAL: 2,
      THIRD_PLACE: 3,
      FINAL: 3,
    });

    expect(countPlannedSets(matches)).toBe(28);
  });
});

describe('matchScrambleSets', () => {
  it('fills the rows in match order, then set order, from sets in letter order', () => {
    const matches = planMatches(8, { ...everyStage(8, 1), FINAL: 2 });

    const plan = matchScrambleSets(
      matches,
      buildPlanRows(matches),
      sets([...letters(10)].reverse()),
    );

    expect(
      plan.map((row) => `${row.matchId}/${row.setNumber}=${row.scrambleSetId}`),
    ).toEqual([
      'm1/1=set-A',
      'm2/1=set-B',
      'm3/1=set-C',
      'm4/1=set-D',
      'm5/1=set-E',
      'm6/1=set-F',
      'm7/1=set-G',
      'm8/1=set-H',
      'm8/2=set-I',
      'm8/3=set-J',
    ]);
  });

  it('keeps a row that already has a set and gives its set to no other row', () => {
    const matches = planMatches(4, everyStage(4, 1));
    const rows = buildPlanRows(matches).map((row) =>
      row.matchId === 'm1' ? { ...row, scrambleSetId: 'set-C' } : row,
    );

    const plan = matchScrambleSets(matches, rows, sets(letters(4)));

    expect(plan.map((row) => row.scrambleSetId)).toEqual([
      'set-C',
      'set-A',
      'set-B',
      'set-D',
    ]);
  });

  it('leaves rows empty when there are too few sets', () => {
    const matches = planMatches(4, everyStage(4, 1));

    const plan = matchScrambleSets(
      matches,
      buildPlanRows(matches),
      sets(['A', 'B']),
    );

    expect(plan.map((row) => row.scrambleSetId)).toEqual([
      'set-A',
      'set-B',
      null,
      null,
    ]);
  });

  it('puts a set lettered past Z after Z', () => {
    const matches = planMatches(4, everyStage(4, 1));
    const rows = buildPlanRows(matches).slice(0, 2);

    const plan = matchScrambleSets(matches, rows, sets(['AA', 'Z']));

    expect(plan.map((row) => row.scrambleSetId)).toEqual(['set-Z', 'set-AA']);
  });

  it('refuses a row whose match is not in the round instead of ordering it anywhere', () => {
    const matches = planMatches(4, everyStage(4, 1));
    const rows = [
      ...buildPlanRows(matches),
      { matchId: 'm-other', setNumber: 1, scrambleSetId: null },
    ];

    expect(() => matchScrambleSets(matches, rows, sets(letters(5)))).toThrow(
      'Plan row for match m-other, which is not in the round',
    );
  });
});
