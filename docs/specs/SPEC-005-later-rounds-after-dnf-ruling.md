# SPEC-005: Removing later-round results after a DNF ruling

- **Status:** Accepted
- **Created:** 2026-11-08
- **Related:** #514 and PR #630 (DNF all attempts, built on), WCA Regulations
  9t, 9t++, 9t3, 9p4, 2j1a, 3k2

## Problem

A delegate can rule a competitor's attempts DNF, for example after an illegal
cube (Regulation 3k2), in one round or across every round of an event (#514).
Sometimes the ruling comes late: the illegal cube used in round 1 is found
during round 2. The round 1 attempts become DNF, and the competitor may no
longer have qualified for round 2.

Regulation 9t says what happens then:

> If any change occurs to the results of a competitor […] such that the
> competitor would not have advanced to the next round […], all results of this
> competitor for all subsequent rounds must be removed.

9t++ applies this during the competition too. 9t3 protects everyone else: if
the change means another competitor would not have advanced either, their
results stay.

The same rule covers any other change that costs the competitor their place,
which 9t names itself: a score-taking mistake corrected later, or a retroactive
penalty. In FKMTime those are ordinary attempt edits, not DNF rulings.

Today the only way to remove a result is "Delete result", which deletes its
attempts and their edit history for good. A ruling can be reversed later (a
later ruling says the cube was fine), and then the round 2 result is gone with
nothing to bring it back.

## Goals

- In the DNF modal, the delegate can also remove the competitor's results in
  every later round of the event, in the same action.
- For any other 9t cause, the delegate can remove a later-round result on its
  own, with a reason, and bring it back later.
- Removed results are kept with their attempts and edit history, but count
  nowhere: not in results, double-check, statistics, public views, group
  progress or scorecards sent.
- Restoring the ruling, or bringing back a result removed on its own, returns
  it exactly as it was.
- A station refuses further attempts for a competitor whose result in that
  round was removed.
- No change to station firmware or the micro-connector.

## Non-goals

- Working out advancement. FKMTime doesn't rank rounds, and the WCA Live round
  is the source of truth for who advanced. The one certain case, a round left
  with only DNF and DNS (9p4), is detected; everything else is the delegate's
  call.
- Touching other competitors' results (9t3), or moving the next-ranked
  competitor into the round (9p3).
- Calling WCA Live's "remove person from round". It needs a signed-in WCA Live
  session, and the empty scorecard already has the same effect (see *WCA
  Live*).
- Head-to-head rounds, which the DNF ruling doesn't cover (and 9t4 excludes
  between stages).

## Design

### Schema

`Result` gains four nullable columns:

```prisma
model Result {
  // …
  removedAt           DateTime? @map("removed_at")
  removedById         String?   @map("removed_by_id")
  /// Why it was removed, shown on its page
  removedReason       String?   @map("removed_reason")
  /// The result whose DNF ruling removed this one, so restoring it brings this
  /// back. Null when it was removed on its own.
  removedByRulingOfId String?   @map("removed_by_ruling_of_id")
}
```

`@@unique([personId, roundId])` stays. A removed result still holds its slot, so
`getResultOrCreate` finds it and refuses, instead of creating a second, empty
result a station could fill.

### Which rounds

The trigger is the earliest round in the ruling that has an attempt set to DNF.
"Later rounds" are every round of the same event with a higher number in which
the competitor has a result. In the event-wide modal, attempts in those rounds
can't be ticked while removal is on, since their whole result goes. The
"DNF all remaining attempts" checkbox then applies to the last round that stays.

### The modal

Shown only when the competitor has results in later rounds:

> ☐ Remove results in later rounds (Regulation 9t): 3x3x3 R2, 3x3x3 R3

- **Ticked by default** when, after the ruling, the trigger round has only DNF
  and DNS results, so the competitor can't have advanced (9p4). The text says
  why: "With only DNF results, Jane Doe can't advance."
- **Unticked** otherwise, with a hint: "Tick if Jane Doe would no longer have
  advanced."
- When ticked, it says what happens in WCA Live (see *WCA Live*). Only a
  competition set never to send results asks the delegate to remove the
  competitor there.

### API

`POST /attempt/dnf` gains `removeLaterRounds: boolean`. In the same transaction
as the ruling, each later result gets `removedAt`, `removedById` and
`removedByRulingOfId` (the trigger round's result). Errors: `409` when a later
result has an open incident, because it would disappear from the incident lists
("Resolve the open incident in 3x3x3 R2 first").

After the transaction, an empty scorecard (`attempts: []`) is sent for each
removed result unless the competition never sends, the same payload as deleting
a result's last attempt.

### WCA Live

An empty result is enough; FKMTime doesn't need to remove the competitor from
the round. In WCA Live's source, a result with no attempts:

- gets no ranking (`Scoretaking.Ranking`),
- is left out of the results export used for submission
  (`CompetitionController.show_results`),
- is dropped when the next round opens, which recomputes who advanced
  (`Scoretaking.finish_round`).

Sending the trigger round's DNFs also recomputes advancement there, so a
competitor left with only DNFs loses "advancing". What remains is a blank row on
the WCA Live round page until the next round opens; in a final it stays, but
doesn't count. WCA Live's own "remove person from round" is a GraphQL mutation
that needs a signed-in session, which the scoretaking token can't provide.

`GET /attempt/dnf/:resultId` also returns the results that ruling removed, for
the card.

### Restoring

`POST /attempt/restore-dnf` on the trigger round also clears `removedAt`,
`removedById` and `removedByRulingOfId` on every result with
`removedByRulingOfId` = that result, and sends their scorecards again. Their
attempts were never touched, so they come back exactly as they were, including
their double-check.

A result a ruling removed comes back only with that ruling, so the two can't
disagree. A result removed on its own comes back from its own page (see below).

### Removing on its own

For any other 9t cause, a later-round result can be removed directly:

```
POST /result/:id/remove        (DelegateGuard)
{ "reason": "Score-taking mistake in R1" }
→ 200

POST /result/:id/bring-back    (DelegateGuard)
→ 200
```

- **Remove** sets `removedAt`, `removedById` and `removedReason`, leaves
  `removedByRulingOfId` null, and sends an empty scorecard unless the
  competition never sends. It is refused with `400` for a first round (nothing
  to advance from) and `409` with an open incident on the result.
- **Bring back** clears those columns and sends the scorecard again. It is
  refused with `409` for a result a ruling removed: "Restore the ruling in
  3x3x3 R1 instead".
- The same rounds as in the DNF modal are affected only if the delegate removes
  each one. The action removes one result, since the delegate is the one who
  knows which rounds the competitor would not have reached.

### Reading results

Removed results must drop out of every read that isn't about that result
itself. There are about 70 queries on `result` and `attempt` across 11 backend
services (results, attempts, statistics, competition and group progress,
incidents, device, attendance, events, person for device).

- **`Result` queries:** a Prisma client extension in `DbService` adds
  `removedAt: null` to `findMany`, `findFirst`, `count`, `groupBy` and
  `aggregate` unless the query sets `removedAt` itself. `findUnique` by id is
  left alone, so a removed result's page still opens.
- **`Attempt` queries** get the same extension: it adds
  `result: { removedAt: null }`, merged into any `result` filter the query
  already has. A query that names one result or one attempt (`resultId` or `id`
  in `where`) is left alone, because it is about that result's own rows. Doing
  this in one place means a new query can't forget it.
- A query that needs removed results too spreads `INCLUDING_REMOVED` into its
  `where`. Only the competitor's results for a delegate and the results a
  ruling removed use it.
- Nested reads (`include: { results }`, relation filters such as
  `results: { some: … }`) aren't covered by the extension and filter by hand.
- `getPersonsWithNoResultsByRoundId` treats a removed result as no result, but
  doesn't list the competitor as missing.

### Stations and the scrambling device

When an attempt or a scramble comes in for a removed result, the backend
answers with a new translation, `competitorRemovedFromRound` ("Removed from
this round"), through the existing error message. The text comes from the
backend, so this needs no protocol change. A solve sent after the removal isn't
stored; the competitor is no longer in the round.

### Frontend

- **Result page of a removed result:** a banner "Removed from this round under
  Regulation 9t", with the reason, or "after the ruling in 3x3x3 R1" linking to
  that result. Editing is disabled. A result removed on its own has a "Bring
  back" button; one a ruling removed points to restoring the ruling.
- **Result page of a later round:** "Remove from this round (Regulation 9t)" in
  the ⋮ menu, opening a short modal with a reason and what happens in WCA Live.
  Not shown for a first round. The incident quick actions don't apply here,
  so the reason is typed.
- **Result page of the trigger round:** the "Ruled DNF" card adds "Also removed:
  3x3x3 R2", with links. Restoring says it brings those results back.
- **Competitor page, Results tab:** removed results stay listed for delegates,
  greyed out, marked "Removed". Organisers and everyone else don't see them.
- **Everywhere else** (round results, double-check, public view, statistics,
  live solving), they don't appear.

Only delegates see removed results. `GET /result/person/:id` includes them only
for a delegate, and `GET /result/:id` returns `404` for a removed result to
anyone else.

## Acceptance criteria

- [ ] Ruling R1 attempts DNF with removal ticked hides the R2 and R3 results, and
      their attempts and edit history stay in the database.
- [ ] The checkbox is ticked by default when R1 is left with only DNF/DNS, and
      unticked otherwise.
- [ ] Hidden results don't appear in round results, double-check, the public
      view, statistics, live solving, group progress or incident lists, and
      don't hold back an automatic group change.
- [ ] A station entering an attempt for a removed result gets "Removed from this
      round", and nothing is stored.
- [ ] An empty scorecard is sent for each removed result, unless the competition
      never sends.
- [ ] Restoring the R1 ruling brings R2 and R3 back unchanged, double-check
      included, and sends their scorecards.
- [ ] A removed result's page opens with the banner and can't be edited.
- [ ] Only delegates see removed results, on the competitor page and the result
      page; organisers get `404` for a removed result.
- [ ] Removal is refused with `409` while a later result has an open incident.
- [ ] "Remove from this round" hides an R2 result with its reason and sends an
      empty scorecard; "Bring back" returns it unchanged and sends its scorecard.
- [ ] "Remove from this round" isn't offered for a first round, and "Bring back"
      is refused for a result a ruling removed.
- [ ] Other competitors' results are never changed.
- [ ] Every `attempt` query that filters through `result` excludes removed
      results, without each query filtering by hand.

## Rollout

- Four nullable columns on `Result`, applied by `prisma db push` on start.
  Only adds to the schema.
- Backend and frontend ship together. Stations and the micro-connector don't
  change.
- Revert: set `removedAt` back to null on every result first, then remove the
  columns. Old code would show removed results again, which is the behaviour
  before this spec.
- Update the user docs at fkmtime.github.io.

## Decisions

1. **Hide removed results instead of deleting them.** A ruling can be
   reversed, and restoring it must bring the later rounds back. Rejected: hard
   delete (simpler, but irreversible and loses the edit history).
2. **Only delegates see removed results.** They apply 9t, and nobody else needs
   a result that no longer counts.
3. **Removing is also offered on its own, one result at a time.** 9t covers
   score-taking mistakes and retroactive penalties too, which are ordinary
   edits in FKMTime. It reuses the same hiding, so the only extra is an action
   and a way back. Rejected: removal only through the DNF modal (every other 9t
   case would fall back to "Delete result").
4. **The delegate decides advancement, except under 9p4.** Rejected: ranking
   the round in FKMTime from the WCIF advancement condition (new logic that
   would have to match WCA Live exactly, ties included) and always asking (the
   9p4 case is certain).
