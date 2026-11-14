import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * A transaction in progress: the client to query it with, and a place for
 * effects that must not run until it commits (socket events, sending
 * results), since whoever they reach reads the database outside it
 */
export interface Tx {
  db: Prisma.TransactionClient;
  afterCommit: (effect: () => void) => void;
}

/**
 * Runs `work` in one transaction, then its after-commit effects. A rolled-back
 * transaction runs none of them.
 */
export async function runInTransaction<T>(
  prisma: DbService,
  work: (tx: Tx) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  const effects: (() => void)[] = [];
  const result = await prisma.$transaction(
    (db) => work({ db, afterCommit: (effect) => effects.push(effect) }),
    options,
  );
  for (const effect of effects) effect();
  return result;
}

/**
 * Spread into a result query's `where` to also get results removed under
 * Regulation 9t, which every result query leaves out otherwise
 */
export const INCLUDING_REMOVED = { removedAt: undefined };

type Where = Record<string, unknown> | undefined;

/** Results removed under Regulation 9t count nowhere (SPEC-005) */
export const withoutRemovedResults = (where: Where) =>
  where && 'removedAt' in where ? where : { ...where, removedAt: null };

/**
 * Attempts of removed results count nowhere either. A query about one result's
 * or one attempt's own rows is left alone: it already knows which it wants.
 */
export const withoutRemovedResultAttempts = (where: Where) => {
  if (where && ('id' in where || 'resultId' in where)) return where;
  const result = where?.result as Where;
  if (result && 'removedAt' in result) return where;
  return { ...where, result: { ...result, removedAt: null } };
};

const LIST_OPERATIONS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'groupBy',
  'aggregate',
] as const;

const filtering = (filter: (where: Where) => Where) =>
  Object.fromEntries(
    LIST_OPERATIONS.map((operation) => [
      operation,
      ({ args, query }) => query({ ...args, where: filter(args.where) }),
    ]),
  );

@Injectable()
export class DbService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL'),
      }),
      log: [{ emit: 'stdout', level: 'error' }],
      // signKey is the key a station signs its packets with. Only the
      // stations themselves need it, so no query returns it unless it opts
      // back in with omit: { signKey: false }
      omit: { device: { signKey: true } },
      errorFormat: 'colorless',
    });
    // The extended client replaces this instance, so Nest injects it everywhere
    const extended = this.$extends({
      query: {
        result: filtering(withoutRemovedResults),
        attempt: filtering(withoutRemovedResultAttempts),
      },
    });
    return Object.assign(extended, {
      onModuleDestroy: () => extended.$disconnect(),
    }) as unknown as DbService;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
