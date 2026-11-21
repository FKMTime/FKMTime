/**
 * Stands in for a constructor dependency the code under test never touches.
 * The type comes from where it's passed, so a test doesn't have to name it.
 */
export const unusedDependency = <T>(): T => null as unknown as T;
