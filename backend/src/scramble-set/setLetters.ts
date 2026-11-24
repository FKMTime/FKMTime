/**
 * Scramble set letters as TNoodle and the WCA scrambles page name them:
 * A to Z, then AA, AB, … (bijective base 26). Set 27 is "AA", not "[".
 */
export const numberToSetLetter = (number: number): string => {
  if (!Number.isInteger(number) || number < 1) {
    throw new RangeError(`No scramble set letter for ${number}`);
  }
  let letters = '';
  let rest = number;
  while (rest > 0) {
    const digit = (rest - 1) % 26;
    letters = String.fromCharCode(65 + digit) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
};

/** The set's number from its letter: A = 1, Z = 26, AA = 27, … */
export const setLetterToNumber = (letters: string): number => {
  if (!/^[A-Z]+$/.test(letters)) {
    throw new RangeError(`"${letters}" is not a scramble set letter`);
  }
  return [...letters].reduce(
    (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
    0,
  );
};

/** Sorts sets in letter order, so "AA" comes after "Z" */
export const bySetLetter = (x: { set: string }, y: { set: string }) => {
  const number = (set: string) =>
    /^[A-Z]+$/.test(set) ? setLetterToNumber(set) : Infinity;
  return number(x.set) - number(y.set) || x.set.localeCompare(y.set);
};
