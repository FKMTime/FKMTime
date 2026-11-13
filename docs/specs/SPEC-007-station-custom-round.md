# SPEC-007: Stations running a different round from their room

- **Status:** Accepted
- **Created:** 2026-11-13
- **Related:** #513, [SPEC-002](SPEC-002-extras-for-all-attempts.md) (extras
  for all attempts so far, whose warning this answers),
  [SPEC-005](SPEC-005-later-rounds-after-dnf-ruling.md) (removed results),
  [SPEC-001](SPEC-001-head-to-head.md) (head-to-head rounds)

## Problem

A station takes attempts only for the groups running in its room
(`room.currentGroupIds`). Once the room has moved on, no station can take an
attempt for an earlier round, even if one competitor still needs one.

The usual case is an extra given late. The delegate grants it after the room
has started the next group of another event, or after the round's last group
finished (SPEC-002 warns about exactly this: "Stations can't take these
attempts"). Today the delegate has two ways out, both bad:

- Set the room back to the earlier round. Every other station in the room stops
  taking attempts for the group that is actually running.
- Time the redo by hand, on a stopwatch or a station that isn't connected, and
  type it into the panel. The attempt has no station, no judge signature on the
  device, no inspection time, and the cutoff and cumulative-limit checks a
  station would apply are left to the delegate.

The scrambling device has the same limit: it only offers "Scramble" for a round
running in its room.

## Goals

- A delegate can point one or more stations at a chosen round. Those stations
  take attempts only for that round, with the usual station flow (scan, inspect,
  solve, judge signs). The rest of the room carries on with its own groups.
- The station goes back to its room when the delegate says so, and never on its
  own.
- A station left on another round is hard to miss in the panel.
- The scrambling device in the same room can scramble for that round.
- An attempt entered this way is the same as any other: same result, same
  checks (cutoff, time limit, cumulative limit, extras, removed results), same
  sending to WCA Live.
- No change to station firmware or the micro-connector. The backend already
  tells a station which round a competitor is in; it decides the round here too.

## Non-goals

- Pointing a station at a single group. The round decides everything an attempt
  needs (format, cutoff, limits, result), and the group is only used for
  attendance. See *Which group is reported*.
- A station taking both its room's groups and another round at once. See
  *Decisions*.
- Attendance devices (`ATTENDANCE_SCRAMBLER`, `ATTENDANCE_RUNNER`). They record
  staff for the room's current group and keep doing so.
- Head-to-head rounds (format `h`, SPEC-001). Once SPEC-001 is built, the
  setting is refused for them, since their stations pair competitors by stage.
- Clearing the setting automatically, for example when the round has nothing
  left to enter. See *Decisions*.
- Changing who advanced. As in SPEC-002, a late redo doesn't move anyone into or
  out of the next round by itself.

## Design

### Words

The panel calls it **"Run a different round"** on a station, and **"Back to the
room's round"** to clear it. In this spec, a station with the setting is
*pointed at* a round; a station without it *follows its room*.

### Schema

`Device` gains three nullable columns:

```prisma
model Device {
  // …
  /// The round this station takes attempts for instead of its room's groups,
  /// e.g. "333-r1". Null while it follows its room.
  customRoundId      String?   @map("custom_round_id")
  customRoundSetAt   DateTime? @map("custom_round_set_at")
  customRoundSetById String?   @map("custom_round_set_by_id")
}
```

Only `STATION` devices can have it. The attempt itself doesn't record that it
came from a pointed station: its device, round and time already say everything,
and a pointed station is no different from any other for the result.

### API

```
PUT /device/custom-round        (DelegateGuard)
{
  "deviceIds": ["…", "…"],
  "roundId": "333-r1"            // null: back to the room's round
}
→ 200 { "updated": 2 }
```

- `roundId` must be a round in the WCIF. `400` otherwise, and for a
  head-to-head round once SPEC-001 is built.
- Every id must be a station that isn't retired. `400` otherwise; nothing is
  changed.
- Pointing a station at the round its room is already running is allowed. It
  keeps that round when the room moves on, which is a reasonable way to keep one
  station back for redos.
- After the update: clear those stations from the `stationsByEspId` cache, and
  call `appGateway.handleDeviceUpdated()` so open panels refetch.

`GET /device` returns the three columns, with the round's name for display.

### What a pointed station accepts

The rule lives in one helper, `getStationRounds(device)`, used by both station
messages below:

- **Pointed station:** exactly one round, `customRoundId`.
- **Station following its room:** the rounds of `room.currentGroupIds`, as now.

#### `PersonInfo` (competitor card scanned)

`PersonForDeviceService` builds `possibleGroups` from `getStationRounds` instead
of `room.currentGroupIds`. For a pointed station that is one entry, so the
station goes straight to that round, as it does today in a room running one
group. The checks stay the same:

- the competitor must have an assignment in the round or be registered for the
  event, otherwise `competitorIsNotSignedInForEvent`;
- a competitor with no attempts left in the round, and nothing waiting for an
  extra, gets `noAttemptsLeft`;
- a removed result gets `competitorRemovedFromRound` (SPEC-005).

`computeSecondaryText` already shows the round ("3x3 R1") and the next attempt
("Attempt E2", or "Attempt 2" in a fresh-set redo), so the judge sees which
round they are timing without any firmware change.

#### `EnterAttempt` (solve sent)

The firmware always sends the `group_id` it was given at the card scan. Today
the backend ignores it when the room runs one group, and takes the room's group.
That would file a solve started before the delegate changed the setting in the
wrong round. So `enterAttempt` changes to:

1. Take the round from `data.groupId` when it is sent.
2. If that round is one of `getStationRounds(device)`, use it.
3. Otherwise refuse with a new translation, `stationRoundChanged` ("Round
   changed, call the delegate"), `status: 409`, `shouldResetTime: false`. The
   station keeps the time; the delegate either points the station back or
   enters the time from the panel.
4. When `groupId` isn't sent (an older connector), fall back to today's rule for
   a station following its room, and to `customRoundId` for a pointed station.

The comparison is by round, not group, so a room that moves from group 2 to
group 3 of the same round mid-solve still files the attempt as before. For a
station following its room, step 3 changes one thing: a solve started in a round
the room has since left is refused instead of being filed in the room's new
round. That was wrong before, and is rare, since the room changes group only
when every result is in.

Everything after the round is chosen is unchanged: result lookup, extras,
cutoff, limits, sending.

#### Which group is reported

Several places need a group id even though the round decides the attempt: the
station's `group_id`, `CurrentTimeInfo` for live solving, and attendance. For a
pointed station, the group is:

- the competitor's own group in that round, from their WCIF assignment;
- otherwise the round's last group in the schedule.

The competitor isn't known when the station is idle, so live solving gets the
group only once a card is scanned, as now.

### Attendance and staffing

An attempt at a pointed station is for a group that has already happened, so it
mustn't add anyone to that group's attendance who wasn't there:

- **Competitor:** marked present in their own group of the round when they have
  one (usually already present). With no assignment in the round, nothing is
  marked.
- **Judge:** not marked. The judge is usually staffing the room's current group,
  and adding them to an old group as an unassigned judge would only show up as
  noise ("Unassigned") on that group's attendance.
- **Scrambler:** the scrambling device doesn't record attendance today, and
  doesn't start to.

The attempt still records its judge and scrambler, so nothing about who did what
is lost.

### Automatic group change

`checkIfGroupCanBeChanged` runs after a station enters an attempt, for the
station's room. For an attempt at a pointed station it doesn't run: the attempt
is for another round, so it can't finish the room's group.

The rule from SPEC-002 stays: in the last group of a round, an attempt waiting
for an extra still blocks the automatic change. Pointing a station is the way to
clear it without moving the room back.

### Scrambling device

The scrambling device belongs to a room, like stations, and offers "Scramble"
only for a round running in that room. It gets the stations of its room that are
pointed elsewhere:

- `GET /scrambling/room` (the existing `getDeviceRoom`) also returns
  `stationRounds: [{ roundId: "333-r1", stationNames: ["Station 3"] }]` for
  pointed stations in the room.
- On the home screen, a round in `stationRounds` counts as running: it gets the
  live dot, "Scramble" is enabled, and the line under the round reads
  "Running at Station 3" instead of "Not in progress in this room".
- On the scramble set screen, the "This round isn't running in this room"
  warning isn't shown for that round, and no group number is shown.
- `createScrambledAttempt` doesn't check the round today and doesn't start to.

Scrambling for the redo then works as in SPEC-002: extra scrambles, or the
normal scrambles of a fresh set in fresh-set mode.

### Frontend

Plain task language; the delegate never sees `customRoundId`.

**Devices page.** Each station row shows a badge when it is pointed:
"Running 3x3x3 Cube R1 · since 14:05". The row's ⋮ menu has "Run a different
round…" and, when pointed, "Back to the room's round". "Run a different
round…" opens a small modal with an event and round picker, defaulting to the
event the room ran last, and the stations of the same room as checkboxes with
the one it was opened from ticked, so several can be pointed at once. A line
says what happens: "Station 3 will only take attempts for 3x3x3 Cube Round 1.
The rest of Main Room carries on."

**Home, room card.** Below the room's current group, a line per pointed station
in the room: "Station 3 is running 3x3x3 Cube R1", with "Back to the room's
round" next to it. This is where a station left behind is spotted, since the
home page is open all day. A pointed station in a room with no group running is
still listed.

**Live solving board.** A pointed station's tile shows its round as a badge, so
a time running on 3x3x3 R1 in a room on Pyraminx isn't mistaken for a Pyraminx
solve. `groupStationsByRoom` still groups it under its room.

**Extras modals (SPEC-002).** The warning "The next round has started. Stations
can't take these attempts…" becomes "The next round has started. Run this round
on a station to take these attempts, and make any change to who advanced in WCA
Live.", with "Run this round on a station" opening the modal above with the
round filled in. The same applies to the hint shown in the last group of a
round.

**Station tester.** Unchanged; it already sends `groupId`.

### Station reconnects and a flaky network

The setting lives in the backend, not on the station, so a station that reboots
or reconnects picks it up at the next card scan. A station mid-solve when the
setting changes is covered by `stationRoundChanged` above. The micro-connector
doesn't cache rounds, so nothing there goes stale.

## Acceptance criteria

- [ ] `PUT /device/custom-round` sets and clears the round on several stations
      in one call, requires a delegate, and returns `400` for an unknown round,
      a retired device or a device that isn't a station, changing nothing.
- [ ] A station pointed at 333-r1 in a room running pyram-r1-g2 offers only
      333-r1 at the card scan, and the attempt is stored in the competitor's
      333-r1 result, as the next attempt or the next extra.
- [ ] The other stations in that room keep taking attempts for pyram-r1-g2.
- [ ] A pointed station gives `noAttemptsLeft` to a competitor with nothing left
      in the round, `competitorIsNotSignedInForEvent` to one not in it, and
      `competitorRemovedFromRound` for a removed result.
- [ ] Cutoff, time limit and cumulative limit apply on a pointed station as on a
      normal one.
- [ ] A solve started before the station was pointed (or pointed back) is
      refused with `stationRoundChanged` and the station keeps the time.
- [ ] A station following its room still files an attempt sent with a group id
      of the room's previous group in the same round.
- [ ] A solve without `groupId` is filed in the station's round, pointed or not.
- [ ] An attempt at a pointed station marks the competitor present only in their
      own group of that round, and doesn't mark the judge.
- [ ] An attempt at a pointed station doesn't trigger the automatic group change
      of its room.
- [ ] The scrambling device in the station's room enables "Scramble" for the
      pointed round and shows "Running at Station 3"; in another room it
      doesn't.
- [ ] The Devices page shows the badge and both actions, and the modal points
      several stations of a room at once.
- [ ] The home room card lists each pointed station with "Back to the room's
      round", including in a room with no group running.
- [ ] The live solving board shows the pointed station's round on its tile.
- [ ] The SPEC-002 "next round has started" warning offers "Run this round on a
      station" with the round filled in.
- [ ] A station that reconnects keeps its setting.
- [ ] Rooms with no pointed stations behave as before.

## Rollout

- Three nullable columns on `Device`, applied by `prisma db push` on start. Only
  adds to the schema; the seed data needs no change.
- Backend and frontend ship together. Station firmware and the micro-connector
  don't change, and an older connector that doesn't pass `groupId` falls back
  as described in *`EnterAttempt`*.
- `stationRoundChanged` is a new translation and needs every locale the station
  texts have.
- Revert: clear `customRoundId` on every station first, so no station is left
  pointed by code that no longer reads it, then remove the columns. The change
  to refuse solves from a round the room has left can be reverted on its own.
- Update the user docs at fkmtime.github.io: a short "Late extras" section
  pointing to "Run a different round".

## Decisions

1. **Point a whole station at a round, in the backend.** Stations already get
   their round from the backend at each card scan, so pointing one is a backend
   setting and the protocol doesn't change. Rejected: a round picker on the
   station (firmware change, and judges shouldn't be choosing rounds) and
   setting it per competitor ("this competitor's next attempt goes to R1 at any
   station"), which is invisible on the floor and makes every station
   ambiguous.
2. **A round, not a group.** The round decides the attempt; the group only feeds
   attendance and is worked out from the competitor. Rejected: pointing at a
   group (the delegate would have to know which group a late competitor was in,
   for no gain).
3. **Delegates set it.** Like extras, it follows a delegate's ruling. Admins can
   too, as with every `DelegateGuard`. Organizers, who manage devices, can't
   change which round a station times.
4. **A pointed station replaces its room's groups.** It takes only the chosen
   round. Rejected: adding the round to the room's groups (a station in a room
   running one group would offer two rounds at every card scan, and the
   firmware asks the competitor to pick, which invites the wrong round).
5. **A station goes back to its room only when a delegate says so.** The home
   room card makes a station left behind hard to miss. Rejected: going back
   once the round has nothing waiting and every result is in (a station could
   switch mid-redo if an incident is resolved and reopened) and going back at
   the end of the competition day.
6. **The judge isn't marked present for attempts at a pointed station.** The
   attempt still records who judged. Rejected: marking the judge as unassigned
   in the competitor's group of that round (noise on a group that already
   happened, for a judge who is usually staffing the room's current group).
7. **Refuse a solve from a round the station no longer takes, for every
   station.** Pointed stations need it, so changing the setting mid-solve is
   safe, and the same check stops a solve started before a room changed round
   from being filed in the new one. It compares rounds, so group changes within
   a round are unaffected. Rejected: checking only pointed stations (leaves the
   misfiling in rooms as it is).
