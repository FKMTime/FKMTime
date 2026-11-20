# SPEC-014: Moving the micro connector into this repository

- **Status:** Draft
- **Created:** 2026-11-20
- **Related:** [FKMTime/micro-connector](https://github.com/FKMTime/micro-connector),
  `backend/src/socket/`, [FKMTime/fim](https://github.com/FKMTime/fim)
  (`templates/prod/docker-compose.yml`), the firmware simulator
  ([FKMTime/firmware](https://github.com/FKMTime/firmware) `sim/`),
  [SPEC-008](SPEC-008-station-wifi-signal.md), [SPEC-009](SPEC-009-live-device-logs.md),
  [SPEC-011](SPEC-011-server-logs.md)

## Summary

"Merge the micro connector into the backend" can mean two things:

1. **Move the code.** The Rust connector moves into this repository as `connector/`.
   It stays its own process and its own image, and runs exactly as it runs today.
2. **Merge the processes.** The connector is rewritten in TypeScript inside the NestJS backend,
   and the unix socket between them goes away.

**Recommendation: do 1, and don't do 2.**

Most of the pain today comes from the two halves of one protocol living in two repositories:
at least six of the 24 connector PRs merged since 2026-11-01 needed a matching backend PR.
Moving the code fixes that for about two days of work, with no change on the router.

Rewriting the connector in the backend would remove the unix socket protocol. But it would
re-implement the connector's hardest parts in Node, where the libraries are weaker: mDNS per
interface, Bluetooth auto-setup through BlueZ, and the router's nl80211 counters. It would put
the backend on the router's host network and make every station disconnect whenever the
backend restarts. It would also break the firmware simulator, which uses the connector's fake
backend. Each of those risks lands on competition day, and the gain doesn't pay for them.

The decision this spec asks for: **accept option B below**, or say which other option to cost
out in detail instead.

## Problem

The connector is the bridge between stations and the backend. Stations hold a websocket to it,
and it talks to the backend over a unix socket in a shared Docker volume. Both run on the
router at the venue (a Raspberry Pi 4 running OpenWrt, managed by fim), next to Postgres and
nginx.

The split costs us in four ways.

**One protocol, two repositories.** The unix socket messages (`unix-utils` in Rust,
`backend/src/socket/` in TypeScript) are a contract with no shared definition and no test
across it. A feature that touches stations ships as two PRs, merged in the right order, and
nothing checks that they agree. Since 2026-11-01 these went out as pairs:

| Change | Connector PR | Backend PR |
|---|---|---|
| Firmware version on connect | FKMTime/micro-connector#14 | #560 |
| Timer and inspection running flags | FKMTime/micro-connector#18 | #562 |
| Max penalty per group | FKMTime/micro-connector#22 | #570 |
| A known device with a new sign key | FKMTime/micro-connector#25 | #557, #574 |
| Station Wi-Fi signal (SPEC-008) | FKMTime/micro-connector#29 | #679 |
| Connector log file (SPEC-011) | FKMTime/micro-connector#30 | #711 |

`AGENTS.md` already has to warn that these messages "are a contract: treat changes to
them as breaking unless proven otherwise", because nothing else enforces it.

**No tests in the connector's CI.** Its only workflow builds the Docker image. Its ~100 unit tests
run only when someone runs `cargo test` by hand.

**Images that can drift apart.** The router pulls `fkmtime-backend:main` and
`fkmtime-micro-connector:master`, two moving tags from two repositories. Nothing says which
backend a given connector build was tested with.

**Two places to look.** Specs, agent instructions, issues and dev setup live in this repository. The
connector has its own README, issue tracker and branch naming (`master`).

## Goals

- A change to the station ↔ backend protocol is one PR, and CI fails if the two sides disagree.
- The connector's tests run in CI on every PR that touches it.
- Nothing changes on the router or the stations: same image name, same compose service, same
  socket protocol, same behaviour during a round.
- The connector's history and its PR references survive the move.

## Non-goals

- Changing the unix socket protocol or the station websocket protocol.
- Changing how the connector is deployed, or where it runs.
- Rewriting any of the connector. That is option D, evaluated and rejected below.
- Moving the firmware into FKMTime. It has its own toolchain, simulator and release cycle,
  and the connector's protocol test (below) doesn't depend on it.

## What the connector does

The size of a rewrite depends on what the connector does, so here it is by module (Rust,
7.1k lines with tests and the fake backend):

| Job | Module | Lines | How it reaches the hardware |
|---|---|---|---|
| Station websocket over TLS (self-signed), the `RandomSigned` AES handshake, sign key checks | `http.rs`, `handler.rs` | 1.2k | TCP on the host network, port 8081 on the router |
| Unix socket client: tagged requests, 7.5 s timeouts, `ServerStatus` cache that outlives a backend restart | `socket/` | 0.9k | shared volume |
| Firmware updates: GitHub releases every 5 min, dev builds from `/tmp/fkm-build`, chunked OTA | `updater.rs`, `watchers.rs`, `github/` | 0.6k | disk, internet |
| mDNS: one daemon per local IPv4 address, re-created when a link comes up | `mdns.rs` | 0.3k | multicast on the host network |
| Bluetooth auto-setup: scan, write Wi-Fi details to stations in setup mode | `bluetooth.rs`, `adapter.rs` | 0.9k | BlueZ over D-Bus (`/run/dbus`), or docker-adapter on macOS |
| Station link: signal, bitrate and retries from the access point | `station_link/` | 0.6k | nl80211 netlink, `/proc/net/arp` |
| Device logs: live header parsing, per-device log files with rotation | `log_packet.rs`, `log_subscriber.rs`, `error_log.rs` | 1.0k | shared volume the backend reads (SPEC-009) |
| Fake FKMTime for the firmware simulator | `e2e/` | 0.8k | unix socket |

Three of these are fragile and were fixed recently on real hardware, in FKMTime/micro-connector:
mDNS (#15, #17, #28), Bluetooth auto-setup (#12, #13, #26) and the station link (#29).

## Options

### A. Keep things as they are

No cost, and every problem above stays.

### B. Move the code into this repository, keep the process (recommended)

The connector moves to `connector/` in this repository with its history. It keeps its own Rust
crate, image and compose service. Shared message fixtures test both sides of the unix socket in
one CI run. Details under [Design](#design).

- **Fixes:** one-PR protocol changes, contract tests, connector tests in CI, one tracker, one
  set of agent instructions, both images built from the same commit.
- **Costs:** about two days. CI here gains a Rust job (a few minutes, cached). Contributors
  touching the connector need a Rust toolchain, as they do today.
- **Risk on competition day:** none. The image is built from the same sources.

### C. Same container, two processes

The connector binary goes into the backend image under a small supervisor.

- **Fixes:** one compose service less.
- **Costs:** the backend container would need the host network and `/run/dbus`, because the
  connector does. That changes how nginx reaches the backend and how the backend reaches
  Postgres, and exposes port 5000 to the venue network unless it's rebound to localhost. The
  two processes could no longer be restarted or updated separately.
- **Verdict:** all of D's deployment cost, none of its code savings. Rejected.

### D. Rewrite the connector inside the NestJS backend

The backend accepts station websockets itself, and the unix socket goes away.

What it would remove:

- the unix socket protocol (10 request and 12 response types), its tags and timeouts, and the
  `ServerStatus` handshake (the connector turns stations away until it gets one,
  FKMTime/micro-connector#16);
- duplicated state: sign keys, device settings and connected devices live in both processes
  today;
- the base64 firmware relay (the panel uploads to the backend, which forwards to the connector)
  and the shared log volume (SPEC-009, SPEC-011);
- one image and one language.

What it would cost, module by module:

| Job | In Node | Risk |
|---|---|---|
| Websocket, TLS, AES handshake, OTA | `ws` + `node:crypto` (`aes-128-ecb`, no padding) | Low |
| Firmware watchers, log parsing and files | Plain TypeScript; the backend already rotates its own log | Low |
| mDNS per interface, following links that come up late | `multicast-dns` / `bonjour-service` have no per-interface daemons or carrier tracking; we'd write that ourselves | **High**: stations that can't find the server can't run a round |
| Bluetooth auto-setup | `node-ble` over D-Bus, or `noble` (raw HCI, needs extra capabilities) | **High**: three hardware-only fixes to redo, testable only on a router |
| Station link (nl80211) | No maintained netlink library; shell out to `iw` (adds it to the image) | Medium |
| Fake backend for the firmware simulator | Gone: it sits behind the unix socket. The simulator would run the real backend and Postgres, or get a new fake speaking the station websocket | Medium: blocks firmware work until replaced |

And what it would change in behaviour:

- **A backend restart drops every station.** Today stations keep their websocket to the
  connector while the backend restarts; requests fail for a few seconds and then work again.
  The connector keeps the sign keys, so stations are trusted again at once (it has a test for
  exactly that). In one process, every station disconnects and reconnects together.
- **Station pings share the event loop.** The connector answers pings while a request waits on
  the backend (FKMTime/micro-connector#27) and runs on several threads. In Node, a slow
  synchronous task (a WCIF import, a results calculation, the HIL processor) delays every
  station's ping. A worker
  thread would avoid that, and would bring back the inter-process boundary D set out to remove.
- **The backend joins the host network.** mDNS needs multicast on the venue network and
  Bluetooth needs D-Bus, so the backend would leave the Docker bridge network: the same
  deployment changes as C.

Memory doesn't decide it either way. The connector is a static musl binary using a few MB,
small next to Node and Postgres on the Pi.

- **Verdict:** several weeks of work, two high risks that show up only on hardware, and a
  worse failure mode during a round. Rejected, unless the contract tests from B show that the
  socket keeps breaking anyway.

### E. Later, after B: move logic to the backend, leave the hardware in the connector

Once both halves live in one repository, the connector can shrink towards a thin edge: it keeps
the hardware (websocket, mDNS, Bluetooth, nl80211, OTA) and passes station messages through,
while decisions it makes today move to the backend, e.g. composing the card display text or
deciding whether to forward an `Add`. Each such move is a normal PR. This spec doesn't
schedule any of it.

## Design

Option B.

### Layout

```
FKMTime/
├── backend/            NestJS, unchanged
├── connector/          the micro-connector repository, as it is on master
│   ├── Cargo.toml      crate `backend`, binaries `backend` and `e2e` (unchanged)
│   ├── unix-utils/
│   ├── src/
│   ├── Dockerfile
│   └── tests.json
├── contract/
│   └── unix-socket/    one JSON file per message, both directions
└── frontend/, e2e/, …
```

The crate keeps its name `backend` in the move, even though it sits next to `backend/`. The
router's compose file filters logs with `RUST_LOG=none,backend=debug`, so renaming the crate
without updating fim at the same time would silence the connector's log. The rename is a
separate change (see Open questions).

### History

Import with history, rewritten into the subdirectory:

1. In a fresh clone of micro-connector: `git filter-repo --to-subdirectory-filter connector`,
   with a message callback that turns `(#N)` into `(FKMTime/micro-connector#N)`. Otherwise every
   old reference would point at an unrelated FKMTime PR.
2. In FKMTime, merge that history once with `--allow-unrelated-histories`, as its own PR.

`git log -- connector/` and `git blame` then work as before.

### CI

- **Move** `publish-docker-image.yml` to `.github/workflows/publish-connector-image.yml`, with
  paths under `connector/`. The image name stays `ghcr.io/fkmtime/fkmtime-micro-connector`.
  It publishes both `:main` and `:master` until fim and the dev compose file are on `:main`.
- **Add** `test-connector.yml`: `cargo fmt --check`, `cargo clippy -- -D warnings` (after the
  existing warnings are fixed), and `cargo test`, on PRs touching `connector/` or
  `contract/`.
- **Add** a `cargo` entry in `dependabot.yml` for `/connector`. FKMTime auto-merges minor and
  patch Dependabot updates, and whether that should cover the connector is an open question.

### Contract tests

`contract/unix-socket/` holds one example per message, in the exact JSON that goes over the
socket, e.g. `request/CurrentTimeInfo.json`, `response/ServerStatus.json`.

- **Connector** (`unix-utils` tests): each request it sends serializes to its fixture; each
  response fixture deserializes.
- **Backend** (`socket.server.spec.ts`): each request fixture goes through `parsePacket` and
  is accepted; each response it builds matches its fixture's shape.

A PR that changes a message on one side only now fails CI. Changing a fixture is visible in the
diff, which is the point. Compatibility with older firmware and connectors stays a review
concern, as SPEC-008 does it today; the fixtures pin the current shape only.

### Dev stack and docs

- `docker-compose.yml` keeps pulling the published image, so nobody needs to compile Rust to run
  the panel. A `build: ./connector` override under a `connector-build` profile is there for work
  that changes the connector.
- `AGENTS.md`: add `connector/` and `contract/` to the layout table and the Rust checks to
  "Checks". Drop the line pointing to the separate repository.
- Firmware `sim/`: change the documented `--mc` path to an FKMTime checkout's `connector/`.

### Old repository

- After the move, a last commit on micro-connector's `master` replaces the README with a pointer
  to `connector/` in FKMTime/FKMTime. Then the repository is archived, read-only. It has no
  open issues or PRs.
- The `old-fw-update` branch, which the README tells people to clone for V2 → V3 firmware
  updates, stays where it is. Archived repositories can still be cloned. The new README keeps
  that instruction.

## Acceptance criteria

- [ ] `connector/` holds the connector with its full history; `git log -- connector/` shows the
      old commits, and their PR references point to FKMTime/micro-connector.
- [ ] A PR touching `connector/` runs `cargo fmt --check`, `cargo clippy` and `cargo test`.
- [ ] The image built here from the first imported commit matches the old repository's build:
      same `Cargo.lock`, same `cargo test` result, and a router running it serves stations as
      before (connect, scan a card, enter an attempt, OTA update).
- [ ] `ghcr.io/fkmtime/fkmtime-micro-connector` is published from this repository as `:main`,
      and as `:master` until fim moves off it.
- [ ] Every unix socket message type has a fixture in `contract/unix-socket/`, tested on both
      sides; changing a message on one side only fails CI.
- [ ] `AGENTS.md` lists `connector/` and `contract/` and their checks.
- [ ] FKMTime/micro-connector is archived, and its README points here.

## Rollout

Nothing in the field changes, so there is no ordering constraint with firmware or competitions.

1. Freeze merges to micro-connector.
2. PR 1: the history import (above). It changes only `connector/`.
3. PR 2: move the image workflow, add the test workflow and Dependabot entry. Check that the
   image built from `connector/` matches a build from the old repository at the same commit
   (same Cargo.lock, same binary size, same `cargo test` result).
4. PR 3: contract fixtures and tests on both sides.
5. PR 4: `AGENTS.md`, dev compose profile.
6. Archive micro-connector (above). Update the firmware `sim/README.md`.
7. fim: switch the template to `fkmtime-micro-connector:main`. Once routers have pulled it,
   stop publishing `:master`.

Steps 2–5 can happen within a week of each other. If step 3's image differs, stop and find out
why before any router pulls from the new workflow.

## Open questions

1. **Rename the crate and binary to `connector`?** That also changes the `RUST_LOG` target in
   fim's template and in this repository's compose files, together. Proposed: yes, in its
   own PR after step 7, with the fim template updated in the same release.
2. **Dependabot auto-merge for cargo updates?** FKMTime auto-merges minor and patch updates.
   Proposed: yes for the connector too, since its CI will then run the tests.
3. **Pin matching versions?** With both images built from one repository, a release could tag
   them with the same version and fim could pin pairs instead of moving tags. Proposed: out of
   scope here; worth a separate look once B is done.
