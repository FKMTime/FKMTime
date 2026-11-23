# SPEC-014: Rewriting the micro connector into the backend

- **Status:** Draft
- **Created:** 2026-11-20
- **Related:** [FKMTime/micro-connector](https://github.com/FKMTime/micro-connector),
  `backend/src/socket/`, [FKMTime/fim](https://github.com/FKMTime/fim)
  (`templates/prod/docker-compose.yml`), the firmware simulator
  ([FKMTime/firmware](https://github.com/FKMTime/firmware) `sim/`),
  [SPEC-008](SPEC-008-station-wifi-signal.md), [SPEC-009](SPEC-009-live-device-logs.md),
  [SPEC-010](SPEC-010-station-last-error.md), [SPEC-011](SPEC-011-server-logs.md)

## Summary

The micro connector is a separate Rust service. Stations connect to it, and it talks to the
backend over a unix socket. This spec looks at rewriting it in TypeScript as a NestJS module,
so stations connect to the backend directly and the connector and the unix socket go away.

**Verdict: feasible, worth doing, but only after a week of spikes on a real router.** Most of
the connector is plain protocol work that ports to TypeScript easily: the station websocket,
the handshake, OTA updates and log parsing. Four things decide whether it works on
competition day, and each can be tested before anyone commits to the port:

1. **mDNS.** Stations find the server only through mDNS, one advertisement per local address.
   `@homebridge/ciao` can do that, but it has to be proven on the router.
2. **Event-loop stalls.** A station whose reply is 2 s late sends a ping and drops the
   connection if no pong arrives within 3 s. The backend must never block its event loop for
   that long.
3. **Bluetooth auto-setup.** It goes through BlueZ over D-Bus, using `node-ble`, a library
   with little recent activity.
4. **The backend joins the router's host network.** So do nginx and Postgres, or they have
   to be reached differently.

The decision this spec asks for: **approve phase 0** (the spikes, about a week), and decide
on the rest once its go/no-go results are in.

## Problem

Stations hold a websocket to the connector, and the connector talks to the backend over a unix
socket in a shared Docker volume. Both run on the router at the venue (a Raspberry Pi 4 running
OpenWrt, managed by fim), next to Postgres and nginx.

The split costs us in several ways.

**Every station feature is built twice.** A station message passes through two codebases and
two serialization layers (`unix-utils` in Rust, `backend/src/socket/` in TypeScript), with no
shared definition and no test across them. Since 2026-11-01, at least six of the 24 merged
connector PRs needed a matching backend PR:

| Change | Connector PR | Backend PR |
|---|---|---|
| Firmware version on connect | FKMTime/micro-connector#14 | #560 |
| Timer and inspection running flags | FKMTime/micro-connector#18 | #562 |
| Max penalty per group | FKMTime/micro-connector#22 | #570 |
| A known device with a new sign key | FKMTime/micro-connector#25 | #557, #574 |
| Station Wi-Fi signal (SPEC-008) | FKMTime/micro-connector#29 | #679 |
| Connector log file (SPEC-011) | FKMTime/micro-connector#30 | #711 |

`AGENTS.md` has to warn that these messages "are a contract: treat changes to them as breaking
unless proven otherwise", because nothing else enforces it.

**The station protocol can't be tested here.** Backend e2e tests and the station tester start at
the unix socket. Nothing in this repository speaks the station's websocket, so the handshake,
sign keys, OTA and live logs are tested only in the connector, and only against a fake backend.

**State lives in two places.** Sign keys, device settings and connected devices are kept in both
processes. The connector turns stations away until the backend's first `ServerStatus` arrives
(FKMTime/micro-connector#16). Firmware uploaded in the panel goes to the backend and is then
relayed to the connector as base64. Device logs reach the panel through files in a shared
volume (SPEC-009).

**Two images, two moving tags.** The router pulls `fkmtime-backend:main` and
`fkmtime-micro-connector:master`. Nothing records which pair was tested together.

**Two languages for one team.** Every other part of the server stack is TypeScript. The
connector's CI builds the image but never runs its tests.

## Goals

- Stations connect to the backend directly. The connector, the unix socket and its protocol
  are gone.
- No firmware change. Stations already in the field connect, update and run rounds as before:
  same mDNS service, same websocket, same handshake, same packets.
- The station protocol is tested in this repository, end to end, from the websocket to the
  database.
- During a round, a station is never dropped because the backend was busy.
- A router can go back to the connector until the new path has run a real competition.

## Non-goals

- Changing the station protocol or the firmware. A later spec can change them, once there is
  only one side to change.
- Changing what the panel shows, apart from data it now gets directly instead of through files.
- Running the backend anywhere but next to the stations. The backend still has to be on the
  venue network.

## What has to be ported

The connector is 7.1k lines of Rust with tests and the fake backend. By job:

| Job | Rust module | Lines | In NestJS | Risk |
|---|---|---|---|---|
| Station websocket over TLS on its own port | `http.rs` | 0.4k | `ws` on a `node:https` server. The firmware uses `InsecureNoVerify`, so a fresh self-signed certificate (`openssl` is already in the image) works, as it does today | Low |
| `RandomSigned` handshake: AES-128 of the station's random and the FKMTime token, keyed by its sign key | `http.rs` | — | `node:crypto`, `aes-128-ecb`, no padding; the header added in `ws`'s `headers` event | Low |
| Station packets: card info, attempts, delegate calls, attendance, battery, `Add`, settings | `handler.rs` | 0.8k | A `StationGateway` calling the services the unix socket handlers call today; the request and response DTOs go away | Low, but it's the most code |
| OTA updates: GitHub releases every 5 min, dev builds from a directory, chunked transfer with an ack per chunk | `updater.rs`, `watchers.rs`, `github/` | 0.6k | `@nestjs/schedule` and plain TypeScript; the panel's firmware upload stops being relayed | Low |
| Live header and device logs: binary header parsing, per-device files with rotation | `log_packet.rs`, `log_subscriber.rs`, `error_log.rs` | 1.0k | TypeScript, with the Rust tests' byte vectors as fixtures. SPEC-009 streams lines in memory instead of tailing files | Low |
| mDNS: `_fkmtime._tcp`, one service per local IPv4 with `ws=wss://<that IP>:<port>` in TXT, re-created when a link comes up late | `mdns.rs` | 0.3k | `@homebridge/ciao`, one service per address (`restrictedAddresses`), plus a watcher that adds and removes services as addresses change | **Medium-high**: a station that can't find the server can't run a round. This took three hardware fixes in Rust (FKMTime/micro-connector#15, #17, #28) |
| Bluetooth auto-setup: scan, connect, write the Wi-Fi details, disconnect, every step bounded | `bluetooth.rs`, `adapter.rs` | 0.9k | `node-ble` (BlueZ over D-Bus, mounts `/run/dbus`). On macOS, the docker-adapter's HTTP API, a direct port | **Medium-high**: `node-ble` and its `dbus-next` dependency are barely maintained, and three hardware fixes need redoing (FKMTime/micro-connector#12, #13, #26) |
| Station link (SPEC-008): signal, bitrate, retries from the access point, matched by IP → MAC | `station_link/` | 0.6k | Parse `iw dev <if> station dump` (`apk add iw`) and `/proc/net/arp`. No maintained netlink library for Node | Medium. It already reports nothing off the router, so a failure is invisible, not fatal |
| Fake backend for the firmware simulator | `e2e/` | 0.8k | No equivalent: it sits behind the unix socket. See [Firmware simulator](#firmware-simulator) | Medium for firmware work |

Expect about 4–5k lines of TypeScript with tests, and **3–5 weeks for one person**,
including hardware testing. Phase 0 below narrows that estimate.

## Design

### Module

A new `backend/src/station-gateway/` module:

- **`StationServer`** starts its own HTTPS server on `STATION_PORT` (8081 on the router, as
  now), separate from the Nest HTTP app, so nginx never sees station traffic. `NO_TLS` keeps
  plain `ws` for development and the simulator.
- **The handshake** reads `id`, `ver`, `firmware`, `hw`, `random` from the query, signs
  `random` when the station has a sign key, and records the connection with its address for
  the station link. There is no "wait for `ServerStatus`" anymore. The gateway reads
  settings from the services, and accepts connections only once Nest has finished starting.
- **`StationGateway`** handles each packet by calling the services the unix socket handlers
  call today (`SocketService` and those behind it). Replies keep the request's `tag`.
- **`StationRegistry`** replaces the connector's `ConnectedDevices` and the backend's own
  connected-connector tracking. It's the one source for "online", the address, the firmware
  version, and the live state SPEC-008 and SPEC-010 keep in memory.
- **`FirmwareService`** holds the release watcher, the dev-build watcher and OTA. A panel
  upload writes to the firmware directory directly.
- **`DeviceLogService`** writes per-device logs, with the same file names and rotation as the
  connector so downloads keep working, and pushes live lines to SPEC-009's viewers without
  tailing files.
- **`MdnsService`**, **`BluetoothSetupService`** and **`StationLinkService`** are each behind
  their own env switch (`NO_MDNS`, `NO_BT` as now, and `NO_STATION_LINK`), so dev stacks,
  previews and CI run without them.

The unix socket server stays, behind `STATION_GATEWAY=0` (the default at first), until the
connector is retired. That's what makes rollback a config change.

### Keeping stations connected while the backend is busy

A station sends a probe ping when a reply is 2 s late (`WS_REPLY_LATE_MS`). It drops the link
if nothing comes back within 3 s (`WS_PROBE_TIMEOUT_MS`). `ws` answers pings on the main event
loop, so **any synchronous stall over ~3 s drops every station waiting on a reply**. Today the
connector answers pings on its own threads (FKMTime/micro-connector#27), and a busy backend
only makes replies slow.

- The gateway measures the loop with `perf_hooks.monitorEventLoopDelay` and logs the maximum
  delay each minute. Over 500 ms is a warning, and the Devices page can show it.
- Phase 0 measures the worst cases on a Pi 4 with 40 simulated stations: a WCIF import, a
  results sync to the WCA and WCA Live, and the HIL processor running.
- If any of them stall past 1 s, the fix goes there: move that work to a worker thread or
  break it up. Only if that fails does the gateway itself move to a worker thread. That would
  bring back a process-like boundary, but it would be in-process and typed.

### Restarts

Today a backend restart leaves stations connected to the connector, and their requests fail
until the backend is back. After the rewrite, stations lose the connection, rediscover the
server over mDNS and reconnect when it's back. Either way a station can't submit during a
restart. The difference is the reconnect storm: every station's TLS handshake plus its
settings at once. Phase 0 measures how long 40 stations take to come back after a restart on
a Pi 4. The target is under 15 s after the backend is healthy.

### Deployment on the router

mDNS needs multicast on the venue network and the station link needs the host's network
namespace, so the backend runs with `network_mode: host`. Bluetooth only needs `/run/dbus`,
mounted as today. Proposed fim template:

- **backend:** `network_mode: host`, listening on `127.0.0.1:5000` for HTTP and `0.0.0.0:8081`
  for stations. Mounts `/run/dbus:ro`, the firmware directory and the logs.
- **nginx:** `network_mode: host` as well, proxying `/api` to `127.0.0.1:5000`. The backend's
  HTTP port is never exposed to the venue network. The login rate limit, which trusts nginx's
  forwarded address (#732), only works if nginx is the only way in.
- **database:** published on `127.0.0.1:5432` only. `DATABASE_URL` points there.
- **micro_connector:** removed.

`nginx/default.conf` gets the upstream from an env var (it's `backend:5000` now) so the dev
stack keeps the bridge network. The dev stack (`docker-compose.yml`) stays on the bridge
network with `NO_MDNS`, `NO_BT` and `NO_STATION_LINK`, publishing 8081. Device work on macOS
uses the docker-adapter as the connector does now.

### Firmware simulator

The firmware simulator (`sim/` in FKMTime/firmware) runs the connector with its fake backend
(`e2e`), which models FKMTime well enough for scripted competitions and monkey testing.

- **Until the connector is retired:** nothing changes. The simulator keeps using the connector
  and `e2e` from the archived repository, which is valid as long as the station protocol
  doesn't change.
- **After:** the simulator points at a real backend: the dev stack with
  `STATION_GATEWAY=1 NO_TLS=1` and the test seed. That's slower to start than `e2e` but tests
  the real code. Its control commands (`hold_reply`, `release_reply`, delegate answers) become
  test-only endpoints, enabled the way the station tester is.

### Tests

- Unit tests port the connector's test vectors: handshake signatures, live header bytes,
  version comparison, the mDNS interface diff, retry percentages.
- Backend e2e tests gain a station client that connects over the real websocket and covers the
  handshake, card info, an attempt, a delegate call and an OTA. Today nothing in this
  repository can test those paths.
- The station tester calls the gateway's handlers instead of building unix socket requests.

## Acceptance criteria

- [ ] Phase 0's go/no-go results are recorded in this spec (below), and each passed or has an
      agreed fix.
- [ ] A station on current firmware, with no change, finds the backend over mDNS, connects,
      gets a signed handshake, scans cards, enters attempts, calls a delegate and takes an OTA
      update.
- [ ] Bluetooth auto-setup configures a station in setup mode on the router.
- [ ] Station link data (SPEC-008) appears on the Devices page on the router, and is absent,
      without errors, elsewhere.
- [ ] Device logs (SPEC-009) stream live and download as before.
- [ ] With 40 simulated stations, a WCIF import and a results sync on a Pi 4 drop no station,
      and the event loop's max delay stays under 1 s.
- [ ] After a backend restart, 40 stations are back within 15 s of the backend being healthy.
- [ ] `STATION_GATEWAY=0` plus the old template puts a router back on the connector.
- [ ] One real competition runs on the gateway.
- [ ] The unix socket server, its DTOs and `SOCKET_PATH` are removed; FKMTime/micro-connector
      is archived.

## Rollout

**Phase 0: spikes on a Pi 4 router (about a week).** Each is a throwaway prototype with a
go/no-go:

| Spike | Go if |
|---|---|
| ciao: one service per address, link brought up after start, router reboot | Real stations find it in every case, as fast as with the connector |
| Event loop: 40 simulated stations during WCIF import, results sync, HIL | Max delay under 1 s, or the stall is in one place we can fix |
| Restart: 40 stations, backend restarted | Back within 15 s of healthy |
| `node-ble`: auto-setup of a station in setup mode, then a station that never answers | Configured, and the stuck one times out without blocking the next |
| `iw` station dump from the container on the host network | Same numbers as the connector's SPEC-008 readings |
| Host networking: nginx, backend and Postgres on the router | Panel and API work; port 5000 is unreachable from the venue network |

If ciao or the event loop fails with no fix in sight, stop: the rewrite isn't worth it, and
moving the connector's Rust code into this repository (below) is the fallback.

**Phase 1: gateway core**, behind `STATION_GATEWAY`: websocket, handshake, packets, OTA,
logs and e2e tests. Tested with the simulator and real stations, with mDNS off and the URL
set by hand.

**Phase 2: mDNS, Bluetooth, station link.**

**Phase 3: the router.** A new fim template (host networking, no connector) next to the
current one. A mock competition on it first, then a real one with the old template ready.

**Phase 4: cleanup.** Remove the unix socket server and `SOCKET_PATH`, archive
micro-connector (its `old-fw-update` branch, used for V2 → V3 updates, stays clonable), update
`AGENTS.md`, and move the firmware simulator to the backend.

## Alternatives considered

- **Move the connector's Rust code into this repository and keep it as a separate process.**
  This fixes the two-repository problem: one PR per protocol change, plus fixtures that test
  both sides of the unix socket. It takes about two days and has no competition-day risk. It
  keeps two languages, the unix socket and the duplicated state, and the station protocol
  still can't be tested from the backend. It is the fallback if phase 0 fails, and worth doing
  in the meantime if the rewrite is a long way off.
- **The connector binary inside the backend image, two processes.** It needs the same host
  networking as the rewrite and saves no code. Rejected.
- **Keep things as they are.** Every problem above stays.

## Open questions

1. **Port 8081 or the backend's own HTTPS port for stations?** **Decided (2026-11-23): a
   separate port, 8081.** The backend runs a second TLS server only for stations, so station
   traffic stays out of nginx and the panel's HTTP stack, an nginx restart doesn't touch
   stations, and routers keep the port they use today. Going through nginx was rejected: it
   would have to pass the `RandomSigned` handshake through untouched and would become a hop
   every station depends on.
2. **Should a busy-loop warning reach the panel,** or only the server log (SPEC-011)?
   Proposed: the log in phase 1; the Devices page if phase 0 shows it's needed.
3. **`node-ble` or our own thin BlueZ D-Bus client** over `dbus-next`? Proposed: decide in
   phase 0. We use four BlueZ calls, so a thin client may be less risk than a stale library.
