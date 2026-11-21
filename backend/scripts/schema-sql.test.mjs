// node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { unsafeStatements } from './schema-sql.mjs';

// Scripts in the shape `prisma migrate diff --script` writes them
const reasons = (sql) => unsafeStatements(sql).map((f) => f.why);

test('a new table, its unique index and required columns are safe', () => {
  const sql = `-- CreateTable
CREATE TABLE "badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_code_key" ON "badge"("code");
`;
  assert.deepEqual(reasons(sql), []);
});

test('an optional column, a column with a default and a new enum value are safe', () => {
  const sql = `-- AlterEnum
ALTER TYPE "H2hSide" ADD VALUE 'C';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0;
`;
  assert.deepEqual(reasons(sql), []);
});

test('dropping a column is flagged', () => {
  const sql = `-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar_url",
ADD COLUMN     "nickname" TEXT;
`;
  assert.deepEqual(reasons(sql), ['drops a column']);
});

test('a required column with no default on an existing table is flagged', () => {
  const sql = `-- AlterTable
ALTER TABLE "users" ADD COLUMN     "level" INTEGER NOT NULL;
`;
  assert.deepEqual(reasons(sql), [
    'adds a required column with no default: fails if the table has rows',
  ]);
});

test('making a column required or unique on an existing table is flagged', () => {
  const sql = `-- AlterTable
ALTER TABLE "users" ALTER COLUMN "avatar_url" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_tag_key" ON "users"("tag");
`;
  assert.deepEqual(reasons(sql), [
    'makes a column required: fails if a row has no value',
    'adds a unique constraint: fails if existing rows clash',
  ]);
});

test('removing an enum value is flagged', () => {
  const sql = `-- AlterEnum
CREATE TYPE "H2hSide_new" AS ENUM ('A');
ALTER TABLE "h2h_match" ALTER COLUMN "winner_side" TYPE "H2hSide_new" USING ("winner_side"::text::"H2hSide_new");
ALTER TYPE "H2hSide" RENAME TO "H2hSide_old";
ALTER TYPE "H2hSide_new" RENAME TO "H2hSide";
DROP TYPE "H2hSide_old";
`;
  assert.deepEqual(reasons(sql), [
    "changes a column's type",
    'removes an enum value',
  ]);
});

test('dropping a table is flagged', () => {
  assert.deepEqual(reasons('-- DropTable\nDROP TABLE "live_clear";\n'), [
    'drops a table',
  ]);
});
