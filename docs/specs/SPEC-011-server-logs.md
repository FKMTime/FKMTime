# SPEC-011: Server logs for admins, replacing Dozzle

- **Status:** Implemented
- **Created:** 2026-11-17
- **Related:** SPEC-009 (live device logs), #710, #711,
  FKMTime/micro-connector#30 (`log_subscriber.rs`), FKMTime/fim#12

## Problem

When something goes wrong on the server during a competition (results don't
reach the WCA, a station can't talk to the backend, the connector keeps
dropping stations), the backend's and the connector's own output is where the
answer is. Today an admin reads it in Dozzle, at `/logs` on the instance,
behind a separate login.

Dozzle is the wrong tool to keep on a competition router:

- It mounts `/var/run/docker.sock`, which is root on the host, and the fim
  templates publish its port `8080` directly. That skips nginx, and anyone
  on the venue's network can reach it. Only Dozzle's own simple login stands
  in the way.
- It adds two containers, `dozzle` and `dozzle-init`, to a router that
  already struggles with disk writes.
- Every instance needs its own bcrypt hash generated for that login.

The panel already shows station logs to admins (SPEC-009). It can't show the
rest, because the backend and most of the connector only print to their
container's console. The connector writes only two kinds of files: one per
station, and `unix.log`, the messages it exchanges with the backend.

## Goals

- An admin can watch the backend's log, the connector's log and the
  connector ↔ backend messages live in the panel, and download each of them,
  without SSH or Dozzle.
- Recent history shows first, as for station logs.
- Only admins can read them, enforced by the backend.
- Log files can't fill the disk: each one is capped.
- Dozzle is gone from every compose file, the nginx config and the panel.

## Non-goals

- Logs of nginx, Postgres, the frontend container or the dummy WCA services.
  When those matter, `docker logs` over SSH still works.
- Reading logs while the backend is down. The viewer goes through the
  backend, so a backend that won't start needs SSH. That's the one thing
  Dozzle could do that this can't.
- Search across files or days, or keeping more than one older file per log.
- Any change to station logs (SPEC-009), the log format, or what gets logged.
- Access for organisers, delegates or other roles. These logs contain user
  ids, round ids and the connector's raw messages, so they stay admin-only.

## Design

### Log sources

The panel offers a fixed list of server logs. The client sends only a source
name from this list, never a path.

| Source | Label in the panel | File | Written by |
|---|---|---|---|
| `backend` | Backend | `backend.log` in `BACKEND_LOGS_DIR` | backend (new) |
| `connector` | Connector | `connector.log` in `DEVICE_LOGS_DIR` | connector (new) |
| `unix` | Connector ↔ backend messages | `unix.log` in `DEVICE_LOGS_DIR` | connector (exists) |

`DEVICE_LOGS_DIR` is the connector's logs folder, already mounted read-only
into the backend by SPEC-009. `BACKEND_LOGS_DIR` is new (see below).

### Backend writes its own log

When `BACKEND_LOGS_DIR` is set, the backend copies everything it prints to
`backend.log` in that folder:

- At the very start of `main.ts`, before Nest boots, `process.stdout.write`
  and `process.stderr.write` are wrapped so each chunk also goes to an
  append-mode write stream. This catches Nest's logger, `console.*`, and
  Prisma's errors alike, without touching the 30-odd call sites.
- Node prints a fatal uncaught exception from native code, so the wrapper
  never sees it. A `process.on('uncaughtExceptionMonitor')` listener appends
  the stack synchronously instead. It only observes, so crash behaviour
  doesn't change.
- **Cap:** when the file would pass 10 MB, it's renamed to `backend.log.1`
  (replacing any older one), and a new `backend.log` starts. At most ~20 MB
  on disk.
- If the folder is missing or not writable, the backend logs one warning to
  the console and carries on. Logging to a file must never stop the backend.
- `BACKEND_LOGS_DIR` is optional in `env.validation.ts`. Unset means no
  file, and the Backend tab says the log isn't available.

The backend's folder is separate from the connector's because the backend
mounts the connector's folder read-only and should keep doing so.

### Connector writes its console output to a file

A small change in FKMTime/micro-connector's `log_subscriber.rs`: every line
it prints to stdout is also appended to `connector.log` in `DEVICE_LOGS`,
byte for byte, so its ANSI level colours stay in. The panel's log view
already colours those (SPEC-009). Lines that already go to a named
file (station logs, `unix.log`) aren't copied.

Same cap as the backend: 10 MB, then rotate to `connector.log.1`. The
station files and `unix.log` stay uncapped, as today (SPEC-009 measured
100–250 KB per station per day).

### Following, snapshots and downloads

SPEC-009's tailing is reused as it is: a snapshot of the last 500 lines from
the last 256 KB, one follower per file polling every second, batches capped
at 1000 lines with a `skipped` count, and a fresh snapshot when the file
shrinks or is replaced.

A rotation is a replaced file (new inode), so watchers get a fresh snapshot
of the new, nearly empty file. The lines before the rotation are in
`<file>.1`, which the panel doesn't offer (open question 1).

The following code moves out of `DeviceLogService` into a shared
`LogFollowers` class (`backend/src/logging/`), keyed by a string. Device logs
keep their behaviour and their events, keyed by device id. Server logs have
their own `LogFollowers` in `ServerLogService`, keyed by source.

### Download endpoint

`GET /server-logs/:source`, guarded by `AdminGuard`, in a new
`ServerLogController`.

- Streams the current file up to its size at request time, as
  `text/plain; charset=utf-8` with
  `Content-Disposition: attachment; filename="<source>-<UTC date>.log"`.
- `400` for a source not in the list. `404` when the file doesn't exist yet.
  `503` when its folder variable is unset or the folder is missing.

### Socket.io

A room per source, `serverLogs-<source>`, guarded by `AdminGuard`:

| Direction | Event | Payload |
|---|---|---|
| client → server | `joinServerLogs` | `{ source }` |
| client → server | `leaveServerLogs` | `{ source }` |
| server → client | `serverLogSnapshot` | `{ source, available, lines, truncated }` |
| server → client | `serverLogLines` | `{ source, lines, skipped }` |

Same semantics as the SPEC-009 events. An unknown source is ignored.

### Frontend

- **Page:** a new **Server logs** page at `/logs`, the URL people already
  use for Dozzle. Only admins can open it. Others get the "not found" page,
  and the backend refuses them anyway.
- **Entry point:** the **Logs** button on the Competition page becomes
  **Server logs**, links to `/logs` in the same tab, and shows only for
  admins. It no longer depends on `import.meta.env.PROD`.
- **Layout:** tabs for **Backend**, **Connector** and **Connector ↔ backend
  messages**. The open tab joins its room through `useSocketRoom`, and is
  kept in the `?tab=` search param like the Devices page tabs.
- **The log view** is the one from `DeviceLogsSheet`, moved into a shared
  `LogView` component: ANSI colours, follow at the bottom, "Jump to latest", the
  filter box, the 5000-line limit, the Download button.
- **Messages:**
  - `available: false`: "This log isn't available on this server."
  - Connector tab with no file: "No connector log yet. Older connectors
    don't write one; update the connector to get it."
  - Other empty logs: "Nothing logged yet."
  - The SPEC-009 `truncated` and `skipped` rows, unchanged.

### Removing Dozzle

In this repo, in the same PR as the frontend page, because nginx's `/logs`
location would otherwise send the new page to Dozzle:

- `nginx/default.conf`: remove the `location ^~ /logs` block.
- `docker-compose-bundled.yml`: remove the commented-out `dozzle` service.
- `.gitignore`: remove the `dozzle/*` entries.
- SPEC-009: point its "connector's own log" non-goal at this spec.

In fim, `templates/prod` and `templates/dev`:

- Remove `dozzle-init`, `dozzle`, and the `DOZZLE_*` variables and their docs
  in `.env.template`.
- The connector's logs were already mounted into the backend
  (`./logs:/device-logs:ro`, fim #11), so this needs no change.
- Add `./logs/backend:/backend-logs` (read-write) and
  `BACKEND_LOGS_DIR=/backend-logs` to the backend.

The dev `docker-compose.yml` and `docker-compose-bundled.yml` get
`BACKEND_LOGS_DIR=/backend-logs` on a `backend-logs` named volume, so each
dev stack keeps its own.

### Edge cases

- **Backend restart:** the write stream reopens in append mode, so the log
  continues where it was. Watchers reconnect and get a fresh snapshot.
- **Backend crash loop:** each crash's stack is in `backend.log`, but the
  panel is down while the backend is. SSH is the fallback.
- **Old connector:** no `connector.log`. The tab says so; the other two tabs
  work.
- **Two backend processes writing one file** (not a supported setup): lines
  may interleave. Not handled.
- **Disk full:** the write stream errors. The backend logs one warning to the
  console, stops writing the file, and keeps serving.

## Acceptance criteria

- [x] The backend copies stdout and stderr to `backend.log`, and an uncaught
      exception's stack lands in it (unit test on a temp folder).
- [x] `backend.log` rotates to `backend.log.1` past 10 MB, keeping one older
      file (unit test with a small cap).
- [x] An unwritable `BACKEND_LOGS_DIR` logs a warning and the backend still
      starts (unit test).
- [x] The connector copies its stdout lines to `connector.log` and rotates it
      past 10 MB (connector unit test).
- [x] `joinServerLogs` is rejected for an organiser, accepted for an admin,
      and ignores an unknown source (e2e).
- [x] `GET /server-logs/:source` returns the file for an admin, `403` for an
      organiser, `400` for an unknown source, `404` for a missing file, and
      `503` without the folder (e2e).
- [x] An admin gets the backend log's snapshot, then a new line (backend e2e
      with a temporary `BACKEND_LOGS_DIR`).
- [x] Device logs behave exactly as before after the follower refactor (the
      existing SPEC-009 tests pass unchanged).
- [x] The Server logs page is reachable only for admins, and the Server logs
      button shows only for admins (component tests).
- [x] Each tab shows its empty and unavailable messages (component test).
- [x] No `dozzle` left in this repo's code and config, or in the fim
      templates (grep; the specs still tell the story).

## Rollout

No migration. Order:

1. **Connector:** release the `connector.log` change. Harmless on its own.
2. **FKMTime:** backend, frontend, the compose files and the nginx change in
   one PR. Until fim is updated, the Backend tab says "not available", and
   `/logs` shows the new page instead of Dozzle.
3. **fim templates:** remove Dozzle, add the backend log mount. Existing instances get
   them when their compose is regenerated or edited by hand. On the live
   instance, `docker compose rm -sf dozzle dozzle-init` removes the old
   containers. That's a prod change, so it's done on its own, with a go.

Reverting the FKMTime PR brings back a `/logs` link to a Dozzle that's no
longer there. Re-adding Dozzle to fim would be part of that revert.

## Open questions

1. **Downloading the rotated file.** Should Download offer `<source>.log.1`
   too, so the previous 10 MB survives a rotation in the panel? Proposed: no
   for now. The backend logs every request, so measure how fast `backend.log`
   grows on a competition day first, and revisit if it rotates mid-day.
