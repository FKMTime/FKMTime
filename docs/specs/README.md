# Specs

Specs describe a change before it is built: what problem it solves, what it
must do, and how we will know it is done. They are written for both people and
AI agents, so an agent can pick up a spec and implement it without a long
back-and-forth.

## When to write one

Write a spec for anything that touches more than one part of the system
(backend, frontend, station firmware, connectors), changes the database or the
socket.io protocol, or changes how a competition runs on the day. Small bug
fixes and dependency bumps don't need one.

## Naming

```
SPEC-NNN-short-kebab-slug.md
```

- `NNN` is exactly three digits: `SPEC-007-…`, not `SPEC-7-…`.
- Take the next free number on `main` when you start the spec.
- The id is what everyone cites — in PRs, commits, code comments and other
  specs. Don't renumber a spec once it has been merged.

Two branches can pick the same number at the same time. The
[Specs workflow](../../.github/workflows/specs.yml) fails when two files share
an id; if it fails on your PR, take the next free number.

## Writing one

Copy [`SPEC-000-template.md`](SPEC-000-template.md) and fill it in. Leave out
sections that don't apply rather than writing "N/A".

Update `Status` as the spec moves:

| Status        | Meaning                                        |
|---------------|------------------------------------------------|
| `Draft`       | Being written or discussed                     |
| `Accepted`    | Agreed on, ready to build                      |
| `Implemented` | Shipped; the spec now describes how it works   |
| `Superseded`  | Replaced — link the spec that replaces it      |

## Index

| Id | Title | Status |
|----|-------|--------|
