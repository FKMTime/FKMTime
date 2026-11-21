/**
 * A value a test knows is there, such as a fixture it set up. Fails the test
 * with a clear message instead of a TypeError further on when it isn't.
 */
export const found = <T>(value: T | null | undefined, what = 'value'): T => {
  if (value === null || value === undefined) {
    throw new Error(`Expected the test's ${what} to exist`);
  }
  return value;
};
