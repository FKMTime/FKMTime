#!/usr/bin/env node
// Turns on strictNullChecks one file at a time. TypeScript can't enable the
// flag per file, so this runs `tsc --strictNullChecks` over the whole backend
// and holds each file to a baseline instead:
//
// - a file not in strict-null-baseline.txt must have no errors, so new and
//   fixed code stays strict;
// - a file in it that has no errors any more must be taken off the list, so
//   the list only shrinks.
//
// When the list is empty, set strictNullChecks in tsconfig.json and delete
// this script, the list and the CI step that runs it.
//
//   node scripts/check-strict-null.mjs            check against the baseline
//   node scripts/check-strict-null.mjs --update   rewrite the baseline

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(backend, 'strict-null-baseline.txt');

const tsc = spawnSync(
  process.execPath,
  [
    join(backend, 'node_modules/typescript/bin/tsc'),
    '--noEmit',
    '-p',
    'tsconfig.json',
    '--strictNullChecks',
    '--pretty',
    'false',
  ],
  { cwd: backend, encoding: 'utf8', maxBuffer: 64 << 20 },
);

// file -> its error lines
const errors = new Map();
for (const line of tsc.stdout.split('\n')) {
  const match = line.match(/^(.+?\.ts)\(\d+,\d+\): error TS\d+/);
  if (!match) continue;
  if (!errors.has(match[1])) errors.set(match[1], []);
  errors.get(match[1]).push(line);
}
if (tsc.status !== 0 && errors.size === 0) {
  // tsc failed for some other reason (a config error, a crash)
  process.stderr.write(tsc.stdout + tsc.stderr);
  process.exit(1);
}

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, [...errors.keys()].sort().join('\n') + '\n');
  console.log(`Wrote ${errors.size} file(s) to strict-null-baseline.txt`);
  process.exit(0);
}

const baseline = new Set(
  readFileSync(baselinePath, 'utf8').split('\n').filter(Boolean),
);
const newlyFailing = [...errors.keys()].filter((f) => !baseline.has(f));
const nowPassing = [...baseline].filter((f) => !errors.has(f));

for (const file of newlyFailing) {
  console.log(`${file} must pass strictNullChecks:`);
  for (const line of errors.get(file)) console.log(`  ${line}`);
}
for (const file of nowPassing) {
  console.log(
    `${file} passes strictNullChecks now: take it off strict-null-baseline.txt`,
  );
}

const total = [...errors.values()].reduce((n, lines) => n + lines.length, 0);
console.log(`strictNullChecks: ${total} error(s) in ${errors.size} file(s)`);
process.exitCode = newlyFailing.length || nowPassing.length ? 1 : 0;
