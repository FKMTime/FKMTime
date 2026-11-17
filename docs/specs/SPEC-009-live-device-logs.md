# SPEC-009: Live device logs for admins

- **Status:** Implemented
- **Created:** 2026-11-15
- **Related:** SPEC-008 (station Wi-Fi signal), FKMTime/micro-connector
  (`log_subscriber.rs`, `on_log_packet`), fim instance templates

## Problem

When a station misbehaves during a competition (timeouts, a card that won't
read, a reboot loop), the station's own log is the first thing to look at.
Today the only way to read it is to SSH into the machine running the
connector, find `logs/device_<HEX>.log`, and work out which hex id belongs
to which station. At a venue that usually means a laptop, the router's
current IP, and someone who knows the layout of the instance folder.

The admin who is already logged into the panel can't see any of it, even
though the backend and the connector share the same host.

## Goals

- An admin can open any station's log from the Devices page and watch new
  lines appear as the connector writes them, without SSH.
- Opening it shows recent history first (the last few hundred lines), so
  "what just happened" is answerable, not only "what happens next".
- An admin can download a station's whole log file, so older history doesn't
  need SSH either.
- Only admins can read logs. Organisers, delegates and other roles can't,
  not even by sending the socket event or calling the endpoint by hand.
- An instance whose backend can't see the log files keeps working and says
  so, instead of showing an empty log.
- No connector or firmware change. The feature uses the files the connector
  already writes.

## Non-goals

- Storing logs in the database, or searching across days or stations.
- The connector's own log (`unix.log`) and container logs. Dozzle already
  covers containers at `/logs`.
- Changing what the stations or the connector log, or the log format.
- Correcting timestamps. Station lines are batched on the station, so their
  timestamp is when the connector received them (see Edge cases).
- Deleting or rotating log files from the panel.
- Access for Delegates, organisers or other roles. Station logs include the
  UID of every card scanned (`rfid.rs`), so they stay admin-only.

## Design

### Where the logs are today

The connector writes one file per station into `DEVICE_LOGS` (`/logs` in
its container), named `device_<espId in upper-case hex, no padding>.log`,
for example `device_2806C23.log`. It opens each file in append mode and
never rotates or truncates it. A competition day produces roughly
100–250 KB per station.

Each line is

```
<UTC RFC 3339, microseconds> <LEVEL, right-aligned to 5> <target>: <text>
```

Lines the station sent have `INFO` as the connector-side level, and their
text starts with the station's own level letter (`E`, `W`, `I`, `D`, `T`),
wrapped in an ANSI colour code and a reset. The connector's own lines
("Client connected", "Closing connection (due to no heartbeat)",
"LOGS TRUNCATED!", crash log dumps) have no colour codes.

On the host, that folder is:

| Setup | Host folder |
|---|---|
| fim instance (prod and dev templates) | `./logs` in the instance folder |
| `docker-compose-bundled.yml` | the `logs` named volume |
| `docker-compose.yml` (dev) | `/tmp/fkm-logs` |

### Making the files visible to the backend

Each compose file mounts the same folder into the backend **read-only** at
`/device-logs`, and sets `DEVICE_LOGS_DIR=/device-logs`:

- `docker-compose.yml`: `/tmp/fkm-logs:/device-logs:ro`
- `docker-compose-bundled.yml`: `logs:/device-logs:ro`
- fim `templates/prod` and `templates/dev`: `./logs:/device-logs:ro`

`DEVICE_LOGS_DIR` is optional in `env.validation.ts`. When it's unset, or
the folder doesn't exist, the feature is unavailable (see below), and the
rest of the backend is unaffected.

### Backend

A `DeviceLogService` in `device/` owns the tailing. Nothing is written to
the database.

- **File name:** built from the device's `espId` in the database,
  `device_${espId.toString(16).toUpperCase()}.log`, inside
  `DEVICE_LOGS_DIR`. The client never sends a file name or an esp id, only
  a device id, so there's no path to traverse.
- **Snapshot:** read up to the last 256 KB of the file and keep the last
  500 complete lines. The file isn't read from the start, so a file that
  has grown over several days costs the same.
- **Following:** one follower per file, started when the first admin
  subscribes to that station and stopped when the last one leaves or
  disconnects. It polls the file size every second, as the rest of the
  dev stack does (file events don't cross bind mounts reliably on macOS),
  reads from the last offset to the new size, and keeps any trailing
  partial line until its newline arrives.
- **Batching:** all complete lines from one poll go out as one event. At
  most 1000 lines per event. Beyond that the backend sends the newest 1000
  and a `skipped` count, so a station dumping a crash log can't flood the
  admin's browser.
- **File shrank or was replaced** (size below the last offset, or a
  different inode): the follower starts again from the end and sends a
  fresh snapshot, in case someone cleared the folder by hand.
- **File doesn't exist yet** (a station that has never connected to this
  connector): an empty snapshot, and the follower keeps polling until it
  appears.

### Download endpoint

`GET /device/:id/logs`, guarded by `AdminGuard`, in `DeviceController`.

- Streams the station's file as it is on disk, colour codes included, as
  `text/plain; charset=utf-8` with
  `Content-Disposition: attachment; filename="<station name>-<UTC date>.log"`.
  The station name is reduced to letters, digits, `-` and `_`, so the header
  can't be broken by a name like `Station "A"`.
- Reads only up to the size the file had when the request arrived. Lines
  written while it streams aren't included, so the download never ends in
  the middle of a line.
- `404` for an unknown device, a device without an `espId`, or a file that
  doesn't exist yet. `503` when `DEVICE_LOGS_DIR` is unset or missing.
- The file name comes from the database, as for the live view.
- CORS exposes `Content-Disposition`, so a panel on another origin (the
  dev stack) can read the file name too.

### Socket.io

A room per station, `deviceLogs-<deviceId>`, guarded by `AdminGuard` on
both events:

| Direction | Event | Payload |
|---|---|---|
| client → server | `joinDeviceLogs` | `{ deviceId }` |
| client → server | `leaveDeviceLogs` | `{ deviceId }` |
| server → client | `deviceLogSnapshot` | `{ deviceId, available, lines, truncated }` |
| server → client | `deviceLogLines` | `{ deviceId, lines, skipped }` |

- `deviceLogSnapshot` goes only to the socket that joined, and replaces
  whatever the client has. Because `useSocketRoom` joins again on every
  reconnect, a reconnect gets a fresh snapshot instead of a gap or
  duplicated lines.
- `available: false` with no lines means the backend can't read the logs
  folder (`DEVICE_LOGS_DIR` unset or missing).
- `truncated: true` means there's older history in the file than the
  snapshot holds.
- `deviceLogLines` goes to the room. `skipped` is `0` unless the batch was
  capped.
- An unknown device id, or a device without an `espId`, gets an
  `available: true` snapshot with no lines. The panel only offers the
  action for devices with an `espId` anyway.

`AdminGuard` already reads the token from the socket handshake, so it works
on gateway events the same way `OrganizerGuard` does for `joinDevices`.

### Frontend (Devices page)

- A **View logs** action in the ⋮ menu of each device that has an `espId`,
  in both the table and the card view (`DeviceItem.tsx`). Attendance
  devices connect through the connector too, so they have logs like
  stations. It's shown only when `isAdmin()`. The backend still enforces
  this through the guard.
- It opens a `Sheet` from the right, titled with the station's name, so
  the device list stays visible behind it. The sheet joins the room through
  `useSocketRoom("DeviceLogs", { params: { deviceId } })` while it's open.
- **The log:** monospaced, one row per line, newest at the bottom.
  - ANSI colour codes 31–35 and the reset become coloured spans. Any other
    escape sequence is removed. Nothing is rendered as HTML.
  - The view follows new lines while scrolled to the bottom. When the admin
    scrolls up, it stops following and shows a "Jump to latest" button.
  - At most 5000 lines in memory. Older ones drop off the top.
  - A filter box narrows the shown lines by text, without affecting what's
    kept.
- A **Download** button in the sheet header calls the endpoint with the
  admin's token, the same way other API calls are made, and saves the
  response as a file through an object URL. It's hidden when the snapshot
  says `available: false`, and shows an error toast on a `404` or `503`.
- **Messages in the sheet:**
  - `available: false`: "Device logs aren't available on this server. The
    backend can't see the connector's logs folder."
  - no lines: "No logs from this station yet."
  - `truncated: true`: a line at the top, "Older lines aren't shown.
    Download the file to see them all."
  - `skipped > 0`: an inline row, "… N lines skipped".
  - A short note under the title: "Times are when the connector received
    each line. Lines sent after a reconnect arrive together."

### Edge cases

- **Wi-Fi drop:** the station buffers its lines and sends them all after
  reconnecting. They arrive as one batch with almost the same timestamp,
  which the note above explains.
- **Two admins on the same station:** one follower, both in the room.
- **Admin closes the tab without leaving:** socket.io removes the socket
  from the room on disconnect. The follower checks the room size on each
  poll and stops when it's empty.
- **Backend restart:** followers are gone. Clients reconnect, rejoin, and
  get a fresh snapshot.
- **Connector on another host** (not a supported setup today): the folder
  isn't there, and the sheet says logs aren't available.
- **Station re-registered under a new esp id:** the device row points at the
  new file. The old file stays on disk and isn't shown.

## Acceptance criteria

- [x] File name from `espId`: upper-case hex, no padding (unit test).
- [x] The snapshot returns the last 500 lines of a file bigger than 256 KB,
      sets `truncated`, and never starts with a partial line (unit test).
- [x] The follower sends only complete new lines, keeps a partial line until
      its newline arrives, and caps a batch at 1000 with `skipped` (unit
      test on a temp file).
- [x] A file that shrinks causes a fresh snapshot (unit test).
- [x] A missing file gives an empty snapshot, then lines once it appears
      (unit test).
- [x] With `DEVICE_LOGS_DIR` unset, the snapshot is `available: false` and
      the backend starts normally (unit test).
- [x] `joinDeviceLogs` is rejected for an organiser and accepted for an
      admin (e2e).
- [x] `GET /device/:id/logs` returns the file for an admin with the
      attachment header and a cleaned-up name, `403` for an organiser, `404`
      for a device without an `espId` or without a file, and `503` without
      `DEVICE_LOGS_DIR` (e2e).
- [x] The download stops at the size the file had when the request arrived
      (unit test on a file appended to mid-stream).
- [x] The follower stops when the last subscriber leaves or disconnects
      (unit test).
- [x] The log view colours ANSI levels, strips other escape sequences, and
      renders `<b>` as text, not markup (component test).
- [x] The view follows new lines at the bottom, stops when scrolled up, and
      "Jump to latest" resumes (component test).
- [x] The Download button saves the file, and shows an error toast on a
      `404` (component test with a mocked API).
- [x] The View logs action is hidden for non-admins and for devices without an
      `espId` (component test).
- [x] An admin gets the snapshot of a real file, then a line appended to it
      (backend e2e with a temporary `DEVICE_LOGS_DIR`). The e2e station
      helper talks to the backend without a connector, so it can't write a
      device log for a Playwright test.

## Rollout

No migration. Ship order:

1. **Backend and frontend.** Without the volume, every instance shows "Device
   logs aren't available on this server", and nothing else changes.
2. **Compose files** in this repo, in the same PR.
3. **fim templates.** Existing fim instances get the mount when their compose
   is regenerated or edited by hand. Until then, they show the unavailable
   message.

Reverting the backend leaves the extra read-only mount unused and harmless.
