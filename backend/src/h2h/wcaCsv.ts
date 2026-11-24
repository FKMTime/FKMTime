import { toAttemptResult } from 'src/result/helpers';
import { setLetterToNumber } from 'src/scramble-set/setLetters';

import {
  Attempt,
  AttemptStatus,
  H2hMatchEnd,
  H2hMatchStatus,
} from '../generated/prisma/client';

/**
 * The CSV the WCA website imports for a head-to-head round (SPEC-001, WCA
 * CSV export). Its importer reads columns by name, takes numbering from row
 * order and validates nothing, so everything is checked here first.
 */
export const WCA_CSV_COLUMNS = [
  'round_id',
  'match_number',
  'match_set_number',
  'set_attempt_number',
  'registration_id',
  'final_position',
  'time_seconds',
  'scramble',
  'scramble_set_number',
  'scramble_number',
  'is_extra',
] as const;

export type CsvAttempt = Pick<Attempt, 'value' | 'penalty' | 'status'>;

export interface CsvPoint {
  pointNumber: number;
  /**
   * Raced after its set or the match was over: it decides nothing, but its
   * attempts are real solves and go in the file
   */
  afterEnd: boolean;
  /** The race that counts; races replaced by an extra aren't here */
  attemptA: CsvAttempt | null;
  attemptB: CsvAttempt | null;
  /** `text` is the scramble as it goes in the file */
  scramble: { set: string; num: number; isExtra: boolean; text: string } | null;
}

export interface CsvSet {
  setNumber: number;
  hasScrambleSet: boolean;
  points: CsvPoint[];
}

export interface CsvMatch {
  matchNumber: number;
  /** "Quarterfinal 2", as the checks name it */
  label: string;
  status: H2hMatchStatus;
  endedBy: H2hMatchEnd | null;
  entrantAId: string | null;
  entrantBId: string | null;
  sets: CsvSet[];
}

export interface CsvEntrant {
  id: string;
  name: string;
  /** The WCA registration's id (WCIF `wcaRegistrationId`) */
  registrationId: number | null;
  /** From rankH2hRound */
  position: number | null;
}

export interface CsvInput {
  wcaRoundId: number | null;
  matches: CsvMatch[];
  entrants: CsvEntrant[];
}

export interface CsvRow {
  roundId: number;
  matchNumber: number;
  setNumber: number;
  pointNumber: number;
  registrationId: number;
  position: number;
  /** WCA-encoded: centiseconds with +2 added, -1 DNF, -2 DNS */
  result: number;
  scramble: string;
  scrambleSetNumber: number;
  scrambleNumber: number;
  isExtra: boolean;
}

/** Attempts that never count: replaced by an extra, or called off */
const NOT_COUNTING: AttemptStatus[] = [
  AttemptStatus.EXTRA_GIVEN,
  AttemptStatus.VOIDED,
  AttemptStatus.SCRAMBLED,
];

/** A side's attempt on a point, when it is one the WCA gets */
const counting = (attempt: CsvAttempt | null) =>
  attempt !== null && !NOT_COUNTING.includes(attempt.status) ? attempt : null;

interface ExportedPoint {
  match: CsvMatch;
  set: CsvSet;
  point: CsvPoint;
  a: CsvAttempt | null;
  b: CsvAttempt | null;
}

/**
 * The points that go in the file, in file order: every point with a
 * counting attempt, except in walkovers (9f5b: no results). Points raced
 * after a set's or the match's end (`afterEnd`) go in too: they are real
 * solves (9i4), the ranking's best singles count them, and the WCA takes
 * `best` from these rows. Points with no attempt (an extra not raced yet, a
 * set opened but not raced) are left out.
 */
const exportedPoints = (matches: CsvMatch[]): ExportedPoint[] =>
  [...matches]
    .filter((match) => match.endedBy !== H2hMatchEnd.WALKOVER)
    .sort((x, y) => x.matchNumber - y.matchNumber)
    .flatMap((match) =>
      [...match.sets]
        .sort((x, y) => x.setNumber - y.setNumber)
        .flatMap((set) =>
          [...set.points]
            .sort((x, y) => x.pointNumber - y.pointNumber)
            .flatMap((point) => {
              const a = counting(point.attemptA);
              const b = counting(point.attemptB);
              return a === null && b === null
                ? []
                : [{ match, set, point, a, b }];
            }),
        ),
    );

/** The scramble set's letter as the WCA numbers it, or null for a bad one */
const setNumberOf = (letter: string) =>
  /^[A-Z]+$/.test(letter) ? setLetterToNumber(letter) : null;

/**
 * What has to be fixed before the file can be made, in words the delegate
 * acts on. Empty when the export can go ahead (the password is checked
 * separately, when it is given).
 */
export const exportBlockers = (input: CsvInput): string[] => {
  const blockers: string[] = [];
  const unfinished = [...input.matches]
    .filter((match) => match.status !== H2hMatchStatus.FINISHED)
    .sort((x, y) => x.matchNumber - y.matchNumber);
  for (const match of unfinished) {
    blockers.push(`${match.label} isn't finished`);
  }
  if (input.wcaRoundId === null) {
    blockers.push(
      "The WCA round id couldn't be fetched from the WCA website. Enter it on the Bracket tab.",
    );
  }
  const points = exportedPoints(input.matches);
  const lastPointOf = new Map<CsvMatch, CsvPoint>();
  for (const { match, point } of points) lastPointOf.set(match, point);
  const setsChecked = new Set<CsvSet>();
  for (const { match, set, point, a, b } of points) {
    const where = `${match.label}, set ${set.setNumber}`;
    if (!set.hasScrambleSet && !setsChecked.has(set)) {
      blockers.push(`${where} has no scramble set`);
    }
    setsChecked.add(set);
    const at = `${where}, point ${point.pointNumber}`;
    // A retirement leaves its open point with the opponent's attempt only.
    // A point after the end decides nothing, so its missing result can't
    // be entered and isn't needed.
    const isOpenPointOfRetired =
      match.endedBy === H2hMatchEnd.RETIRED && lastPointOf.get(match) === point;
    if (
      (a === null || b === null) &&
      !isOpenPointOfRetired &&
      !point.afterEnd
    ) {
      blockers.push(`${at} has only one result. Enter the missing one.`);
    }
    if (
      a?.status === AttemptStatus.UNRESOLVED ||
      b?.status === AttemptStatus.UNRESOLVED
    ) {
      blockers.push(`${at} has an open incident. Resolve it first.`);
    }
    if (point.scramble === null) {
      blockers.push(`${at} has no scramble`);
    } else if (setNumberOf(point.scramble.set) === null) {
      blockers.push(
        `${at} was raced on set "${point.scramble.set}", which isn't a scramble set letter the WCA can number`,
      );
    }
  }
  const competing = new Set(
    points.flatMap(({ match, a, b }) => [
      ...(a && match.entrantAId ? [match.entrantAId] : []),
      ...(b && match.entrantBId ? [match.entrantBId] : []),
    ]),
  );
  for (const entrant of input.entrants) {
    if (!competing.has(entrant.id)) continue;
    if (entrant.registrationId === null) {
      blockers.push(
        `${entrant.name} has no WCA registration id. Only competitors registered on the WCA website can be in the results: sync the competition, or check the registration.`,
      );
    }
    // Positions come with the last matches: no need to say it twice
    if (entrant.position === null && unfinished.length === 0) {
      blockers.push(`${entrant.name} has no final position yet`);
    }
  }
  return blockers;
};

/**
 * One row per counting attempt, sorted by match, set, point, then side A
 * before side B: the importer numbers attempts by row order. Throws when
 * there are blockers; check exportBlockers first.
 */
export const buildCsvRows = (input: CsvInput): CsvRow[] => {
  const blockers = exportBlockers(input);
  if (blockers.length > 0 || input.wcaRoundId === null) {
    throw new Error(`The export isn't ready: ${blockers.join('; ')}`);
  }
  const roundId = input.wcaRoundId;
  const entrantById = new Map(input.entrants.map((e) => [e.id, e]));
  return exportedPoints(input.matches).flatMap(
    ({ match, set, point, a, b }) => {
      const scramble = point.scramble;
      const scrambleSetNumber = scramble && setNumberOf(scramble.set);
      if (!scramble || scrambleSetNumber === null) return [];
      const sides = [
        { attempt: a, entrantId: match.entrantAId },
        { attempt: b, entrantId: match.entrantBId },
      ];
      return sides.flatMap(({ attempt, entrantId }) => {
        const entrant = entrantId === null ? null : entrantById.get(entrantId);
        if (
          attempt === null ||
          !entrant ||
          entrant.registrationId === null ||
          entrant.position === null
        ) {
          return [];
        }
        return [
          {
            roundId,
            matchNumber: match.matchNumber,
            setNumber: set.setNumber,
            pointNumber: point.pointNumber,
            registrationId: entrant.registrationId,
            position: entrant.position,
            result: toAttemptResult(attempt),
            scramble: scramble.text,
            scrambleSetNumber,
            scrambleNumber: scramble.num,
            isExtra: scramble.isExtra,
          },
        ];
      });
    },
  );
};

/**
 * Seconds with exactly two decimals, as the importer reads them
 * (`sub(".", "").to_i`): 6532 is "65.32", never "1:05.32". DNF is -1 and
 * DNS -2.
 */
export const formatTimeSeconds = (result: number): string => {
  if (result < 0) return String(result);
  const seconds = Math.floor(result / 100);
  const hundredths = result % 100;
  return `${seconds}.${String(hundredths).padStart(2, '0')}`;
};

/** Quoted only when it has to be (RFC 4180); scrambles never need it */
const csvField = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** The file: a header row, then the rows, with `\n` line endings */
export const toCsv = (rows: CsvRow[]): string =>
  [
    WCA_CSV_COLUMNS.join(','),
    ...rows.map((row) =>
      [
        String(row.roundId),
        String(row.matchNumber),
        String(row.setNumber),
        String(row.pointNumber),
        String(row.registrationId),
        String(row.position),
        formatTimeSeconds(row.result),
        csvField(row.scramble),
        String(row.scrambleSetNumber),
        String(row.scrambleNumber),
        row.isExtra ? '1' : '0',
      ].join(','),
    ),
  ].join('\n') + '\n';
