# SPEC-010: A station's last error, and how to fix it, on the Devices page

- **Status:** Accepted
- **Created:** 2026-11-15
- **Related:** SPEC-008 (Wi-Fi signal on the Devices page, same in-memory
  pattern), SPEC-009 (live device logs for admins), SPEC-005 (removed from
  round), SPEC-007 (station round changed)

## Problem

When a station rejects a scan or a solve, its screen shows a short message
such as "Competitor not found" or "Judge not found". Then the judge calls the
delegate. When the delegate gets there, the judge may already have dismissed
the screen. Even if it is still up, the message says what went wrong but not
what to do about it. Some errors are setup problems the delegate can fix in a
minute (a card nobody was given, a room with no group running). Others are the
rules working as intended (cutoff not passed, no attempts left). From the
message alone, a delegate who doesn't know FKM Time well can't tell which kind
it is.

The backend already decides every one of these errors, but it sends the
station only the translated text and keeps no record. The panel has nothing
to show.

## Goals

- On the Devices page, each station shows the last error the backend sent it,
  with a one-line explanation of what it means and what to do about it.
- The delegate can tell a setup problem they should fix from the rules working
  as intended.
- The error goes away once the station works again, so a fixed problem doesn't
  linger.
- Nothing changes for the station, the connector or the firmware.

## Non-goals

- **Errors the station detects itself:** stackmat disconnected, server
  disconnected, waiting for Wi-Fi or mDNS, both cards the same. The backend
  never hears about them, and reporting them needs a firmware change.
- **Error history and detailed device logs.** Admins get those from
  SPEC-009. This spec keeps only the latest error per station.
- **Storing errors in the database.** They matter only while someone is
  looking at the station. A backend restart clears them, as it clears the
  Wi-Fi signal.
- **An alert on Home, or a push notification.** The judge already calls the
  delegate. This view helps once the delegate opens Devices.
- **Dismissing an error from the panel.** The next successful reply, or the
  10-minute expiry, clears it. A Dismiss button would add an endpoint and
  state for little gain.
- **Changing what the station shows.** Its texts and translations stay the
  same.

## Design

### Which errors

Every reply that the backend sends to a station with `error: true`, from
`EnterAttempt` (`result/resultFromDevice.service.ts`) and `PersonInfo`
(`person/personForDevice.service.ts`), plus the catch-all in
`socket/socket.server.ts`. `CreateAttendance` never replies with an error, so
it has nothing to record.

Each error has a **kind**:

- `problem`: something is set up wrong, and the delegate can fix it.
- `rule`: the system did what the regulations or the schedule say. Usually
  there is nothing to fix, but the delegate may want to know why.

| Key | Kind | When | What the panel tells the delegate |
|---|---|---|---|
| `competitionNotFound` | problem | No competition imported | Import the competition. |
| `noGroups` | problem | The station's room has no group running, and the station isn't pointed at a round | Start a group in the station's room, or point the station at a round. |
| `groupNotFound` | problem | The solve came without a round, and the room runs several | Ask the competitor to scan their card again and choose the round. |
| `stationRoundChanged` | problem | The room's group, or the station's round, changed during the solve (SPEC-007) | The solve was not saved. Enter it by hand in Results, or give an extra. |
| `competitorNotFound` | problem | The scanned card belongs to nobody | Card {cardId} isn't assigned. Assign it on the Cards page. |
| `judgeNotFound` | problem | The judge's card belongs to nobody | Card {cardId} isn't assigned. Assign it on the Cards page. |
| `judgeIsCompetitor` | problem | The competitor's card was scanned as the judge's | Another person has to scan their card as the judge. |
| `judgeCardNotScanned` | problem | A resolved incident is being re-entered without a judge card | The judge has to scan their card to enter the redo. |
| `competitorIsNotSignedInForEvent` | problem | The competitor isn't registered for the event | Check that the competitor is at the right station, or fix their registration. |
| `internalError` | problem | The backend failed while handling the request | Something failed on the server. Try again, and check the backend logs if it happens again. |
| `attemptAlreadyEntered` | rule | The station sent a solve that is already saved | Already saved. If the time differs from the station's, check the attempt in Results. |
| `competitorRemovedFromRound` | rule | The competitor was removed from the round (SPEC-005) | Restore them in Results if that was a mistake. |
| `cutoffNotPassed` | rule | The competitor didn't make the cutoff | Nothing to fix: the cutoff was not met. |
| `noAttemptsLeft` | rule | Every attempt in the round is already entered | Grant an extra attempt if the competitor is owed one. |

`stationNotFound` isn't shown. A station the backend doesn't know isn't on the
Devices page, and it already shows its own "device not added" screen.

The panel holds the explanations, keyed by error key. The backend sends only
the key and the details, so the wording can change without a backend release.
An unknown key (a newer backend with an older frontend) shows the station's
message with no explanation.

### Backend

- **Recording the key.** Where a service returns an error to a station, the
  reply also carries `errorKey`. `SocketService.enterAttempt` and
  `SocketService.getPersonInfo` pass the reply to the new
  `StationErrorService`, then remove `errorKey` before the reply goes back to
  the connector. Nothing new reaches the connector or the station.
  The catch-all in `socket.server.ts` records `internalError` for the
  request's `espId`, if it has one.
- **Recording a success.** A reply without `error` clears the station's error
  in the same service. That includes `attemptEntered`,
  `attemptEnteredButReplacedToDnf`, `delegateWasNotified`, and a `PersonInfo`
  that returns a person.
- **`StationErrorService`** (in `device/`, next to `StationSignalService`)
  keeps one entry per `espId` in memory:

  ```ts
  interface StationLastError {
    key: string;          // e.g. 'competitorNotFound'
    kind: 'problem' | 'rule';
    message: string;      // the text the station showed, in its language
    at: string;           // ISO time of the latest occurrence
    count: number;        // how many times in a row this key happened
    cardId: string | null;          // the card the error is about, if any
    competitorName: string | null;  // when the backend knows who it was
  }
  ```

  The backend sets `kind`, so the panel and any later consumer agree on it.
  `count` goes up while the same key repeats, and restarts at 1 when the key
  changes. "Competitor not found ×4" means a card that keeps failing, not a
  single bad scan.
- **Expiry.** An entry older than 10 minutes counts as gone. The backend
  can't see when the judge dismisses the screen, so a station left idle after
  an error would otherwise show it all day. Ten minutes is long enough for the
  delegate to walk over, and short enough not to mislead later in the day. The same 5 s sweep that
  `StationSignalService` runs can send the clear.
- **Device list.** `GET /device` adds `lastError: StationLastError | null` to
  each station.
- **Live updates.** A new `deviceError` event (`{ espId, lastError }`) goes to
  the `device` room whenever a station's entry is set, changes or clears. Like
  `deviceSignal`, it does not reuse `deviceUpdated`, which would make every
  open Devices page refetch the whole list.

### Frontend (Devices page)

- **Where it shows.** A `StationErrorIcon` next to the signal icon, in the
  table and in the card view (`DeviceItem.tsx`). Stations with no current
  error show nothing.
  - `problem`: `TriangleAlert`, red (destructive).
  - `rule`: `Info`, muted.

  `rule` errors show too, but muted. The judge calls the delegate either way,
  and "why does the station say No attempts left?" needs an answer as much as
  a setup problem does.
- **Details.** Tapping or clicking the icon opens a popover. Delegates mostly
  use phones, and tooltips don't open on touch. The popover shows:
  1. The station's message, as the station showed it, with "×N" when
     `count` > 1.
  2. The explanation from the table above, with `{cardId}` filled in.
  3. "4 min ago", and the competitor's name when known.

  The icon's `aria-label` is the station's message.
- `deviceError` updates that one station in place, the same way
  `deviceSignal` does.
- The relative time ticks on its own. When an entry passes 10 minutes, the
  panel hides it even if the backend's clear hasn't arrived yet.

### Edge cases

- **A solve resent after a lost reply.** The station gets
  `attemptAlreadyEntered`. If it is the same solve (`shouldResetTime: true`),
  it was saved and nothing went wrong, so it counts as a success and clears
  the error. If it differs, it is recorded as a `rule` error.
- **Several requests in flight.** The latest reply wins. The backend handles
  one station's requests in order, so this matches what the station shows.
- **Station deleted.** Its entry is dropped, with no event.
- **Backend restart.** Every station starts with no error.

## Acceptance criteria

- [ ] Every error reply from `EnterAttempt` and `PersonInfo` carries an
      `errorKey`, and the reply the connector receives does not (unit tests on
      `SocketService`).
- [ ] An error reply sets the station's entry with key, kind, message, card
      and count. The same key again increments `count`, and a different key
      resets it to 1 (unit tests on `StationErrorService`).
- [ ] A successful reply, and a same-solve `attemptAlreadyEntered`, clear the
      entry (unit tests).
- [ ] An entry older than 10 minutes is dropped and `deviceError` fires with
      `null` (unit test with fake timers).
- [ ] An exception while handling a station request records `internalError`
      (unit test).
- [ ] `GET /device` includes `lastError` for stations (e2e).
- [ ] `StationErrorIcon` picks the icon and tone by kind, and its popover shows
      the message, the explanation with the card filled in, ×N and the age
      (component test).
- [ ] An unknown card scanned through the e2e station helper shows the
      problem icon on Devices, and its popover says to assign the card. A
      later successful scan removes it (Playwright).

## Rollout

No migration, and no change to firmware, connector or the station protocol.
The backend and frontend ship together. A frontend without this ignores
`lastError` and `deviceError`. Reverting removes the icon, and stations keep
working as before.
