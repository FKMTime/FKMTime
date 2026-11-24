import {
  bySetLetter,
  numberToSetLetter,
  setLetterToNumber,
} from './setLetters';

describe('scramble set letters', () => {
  it.each([
    [1, 'A'],
    [2, 'B'],
    [26, 'Z'],
    [27, 'AA'],
    [28, 'AB'],
    [52, 'AZ'],
    [53, 'BA'],
    [702, 'ZZ'],
    [703, 'AAA'],
  ])('letters set %i as %s and back', (number, letters) => {
    expect(numberToSetLetter(number)).toBe(letters);
    expect(setLetterToNumber(letters)).toBe(number);
  });

  it('gives every set up to 1000 its own letters, in order', () => {
    const all = Array.from({ length: 1000 }, (_, i) =>
      numberToSetLetter(i + 1),
    );
    expect(new Set(all).size).toBe(1000);
    expect(all.map(setLetterToNumber)).toEqual(
      Array.from({ length: 1000 }, (_, i) => i + 1),
    );
  });

  it.each([0, -1, 1.5])('refuses to letter %p', (number) => {
    expect(() => numberToSetLetter(number)).toThrow(RangeError);
  });

  it.each(['', 'a', 'A1', '['])('refuses to number %p', (letters) => {
    expect(() => setLetterToNumber(letters)).toThrow(RangeError);
  });
});

describe('bySetLetter', () => {
  it('sorts AA after Z', () => {
    const sets = ['AB', 'B', 'AA', 'Z', 'A'].map((set) => ({ set }));

    expect([...sets].sort(bySetLetter).map((s) => s.set)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
    ]);
  });
});
