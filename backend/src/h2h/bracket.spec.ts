import {
  BracketMatch,
  BracketSize,
  BracketSlot,
  buildBracket,
  getStages,
  SetsToWinByStage,
  validateSetsToWin,
} from './bracket';

const allOnes = (size: BracketSize): SetsToWinByStage =>
  Object.fromEntries(getStages(size).map((stage) => [stage, 1]));

/** A slot as the I2 layout reads: "3", "W2" (winner of match 2), "L5" */
const label = (slot: BracketSlot) =>
  slot.kind === 'seed'
    ? `${slot.seed}`
    : `${slot.outcome === 'WINNER' ? 'W' : 'L'}${slot.matchNumber}`;

const layout = (matches: BracketMatch[]) =>
  matches.map((m) => `${m.matchNumber} ${m.stage} ${label(m.a)}-${label(m.b)}`);

describe('buildBracket', () => {
  it('pairs 4 competitors 1v4 and 2v3, with the losers in the third-place match', () => {
    expect(layout(buildBracket(4, allOnes(4)))).toEqual([
      '1 SEMIFINAL 1-4',
      '2 SEMIFINAL 2-3',
      '3 THIRD_PLACE L2-L1',
      '4 FINAL W1-W2',
    ]);
  });

  it('pairs 8 competitors so the seeds of each match add up to 9, then 5', () => {
    expect(layout(buildBracket(8, allOnes(8)))).toEqual([
      '1 QUARTERFINAL 1-8',
      '2 QUARTERFINAL 4-5',
      '3 QUARTERFINAL 3-6',
      '4 QUARTERFINAL 2-7',
      '5 SEMIFINAL W1-W2',
      '6 SEMIFINAL W4-W3',
      '7 THIRD_PLACE L6-L5',
      '8 FINAL W5-W6',
    ]);
  });

  it('sends seeds 1 to 4 of 12 straight to the quarterfinals, against the Stage of 12 winners', () => {
    expect(layout(buildBracket(12, allOnes(12)))).toEqual([
      '1 STAGE_OF_12 8-9',
      '2 STAGE_OF_12 5-12',
      '3 STAGE_OF_12 6-11',
      '4 STAGE_OF_12 7-10',
      '5 QUARTERFINAL 1-W1',
      '6 QUARTERFINAL 4-W2',
      '7 QUARTERFINAL 3-W3',
      '8 QUARTERFINAL 2-W4',
      '9 SEMIFINAL W5-W6',
      '10 SEMIFINAL W8-W7',
      '11 THIRD_PLACE L10-L9',
      '12 FINAL W9-W10',
    ]);
  });

  it('pairs 16 competitors so the seeds of each first match add up to 17', () => {
    const matches = buildBracket(16, allOnes(16));

    expect(layout(matches).slice(0, 8)).toEqual([
      '1 STAGE_OF_16 1-16',
      '2 STAGE_OF_16 8-9',
      '3 STAGE_OF_16 5-12',
      '4 STAGE_OF_16 4-13',
      '5 STAGE_OF_16 3-14',
      '6 STAGE_OF_16 6-11',
      '7 STAGE_OF_16 7-10',
      '8 STAGE_OF_16 2-15',
    ]);
    expect(layout(matches).slice(8)).toEqual([
      '9 QUARTERFINAL W1-W2',
      '10 QUARTERFINAL W4-W3',
      '11 QUARTERFINAL W5-W6',
      '12 QUARTERFINAL W8-W7',
      '13 SEMIFINAL W9-W10',
      '14 SEMIFINAL W12-W11',
      '15 THIRD_PLACE L14-L13',
      '16 FINAL W13-W14',
    ]);
  });

  it('gives every match the sets to win of its stage', () => {
    const matches = buildBracket(8, {
      QUARTERFINAL: 1,
      SEMIFINAL: 2,
      THIRD_PLACE: 2,
      FINAL: 3,
    });

    expect(matches.map((m) => m.setsToWin)).toEqual([1, 1, 1, 1, 2, 2, 2, 3]);
  });
});

describe('validateSetsToWin', () => {
  it('accepts sets to win that never go down, with a final above the third-place match', () => {
    expect(
      validateSetsToWin(8, {
        QUARTERFINAL: 1,
        SEMIFINAL: 1,
        THIRD_PLACE: 1,
        FINAL: 2,
      }),
    ).toEqual([]);
  });

  it('rejects a stage lower than the one before it', () => {
    expect(
      validateSetsToWin(8, {
        QUARTERFINAL: 2,
        SEMIFINAL: 1,
        THIRD_PLACE: 2,
        FINAL: 2,
      }),
    ).toEqual([
      "Sets to win in the Semifinal can't be lower than in the Quarterfinal",
    ]);
  });

  it('rejects a final lower than the third-place match', () => {
    expect(
      validateSetsToWin(4, { SEMIFINAL: 1, THIRD_PLACE: 2, FINAL: 1 }),
    ).toEqual([
      "Sets to win in the Final can't be lower than in the Third-place match",
    ]);
  });

  it('rejects a missing stage and a value above 3', () => {
    expect(validateSetsToWin(4, { SEMIFINAL: 1, THIRD_PLACE: 4 })).toEqual([
      'Sets to win in the Third-place match must be between 1 and 3',
      'Sets to win in the Final must be between 1 and 3',
    ]);
  });
});
