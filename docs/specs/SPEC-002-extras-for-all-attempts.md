# SPEC-002: Extras for all attempts so far

- **Status:** Accepted
- **Created:** 2026-10-30
- **Related:** existing extras flow (`EXTRA_GIVEN` / `replacedBy`),
  [SPEC-001](SPEC-001-head-to-head.md) (extras in head-to-head rounds), #513
  (stations running a custom round), #514 (DNF all attempts, built after this)

## Problem

Sometimes every attempt a competitor has done so far is invalid, not just the
latest one. The usual case is an illegal cube: it is found on attempt 3, and
attempts 1 and 2 were solved on the same cube. The delegate wants the competitor
to redo all of them.

Today a delegate can only give extras one attempt at a time. For a finished
average that means five separate "Give extra attempt" actions, on a busy
competition day, for one decision. It is easy to get wrong, and each attempt
gets its own comment.

Giving several extras by hand also runs into gaps in the extras flow that one
extra at a time rarely hits. See *Gaps to close*.

## Goals

- One delegate action replaces the attempts the competitor has completed in the
  round, all of them by default, from the incident screen or from the result page.
- The competitor redoes those attempts at a station, in order, then carries on
  with their remaining standard attempts, if any.
- A long redo can use the normal scrambles of a fresh set: the next group's, which
  is the usual practice for 3 or more attempts, or a newly imported one.
- The result ends up correct in all the awkward cases: chained extras, cutoffs,
  cumulative limits, double-checked results, WCA Live.
- Nothing is lost: replaced attempts stay visible with their edit history, and the
  delegate can go back to all the original attempts in one action, at any time.
- No change to station firmware or the micro-connector.

## Non-goals

- Replacing attempts across several rounds. A cumulative limit shared between
  rounds is handled per round, like any other extra.
- Head-to-head rounds. SPEC-001 has no single-competitor extras, so the action
  isn't offered for format `h`.
- Generating scrambles. The delegate generates a set outside FKMTime and adds it
  with the existing "Add scramble set" import.

## Design

### Approach

No separate mechanism. "Replace everything so far" is the existing extra applied
to a set of attempts, so it reuses `EXTRA_GIVEN` / `replacedBy`, the station
flow, the scrambling flow and the reorder board. It adds a single-call bulk
action on top and closes the gaps below.

The alternative was a separate restart mechanism: archive the attempts under a
new generation and let the competitor start again from attempt 1. It suits a
next-group redo, but every read of attempts would need a generation filter, and
single extras would stay alongside it as a second mechanism. Fresh-set mode below
gives the same result on the station and scrambling device.

Example: Ao5, the competitor has done attempts 1 to 3 and attempt 2 was already
replaced by E1.

| Attempt | Before | After granting | After the redo |
|---------|--------|----------------|----------------|
| 1 | counts | `EXTRA_GIVEN`, waiting | `replacedBy` E2 |
| 2 | `replacedBy` E1 | unchanged | unchanged |
| E1 | counts, for 2 | `EXTRA_GIVEN`, waiting | `replacedBy` E3 |
| 3 | counts | `EXTRA_GIVEN`, waiting | `replacedBy` E4 |
| 4, 5 | not done | not done | done as standard attempts |

The counting attempts end up as E2, E3, E4, 4, 5.

### What gets replaced

The delegate chooses from the attempts `getCountingAttempts` returns at that
moment, with all of them ticked. That covers standard attempts, and extras that
currently count for a position. Unticking serves a competitor who used the
illegal cube for only part of the round. So:

- DNS attempts are offered and ticked like any other. Otherwise attempts auto-DNSed
  by a cumulative limit would stay DNS after the time was handed back.
- Attempts already waiting for an extra are left alone, so they keep their place.
- `SCRAMBLED` attempts have no time yet and are left alone. A scrambled attempt 4
  waits until the extras are done.

### API

```
POST /attempt/give-extras-for-all        (DelegateGuard)
{
  "resultId": "…",
  "attemptIds": ["…", "…"],
  "comment": "Illegal cube",
  "useFreshSet": true,
  "removeFromLive": true
}
→ 200 { "replaced": 3 }
```

Errors: `404` for no such result, `400` when nothing is replaced or an id isn't a
counting attempt of this result, `400` for a head-to-head round, `409` when the
result has an open incident ("resolve it first").

The endpoint itself never touches an open incident. The frontend saves it as extra
given first, so all the existing handling still applies.

`GET /attempt/give-extras-for-all/:resultId` gives the modal what it needs: whether
another group of the round follows, whether the next round has started, and what
can be restored.

In one `prisma.$transaction`:

1. Create the `ExtraGrant` (see *Restoring the original attempts*).
2. Set each target to `status: EXTRA_GIVEN`, `replacedBy: null`, with the comment
   and `updatedBy`, and store `extraGrantId` and `statusBeforeGrant`. The comment
   overwrites, as a single extra does; the edit log keeps the old one.
3. Log each with `'Extras given for all attempts'`.
4. Clear `isDoubleChecked`, `doubleCheckedAt` and `doubleCheckedById`. The
   checked times no longer count, so the result has to come back for checking
   when the redo is done.

Then, outside the transaction, send the scorecard to WCA Live / Cubing Contests if
`removeFromLive` is set, and call `handleAttemptUpdated`. A sync failure is logged
and doesn't fail the request. See *WCA Live*.

### Gaps to close

These are in the existing code. Each one is rare with single extras and ordinary
with several.

1. **Order of waiting attempts.** `enterAttempt` picks the attempt to replace
   with `attempts.find` on an unsorted query, so E1 may not land on attempt 1.
   Add one helper, `getAttemptsWaitingForExtra(attempts)`, returning waiting
   attempts in position order, following chains, so a waiting E1 that counts for
   attempt 2 sorts as position 2. `enterAttempt` and `getNextAttemptData` both
   use it. The check treats `replacedBy` `0` and `null` as waiting, as now.
2. **Waiting extras still count.** `getFinalExtraAttempt` returns the last extra
   in a chain even if it is `EXTRA_GIVEN` itself, so `getCountingAttempts` keeps
   counting and syncing the invalid time. Skip it when it isn't a real result.
   The frontend copy (`getExtra` / `getSubmittedAttempts` in `lib/utils.ts`) needs
   the same fix.
3. **Cutoff.** See *Cutoff*.
4. **Cumulative limit.** See *Cumulative limit*.
5. **Finished rounds.** `getFinishedRoundIds` checks the cutoff against all raw
   attempts, including replaced ones, so a discarded time under the cutoff keeps
   the round open on the station. It should check counting attempts.

### Cutoff

The new attempts decide the cutoff; the replaced ones no longer matter.

The case that needs handling: Ao5 with a cutoff in 2. The competitor made the
cutoff on an illegal cube, has done 3 attempts, and gets all 3 replaced. E1 and
E2 both miss the cutoff, so the round is over, but attempt 3 is still waiting. A
third extra is rejected with `cutoffNotPassed`, the attempt waits forever, the
result never reaches double-check and the group can't be changed.

So add `AttemptStatus.VOIDED`: replaced, and no replacement needed. A new helper
`settleWaitingExtras(resultId)` applies the rule: if the round has a cutoff, the
counting attempts have reached `numberOfAttempts` and none meets it, every
attempt still waiting becomes `VOIDED`, logged as `'No longer needed: cutoff not
met'`. It runs after anything that can change counting attempts: an extra entered
at a station, and `updateAttempt`, `createAttempt` and `setAttemptReplacement` on
the panel, so an extra that went through an incident is covered.

`VOIDED` attempts never count, aren't waiting, and aren't incidents or statistics.
The row and its edit history stay, because the solve really happened, and because
the time that triggered this can still be wrong before double-check. Settling only
goes one way. If a delegate later corrects a time so that the cutoff is met, they
use "Give extra attempt" on the voided attempt, which stays available and puts it
back to waiting.

The other direction needs nothing: a competitor who missed the cutoff, had both
attempts replaced and now meets it continues to attempts 3 to 5 as usual.

### Cumulative limit

Replaced attempts stop counting towards the limit, since `getSubmittedAttempts`
only sees counting attempts, so the competitor gets that time back, and the
station's "Remaining" text follows.

If the limit runs out during the redo, `dnsOther` is ignored on the extra path
today, so the competitor would be called back to DNF each remaining attempt. On
that path, also create a DNS extra for each attempt still waiting and link it,
then fill the remaining standard attempts with `dnsOtherAttempts`. The result
stays complete, unlike voiding, because a cumulative limit doesn't shorten the
round.

### WCA Live

The delegate is asked once, when granting: "Remove these times from WCA Live now",
ticked by default. After that, redo attempts are sent as normal, following
`sendingResultsFrequency`; only this first step is a choice. When the competition
is set to `NEVER` the option isn't shown and nothing is sent. On `EVERY_5_MINUTES`
an unticked grant still reaches WCA Live with the next send of the round.

After a full grant there are no counting attempts, so the scorecard goes out with
`attempts: []`, the same payload as deleting a result's last attempt today. WCA
Live's source accepts this and treats the result as empty (`Result.changeset` has
no minimum length, and `Result.empty?` is `attempts == []`), which takes the invalid
times off the public results straight away. Not yet tried against the live service.

When every attempt was replaced, scorecards during the redo are a correct prefix,
because attempts are replaced in position order. After a partial grant the attempts
that still count close up until the redo is finished, as with single extras today:
replacing 1 and 3 of 1 to 4 shows 2 and 4 in the first two places. The final
scorecard is correct.

### Stations and scrambling

No protocol change. The station already shows "Attempt E2" and the scrambling
device already asks for the next extra from `getNextAttemptData`, one at a time.
An open incident on the station gets the existing `IncidentResolved` with
`shouldScanCards: false`.

A set usually has fewer extra scrambles than a long redo needs. With no scramble
left the scrambling device shows "Scramble not found". The confirmation says how
many extras are needed, so the delegate can prepare them or use a fresh set.

### Fresh-set mode

A competitor doing 3 or more attempts again usually joins the next group of the
round, because that group's normal scrambles are fresh for them, unless they
judged or scrambled it. In the last group there is no next group, so the delegate
generates a set and adds it with "Add scramble set". Scramble sets belong to the
round and the scrambling device lists all of them, so both cases are the same:
the redo uses the normal scrambles of whichever set is open on the device. FKMTime
doesn't need to know which set it is. Stations and the scrambling device check the
round, not the group, so the competitor can already compete in a later group.

Attempts are still stored as extras, with the same links and counting, but each is
shown and scrambled by its position. E2 replacing attempt 2 appears as "Attempt 2"
on the station and uses scramble 2 of the open set. The remaining standard attempts
then use their own numbers.

- `useFreshSet` is stored on the grant (see *Restoring the original attempts*), so
  `getNextAttemptData` and the station text can apply it. It only applies while an
  attempt from that grant is waiting, so a single extra given later uses extra
  scrambles as usual.
- `getNextAttemptData` returns the attempt to sign and the scramble to show
  separately, so the scrambling device no longer treats them as one number.
- No firmware change: the station text comes from the backend.

### Restoring the original attempts

A delegate may need the original attempts back: the grant was a mistake, or a later
ruling says the cube was fine. This works at any time, including after the redo.

Each grant is stored, so that it can be undone exactly:

```prisma
model ExtraGrant {
  id          String    @id @default(uuid())
  resultId    String
  useFreshSet Boolean
  createdById String
  createdAt   DateTime  @default(now())
  restoredAt  DateTime?
}
```

`Attempt` gains `extraGrantId` and `statusBeforeGrant`, set on each replaced attempt.

`POST /attempt/restore-extra-grant` with `{ "grantId": "…" }` (`DelegateGuard`)
does this in one transaction:

1. Puts each attempt of the grant back to `statusBeforeGrant`, with `replacedBy`
   as it was: `null` for an attempt that counted. That includes attempts now
   `VOIDED`.
2. Clears `isDoubleChecked`, because the counting attempts changed again.
3. Logs each with `'Original attempt restored'` and sets `restoredAt`.

Then it sends the scorecard, unless the competition is on `NEVER`.

Redo attempts stay, keep their history and appear on the attempts tab, but nothing
links to them, so they don't count. Standard attempts done after the grant still
count, and so do auto-DNSed ones, which the delegate corrects by hand if needed.

Only the latest unrestored grant of a result can be restored, so two grants on one
result unwind in order. Restoring returns `409` with an open incident on the result.

### Group changes

`checkIfGroupCanBeChanged` needs two rules, in either mode:

- When another group of the round follows, a result in fresh-set mode is skipped
  until its first redo attempt is entered, so a redo planned for the next group
  doesn't hold this one back. A full grant has no counting attempts and is already
  skipped. Once the redo has started, the result blocks the change until it is
  finished.
- In the last group of a round, a waiting attempt always blocks the automatic
  change, including when the result has no counting attempts. Stations can't enter
  attempts for an earlier round, so moving on would strand the redo.

### Entering a redo by hand

A redo may have to be typed in, for example once stations have moved to the next
round. An extra entered in the panel replaces the next waiting attempt, as at a
station. `createAttempt` links them, and the settling and sending that follow are
the same. "Enter attempt" and quick entry start on the next extra while attempts are
waiting, and offer as many extras as the redo needs. Editing keeps any extra, however
high its number.

Extras can be typed in any order. Within a grant they always go to their attempts in
order, so E1 replaces the first attempt even if E2 was entered before it. Extras a
delegate assigned by hand outside a grant are left as they are. Numbering follows the
highest extra, so a gap doesn't reuse a number.

The scorecard page works by standard attempt number, so for a competitor with
attempts waiting it sends the delegate to their result instead.

### Frontend

Plain task language; the delegate never sees statuses.

**Result page (`SingleResult`).** A "Give extras for several attempts" action, shown
when there is at least one counting attempt. An open incident on the result comes
along locked in, as from the incident panel; with several open, the action is
disabled until they are resolved. It opens a modal
with the quick actions and a comment, like `GiveExtraAttemptModal`, plus what will
happen:

The modal lists the counting attempts, all ticked, and the text follows the
selection:

> Attempts 1, 2 and 3 will no longer count. Jane Doe redoes them, then continues
> from attempt 4.

Below that, a choice of scrambles, always shown: "Extra scrambles" or "Normal
scrambles from a fresh set". Three or more selected attempts preselect the fresh
set, fewer preselect extras, and the delegate can change it. With extras selected
the text adds how many are needed. In the last group of a round, the fresh set
option adds a hint to generate a set and add it under Scrambles first.

**Incident panel (`IncidentPanel`).** A separate "Give extras for several attempts"
button next to "Save and give extra", shown when the competitor has counting
attempts besides this one. It opens the same modal, with the incident's attempt
included and locked, and the modal's quick actions fill the comment. On submit the
panel calls `updateAttempt` for the incident as now, then the new endpoint. The
incident goes first so all the existing handling (noteworthy, station response)
still applies and the endpoint's open-incident check passes. If the second call
fails the competitor has a single extra; show the error, and the delegate can finish
from the result page.

**When the next round has started.** Detected by anyone having attempts in the next
round of the event. The action stays available, with a warning in the modal: "The
next round has started. Stations can't take these attempts, and any change to who
advanced must be made in WCA Live." FKMTime doesn't work out advancement, and WCA
Live takes it from who is in the next round once that round is open, so a redo
doesn't move anyone by itself.

**Result page, restoring.** While the result has a restorable grant, a "Use original
attempts" action opens a confirmation listing what will count again and what stops
counting.

**Voided attempts.** For delegates and competitors these effectively didn't happen.
They are left out of the counting attempts, results, incident lists, statistics and
staffing warnings. On the result page they appear greyed out on the attempts tab,
with "Give extra attempt" still available, and on the reorder board, which needs
every attempt to renumber correctly. `prettyAttemptStatus` shows "Extra not needed". `attemptOutcome` gets a
`voided` outcome that only appears when editing such an attempt, like `open` and
`scrambled`.

Replaced attempts appear in the incident lists and in "previous extras" as
separate rows, one per attempt, with the same comment. That's accurate and needs
no change.

## Acceptance criteria

- [ ] Giving extras for all attempts on a 3-attempt Ao5 result leaves no counting
      attempts, and the next three attempts entered at a station become E1 to E3,
      replacing attempts 1 to 3 in order. The next one is standard attempt 4.
- [ ] A finished Ao5 is replaced by E1 to E5 and comes back to double-check after
      E5, with `isDoubleChecked` cleared at grant time.
- [ ] A chain 2→E1 is replaced through E1, and E1 stops counting at grant time.
- [ ] The scorecard sent after each step contains only valid attempts, in position
      order.
- [ ] Cutoff in 2, 3 replaced, E1 and E2 miss: attempt 3 becomes `VOIDED`, the
      result is finished with 2 attempts, reaches double-check, and the station no
      longer offers the round.
- [ ] A `VOIDED` attempt appears only on the result page, greyed out on the attempts
      tab, keeps its edit history, and "Give extra attempt" puts it back to waiting.
- [ ] Cutoff in 2, 2 replaced, E1 and E2 meet it where the originals didn't: the
      competitor continues to attempt 3.
- [ ] Cumulative limit runs out on E2 of 5: E3 to E5 are DNS extras and the result
      is complete. Remaining time on the station includes the handed-back time.
- [ ] A competitor whose attempts 3 to 5 were auto-DNSed gets all five replaced.
- [ ] Unticking attempts 1 and 2 of a finished Ao5 replaces only 3 to 5, with the
      redo in those positions.
- [ ] A `SCRAMBLED` attempt 4 isn't replaced and is used after the extras.
- [ ] In fresh-set mode, a redo of attempts 1 to 3 shows "Attempt 1" to "Attempt 3"
      on the station, uses scrambles 1 to 3 of the set open on the scrambling
      device, is stored as E1 to E3, and continues with attempts 4 and 5.
- [ ] A set added with "Add scramble set" works for a fresh-set redo.
- [ ] The modal preselects extras for 1 or 2 attempts and a fresh set for 3 or more,
      and both can be changed.
- [ ] A fresh-set grant doesn't hold back the automatic group change while another
      group of the round follows, and blocks it once the redo has started.
- [ ] In the last group of a round, a waiting attempt blocks the automatic group
      change, even with no counting attempts.
- [ ] "Remove these times from WCA Live now" is ticked by default and sends the
      scorecard at grant. Unticked, nothing is sent at grant. With `NEVER` the option
      is hidden and nothing is sent. Redo attempts are sent as normal in every case.
- [ ] With attempts in the next round of the event, the modal shows the warning and
      the grant still works.
- [ ] The endpoint returns `409` with an open incident, `400` with nothing to
      replace, `400` on format `h`, and requires a delegate.
- [ ] All replacements in one call succeed or fail together.
- [ ] From the result page, an open incident comes along locked in, and with several
      open the action is disabled.
- [ ] A five-attempt redo can be entered by hand: the form starts on E1 and moves to
      E5, each replaces its attempt, and they all count.
- [ ] Entering E2 before E1 by hand still puts E1 on the first replaced attempt.
- [ ] Editing E3 or later keeps it that extra.
- [ ] The scorecard page sends a competitor with attempts waiting to their result.
- [ ] From the incident panel, the button opens the shared modal with the incident's
      attempt locked in, and the station waiting on that incident is released.
- [ ] Every replaced attempt keeps its edit history and can be restored one by one.
- [ ] "Use original attempts" before the redo puts all five back, with their previous
      statuses, and nothing is waiting.
- [ ] "Use original attempts" after a finished redo makes the five originals count
      again, leaves E1 to E5 in place but not counting, clears the double-check and
      sends the scorecard.
- [ ] Restoring brings back a `VOIDED` attempt and an extra that counted in a chain.
- [ ] With two grants on one result, only the latest can be restored.
- [ ] Single extras behave as before, apart from the gap fixes.

## Rollout

- `AttemptStatus` gains `VOIDED`, `ExtraGrant` is a new table and `Attempt` gains two
  nullable columns, applied by `prisma db push` on start (the repo has no
  migrations). All of this only adds to the schema.
- Backend and frontend ship together. Stations and the micro-connector don't
  change, so older firmware works.
- Revert: remove the UI and endpoint first and keep the enum. If any `VOIDED` rows
  exist, set them back to `EXTRA_GIVEN` by hand before removing the value, because
  old code would count them.
- The gap fixes are useful on their own and can go in a PR before the feature.
- Update the user docs at fkmtime.github.io.

## Decisions

1. **Build on existing extras, with a next-group mode.** Rejected: a separate
   restart mechanism (about 71 backend reads of attempts to check, a second
   mechanism next to single extras, hard to move away from) and keeping single
   extras only (the gaps stay, and scrambles run out on long redos).
2. **Picker with everything ticked, DNS attempts included.** Rejected: all
   attempts with no picker (a competitor who used the illegal cube for only part
   of the round couldn't use next-group mode) and leaving DNS out (attempts
   auto-DNSed by a cumulative limit would stay DNS).
3. **Choice of scrambles preselected by count, always shown.** Three or more
   attempts preselect a fresh set. This widens the next-group mode from decision 1:
   a fresh set is the next group's or a newly imported one, which covers the last
   group of a round. Rejected: automatic by count (no way to handle a competitor
   who has seen those scrambles) and a plain choice with nothing preselected.
4. **New `VOIDED` status, hidden from normal views.** An attempt left waiting after
   the cutoff is missed keeps its row and history but shows only, greyed out, on the
   result page's attempts tab. Rejected: deleting it (automatic and unrecoverable,
   triggered by a time that may still be corrected before double-check) and working
   it out when reading (four checks would need the cutoff).
5. **Fill automatically when a cumulative limit runs out.** Remaining waiting
   attempts get linked DNS extras and remaining standard attempts get DNS, as in a
   normal round. Rejected: today's behaviour (the competitor returns for each one
   and gets a DNF) and leaving it to the delegate (the result stays blocked).
6. **Ask once whether to remove the times from WCA Live, ticked by default.** Redo
   attempts then follow the normal send setting, and the option is hidden on
   `NEVER`. Rejected: always sending, and not
   sending at grant (invalid times could stay public for a whole group).
7. **Separate button in the incident panel, opening the shared modal.** Rejected: a
   quick action setting (a new column, and it only helps competitions that set it
   up; can be added later) and an inline checkbox (the choices built twice, and a
   long screen on phones).
8. **Restore the original attempts in one action, at any time.** Grants are stored
   to make it exact. Rejected: no bulk undo, an undo that ends at the first redo
   attempt (a later ruling can still bring the originals back), and an undo that
   only appears in a toast.
9. **Allow it with a warning once the next round has started.** It's the delegate's
   call. Rejected: blocking it (stops a late ruling) and no warning (a redo no
   station accepts, with no hint why). Stations running a custom round is tracked
   separately as a long-term change in #513.
10. **"DNF all attempts" is a separate change, built after this spec.** It reuses
    the modal and restore. Rejected: adding it here (a large spec grows, and the
    all-rounds case doesn't fit a per-result modal), building it first (no restore)
    and not building it.
