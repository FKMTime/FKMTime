# SPEC-012: Tutorial mode for a station

- **Status:** Accepted
- **Created:** 2026-11-17
- **Related:** SPEC-007 (stations running a different round, same per-station
  pattern), SPEC-010 (station last error), SPEC-006 (where results are sent)

## Problem

Most competitions start with a tutorial for people who haven't used FKMTime
before. A delegate takes a station, and each newcomer scans their card, does
inspection and a solve, and the judge scans their card to confirm.

FKMTime has no way to do a solve that doesn't count. Today the organisers:

1. Turn off sending results, so the tutorial solve doesn't reach WCA Live.
2. Let the newcomer do the solve, which FKMTime saves as attempt 1 of
   whatever round the station's room is running, or rejects with "No groups"
   or "Competitor not registered for this event" when nothing fits.
3. Delete each attempt in Results.
4. Turn sending results back on.

This is slow, and it goes wrong. An attempt left behind counts as a real
attempt 1. Results sending left off holds back every real result in the
competition. Sending is competition-wide, so the tutorial also blocks results
from the other stations. And a newcomer who isn't in the current round can't
do a tutorial solve at all.

## Goals

- A delegate can switch one station into tutorial mode from the panel.
- On a station in tutorial mode, a competitor's card scan shows their name
  with "Tutorial" (Polish: "Szkolenie") under it, whatever round the room is
  running, and even when it runs none.
- The rest of the flow works as it does for a real solve: inspection, the
  solve, penalties, the judge's card, and calling the delegate.
- Nothing from a tutorial solve is saved: no attempt, no result, no
  attendance, no incident in the database, nothing sent to the WCA or Cubing Contests.
- The other stations keep working normally, and results keep being sent.
- Home reminds organisers and delegates to start it when the schedule's
  tutorial is about to begin.
- Tutorial mode can't silently swallow real solves: what the station showed
  at the card scan decides whether a solve counts, and the mode ends on its own
  (see "Ending tutorial mode").

## Non-goals

- **Firmware or connector changes.** The station gets a normal card-scan
  reply with one group whose name is "Tutorial". It doesn't know it is in
  tutorial mode until a card is scanned, so the idle screen looks as usual.
- **A tutorial for scramblers or for the scrambling devices.**
- **Keeping tutorial solves anywhere**: no "tutorial results" page, no
  history. Only a pending tutorial delegate call is kept, in memory, until it
  is answered.
- **Tutorials for other events.** The tutorial solve behaves like 3x3:
  inspection on, +2 as the highest penalty. Newcomers learn the station, not
  an event.
- **Starting tutorial mode from the schedule on its own.** Home suggests it
  when the schedule's tutorial is near; a delegate still starts it.
- **Several tutorial stations' worth of setup.** Each station is switched on
  its own; there is no "tutorial room".

## Design

### The rule: the card scan decides

A station in tutorial mode answers a competitor's card scan with a single
group whose id is `tutorial`. The station keeps that id for the solve and
sends it back with the attempt, as it does with a real group id. The backend
treats every attempt whose group is `tutorial` as a tutorial solve and saves
nothing, **whatever the station's mode is when the attempt arrives**.

So turning the mode on or off mid-solve never changes what happens to a solve
already under way:

| Mode at scan | Mode at submit | What the station showed | Outcome |
|---|---|---|---|
| on | on | Tutorial | not saved |
| on | off (ended, by hand or on its own) | Tutorial | not saved |
| off | on | the real round | saved as normal |

The firmware treats the group id as an opaque string (up to 48 bytes, 20 in
the binary log packet), and the connector passes it through, so `tutorial`
needs no change outside the backend. `EnterAttemptDto.groupId` has to accept
`tutorial` next to the `…-rN-gN` pattern.

An attempt with no group id (firmware that doesn't send one) falls back to the
station's mode at the time it arrives.

### Card scan (`PersonInfo`)

`PersonForDeviceService.getPersonInfo`, when the station is in tutorial mode:

- Looks up the card as usual. An unknown card still gets "Competitor not
  found": scanning the card is part of what is being taught.
- Skips everything about rounds: the station's room or round, the person's
  registration and assignments, attempts left, cutoff, time limit. None of it
  applies, and none of it should stop a newcomer.
- Returns the person with one group:

  ```json
  {
    "groupId": "tutorial",
    "name": "Tutorial",
    "secondaryText": "Tutorial",
    "useInspection": true,
    "maxPenalty": 2,
    "limit": null
  }
  ```

  `name` and `secondaryText` are both set because V4 stations show
  `secondaryText` under the name and older ones show `name`. The text is the
  new `tutorial` translation (`Tutorial` / `Szkolenie`), in the competitor's
  language when FKMTime has it, otherwise the competition's, like
  `noAttemptsLeft`. No diacritics, as with the other station texts.
- The judge's card scan (`isCompetitor: false`) only checks that the card
  belongs to someone. Anyone may judge a tutorial, including people who
  compete in the room's current group.
- The scan counts as tutorial activity (see "Ending tutorial mode").

### Solve (`EnterAttempt`) with group `tutorial`

`ResultFromDeviceService.enterAttempt` checks for `tutorial` first, before the
transaction and before the station-round checks. It:

1. Checks the competitor's card (`competitorNotFound`), the judge's card when
   it isn't a delegate call (`judgeNotFound`), and that the judge isn't the
   competitor (`judgeIsCompetitor`). These are the errors a newcomer may meet
   on the day, so the tutorial shows them.
2. Writes nothing. It doesn't mark attendance, create a result or attempt,
   log an edit, notify incidents, trigger the group-change check, send
   results, or record the station's last solve.
3. Replies with the new `tutorialAttemptEntered` message, shaped like a real
   success: `shouldResetTime: true`, `error: false`. Proposed text: EN
   "Tutorial solve, not saved", PL "Proba ze szkolenia, nie zapisano".

A resent tutorial solve (reply lost) gets the same reply again; with nothing
saved, there's nothing to deduplicate. `CheckTimeEntry` for a tutorial session
answers "not entered", so the station resends and gets that reply.

SPEC-010's last-error tracking sees these replies as usual: a tutorial error
is shown on Devices, and a tutorial success clears it.

### Delegate call during a tutorial

A delegate call is a solve sent with `delegate: true`. Today the backend saves
it as an unresolved attempt, the Incidents page shows it, and the station waits
(up to 5 minutes) until a delegate resolves it in the panel. The backend then
pushes `IncidentResolved` to the station with the decided time and penalty,
and `shouldScanCards` when the competitor and judge must confirm.

**Decided (2026-11-17): a tutorial incident, kept in memory, that a delegate
resolves on the Incidents page with the real controls.** It teaches the
delegate side too: a new delegate's first incident doesn't have to be a real
one. Rejected: answering automatically after a few seconds (nobody on the
panel side learns anything), and no delegate call in tutorials (newcomers
never see what it does).

For a tutorial solve sent as a delegate call, the backend:

1. Checks the cards as for any tutorial solve, then replies
   `delegateWasNotified`, as for a real call.
2. Saves nothing in the database. `TutorialIncidentService` (in `incident/`)
   keeps the call in memory:

   ```ts
   interface TutorialIncident {
     id: string;            // uuid, made up by the backend
     espId: number;
     deviceName: string;
     competitorName: string;
     judgeName: string | null;
     value: number;         // centiseconds, as the station sent it
     penalty: number;
     inspectionTime: number;
     sessionId: string;
     createdAt: string;
   }
   ```

   A resent call with the same station and session keeps the one entry.
3. Emits `newIncident` with `isTutorial: true`, so delegates get the usual
   notification, titled "Tutorial incident".

**On the panel.** Open incidents list tutorial incidents with the real ones,
marked with a "Tutorial" badge, and count them in the unresolved count. The
delegate opens one in the same incident panel and form as a real incident,
with what doesn't exist for a tutorial left out: the competitor's previous
attempts and extras, warnings, and "save as noteworthy". A line at the top
says "Tutorial: nothing here is saved."

**Resolving.** The form's outcomes map onto what the station gets, as for a
real incident (`AttemptService.updateAttempt` and `deleteAttempt`):

| Delegate chooses | Station gets (`IncidentResolved`) |
|---|---|
| Resolved, time and penalty as decided | that time and penalty, `shouldScanCards: true` unless "Don't require cards" is ticked |
| Extra given | `shouldScanCards: false` |
| Delete | `shouldScanCards: false` |

Quick actions work the same way; one that gives an extra counts as "Extra
given". Nothing else happens: no extra is granted, no edit is logged.

**API**, for delegates like the rest of `/incident`:

- `GET /incident/unresolved` and `/unresolved/count` include tutorial
  incidents, each with `isTutorial: true`.
- `PUT /incident/tutorial/:id` with `{ value, penalty, status, doNotRequireCards }`
  sends `IncidentResolved` and drops the entry.
- `DELETE /incident/tutorial/:id` sends `IncidentResolved` with
  `shouldScanCards: false` and drops the entry.
- Each change emits the event the Incidents page already listens to, so
  other open panels drop the entry.

**Afterwards.** With `shouldScanCards`, the station asks the competitor and
judge to scan again and resends the solve with the same session. It is still
a `tutorial` solve, so it gets `tutorialAttemptEntered`.

**Lifetime.** An entry is dropped when resolved or deleted, 5 minutes after
the call (the station stops waiting then, `DELEGATE_TIMEOUT_MS` in the
firmware), when the station is deleted or retired, and on a backend restart.
Resolving one that is already gone answers 404, and the panel says "The
station stopped waiting for this tutorial incident".

### Live solving

A station whose current group is `tutorial` is taken off live solving (the
panel's board, the public page and the TV) with the same `stationRemoved`
event a retired station gets, and its packets are not broadcast while the
group stays `tutorial`. A newcomer's tutorial solve isn't a result, and the
public board shouldn't look like it is. The station comes back with its first
packet for a real group.

Decided (2026-11-17). Rejected: showing it on the panel's board only, marked
"Tutorial" (staff already see it on Devices and Home, and the shared feed
would need a filter for the public page and the TV); and showing it
everywhere (spectators would read practice solves as results).

### Storing the mode

Two new nullable columns on `device`:

```prisma
/// While in the future, the station takes tutorial solves (SPEC-012).
/// Null or in the past: off
tutorialEndsAt     DateTime? @map("tutorial_ends_at")
tutorialStartedById String?  @map("tutorial_started_by_id")
```

A station is in tutorial mode while `tutorialEndsAt > now()`. Storing the end
rather than a flag means ending on time needs no timer on the backend, and a
backend restart keeps a tutorial that is under way. The person who started it
is shown on Devices, like the custom round's "set by".

### Ending tutorial mode

Forgetting the mode on is the dangerous mistake: real competitors' solves on
that station would be thrown away, and the only sign is one word on the
station's screen that a new judge may not read. Ending too early is harmless
under the card-scan rule: the next newcomer gets the room's round (or "No
groups"), and the delegate switches it on again. So the mode should end on
its own, generously.

Options considered:

| | How it ends | For | Against |
|---|---|---|---|
| A | Only by hand | Simplest, predictable | Forgotten → real solves lost until someone notices |
| B | Fixed time after it was switched on (e.g. 30 min), with "Extend" | Predictable, easy to show | A long tutorial is cut off mid-way; the delegate has to watch the clock |
| C | **After a quiet spell: 15 min after the last tutorial card scan or solve** (15 min after switching on if nobody uses it) | Lasts as long as it is used, ends soon after the last newcomer; nothing to watch | The end time moves, so the panel shows "ends 15 min after the last solve" rather than a fixed clock time |
| D | When a group starts in the station's room | Strong sign the competition has started there | Every group change ends it, so a tutorial held mid-day in a room that is running groups keeps being cut off |
| D′ | **When the first group of the day starts in the station's room** | Catches the likeliest mistake: tutorial before the first group, mode forgotten, competition starts at that station | Does nothing for a tutorial left on later in the day; the notification below covers that |
| E | On the schedule's tutorial activity (`other-tutorial` in the WCIF) | No clicks at all | Schedules drift; the tutorial isn't always at the station or room the schedule says |
| F | At backend restart (mode kept in memory only) | No migration | Not a policy: a restart is random, and a long-running backend never ends it |

**Decided (2026-11-17): C and D′, plus "End tutorial" by hand at any time.**
Rejected: D, because it cuts off every mid-day tutorial at the next group
change; B, because the delegate has to watch the clock; A, E and F, for the
reasons in the table.

- **Quiet spell (C).** Each tutorial card scan and each tutorial solve sets
  `tutorialEndsAt` to now + 15 minutes, while the mode is still on.
- **First group of the day (D′).** When a room's groups change
  (`RoomsService.updateRooms` and `switchRoomGroups`, through
  `afterGroupsChanged`, so both the panel and automatic group changes count),
  and the change starts a group in a room that hasn't started any group yet
  that day, every station in that room that is in tutorial mode leaves it.
  "That day" is the venue's local date (the WCIF venue's timezone). "Hasn't
  started any group" means none of the room's `startedGroupIds` is scheduled
  on that date. A station pointed at a round (SPEC-007) counts as part of its
  room here too. Ending it this way clears `tutorialEndsAt` as "End tutorial"
  does, and emits `deviceUpdated`.
- A tutorial started after the day's first group (a latecomer) is ended only
  by the quiet spell or by hand.

### API

- `PUT /device/:id/tutorial` with `{ enabled: boolean }`, for delegates
  (`DelegateGuard`, like the custom round). Enabling sets `tutorialEndsAt` to
  now + 15 min and `tutorialStartedById`; disabling clears both. Only stations
  can be put in tutorial mode; a retired station can't.
- `GET /device` adds `tutorialEndsAt` and `tutorialStartedBy` (name) to each
  station.
- Every change, including the extension on each tutorial scan or solve, emits
  the existing `deviceUpdated`. The extension happens at most once per scan or
  solve, so a few per minute at most. The station lookup cache
  (`getStationByEspIdCached`) is invalidated on each change.

### Panel

Wording follows what the delegate is doing, not the column names.

- **Devices.** Each station's menu has "Start tutorial" or "End tutorial". A
  station in tutorial mode shows a "Tutorial" badge next to its name, with a
  popover: "Solves on this station aren't saved. Ends on its own 15 min after
  the last tutorial solve (now about 14:32). Started by {name}." and an "End
  tutorial" button.
- **Home.** While any station is in tutorial mode, a banner: "Station 3 is in
  tutorial mode: its solves aren't saved." with "End tutorial". This is the
  safety net for a mode left on.
- The badge and banner disappear when `tutorialEndsAt` passes, from the
  timestamp alone, without waiting for an event.

### Notifying delegates

Decided (2026-11-17). Rejected: a message inside the panel only, which adds
little over the Home banner; and the Home banner alone, which leaves a
tutorial forgotten mid-day unnoticed.

Organisers and delegates get a notification, the same kind as "New
incident" (`Layout.tsx`): a browser notification, which on a phone the
service worker shows. Like incident notifications, it reaches only a device
with the panel open. FKMTime has no server push.

- **A group starts in a room where a station is still in tutorial mode**
  (any group change after the first of the day, which ends the mode itself):
  "Station 3 is still in tutorial mode: its solves aren't saved." Tapping it
  opens Devices.
- **The first group of the day ends a tutorial on its own:** "Tutorial on
  Station 3 ended: the first group started." Nobody is then surprised that
  the station is back to normal.

The backend sends both on a new `tutorialNotice` event to organisers and
delegates (`{ kind: 'stillOn' | 'endedByGroupStart', espId, deviceName }`),
from the same `afterGroupsChanged` hook that ends the mode. Each notification
is tagged with the station and the group start, so a second open tab doesn't
show it twice.

### Suggesting the tutorial on Home

Added on 2026-11-17. This is the first of the actions Home will suggest to
organisers and delegates. It is built as one component for now; whatever two
suggestions have in common gets pulled out when the second one arrives.

When the competition's schedule (WCIF) has an activity with the code
`other-tutorial` that is under way, or starts within the next 15 minutes,
Home shows organisers and delegates a banner for it:

> **Tutorial for new competitors**, Main Hall, 9:30–9:45.
> Put a station in tutorial mode so newcomers can try a solve.
> [Start tutorial]

- The time is in the venue's timezone, like the rest of Home
  (`formatTimeRange`). The activity's own name is shown when it isn't the
  default one.
- **Start tutorial** lists the active stations in the activity's room (rooms
  are matched by name, as `getNextActivityInRoom` does) and starts tutorial
  mode on the one picked. With one station in that room it starts there
  straight away. A room with no stations lists all stations.
- The banner goes away once a station in that room is in tutorial mode, when
  the activity ends, or when dismissed (remembered per activity in the
  browser).
- Everything is computed in the panel from the WCIF and the device list: no
  backend change and no new setting.

### Edge cases

- **Station switched to tutorial mid-solve.** The station already shows the
  real round; the solve is saved normally (see the table above).
- **Tutorial ends mid-solve.** The station already shows Tutorial; the solve
  is not saved, and it doesn't switch the mode back on: tutorial activity
  extends the mode only while it is still on. (Ending on its own mid-solve
  needs a solve longer than 15 minutes after the scan, so in practice this is
  "End tutorial" by hand.)
- **Station with a custom round (SPEC-007).** Tutorial mode wins while on;
  the custom round is kept and applies again once tutorial mode ends.
- **Station retired or deleted.** Retiring ends tutorial mode.
- **A real competitor scans at a tutorial station by mistake.** They see
  "Tutorial" instead of their round. The judge is expected to notice; if the
  solve is done anyway, it is not saved and the competitor redoes it at a
  normal station, just as with a solve on the wrong station today.
- **Card belonging to a person who can't compete (staff only).** Allowed: the
  tutorial doesn't check who may compete.

## Acceptance criteria

- [ ] A card scan on a station in tutorial mode returns the person with only
      the `tutorial` group, named in the competitor's language, even when the
      room has no group running and the person isn't registered for anything
      (unit tests on `PersonForDeviceService`).
- [ ] An unknown card on a tutorial station still gets `competitorNotFound`
      (unit test).
- [ ] An attempt with group `tutorial` writes no row in any table and calls
      no results sender, whatever the station's mode, and replies
      `tutorialAttemptEntered` (unit tests, including a station whose mode
      ended before the attempt arrived).
- [ ] An attempt with a real group on a station in tutorial mode is saved as
      normal (unit test).
- [ ] A tutorial delegate call replies `delegateWasNotified`, writes nothing
      to the database, keeps one in-memory tutorial incident per station and
      session, and emits `newIncident` with `isTutorial: true` (unit tests).
- [ ] Resolving, giving an extra and deleting a tutorial incident send
      `IncidentResolved` as in the table, and drop the entry; an entry older
      than 5 minutes is gone and resolving it answers 404 (unit tests with
      fake timers).
- [ ] Open incidents show a tutorial incident with its badge and without
      previous attempts, warnings or "save as noteworthy" (component test).
- [ ] Each tutorial scan and solve moves `tutorialEndsAt` to now + 15 min; after
      it passes, a scan gets the room's round again (unit test with fake
      timers).
- [ ] Starting the first group of the day in a room, from the panel or by
      the automatic group change, ends tutorial mode on that room's stations;
      a later group change that day doesn't (unit tests on `RoomsService`).
- [ ] `PUT /device/:id/tutorial` needs a delegate, rejects non-stations and
      retired stations, and `GET /device` returns `tutorialEndsAt` and who
      started it (e2e).
- [ ] A station in tutorial mode is off live solving while its group is
      `tutorial`, and back on with a real group (unit test on `SocketService`).
- [ ] A group start in a room with a station still in tutorial mode sends
      `tutorialNotice` `stillOn`, and the first group of the day sends
      `endedByGroupStart` (unit tests); the panel shows them as notifications
      for organisers and delegates only (component test).
- [ ] Home shows the "Tutorial for new competitors" banner from 15 minutes
      before an `other-tutorial` activity until it ends, hides it once a
      station in its room is in tutorial mode or it is dismissed, and "Start
      tutorial" starts the mode on the picked station (component tests with
      a fake clock).
- [ ] Devices shows the badge and "Start/End tutorial"; Home shows the banner;
      both disappear at `tutorialEndsAt` (component tests).
- [ ] Through the station tester: start tutorial, scan, solve, call the
      delegate, confirm; Results stays empty and the station returns to the
      room's round after "End tutorial" (Playwright).

## Rollout

One migration adding two nullable columns; nothing to backfill. No firmware,
connector or protocol change: older stations show "Tutorial" from the group
name. Reverting the backend leaves the columns unused; a station mid-tutorial
then sends a `tutorial` group the old backend doesn't know, and gets the
"No groups" or "station round changed" error rather than a saved solve, so
nothing wrong is recorded.

## Decisions

All decided on 2026-11-17; each is recorded with what was rejected in its
section.

1. **Auto-end:** 15 minutes after the last tutorial use, when the first group
   of the day starts in the station's room, or by hand ("Ending tutorial
   mode").
2. **Notifications:** delegates are told when a group starts while a station
   is still in tutorial mode, and when the first group of the day ends one
   ("Notifying delegates").
3. **Delegate call:** an in-memory tutorial incident, resolved on Incidents
   ("Delegate call during a tutorial").
4. **Live solving:** hidden everywhere while the station times a tutorial
   solve ("Live solving").
5. **Home suggestion**, added on request: a "Tutorial for new competitors"
   banner around the schedule's tutorial ("Suggesting the tutorial on Home").
