# SPEC-008: Station Wi-Fi signal on the Devices page

- **Status:** Draft
- **Created:** 2026-11-14
- **Related:** FKMTime/micro-connector#28 (connector CPU), #676 (EnterAttempt
  in one transaction), esp-hal-wifimanager 0.6.7 (`WifiManager::rssi`)

## Problem

At a competition in a basement venue, stations kept dropping their
connection and showing timeouts. The router's Wi-Fi counters showed a
coverage problem rather than interference:

- Stations at −54 to −61 dBm retried 29–84% of their frames.
- Stations at −63 dBm or weaker retried 110–133%, and one was stuck at
  1 Mbit/s.
- The channel was only ~11% busy, with no neighbouring access points on it.

Retries rose as signal fell. A station placed a few metres closer to the router,
or the router moved to the middle of the room, would have fixed most of it.

Nobody could see this during setup. The panel shows each station's battery
but nothing about its link. The figures above came from SSH on the router
after the day had gone wrong. The organiser setting up the room has no way to
tell a station on the edge of coverage from a healthy one until judges
start seeing timeouts mid-round.

## Goals

- During setup, the Devices page tells the organiser which stations have a
  weak signal, in plain words, while there is still time to move the station
  or the router.
- The hint is steady: one bad reading doesn't flip it, and a station sitting
  near the threshold doesn't flicker.
- Stations on older firmware keep working, and show "unknown" rather than
  something misleading.
- Any combination of old and new firmware, connector and backend keeps
  working, so the parts can ship in any order.

## Non-goals

- Signal history, charts or per-attempt signal records. Only the current
  state matters for "move this station".
- Storing signal in the database. It changes every few seconds and means
  nothing after a restart.
- Any automatic action (changing channel, moving stations between access
  points).
- An alert on Home. A weak station is fixed during setup, when the organiser
  is on the Devices page anyway. During a round nobody moves a station, so a
  Home alert would only nag.
- Router-side link details anywhere but the Devices page. The router's
  per-station counters are also logged on the router (fim), for after the
  competition.

## Design

### Firmware (FKMTime/firmware)

The station reads its own RSSI from the Wi-Fi driver and sends it in the live
header it already sends every 5 s while idle and every 1 s during a solve
(`src/utils/live_send.rs`).

- **Reading it:** `WifiManager::rssi() -> Option<i8>` from
  esp-hal-wifimanager 0.6.7. The connection task samples it every 2 s while
  connected, and it's `None` while disconnected, reconnecting or with the
  radio stopped. The firmware bumps the crate to 0.6.7 and calls it when
  building the live header.
- **Carrying it:** byte 86 of the 100-byte live header, as an `i8` in dBm.
  `0` means unknown (no reading yet, or disconnected). Bytes 86..99 are zero
  padding today (`src/utils/live_header.rs`, `write_header` fills
  `26..HEADER_LEN` with zeros), so older firmware already sends "unknown".
- **`LIVE_VERSION` stays 1.** The connector accepts the live block only when
  its version byte matches exactly (`log_packet.rs`, `read_live_flags`), so
  bumping it would make older connectors drop the timer and inspection
  flags too. The new byte sits outside the four bytes (82..85) that check
  reads.

Battery messages are not a good carrier. They go out every 60 s, too slowly
for "move the station and look again".

### Connector (FKMTime/micro-connector)

- `LogPacket` gets `rssi: Option<i8>`, read from byte 86 only when the `LV`
  live block is valid, with `0` mapped to `None`.
- `CurrentTimeInfo` (unix socket, camelCase) gets `rssi`: a number, or `null`
  when unknown, the same pattern as `timerRunning`.
- An older connector ignores byte 86, and the backend sees no `rssi` field.

### Router side (connector)

What the station hears is only half of the link. The other half is what the
access point hears from the station, how fast it sends to it, and how often
it has to retry. That half is what would have caught the station stuck at
1 Mbit/s. It is also the only reading for stations that haven't been updated
yet. When the access point is the machine the connector runs on (an OpenWrt
router running the instance), the connector reads it too:

- **Reading it:** every 10 s, an nl80211 station dump (what
  `iw dev <if> station dump` shows) for every interface in AP mode. Found
  through nl80211, so no interface names are configured.
- **Matching stations:** the connector knows each station's IP from its
  websocket, and maps it to a MAC through the host's neighbour table. A
  station it can't match is skipped.
- **Sending it:** a new unix-socket request `StationLink` per matched
  station:
  `{ espId, apSignal, txBitrateKbps, txRetriesPercent }`. `txRetriesPercent`
  is retries over packets sent since the previous reading, so it reflects
  now, not the whole day.
- **Where it can't:** in the Docker dev stack on macOS, with a separate
  access point, or without nl80211 access, the dump finds no AP interface or
  no matching station. The connector then sends nothing, and the panel hides
  the router part. Not every competition runs on the router, so this is the
  normal case for some of them, not an error.

### Backend

- `CurrentTimeInfoDto` gets `rssi?: number | null`. Absent and `null` both
  mean unknown.
- A small in-memory `StationSignalService` (in `device/`) keeps, per `espId`,
  the last 5 readings and when the last one arrived. Nothing is written to the
  database.
- **Level:** the median of the last 5 readings, with hysteresis.
  - `weak` once the median is −63 dBm or lower.
  - Back to `ok` only once the median is above −59 dBm.
  - `unknown` before the first reading, and once no reading has arrived for
    30 s (the station is off, out of range, or on older firmware).
  - −63 dBm is where retries passed 100% at the competition above. The 4 dB
    band stops a station at −62/−63 from flickering.
- `StationLink` updates the same service with the router's view of the
  station. The connector sends it without waiting for a reply. A backend
  that doesn't know it logs "Unknown request type" and carries on (covered
  by the station socket e2e tests). That's another reason the backend ships
  first.
- **Which reading decides the level:** the station's own RSSI when it has
  one. For a station on older firmware, the access point's signal for it,
  with the same median, thresholds and staleness.
- **Device list:** `GET /device` adds to each station, from memory:
  `signal: { level: 'ok' | 'weak' | 'unknown', rssi: number | null, link: { apSignal, txBitrateKbps, txRetriesPercent } | null }`.
  `link` is `null` when the router side isn't available, or hasn't reported
  for 30 s.
- **Live updates:** a new `deviceSignal` event (`{ espId, level, rssi, link }`) to
  the `device` room. It fires when a station's level changes, and at most
  every 10 s per station otherwise, so the dBm in the tooltip stays fresh.
  It does **not** reuse `deviceUpdated`, which makes every open Devices page
  refetch the whole list. With ~15 stations sending every 5 s, that would
  mean several refetches a second.

### Frontend (Devices page)

- A "Wi-Fi" column next to Battery in the table, and the same line in the
  card view (`DeviceItem.tsx`).
- `weak`: amber text, "Weak signal — move closer to the router".
- `ok`: muted text, "Good".
- `unknown`: "—", with a tooltip that says why: "Waiting for the station" if
  it reported before, otherwise "Needs newer station firmware".
- The dBm value only appears in the tooltip: "−66 dBm (median of the last 5
  readings)". The page speaks in actions, not in radio units.
- When `link` is there, the tooltip adds the router's view:
  "Router hears it at −68 dBm, sends at 6 Mbit/s, retries 120%". When
  `link` is `null`, the line isn't shown at all. No "unavailable" text: most
  setups without the router simply don't have it.
- `deviceSignal` patches the one station in place, with no list refetch.

### Edge cases

- **During a solve** the station sends every 1 s, so the median reacts within
  ~5 s. While idle it takes up to ~25 s. That's fine for setup, which is
  when the hint matters.
- **Station reconnecting:** readings stop and the level goes `unknown` after
  30 s. It doesn't stay at a stale `ok`.
- **Backend restart:** every station starts `unknown` and fills in within one
  idle interval.
- **Several access points** (if a venue ever uses them): the reading is what
  the station hears from its current AP, which is still what "move closer"
  needs.

## Acceptance criteria

- [ ] Firmware writes RSSI to byte 86 and `0` when unknown. Bytes 82..85
      are unchanged (host test).
- [ ] The connector parses byte 86 into `rssi`. `0`, and a header without
      a valid `LV` block, give `null`. `CurrentTimeInfo` serialises `rssi` as
      a number or `null` (unit tests).
- [ ] The backend signal service: median of 5, `weak` at −63 dBm, `ok` again
      only above −59, `unknown` after 30 s without a reading (unit tests).
- [ ] `CurrentTimeInfo` with `rssi` updates the service; without `rssi` or
      with `null`, it doesn't (unit test). `GET /device` includes `signal`
      (e2e).
- [ ] `deviceSignal` fires on a level change and not on every packet (unit
      test).
- [ ] The Devices page shows the weak hint and the dBm tooltip, and "—" for
      unknown (component test). A station sending a weak `rssi` through the
      e2e station helper shows the hint (Playwright).
- [ ] Older firmware with a new connector and backend shows "—" and nothing
      else changes (e2e with a header that has no RSSI).
- [ ] The connector turns a station dump into `StationLink` for matched
      stations, with retries over the last interval, and sends nothing when
      there is no AP interface or no match (unit tests on parsed dumps).
- [ ] The backend takes the level from the AP signal for a station without
      its own RSSI, and `link` goes `null` after 30 s without `StationLink`
      (unit tests).
- [ ] The tooltip shows the router line with `link` and hides it without
      (component test).

## Rollout

No migration. Each part tolerates the others being older:

1. **Backend and frontend** first. Testable with the station tester or the
   e2e station helper sending `rssi`.
2. **Connector.** Older backends ignore the extra JSON field, and only log
   `StationLink` as an unknown request.
3. **Firmware**, on esp-hal-wifimanager 0.6.7. Until stations are updated,
   they show "—".

Reverting any one part leaves the others working, with every station shown
as unknown.
