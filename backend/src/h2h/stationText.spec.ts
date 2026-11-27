import { H2hMatchStatus, H2hSide } from '../generated/prisma/client';
import { getTranslation } from '../translations/translations';
import {
  h2hStationText,
  nextPointNumber,
  OutcomeMatch,
  OutcomePoint,
  StationOutcome,
  stationOutcome,
} from './stationText';

const { A, B } = H2hSide;

/** A point both competitors raced, won by `winner` (null: no winner) */
const decided = (id: string, winner: H2hSide | null): OutcomePoint => ({
  id,
  winnerSide: winner,
  decided: true,
  afterEnd: false,
  a: 'in',
  b: 'in',
});

const playing = (
  sets: OutcomeMatch['sets'],
  status: H2hMatchStatus = H2hMatchStatus.IN_PROGRESS,
  winnerSide: H2hSide | null = null,
): OutcomeMatch => ({ status, winnerSide, sets });

const text = (outcome: StationOutcome, locale = 'en') =>
  h2hStationText(
    outcome,
    (key) => getTranslation(key, locale),
    getTranslation('h2hScore', locale),
  );

describe('stationOutcome', () => {
  it("scores the point's set and the sets from the competitor's side", () => {
    const match = playing([
      {
        winnerSide: B,
        points: ['1', '2', '3', '4'].map((id) => decided(id, B)),
      },
      {
        winnerSide: null,
        points: [decided('5', A), decided('6', A), decided('7', B)],
      },
    ]);

    expect(stationOutcome(match, '6', A)).toEqual({
      matchWon: null,
      point: 'won',
      set: { mine: 2, theirs: 1 },
      sets: { mine: 0, theirs: 1 },
    });
    expect(stationOutcome(match, '7', B)).toEqual({
      matchWon: null,
      point: 'won',
      set: { mine: 1, theirs: 2 },
      sets: { mine: 1, theirs: 0 },
    });
    expect(stationOutcome(match, '5', B).point).toBe('lost');
  });

  it('says no point when nobody won it (I3d)', () => {
    const match = playing([{ winnerSide: null, points: [decided('1', null)] }]);

    expect(stationOutcome(match, '1', A).point).toBe('none');
  });

  it("waits for the opponent's attempt, or for the delegate on an open incident", () => {
    const waiting: OutcomePoint = {
      id: '1',
      winnerSide: null,
      decided: false,
      afterEnd: false,
      a: 'in',
      b: 'empty',
    };
    const incident: OutcomePoint = { ...waiting, id: '2', b: 'incident' };
    const match = playing([{ winnerSide: null, points: [waiting, incident] }]);

    expect(stationOutcome(match, '1', A).point).toBe('waitingForOpponent');
    expect(stationOutcome(match, '2', A).point).toBe('waitingForDelegate');
  });

  it('leaves points after the end out of the set score', () => {
    const surplus = { ...decided('4', B), winnerSide: null, afterEnd: true };
    const match = playing([
      {
        winnerSide: null,
        points: [decided('1', A), decided('2', A), decided('3', B), surplus],
      },
    ]);

    expect(stationOutcome(match, '3', A).set).toEqual({ mine: 2, theirs: 1 });
  });

  it('says who won once the match is over', () => {
    const match = playing(
      [
        {
          winnerSide: A,
          points: [decided('1', A), decided('2', B), decided('3', A)].concat(
            decided('4', A),
          ),
        },
      ],
      H2hMatchStatus.FINISHED,
      A,
    );

    expect(stationOutcome(match, '4', A)).toMatchObject({
      matchWon: true,
      set: { mine: 3, theirs: 1 },
      sets: { mine: 1, theirs: 0 },
    });
    expect(stationOutcome(match, '4', B).matchWon).toBe(false);
  });
});

describe('h2hStationText', () => {
  const score = { set: { mine: 2, theirs: 1 }, sets: { mine: 1, theirs: 0 } };

  it('puts the point first, then the set and sets score', () => {
    expect(text({ matchWon: null, point: 'won', ...score })).toBe(
      'Point won Set 2-1 Sets 1-0',
    );
    expect(text({ matchWon: null, point: 'lost', ...score })).toBe(
      'Point lost Set 2-1 Sets 1-0',
    );
    expect(text({ matchWon: null, point: 'none', ...score })).toBe(
      'No point Set 2-1 Sets 1-0',
    );
  });

  it('says only that it waits while the point is open', () => {
    expect(
      text({ matchWon: null, point: 'waitingForOpponent', ...score }),
    ).toBe('Waiting for opponent');
    expect(
      text({ matchWon: null, point: 'waitingForDelegate', ...score }),
    ).toBe('Waiting for delegate');
  });

  it('says who won the match, with the score', () => {
    const end = { set: { mine: 3, theirs: 1 }, sets: { mine: 2, theirs: 1 } };
    expect(text({ matchWon: true, point: 'won', ...end })).toBe(
      'Match won Set 3-1 Sets 2-1',
    );
    expect(text({ matchWon: false, point: 'lost', ...end })).toBe(
      'Match lost Set 3-1 Sets 2-1',
    );
  });

  it('is in Polish without diacritics', () => {
    expect(text({ matchWon: null, point: 'won', ...score }, 'pl')).toBe(
      'Punkt wygrany Set 2-1 Sety 1-0',
    );
  });

  // The station shows the first two words on the top line, the rest below:
  // each line has 16 characters, in ASCII
  it('fits two lines of the station screen in every language', () => {
    const outcomes: StationOutcome[] = [
      { matchWon: null, point: 'won', ...score },
      { matchWon: null, point: 'lost', ...score },
      { matchWon: null, point: 'none', ...score },
      { matchWon: null, point: 'waitingForOpponent', ...score },
      { matchWon: null, point: 'waitingForDelegate', ...score },
      { matchWon: true, point: 'won', ...score },
      { matchWon: false, point: 'lost', ...score },
    ];
    for (const locale of ['en', 'pl']) {
      for (const outcome of outcomes) {
        const words = text(outcome, locale).split(' ');
        const lines = [words.slice(0, 2), words.slice(2)].map((w) =>
          w.join(' '),
        );
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(16);
          expect(line).toMatch(/^[\x20-\x7e]*$/);
        }
      }
    }
  });

  // A refusal is an error: the station shows "Error" on the top line and the
  // whole text below, scrolling when it is longer than 16 characters, as
  // the other error texts do
  it('keeps the refusals in ASCII, on the one line an error gets', () => {
    const refusals = [
      'h2hNoMatchInProgress',
      'h2hWaitingForOpponent',
      'h2hWaitingForDelegate',
      'h2hNoScrambleLeft',
    ];
    for (const locale of ['en', 'pl']) {
      for (const key of refusals) {
        const shown = getTranslation(key, locale);
        expect(shown).not.toBe(key);
        expect(shown).toMatch(/^[\x20-\x7e]+$/);
      }
    }
  });
});

describe('nextPointNumber', () => {
  it("is the competitor's first empty slot, or the point after the last", () => {
    expect(nextPointNumber([], A)).toBe(1);
    expect(
      nextPointNumber(
        [
          { pointNumber: 1, a: true, b: true },
          { pointNumber: 2, a: false, b: true },
        ],
        A,
      ),
    ).toBe(2);
    expect(nextPointNumber([{ pointNumber: 1, a: true, b: true }], B)).toBe(2);
  });

  it('is the point after their last while they are a point ahead', () => {
    expect(nextPointNumber([{ pointNumber: 1, a: true, b: false }], A)).toBe(2);
  });
});
