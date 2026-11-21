#!/usr/bin/env node
// Generates the SQL that src/db/apply-schema.ts applies at boot, so the image
// needs no Prisma CLI, no Prisma engine and no OpenSSL. Runs wherever the CLI
// already works: the image's build stage, CI and developer machines.
//
//   node scripts/schema-sql.mjs create     prisma/sql/create.sql and version
//   node scripts/schema-sql.mjs create <ref> <dir>
//                                          the same for the schema at <ref>
//   node scripts/schema-sql.mjs upgrades   prisma/sql/from-<version>.sql for
//                                          every earlier schema.prisma since
//                                          FIRST_COMMIT; needs git history
//   node scripts/schema-sql.mjs unsafe <ref>
//                                          lists what the change from <ref>'s
//                                          schema could break on a live
//                                          database; exits 2 if anything
//
// A version is the SHA-256 of schema.prisma, so the same file always has the
// same version wherever it is built.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The last commit on main before databases recorded their schema version. No
// database can be on a version older than the schema here.
const FIRST_COMMIT = '600f6136f7b1ebe76b67db6226c702e59c49bbc0';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(backend, 'prisma/schema.prisma');
const outDir = join(backend, 'prisma/sql');
const prismaBin = join(backend, 'node_modules/prisma/build/index.js');

const versionOf = (schema) => createHash('sha256').update(schema).digest('hex');

const migrateDiff = (from, to) =>
  execFileSync(
    process.execPath,
    [prismaBin, 'migrate', 'diff', ...from, ...to, '--script'],
    {
      cwd: backend,
      encoding: 'utf8',
      env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );

/** Runs `work` with each schema written to a file of its own */
const withSchemaFiles = (schemas, work) => {
  const dir = mkdtempSync(join(tmpdir(), 'fkmtime-schema-'));
  try {
    const paths = schemas.map((schema, i) => {
      const path = join(dir, `${i}.prisma`);
      writeFileSync(path, schema);
      return path;
    });
    return work(paths);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** The SQL taking schema `from` to schema `to` */
const upgradeSql = (from, to) =>
  withSchemaFiles([from, to], ([fromPath, toPath]) =>
    migrateDiff(['--from-schema', fromPath], ['--to-schema', toPath]),
  )
    // Prisma wraps an enum change in its own transaction; apply-schema already
    // runs each script in one, which an inner COMMIT would end early
    .split('\n')
    .filter((line) => line !== 'BEGIN;' && line !== 'COMMIT;')
    .join('\n');

const git = (...args) =>
  execFileSync('git', args, { cwd: backend, encoding: 'utf8', maxBuffer: 64 << 20 });

const schemaAt = (commit) => {
  const repoPath = relative(git('rev-parse', '--show-toplevel').trim(), schemaPath);
  return git('show', `${commit}:${repoPath}`);
};

/** With a ref and a directory, writes the schema as it was at that ref */
function create(ref, dir = outDir) {
  const schema = ref ? schemaAt(ref) : readFileSync(schemaPath, 'utf8');
  mkdirSync(dir, { recursive: true });
  const createSql = withSchemaFiles([schema], ([path]) =>
    migrateDiff(['--from-empty'], ['--to-schema', path]),
  );
  writeFileSync(join(dir, 'create.sql'), createSql);
  writeFileSync(join(dir, 'version'), `${versionOf(schema)}\n`);
}

function upgrades() {
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
    throw new Error('Needs the full git history: check out with fetch-depth: 0');
  }
  const current = readFileSync(schemaPath, 'utf8');
  const currentVersion = versionOf(current);
  const commits = [
    FIRST_COMMIT,
    ...git('log', '--format=%H', `${FIRST_COMMIT}..HEAD`, '--', schemaPath)
      .split('\n')
      .filter(Boolean),
  ];
  const earlier = new Map();
  for (const commit of commits) {
    const schema = schemaAt(commit);
    const version = versionOf(schema);
    if (version !== currentVersion) earlier.set(version, schema);
  }
  mkdirSync(outDir, { recursive: true });
  for (const [version, schema] of earlier) {
    writeFileSync(join(outDir, `from-${version}.sql`), upgradeSql(schema, current));
  }
  console.log(`Wrote ${earlier.size} upgrade script(s) to ${relative(backend, outDir)}`);
}

// What a statement does that can lose data or fail on a database that already
// has rows. Statements on a table the same script creates can't do either.
const UNSAFE = [
  [/\bDROP TABLE\b/, 'drops a table'],
  [/\bDROP COLUMN\b/, 'drops a column'],
  [/\bALTER COLUMN "[^"]+" (SET DATA )?TYPE\b/, "changes a column's type"],
  [/\bSET NOT NULL\b/, 'makes a column required: fails if a row has no value'],
  [/\bADD COLUMN\s+"[^"]+"[^,;]*\bNOT NULL\b(?![^,;]*\bDEFAULT\b)/, 'adds a required column with no default: fails if the table has rows'],
  [/\bDROP TYPE\b/, 'removes an enum value'],
  [/\bCREATE UNIQUE INDEX\b/, 'adds a unique constraint: fails if existing rows clash'],
];

export function unsafeStatements(sql) {
  const statements = sql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
  const created = new Set(
    statements.flatMap((s) => [...s.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1])),
  );
  const findings = [];
  for (const statement of statements) {
    const table = statement.match(/(?:ALTER TABLE|ON) "([^"]+)"/)?.[1];
    if (table && created.has(table)) continue;
    for (const [pattern, why] of UNSAFE) {
      if (pattern.test(statement)) findings.push({ statement, why });
    }
  }
  return findings;
}

function unsafe(ref) {
  if (!ref) throw new Error('Usage: schema-sql.mjs unsafe <git ref>');
  const findings = unsafeStatements(upgradeSql(schemaAt(ref), readFileSync(schemaPath, 'utf8')));
  if (findings.length === 0) {
    console.log(`The schema change from ${ref} is safe to apply to a live database`);
    return;
  }
  console.log(`The schema change from ${ref} can lose data or fail on a live database:\n`);
  for (const { statement, why } of findings) console.log(`- ${why}:\n    ${statement.replace(/\n/g, '\n    ')}\n`);
  process.exitCode = 2;
}

const commands = { create, upgrades, unsafe };
const [command, ...args] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!commands[command]) {
    console.error(`Usage: schema-sql.mjs ${Object.keys(commands).join(' | ')}`);
    process.exit(1);
  }
  commands[command](...args);
}
