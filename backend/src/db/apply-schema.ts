import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client, ClientBase } from 'pg';

/**
 * Brings the database to the schema this build was made with, without the
 * Prisma CLI: the image carries SQL that CI generated from schema.prisma
 * (scripts/schema-sql.mjs), so no Prisma engine or OpenSSL ships in it.
 *
 * - `create.sql` builds the whole schema in an empty database.
 * - `from-<version>.sql` takes a database on an earlier schema straight to
 *   this one, for an image pulled mid-competition.
 * - `version` names this build's schema: the SHA-256 of schema.prisma.
 *
 * The database records its version in fkmtime.schema_version, outside the
 * public schema so Prisma's own tools (db push, migrate diff) never see it.
 *
 * Dev and CI keep `prisma db push`; this runs only where the Prisma CLI isn't
 * installed: the image (entrypoint.sh) and preview environments.
 */

/** Held while applying, so two processes never change one database at once */
const LOCK_ID = 'fkmtime-apply-schema';

export type SchemaChange =
  | { kind: 'created'; version: string }
  | { kind: 'upgraded'; from: string; version: string }
  | { kind: 'unchanged'; version: string };

/** Thrown when this build can't bring the database to its schema */
export class SchemaRefused extends Error {}

export interface SchemaSql {
  version: string;
  create: string;
  /** The script from an earlier version, or undefined when there is none */
  from: (version: string) => string | undefined;
}

/** Reads the SQL scripts CI generated into `dir` */
export const readSchemaSql = (dir: string): SchemaSql => {
  const read = (name: string) => readFileSync(join(dir, name), 'utf8');
  return {
    version: read('version').trim(),
    create: read('create.sql'),
    from: (version) => {
      // Versions are hex digests; anything else never names a file
      if (!/^[0-9a-f]{64}$/.test(version)) return undefined;
      const file = join(dir, `from-${version}.sql`);
      return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    },
  };
};

const inTransaction = async (db: ClientBase, work: () => Promise<void>) => {
  await db.query('BEGIN');
  try {
    await work();
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
};

const recordedVersion = async (db: ClientBase): Promise<string | undefined> => {
  const table = await db.query<{ exists: boolean }>(
    "SELECT to_regclass('fkmtime.schema_version') IS NOT NULL AS exists",
  );
  if (!table.rows[0].exists) return undefined;
  const row = await db.query<{ version: string }>(
    'SELECT version FROM fkmtime.schema_version',
  );
  return row.rows[0]?.version;
};

const publicTableCount = async (db: ClientBase) => {
  const result = await db.query<{ count: string }>(
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'",
  );
  return Number(result.rows[0].count);
};

const recordVersion = async (db: ClientBase, version: string) => {
  await db.query('CREATE SCHEMA IF NOT EXISTS fkmtime');
  await db.query(
    'CREATE TABLE IF NOT EXISTS fkmtime.schema_version (version text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  await db.query('DELETE FROM fkmtime.schema_version');
  await db.query('INSERT INTO fkmtime.schema_version (version) VALUES ($1)', [
    version,
  ]);
};

/**
 * Creates or upgrades the schema of the database `db` is connected to. Each
 * change runs in one transaction, so a failed upgrade leaves the database on
 * the version it was on.
 */
export async function applySchema(
  db: ClientBase,
  sql: SchemaSql,
): Promise<SchemaChange> {
  await db.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_ID]);
  try {
    const current = await recordedVersion(db);
    if (current === sql.version) {
      return { kind: 'unchanged', version: sql.version };
    }

    if (current === undefined) {
      if ((await publicTableCount(db)) > 0) {
        throw new SchemaRefused(
          'The database has tables but no recorded schema version: it was set up by `prisma db push` or by hand. ' +
            'Start this competition on a fresh database.',
        );
      }
      await inTransaction(db, async () => {
        await db.query(sql.create);
        await recordVersion(db, sql.version);
      });
      return { kind: 'created', version: sql.version };
    }

    const upgrade = sql.from(current);
    if (upgrade === undefined) {
      throw new SchemaRefused(
        `This build can't upgrade the database from schema ${current} to ${sql.version}: ` +
          'no upgrade script was generated for that version. Start this competition on a fresh database.',
      );
    }
    await inTransaction(db, async () => {
      await db.query(upgrade);
      await recordVersion(db, sql.version);
    });
    return { kind: 'upgraded', from: current, version: sql.version };
  } finally {
    await db.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_ID]);
  }
}

const describe = (change: SchemaChange) => {
  switch (change.kind) {
    case 'created':
      return `Created the database schema (${change.version})`;
    case 'upgraded':
      return `Upgraded the database schema from ${change.from} to ${change.version}`;
    case 'unchanged':
      return `The database schema is up to date (${change.version})`;
  }
};

async function main() {
  const dir = process.env.SCHEMA_SQL_DIR ?? join(process.cwd(), 'prisma/sql');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    console.log(describe(await applySchema(db, readSchemaSql(dir))));
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(
      e instanceof SchemaRefused ? e.message : 'Applying the schema failed',
    );
    if (!(e instanceof SchemaRefused)) console.error(e);
    process.exit(1);
  });
}
