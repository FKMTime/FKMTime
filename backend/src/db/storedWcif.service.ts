import { Injectable } from '@nestjs/common';
import { Competition as Wcif } from 'wcif-helpers';

import { Prisma } from '../generated/prisma/client';
import { DbService } from './db.service';

type Db = DbService | Prisma.TransactionClient;

/** Every nested object and array of `value` made read-only, in place */
export const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

/**
 * The competition's WCIF, parsed once per version of its row instead of on
 * every read. A large competition's WCIF is over a megabyte, and parsing it
 * for each attempt a station sends was most of what entering an attempt
 * cost.
 *
 * Each read asks PostgreSQL for the row's version (its `xmin`, which every
 * insert or update of the row changes, whoever makes it: an import, a sync,
 * an edit to an unofficial event, a seed, or SQL run by hand) and parses the
 * WCIF again only when that changed. So a read never sees an older WCIF than
 * the database holds, and nothing that writes it has to remember to clear a
 * cache.
 *
 * The WCIF returned is shared by every caller and frozen: change a copy.
 */
@Injectable()
export class StoredWcifService {
  private cached: { version: string; wcif: Wcif } | null = null;

  constructor(private readonly prisma: DbService) {}

  /** Pass the transaction's client to read within it */
  async get(db: Db = this.prisma): Promise<Wcif | null> {
    const [row] = await db.$queryRaw<{ id: string; version: string }[]>`
      SELECT id, xmin::text AS version FROM competition LIMIT 1`;
    if (!row) return null;
    // The row's id too: a competition imported again is a new row, whose
    // xmin could in theory match the old one's
    const version = `${row.id}:${row.version}`;
    if (this.cached?.version === version) return this.cached.wcif;

    const competition = await db.competition.findUnique({
      where: { id: row.id },
      select: { wcif: true },
    });
    if (!competition?.wcif) return null;
    // Read after the version, so at worst newer than it: the next read then
    // sees a different version and parses again
    const wcif = deepFreeze(competition.wcif as unknown as Wcif);
    this.cached = { version, wcif };
    return wcif;
  }

  /** For callers that can't go on without a competition */
  async getOrThrow(db: Db = this.prisma): Promise<Wcif> {
    const wcif = await this.get(db);
    if (!wcif) throw new Error('Competition not found');
    return wcif;
  }
}
