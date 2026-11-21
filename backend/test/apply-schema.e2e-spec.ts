import { randomBytes } from 'crypto';
import { Client } from 'pg';
import { applySchema, SchemaRefused, SchemaSql } from 'src/db/apply-schema';

const V1 = '1'.repeat(64);
const V2 = '2'.repeat(64);

const v1: SchemaSql = {
  version: V1,
  create: 'CREATE TABLE "person" ("id" TEXT NOT NULL PRIMARY KEY);',
  from: () => undefined,
};

const v2 = (fromV1: string): SchemaSql => ({
  version: V2,
  create:
    'CREATE TABLE "person" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT);',
  from: (version) => (version === V1 ? fromV1 : undefined),
});

describe('applying the schema at boot', () => {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  let name: string;
  let db: Client;

  const columns = async () =>
    (
      await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'person' ORDER BY column_name",
      )
    ).rows.map((r) => r.column_name);

  const recorded = async () =>
    (await db.query('SELECT version FROM fkmtime.schema_version')).rows.map(
      (r) => r.version,
    );

  beforeAll(() => admin.connect());
  afterAll(() => admin.end());

  // Each test gets a database of its own, never the one the other specs use
  beforeEach(async () => {
    name = `fkmtime_apply_schema_${randomBytes(4).toString('hex')}`;
    await admin.query(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${name}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
  });

  afterEach(async () => {
    await db.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
  });

  it('creates the schema in an empty database and records its version', async () => {
    expect(await applySchema(db, v1)).toEqual({
      kind: 'created',
      version: V1,
    });

    expect(await columns()).toEqual(['id']);
    expect(await recorded()).toEqual([V1]);
  });

  it('leaves a database on the same version alone', async () => {
    await applySchema(db, v1);

    expect(await applySchema(db, v1)).toEqual({
      kind: 'unchanged',
      version: V1,
    });
    expect(await recorded()).toEqual([V1]);
  });

  it('upgrades a database on an earlier version with its script', async () => {
    await applySchema(db, v1);
    await db.query(`INSERT INTO "person" ("id") VALUES ('p1')`);

    expect(
      await applySchema(db, v2('ALTER TABLE "person" ADD COLUMN "name" TEXT;')),
    ).toEqual({ kind: 'upgraded', from: V1, version: V2 });

    expect(await columns()).toEqual(['id', 'name']);
    expect(await recorded()).toEqual([V2]);
    // The data recorded so far stays
    expect((await db.query('SELECT id FROM "person"')).rows).toEqual([
      { id: 'p1' },
    ]);
  });

  it('leaves the database on its version when the upgrade fails', async () => {
    await applySchema(db, v1);

    await expect(
      applySchema(
        db,
        v2(
          'ALTER TABLE "person" ADD COLUMN "name" TEXT; ALTER TABLE "missing" ADD COLUMN "x" TEXT;',
        ),
      ),
    ).rejects.toThrow('"missing" does not exist');

    expect(await columns()).toEqual(['id']);
    expect(await recorded()).toEqual([V1]);
  });

  it('refuses a version it has no script for', async () => {
    await applySchema(db, v1);
    const v3: SchemaSql = {
      ...v2(''),
      version: '3'.repeat(64),
      from: () => undefined,
    };

    await expect(applySchema(db, v3)).rejects.toThrow(SchemaRefused);
    expect(await recorded()).toEqual([V1]);
  });

  it('refuses a database set up without a recorded version', async () => {
    await db.query('CREATE TABLE "person" ("id" TEXT NOT NULL PRIMARY KEY)');

    await expect(applySchema(db, v1)).rejects.toThrow(SchemaRefused);
  });
});
