import { StoredWcifService } from '../db/storedWcif.service';

/**
 * A StoredWcifService handing out the WCIF a test sets up, or what `read`
 * returns at the time, for a test whose WCIF changes
 */
export const storedWcifOf = (wcif: unknown | (() => unknown)) => {
  const read = () => (typeof wcif === 'function' ? wcif() : wcif) ?? null;
  return {
    get: jest.fn(async () => read()),
    getOrThrow: jest.fn(async () => {
      const value = read();
      if (!value) throw new Error('Competition not found');
      return value;
    }),
  } as unknown as StoredWcifService;
};

/** The WCIF of the competition row a test's database mock returns */
export const storedWcifFrom = (prisma: object) => {
  const { competition } = prisma as {
    competition?: Record<string, (args?: object) => unknown>;
  };
  const read = async () => {
    const find = competition?.findFirst ?? competition?.findFirstOrThrow;
    const row = (await find?.({})) as { wcif?: unknown } | null;
    return row?.wcif ?? null;
  };
  return {
    get: jest.fn(read),
    getOrThrow: jest.fn(async () => {
      const value = await read();
      if (!value) throw new Error('Competition not found');
      return value;
    }),
  } as unknown as StoredWcifService;
};
