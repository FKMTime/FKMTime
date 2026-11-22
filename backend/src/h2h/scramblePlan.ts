/**
 * The scramble plan (SPEC-001): one TNoodle set for every set a match could
 * need, fixed before the round so the scramble team can prepare in advance
 * and parallel matches don't make the letters depend on timing.
 */

export interface PlanMatch {
  matchId: string;
  matchNumber: number;
  setsToWin: number;
}

export interface PlanRow {
  matchId: string;
  setNumber: number;
  scrambleSetId: string | null;
}

export interface RoundScrambleSet {
  id: string;
  /** The set's letter: "A", "B", … */
  set: string;
}

/** A match to X sets lasts at most 2X − 1 sets */
const maxSets = (setsToWin: number) => 2 * setsToWin - 1;

/** How many TNoodle sets the plan needs for these matches */
export const countPlannedSets = (matches: Pick<PlanMatch, 'setsToWin'>[]) =>
  matches.reduce((sum, match) => sum + maxSets(match.setsToWin), 0);

/** The plan's rows, all unassigned: every set every match could need */
export const buildPlanRows = (matches: PlanMatch[]): PlanRow[] =>
  [...matches]
    .sort((x, y) => x.matchNumber - y.matchNumber)
    .flatMap((match) =>
      Array.from({ length: maxSets(match.setsToWin) }, (_, i) => ({
        matchId: match.matchId,
        setNumber: i + 1,
        scrambleSetId: null,
      })),
    );

/** Letter order, shorter letters first, so "AA" comes after "Z" */
const byLetter = (x: RoundScrambleSet, y: RoundScrambleSet) =>
  x.set.length - y.set.length || x.set.localeCompare(y.set);

/**
 * Fills the empty rows in match order, then set order, with the sets nobody
 * uses yet, in letter order. Rows that already have a set keep it, so an
 * edited row survives matching again and a raced one never changes. Rows left
 * empty mean there weren't enough sets.
 */
export const matchScrambleSets = (
  matches: PlanMatch[],
  rows: PlanRow[],
  scrambleSets: RoundScrambleSet[],
): PlanRow[] => {
  const matchNumbers = new Map(matches.map((m) => [m.matchId, m.matchNumber]));
  const matchNumberOf = (row: PlanRow) => {
    const matchNumber = matchNumbers.get(row.matchId);
    if (matchNumber === undefined) {
      throw new Error(
        `Plan row for match ${row.matchId}, which is not in the round`,
      );
    }
    return matchNumber;
  };
  const taken = new Set(
    rows.map((row) => row.scrambleSetId).filter((id) => id !== null),
  );
  const free = [...scrambleSets]
    .filter((set) => !taken.has(set.id))
    .sort(byLetter);
  return [...rows]
    .sort(
      (x, y) =>
        matchNumberOf(x) - matchNumberOf(y) || x.setNumber - y.setNumber,
    )
    .map((row) => {
      const set = row.scrambleSetId === null ? free.shift() : undefined;
      return set ? { ...row, scrambleSetId: set.id } : row;
    });
};
