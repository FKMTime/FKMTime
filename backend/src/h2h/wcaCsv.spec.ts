import {
  AttemptStatus,
  H2hMatchEnd,
  H2hMatchStatus,
} from '../generated/prisma/client';
import {
  buildCsvRows,
  CsvAttempt,
  CsvEntrant,
  CsvInput,
  CsvMatch,
  CsvPoint,
  exportBlockers,
  formatTimeSeconds,
  toCsv,
  WCA_CSV_COLUMNS,
} from './wcaCsv';

const DNF = -1;
const DNS = -2;

/** A solve: centiseconds, with a +2 when asked */
const solve = (value: number, penalty = 0): CsvAttempt => ({
  value,
  penalty,
  status: AttemptStatus.STANDARD,
});
const dnf = (): CsvAttempt => ({
  value: 4210,
  penalty: DNF,
  status: AttemptStatus.STANDARD,
});
const dns = (): CsvAttempt => ({
  value: 0,
  penalty: DNS,
  status: AttemptStatus.STANDARD,
});

const point = (
  pointNumber: number,
  a: CsvAttempt | null,
  b: CsvAttempt | null,
  scramble: { set?: string; num?: number; isExtra?: boolean } = {},
  afterEnd = false,
): CsvPoint => ({
  pointNumber,
  afterEnd,
  attemptA: a,
  attemptB: b,
  scramble: {
    set: scramble.set ?? 'A',
    num: scramble.num ?? pointNumber,
    isExtra: scramble.isExtra ?? false,
    text: `R U${pointNumber} F' ${scramble.set ?? 'A'}${scramble.num ?? pointNumber}`,
  },
});

const match = (
  matchNumber: number,
  entrants: [string, string],
  sets: { setNumber: number; points: CsvPoint[] }[],
  endedBy: H2hMatchEnd = H2hMatchEnd.PLAYED,
): CsvMatch => ({
  matchNumber,
  label: `Match ${matchNumber}`,
  status: H2hMatchStatus.FINISHED,
  endedBy,
  entrantAId: entrants[0],
  entrantBId: entrants[1],
  sets: sets.map((set) => ({ ...set, hasScrambleSet: true })),
});

// Invented competitors
const entrants: CsvEntrant[] = [
  { id: 'e1', name: 'Ada Example', registrationId: 1001, position: 1 },
  { id: 'e2', name: 'Ben Sample', registrationId: 1002, position: 3 },
  { id: 'e3', name: 'Cleo Test', registrationId: 1003, position: 2 },
  { id: 'e4', name: 'Dan Mock', registrationId: 1004, position: 4 },
];

const input = (matches: CsvMatch[], wcaRoundId: number | null = 98765) => ({
  wcaRoundId,
  entrants,
  matches,
});

/**
 * Reads a CSV the way the WCA website's H2H import (the rake task) does:
 * columns by name, numbers through Ruby's `to_i`, times through
 * `sub(".", "").to_i`, and attempt numbers from row order rather than the
 * file
 */
const importLikeWca = (csv: string) => {
  // Ruby's String#to_i: the leading integer, 0 when there is none
  const toI = (text: string) => {
    const found = /^\s*[-+]?\d+/.exec(text);
    return found ? parseInt(found[0], 10) : 0;
  };
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length > 0) records.push([...record, field]);
  const [header, ...rows] = records;
  const attemptsSoFar = new Map<number, number>();
  const setAttemptsSoFar = new Map<string, number>();
  return rows.map((cells) => {
    const get = (column: string) => cells[header.indexOf(column)];
    const registrationId = toI(get('registration_id'));
    const matchNumber = toI(get('match_number'));
    const setNumber = toI(get('match_set_number'));
    const setKey = `${registrationId}/${matchNumber}/${setNumber}`;
    const attemptNumber = (attemptsSoFar.get(registrationId) ?? 0) + 1;
    attemptsSoFar.set(registrationId, attemptNumber);
    const setAttemptNumber = (setAttemptsSoFar.get(setKey) ?? 0) + 1;
    setAttemptsSoFar.set(setKey, setAttemptNumber);
    return {
      roundId: toI(get('round_id')),
      matchNumber,
      setNumber,
      setAttemptNumberInFile: toI(get('set_attempt_number')),
      registrationId,
      position: toI(get('final_position')),
      value: toI(get('time_seconds').replace('.', '')),
      scramble: get('scramble'),
      scrambleSetNumber: toI(get('scramble_set_number')),
      scrambleNumber: toI(get('scramble_number')),
      isExtra: toI(get('is_extra')) === 1,
      attemptNumber,
      setAttemptNumber,
    };
  });
};

/**
 * The Results row the importer makes of a competitor's rows: `pos` from
 * their first row only, never recomputed, and `best` their best single,
 * DNF when nothing was solved
 */
const resultsLikeWca = (rows: ReturnType<typeof importLikeWca>) => {
  const results = new Map<number, { pos: number; best: number }>();
  for (const row of rows) {
    const result = results.get(row.registrationId);
    if (!result) {
      results.set(row.registrationId, { pos: row.position, best: row.value });
      continue;
    }
    const better =
      row.value > 0 && (result.best <= 0 || row.value < result.best);
    const dnfOverDns = result.best === DNS && row.value === DNF;
    if (better || dnfOverDns) result.best = row.value;
  }
  return results;
};

/**
 * A match's winner as the WCA results pages work it out from the imported
 * attempts (`computeMatchScores` in the WCA website's `headToHead.ts`).
 * Races are the attempts sharing a set attempt number, which the importer
 * gives by count; a race goes to the better result (DNF over DNS), a set to
 * whoever won the most races, and the match to whoever won the most sets.
 */
const scoresLikeWca = (rows: ReturnType<typeof importLikeWca>) => {
  const compare = (a: number, b: number) => {
    if (a > 0 && b > 0) return a - b;
    if (a > 0) return -1;
    if (b > 0) return 1;
    return b - a;
  };
  const byMatch = new Map<number, ReturnType<typeof importLikeWca>>();
  for (const row of rows) {
    byMatch.set(row.matchNumber, [
      ...(byMatch.get(row.matchNumber) ?? []),
      row,
    ]);
  }
  const scores = new Map<
    number,
    { winner: number | null; setWins: Map<number, number> }
  >();
  for (const [matchNumber, matchRows] of byMatch) {
    const competitors = [...new Set(matchRows.map((r) => r.registrationId))];
    const setWins = new Map(competitors.map((c) => [c, 0]));
    const sets = [...new Set(matchRows.map((r) => r.setNumber))];
    for (const setNumber of sets) {
      const raceWins = new Map(competitors.map((c) => [c, 0]));
      const inSet = matchRows.filter((r) => r.setNumber === setNumber);
      const races = [...new Set(inSet.map((r) => r.setAttemptNumber))];
      for (const race of races) {
        const [best, runnerUp] = inSet
          .filter((r) => r.setAttemptNumber === race)
          .sort((x, y) => compare(x.value, y.value));
        if (runnerUp && compare(best.value, runnerUp.value) === 0) continue;
        raceWins.set(
          best.registrationId,
          (raceWins.get(best.registrationId) ?? 0) + 1,
        );
      }
      const most = Math.max(0, ...raceWins.values());
      const leaders = competitors.filter((c) => raceWins.get(c) === most);
      if (most > 0 && leaders.length === 1) {
        setWins.set(leaders[0], (setWins.get(leaders[0]) ?? 0) + 1);
      }
    }
    const most = Math.max(0, ...setWins.values());
    const leaders = competitors.filter((c) => setWins.get(c) === most);
    scores.set(matchNumber, {
      winner: most > 0 && leaders.length === 1 ? leaders[0] : null,
      setWins,
    });
  }
  return scores;
};

describe('formatTimeSeconds', () => {
  it.each([
    [6532, '65.32'],
    [1020, '10.20'],
    [6000, '60.00'],
    [100000, '1000.00'],
    [905, '9.05'],
    [7, '0.07'],
    [DNF, '-1'],
    [DNS, '-2'],
  ])('writes %i as %s', (result, text) => {
    expect(formatTimeSeconds(result)).toBe(text);
  });
});

describe('WCA CSV', () => {
  it('gives back the stored values when read with the WCA importer rules', () => {
    const final = match(
      1,
      ['e1', 'e3'],
      [
        {
          setNumber: 1,
          points: [
            point(1, solve(6532), solve(1020)),
            point(2, dnf(), dns()),
            point(3, solve(12145, 2), solve(6000), { set: 'AA', num: 2 }),
            point(4, solve(905), solve(100000), { isExtra: true, num: 1 }),
          ],
        },
      ],
    );
    const csv = toCsv(buildCsvRows(input([final])));

    expect(csv.split('\n')[0]).toBe(WCA_CSV_COLUMNS.join(','));
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv).not.toContain('\r');
    expect(csv).not.toMatch(/\d+:\d\d/);
    const rows = importLikeWca(csv);
    expect(rows.map((row) => [row.registrationId, row.value])).toEqual([
      [1001, 6532],
      [1003, 1020],
      [1001, DNF],
      [1003, DNS],
      // 121.45 with a +2
      [1001, 12345],
      [1003, 6000],
      [1001, 905],
      [1003, 100000],
    ]);
    expect(resultsLikeWca(rows)).toEqual(
      new Map([
        [1001, { pos: 1, best: 905 }],
        [1003, { pos: 2, best: 1020 }],
      ]),
    );
    expect(rows.every((row) => row.roundId === 98765)).toBe(true);
    expect(rows.every((row) => row.matchNumber === 1)).toBe(true);
    expect(rows.every((row) => row.setNumber === 1)).toBe(true);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
    expect(rows.map((row) => row.scrambleSetNumber)).toEqual([
      1, 1, 1, 1, 27, 27, 1, 1,
    ]);
    expect(rows.map((row) => row.scrambleNumber)).toEqual([
      1, 1, 2, 2, 2, 2, 1, 1,
    ]);
    expect(rows.map((row) => row.isExtra)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(rows[0].scramble).toBe("R U1 F' A1");
    expect(rows[4].scramble).toBe("R U3 F' AA2");
    // The numbers the importer gives from row order are the points
    expect(rows.map((row) => row.attemptNumber)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    expect(rows.map((row) => row.setAttemptNumber)).toEqual(
      rows.map((row) => row.setAttemptNumberInFile),
    );
  });

  it('numbers attempts across the round and per set, as the importer counts rows', () => {
    const semi = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [1, 2, 3].map((n) => point(n, solve(900), solve(1000))),
        },
        {
          setNumber: 2,
          points: [1, 2, 3].map((n) =>
            point(n, solve(900), solve(1000), { set: 'B' }),
          ),
        },
      ],
    );
    const rows = importLikeWca(toCsv(buildCsvRows(input([semi]))));

    const ada = rows.filter((row) => row.registrationId === 1001);
    expect(ada.map((row) => row.attemptNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ada.map((row) => row.setAttemptNumber)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(ada.map((row) => row.setAttemptNumberInFile)).toEqual([
      1, 2, 3, 1, 2, 3,
    ]);
  });

  it('quotes a field only when it has to', () => {
    const odd = match(
      1,
      ['e1', 'e2'],
      [{ setNumber: 1, points: [point(1, solve(900), solve(1000))] }],
    );
    odd.sets[0].points[0].scramble = {
      set: 'A',
      num: 1,
      isExtra: false,
      text: 'R, "U"',
    };
    const csv = toCsv(buildCsvRows(input([odd])));

    expect(csv).toContain('"R, ""U"""');
    expect(importLikeWca(csv)[0].scramble).toBe('R, "U"');
  });
});

describe('buildCsvRows', () => {
  it('sorts by match, set, point, then side A before side B', () => {
    const second = match(
      2,
      ['e2', 'e4'],
      [{ setNumber: 1, points: [point(1, solve(800), solve(700))] }],
    );
    const first = match(
      1,
      ['e1', 'e3'],
      [
        {
          setNumber: 2,
          points: [
            point(2, solve(500), solve(600), { set: 'B' }),
            point(1, solve(500), solve(600), { set: 'B' }),
          ],
        },
        { setNumber: 1, points: [point(1, solve(500), solve(600))] },
      ],
    );
    const rows = buildCsvRows(input([second, first]));

    expect(
      rows.map((row) => [
        row.matchNumber,
        row.setNumber,
        row.pointNumber,
        row.registrationId,
      ]),
    ).toEqual([
      [1, 1, 1, 1001],
      [1, 1, 1, 1003],
      [1, 2, 1, 1001],
      [1, 2, 1, 1003],
      [1, 2, 2, 1001],
      [1, 2, 2, 1003],
      [2, 1, 1, 1002],
      [2, 1, 1, 1004],
    ]);
  });

  it('gives a walkover no rows, even with attempts in it', () => {
    // The retiring competitor never solved: a walkover (9f5b)
    const walkover = match(
      1,
      ['e1', 'e2'],
      [{ setNumber: 1, points: [point(1, solve(900), null)] }],
      H2hMatchEnd.WALKOVER,
    );
    const played = match(
      2,
      ['e3', 'e4'],
      [{ setNumber: 1, points: [point(1, solve(900), solve(1000))] }],
    );

    expect(exportBlockers(input([walkover, played]))).toEqual([]);
    const rows = buildCsvRows(input([walkover, played]));
    expect(rows.map((row) => row.matchNumber)).toEqual([2, 2]);
  });

  it("keeps every attempt of a retired match, the opponent's on the open point too", () => {
    const retired = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [1, 2, 3].map((n) => point(n, solve(900), solve(1000))),
        },
        {
          setNumber: 2,
          points: [
            point(1, solve(1100), solve(1000), { set: 'B' }),
            // B retired before solving point 2
            point(2, solve(950), null, { set: 'B' }),
          ],
        },
      ],
      H2hMatchEnd.RETIRED,
    );

    expect(exportBlockers(input([retired]))).toEqual([]);
    const rows = buildCsvRows(input([retired]));
    expect(rows).toHaveLength(9);
    expect(rows[8]).toMatchObject({
      setNumber: 2,
      pointNumber: 2,
      registrationId: 1001,
      result: 950,
    });
  });

  it('leaves out attempts replaced by an extra or called off', () => {
    const extra = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [
            point(1, solve(900), solve(1000)),
            // An extra granted and never raced: the old race is called off
            point(
              2,
              { value: 900, penalty: 0, status: AttemptStatus.VOIDED },
              { value: 800, penalty: 0, status: AttemptStatus.EXTRA_GIVEN },
            ),
          ],
        },
      ],
      H2hMatchEnd.RETIRED,
    );

    const rows = buildCsvRows(input([extra]));
    expect(rows.map((row) => row.pointNumber)).toEqual([1, 1]);
  });

  it('leaves out points after the end and sets after the match', () => {
    const reopened = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [
            point(1, solve(900), solve(1000)),
            point(2, solve(900), solve(1000)),
            point(3, solve(900), solve(1000)),
            // Raced before an amended time ended the set at point 3
            point(4, solve(1000), solve(700), {}, true),
            point(5, solve(1000), null, {}, true),
          ],
        },
        {
          setNumber: 2,
          points: [point(1, solve(650), solve(1000), { set: 'B' }, true)],
        },
      ],
    );

    expect(exportBlockers(input([reopened]))).toEqual([]);
    const rows = buildCsvRows(input([reopened]));
    expect(rows.map((row) => [row.setNumber, row.pointNumber])).toEqual([
      [1, 1],
      [1, 1],
      [1, 2],
      [1, 2],
      [1, 3],
      [1, 3],
    ]);
  });

  it('gives the WCA the winner FKMTime decided, after a reopened match', () => {
    // A, A, no winner, B, B, B; then A's point 3 is amended to a win and
    // the match reopened: A wins the set 3-0 at point 3, and points 4 to 6
    // come after its end
    const reopened = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [
            point(1, solve(900), solve(1000)),
            point(2, solve(900), solve(1000)),
            point(3, solve(900), dnf()),
            point(4, solve(1100), solve(1000), {}, true),
            point(5, solve(1100), solve(1000), {}, true),
            point(6, solve(1100), solve(1000), {}, true),
          ],
        },
      ],
    );
    const fkmTimeWinner = 1001;

    const scores = scoresLikeWca(
      importLikeWca(toCsv(buildCsvRows(input([reopened])))),
    );

    expect(scores.get(1)).toEqual({
      winner: fkmTimeWinner,
      setWins: new Map([
        [1001, 1],
        [1002, 0],
      ]),
    });
  });

  it('leaves out empty points', () => {
    const withEmpty = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [point(1, solve(900), solve(1000)), point(2, null, null)],
        },
      ],
      H2hMatchEnd.RETIRED,
    );

    expect(buildCsvRows(input([withEmpty]))).toHaveLength(2);
  });

  it('refuses to build while anything blocks the export', () => {
    expect(() => buildCsvRows(input([], null))).toThrow(
      "The export isn't ready",
    );
  });
});

describe('exportBlockers', () => {
  it('lists everything to fix', () => {
    const playing: CsvMatch = {
      ...match(
        2,
        ['e3', 'e4'],
        [{ setNumber: 1, points: [point(1, solve(900), null)] }],
      ),
      status: H2hMatchStatus.IN_PROGRESS,
      endedBy: null,
    };
    const unresolved: CsvAttempt = {
      value: 900,
      penalty: 0,
      status: AttemptStatus.UNRESOLVED,
    };
    const played = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [
            point(1, unresolved, solve(1000)),
            { ...point(2, solve(900), solve(1000)), scramble: null },
            point(3, solve(900), solve(1000), { set: 'a1' }),
          ],
        },
      ],
    );
    played.sets[0].hasScrambleSet = false;
    const noRegistration: CsvInput = {
      ...input([played, playing], null),
      entrants: entrants.map((e) =>
        e.id === 'e2' ? { ...e, registrationId: null, position: null } : e,
      ),
    };

    expect(exportBlockers(noRegistration)).toEqual([
      "Match 2 isn't finished",
      "The WCA round id couldn't be fetched from the WCA website. Enter it on the Bracket tab.",
      'Match 1, set 1 has no scramble set',
      'Match 1, set 1, point 1 has an open incident. Resolve it first.',
      'Match 1, set 1, point 2 has no scramble',
      'Match 1, set 1, point 3 was raced on set "a1", which isn\'t a scramble set letter the WCA can number',
      'Match 2, set 1, point 1 has only one result. Enter the missing one.',
      'Ben Sample has no WCA registration id. Only competitors registered on the WCA website can be in the results: sync the competition, or check the registration.',
    ]);
  });

  it('asks for a final position once every match is finished', () => {
    const played = match(
      1,
      ['e1', 'e2'],
      [{ setNumber: 1, points: [point(1, solve(900), solve(1000))] }],
    );
    const unranked = {
      ...input([played]),
      entrants: entrants.map((e) =>
        e.id === 'e2' ? { ...e, position: null } : e,
      ),
    };

    expect(exportBlockers(unranked)).toEqual([
      'Ben Sample has no final position yet',
    ]);
  });

  it('allows one result only on the open point of a retired match', () => {
    const retiredEarly = match(
      1,
      ['e1', 'e2'],
      [
        {
          setNumber: 1,
          points: [point(1, solve(900), null), point(2, solve(900), null)],
        },
      ],
      H2hMatchEnd.RETIRED,
    );

    expect(exportBlockers(input([retiredEarly]))).toEqual([
      'Match 1, set 1, point 1 has only one result. Enter the missing one.',
    ]);
  });

  it('asks nothing of a competitor whose only match was a walkover', () => {
    const walkover = match(1, ['e1', 'e2'], [], H2hMatchEnd.WALKOVER);
    const unregistered = {
      ...input([walkover]),
      entrants: entrants.map((e) => ({ ...e, registrationId: null })),
    };

    expect(exportBlockers(unregistered)).toEqual([]);
  });
});
