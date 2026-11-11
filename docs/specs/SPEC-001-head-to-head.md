# SPEC-001: Head-to-head rounds

- **Status:** Accepted
- **Created:** 2026-10-29
- **Related:** WCA Regulations Article I, 9b7, 9f5b, 9f16, 9i4, 11k, 11l
  (version April 1, 2026); WCA website H2H import
  (`lib/tasks/h2h_results_import.rake`, thewca/worldcubeassociation.org#13200),
  bracket widget (thewca/worldcubeassociation.org#14935);
  [SPEC-002](SPEC-002-extras-for-all-attempts.md) (not offered for H2H rounds)

## Problem

The WCA Regulations allow a Head to Head (H2H) format for the final round of
3x3x3, 4x4x4, 3x3x3 Blindfolded and 3x3x3 One-Handed (9b7). Two competitors
solve the same scramble at the same time. A point goes to the faster one, a
set goes to the first to 3 points, and a match goes to the first to win X sets.
The round is a single-elimination bracket of 4, 8, 12 or 16 competitors
(Article I).

FKMTime can't run such a round today:

- It has no idea of a match, set or point. A station attempt is just "the next
  attempt of this competitor in this round", and attempts per round are capped
  by `getMaxAttempts`, which doesn't know format `h`.
- Ranking (`frontend/src/lib/ranking.ts`) sorts by best and average. H2H
  positions come from bracket outcomes instead (9f16b).
- Organisers have no way to seed a bracket, run the matches in order or see who
  plays next. Spectators have no bracket view and no scoreboard for the match
  on stage.
- The WCA website doesn't take H2H rounds in the normal Results JSON upload
  (`upload_json.rb` skips `formatId == "h"`). It takes a separate CSV, which
  FKMTime can't produce.

So a delegate who wants an H2H final today has to keep score on paper and
build the CSV by hand. That's slow and easy to get wrong on the one round
everyone watches.

## Goals

- Run an H2H round on competition day using the existing stations. Each
  competitor's judge submits attempts as usual, and FKMTime groups them into
  points, sets and matches.
- Seed and build the bracket from the previous round (I1, I2), including the
  12-competitor layout where the top 4 seeds skip the first stage.
- Apply the scoring rules exactly: points (I3c, I3d), sets including the
  7-point tie-break (I3e), matches (I3a), withdrawals (I2h, 9f5b), extra
  attempts for both competitors (11k1), and freezing outcomes when a match ends
  (11l).
- Compute the final ranking per 9f16b.
- Export the CSV the WCA website imports for H2H rounds, in the exact format
  its importer reads.
- Show a live bracket and a live match scoreboard on the public pages and the
  TV view, plus a staff screen for running the matches.

## Non-goals

- Pushing H2H rounds to WCA Live. They are skipped there, same as the WCA
  website skips them in the JSON upload. Revisit once WCA Live supports H2H.
- Changes to station firmware or the messages between the backend and the
  stations, beyond new values in existing response fields (text, and
  `useInspection`; see *Inspection*).
- Running the announcer's inspection countdown (I4c) from FKMTime.
- Reserved spaces for championships (9p2b) as a built-in rule. The delegate can
  edit the seed list by hand instead.
- H2H for unofficial events or for rounds other than the last one of an event.
- Uploading the CSV to the WCA website. FKMTime only produces the file.

## Background: what the WCA website expects

The website's model and import are still early (thewca/worldcubeassociation.org#13200,
phases 1–2 of 4). The parts FKMTime has to match:

- **Marking a round as H2H.** The round's WCIF `format` is `"h"`; the round
  type stays the normal final. WCIF has no H2H extension, so the bracket lives
  only in FKMTime.
- **Data stored.** The website keeps matches (`match_number`), the two
  competitors in each match, sets (`set_number`) and the attempts in each set.
  It doesn't store point, set or match winners, or which stage a match belongs
  to.
- **Results.** Each competitor gets one `Results` row with `best` = their best
  single in the round, `average = 0`, and `pos` taken as-is from the CSV. The
  website never recomputes these positions. 9i4 allows records for singles
  only.
- **The import itself.** It is a rake task with no validation, run in a single
  transaction.

The CSV, one row per attempt, per competitor, per set, per match:

```
round_id,match_number,match_set_number,set_attempt_number,registration_id,final_position,time_seconds,scramble,scramble_set_number,scramble_number,is_extra
```

| Column | What the importer does with it |
|---|---|
| `round_id` | `.to_i`. The WCA website's internal `rounds.id`, **not** the WCIF id. WCIF only has `"333-r3"`, and `"333-r3".to_i` is `0` |
| `match_number` | `.to_i`. Match number within the round |
| `match_set_number` | `.to_i`. Set number within the match |
| `set_attempt_number` | Read but ignored. The stored number comes from **row order** |
| `registration_id` | `.to_i`. The WCA `registrations.id` (WCIF `registration.wcaRegistrationId`), not `registrantId` |
| `final_position` | Only the competitor's **first** row counts |
| `time_seconds` | `sub(".", "").to_i`. Must be seconds with **exactly two decimals** and no `m:ss` (`65.32`, not `1:05.32`); `-1` = DNF, `-2` = DNS |
| `scramble` | Scramble text |
| `scramble_set_number` | 1-based scramble set within the round; the fixture uses one per match-set |
| `scramble_number` | 1-based scramble within the set |
| `is_extra` | `0` or `1`, whether the scramble is an extra |

Because numbering comes from row order, the importer gives each competitor
attempt numbers 1..N across the whole round and set attempt numbers 1..n per
set. So the file must be sorted by match, then set, then point, then
competitor.

FKMTime won't copy two behaviours of the website's draft bracket widget
(#14935), because they disagree with the Regulations. The widget treats DNF as
better than DNS (I3c makes both the worst result). It decides a set by "most
races won" (I3b/I3e give the set to the first to 3 points, with the tie-break
only after 7 points).

## Design

### Overview

An H2H round is still an ordinary FKMTime round (`333-r3`), with one `Result`
per competitor and their `Attempt`s, so double-check, edit logs, incidents and
manual entry keep working. On top of that, a **bracket** of new tables records
the structure (stages, matches, sets, points) and who won each one. Every
point points at the two `Attempt` rows that decided it.

Outcomes are **stored, not just derived**. 11l says a point's winner is final
once its match is complete, even if an attempt's time is later amended. A model
that recomputed everything from attempt values would break that rule, so the
backend works winners out while a match runs and freezes them when it ends.

### Database

```prisma
model H2hBracket {
  id           String           @id @default(uuid())
  roundId      String           @unique @map("round_id") // WCIF id, e.g. "333-r3"
  eventId      String           @map("event_id")
  size         Int              // 4, 8, 12 or 16 (I1a)
  status       H2hBracketStatus @default(DRAFT)
  wcaRoundId   Int?             @map("wca_round_id") // the WCA website's rounds.id, for the CSV (see WCA CSV export)
  entrants     H2hEntrant[]
  matches      H2hMatch[]
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  @@map("h2h_bracket")
}

/// A competitor in the bracket, with their seed
model H2hEntrant {
  id          String     @id @default(uuid())
  bracketId   String     @map("bracket_id")
  bracket     H2hBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  personId    String     @map("person_id")
  person      Person     @relation(fields: [personId], references: [id], onDelete: Cascade)
  seed        Int        // 1 = highest
  seedTieBroken Boolean  @default(false) @map("seed_tie_broken") // randomised per I1d
  withdrawnAt DateTime?  @map("withdrawn_at")

  @@unique([bracketId, seed])
  @@unique([bracketId, personId])
  @@map("h2h_entrant")
}

model H2hMatch {
  id           String         @id @default(uuid())
  bracketId    String         @map("bracket_id")
  bracket      H2hBracket     @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  stage        H2hStage
  matchNumber  Int            @map("match_number") // 1..N across the round, the CSV match_number
  setsToWin    Int            @map("sets_to_win")  // X in I3a: 1, 2 or 3
  status       H2hMatchStatus @default(WAITING)

  // Each side is either seeded directly or filled from an earlier match
  entrantAId   String?        @map("entrant_a_id")
  entrantBId   String?        @map("entrant_b_id")
  sourceAMatchId String?      @map("source_a_match_id")
  sourceAOutcome H2hOutcome?  @map("source_a_outcome") // WINNER or LOSER of that match
  sourceBMatchId String?      @map("source_b_match_id")
  sourceBOutcome H2hOutcome?  @map("source_b_outcome")

  winnerSide   H2hSide?       @map("winner_side")
  endedBy      H2hMatchEnd?   @map("ended_by") // how the match finished
  startedAt    DateTime?      @map("started_at")
  finishedAt   DateTime?      @map("finished_at") // freezes outcomes (11l)
  sets         H2hSet[]

  @@unique([bracketId, matchNumber])
  @@map("h2h_match")
}

model H2hSet {
  id            String       @id @default(uuid())
  matchId       String       @map("match_id")
  match         H2hMatch     @relation(fields: [matchId], references: [id], onDelete: Cascade)
  setNumber     Int          @map("set_number")
  scrambleSetId String?      @unique @map("scramble_set_id") // the TNoodle set this H2H set draws from (see Scrambles)
  scrambleSet   ScrambleSet? @relation(fields: [scrambleSetId], references: [id])
  winnerSide    H2hSide?     @map("winner_side")
  decidedBy     H2hSetDecision? @map("decided_by") // how the winner was found (I3b / I3e)
  points        H2hPoint[]

  @@unique([matchId, setNumber])
  @@map("h2h_set")
}

model H2hPoint {
  id           String    @id @default(uuid())
  setId        String    @map("set_id")
  set          H2hSet    @relation(fields: [setId], references: [id], onDelete: Cascade)
  pointNumber  Int       @map("point_number")
  attemptAId   String?   @unique @map("attempt_a_id")
  attemptBId   String?   @unique @map("attempt_b_id")
  scrambleId   String?   @unique @map("scramble_id") // the imported TNoodle scramble raced on this point
  scramble     Scramble? @relation(fields: [scrambleId], references: [id])
  winnerSide   H2hSide?  @map("winner_side")    // null with both attempts in = no winner (I3d)
  decidedAt    DateTime? @map("decided_at")

  @@unique([setId, pointNumber])
  @@map("h2h_point")
}

enum H2hBracketStatus { DRAFT SEEDED IN_PROGRESS FINISHED }
enum H2hStage { STAGE_OF_16 STAGE_OF_12 QUARTERFINAL SEMIFINAL FINAL THIRD_PLACE }
enum H2hMatchStatus { WAITING READY IN_PROGRESS FINISHED }
enum H2hSide { A B }
enum H2hOutcome { WINNER LOSER }
enum H2hMatchEnd { PLAYED WALKOVER RETIRED } // WALKOVER: I2h, no results; RETIRED: stopped mid-match
enum H2hSetDecision { POINTS MOST_POINTS BEST_IN_SET BEST_IN_MATCH BEST_IN_ROUND SEED }
```

Why it is shaped this way:

- **The bracket is a graph, not a formula.** Each side of a match is either an
  entrant or "winner/loser of match M". One generic advancement routine covers
  all four sizes, the 12-competitor exception (I2c1), the third-place match
  (I2e) and walkovers. The graph is built once, when the bracket is created
  (see below).
- **A point is a pair of attempts.** Every attempt in the round still lives in
  `Attempt`, numbered 1..N per competitor across the round (the same numbering
  the WCA importer gives them). `H2hPoint` only links which two attempts were
  raced. An attempt on an H2H point is in at most one point (`@unique`).
- **Extras keep the existing extra-attempt mechanism.** Attempts replaced by an
  extra stay in place with `EXTRA_GIVEN` / `replacedBy`; the point is moved to
  the two new extra attempts. See *Extra attempts*.
- **The stage is stored, not inferred.** The WCA widget guesses stages from
  match order. We know them, and the UI and the ranking need them.
- **The scramble plan is its own table** (`H2hScrambleAssignment`, see
  *Scrambles*), so the matching of TNoodle sets to H2H sets is fixed before
  the round and can be edited.
- **A point points at the exact scramble.** The `@unique` on
  `H2hPoint.scrambleId` makes the database refuse to race the same scramble
  twice in the round (I4b1). The CSV's scramble columns come straight from
  that `Scramble` row.
- **No new columns on `Result`/`Attempt`.** H2H stays an add-on, the existing
  screens still work, and dropping the bracket tables reverts the feature.

`Person` gets the reverse relation `h2hEntrants`. `ScrambleSet` gets reverse
relations to `H2hSet` and `H2hScrambleAssignment`, `Scramble` to `H2hPoint`,
and `H2hMatch` gets `scrambleAssignments`. The seed data in
`backend/prisma/seed/` gets an H2H final for one event, so local and e2e
environments have a bracket.

### Recognising an H2H round

- A round is H2H when its WCIF `format` is `"h"` and it is the event's last
  round (9b7b). FKMTime refuses to create a bracket for any other round, or for
  an event not in 9b7a (`333`, `444`, `333bf`, `333oh`).
- `roundFormatMap` / `getMaxAttempts` learn `h`. The round has no fixed number
  of attempts: the station flow asks the bracket whether the competitor has a
  point to play.
- The round's WCIF `timeLimit` applies to every attempt as usual (A1a). WCIF
  doesn't allow a cutoff for format `h`, and FKMTime ignores one if present.
- **No cumulative time limits.** Article I doesn't say whether an H2H round
  may have one (A1a2), and a limit running out mid-match has no defined
  outcome. FKMTime refuses to create a bracket for a round whose `timeLimit`
  is cumulative, with "Head-to-head rounds can't use a cumulative time limit.
  Change it to a per-attempt limit on the WCA website and sync the
  competition." Revisit if the Regulations allow it.
- The station check that answers "no attempts left"
  (`personForDevice.service.ts`) asks the bracket too: a competitor with no
  playing match is told so when they scan their card, before they solve.

### Inspection (I4c)

In an H2H round the announcer times inspection for both competitors at once
and calls "GO" at 14 seconds (I4c2–I4c5). The usual 15 s/17 s inspection
penalties don't apply (I4c6). For blindfolded there is no inspection at all,
only "3, 2, 1, GO" (I5b2). The station therefore must not run its own
inspection: the judge starts straight on the timer.

The station already takes this from the backend. `possibleGroups[].useInspection`
in the `PersonInfo` response is what turns inspection off for 6x6x6, 7x7x7 and
the blindfolded events today. It is currently looked up per event
(`eventsData`). For H2H it becomes per round: `false` for a format `h` round,
otherwise the event's value. So the protocol stays the same, and no firmware
change is needed.

The "inspection over 15 seconds" check on the results checks page
(`result.service.ts`) skips H2H rounds, so it doesn't flag attempts that are
fine under I4c6.

### Scrambles

TNoodle knows nothing about H2H. For the round it just generates the WCIF
`scrambleSetCount` ordinary sets (A, B, C, …). Each has the usual number of
scrambles and extras, whatever the delegate configured, and FKMTime imports
them through the existing scramble import as `ScrambleSet`s with
`set = "A"`, `"B"`, …. FKMTime does the matching of those sets to the bracket,
and assumes nothing about how many scrambles a set has.

**The rule.** One TNoodle set is raced in one H2H set (I4b1 needs fresh
scrambles for every point and every match). Points use the set's normal
scrambles in order, then its extras.

**The scramble plan.** The matching is a fixed plan, made before the round,
not decided as matches happen. Matches can run in parallel on two stages, and
the scramble team needs to prepare sets in advance. So "next free set" would
make the letters depend on timing.

```prisma
/// Which TNoodle set each possible H2H set will use
model H2hScrambleAssignment {
  id            String       @id @default(uuid())
  matchId       String       @map("match_id")
  match         H2hMatch     @relation(fields: [matchId], references: [id], onDelete: Cascade)
  setNumber     Int          @map("set_number")
  scrambleSetId String?      @unique @map("scramble_set_id")
  scrambleSet   ScrambleSet? @relation(fields: [scrambleSetId], references: [id], onDelete: SetNull)

  @@unique([matchId, setNumber])
  @@map("h2h_scramble_assignment")
}
```

**Building the plan:**

- **Rows.** Creating the bracket adds one row for every set a match could
  need, 2X − 1 per match (first to X sets).
- **Automatic matching.** "Match scrambles automatically" fills the rows in
  match order, then set order, with the round's sets in letter order. With the
  8-player example below, QF 1 gets A, QF 2 gets B, …, and the final gets
  sets H, I and J for its sets 1–3. This runs on its own after scrambles are
  imported, or after the bracket is created, whichever comes second.
- **Editing the plan.** The **Scrambles** tab of the bracket setup shows the
  plan as a table (Match · Set · Scramble set), and each row can be changed
  to any set not used elsewhere. Rows already raced are locked.
- **Using the plan.** When an H2H set opens, it copies its row's set into
  `H2hSet.scrambleSetId`. Each new point takes the next unused scramble of
  that set (`H2hPoint.scrambleId`). The `@unique` constraints keep one TNoodle
  set in one H2H set, and one scramble in one point.

**When a set runs out.** Points with no winner (I3d) can push a set to 7
points, and an extra (11k1) adds more. Once the set's normal and extra
scrambles are used up:

- The next point takes a scramble from the first **spare** set: one that
  isn't in the plan.
- The stage leader and the scrambling device are told which set to hand over.
- With no spare left, the point can't open, and the stage leader is asked to
  generate and import more sets for the round. The existing "add scrambles"
  import appends them as new letters.

**How many sets to generate.** The plan needs one set for every row:
Σ (2X − 1) over the matches. Bracket setup shows the number with the
instruction "Set the scramble set count for 333-r3 to N on the WCA website,
then generate scrambles in TNoodle". A couple of spares on top are
recommended. Unused sets never reach the CSV.

| Bracket | Sets to win | Sets in the plan |
|---|---|---|
| 8 players | 1 everywhere, final 2 | QF 4×1 + SF 2×1 + third place 1 + final 3 = 10 |
| 16 players | 1 everywhere | 8 + 4 + 2 + 2 = 16 |
| 16 players | S16/QF 1, SF 2, final stage 3 | 8 + 4 + 2×3 + 2×5 = 28 |

**Import checks.** For an H2H round, the existing warnings in
`scramblesImport.ts` about set counts and scrambles per set are replaced by:

- **Warning:** fewer sets imported than rows in the plan. The rows left over
  are listed.
- **Warning:** a set with fewer than 5 normal scrambles. A 3–2 set would
  start using its extras.
- **Error:** no sets at all.

**On the day.** The staff Matches screen and the scrambling device show, for
each playing match, which set is in use and which point's scramble is next
("QF 3 · set 1 · Set C, scramble 4"). When two matches are playing at once,
the scrambling device lists both and the scrambler picks one. The scrambler unlocks that set as
today, and applies the scramble to both cubes (I4b1). The "scan card to mark
scrambled" placeholder (`createScrambledAttempt`) is off for H2H rounds,
because the point already knows its scramble.

### Creating and seeding the bracket

The delegate opens the round in the panel and picks:

- **Size** (4/8/12/16). It defaults to the previous round's advancement
  condition when that is a ranking of 4, 8, 12 or 16.
- **Sets to win per stage.** The default is 1 for every stage, and the final
  may be higher than the third-place match. Validation follows I3a1 and I3a2:
  the same value for every match in a stage, never lower than the stage before,
  and the final at least the third-place match.

Seeding:

1. **With a prior round** (I1b), seeds follow the previous round's ranking
   (WCIF `results[].ranking`, as `frontend/src/lib/results.ts` already reads
   it), limited to the people who advanced.
2. **Ties** (I1d) are broken randomly on the server. The entrant is marked
   `seedTieBroken`, so the UI can show "tie broken randomly" and nobody can say
   the order was picked.
3. **With no prior round** (I1c), or with reserved spaces, the delegate edits
   the seed list by hand (drag to reorder, swap a competitor).

Seeds can be edited until the first match starts. After that they are locked.

Building the graph (I2c, I2f):

- **First stage:** highest seed against lowest. With 12, seeds 5–12 play the
  Stage of 12 (5v12, 6v11, 7v10, 8v9), and seeds 1–4 go straight into the
  quarterfinal slots.
- **Later stages:** pair so the seeds add up to the number of remaining
  competitors + 1, assuming the higher seed won every match. For 8 that gives
  QF 1v8, 4v5, 3v6, 2v7; SF W(1v8)–W(4v5), W(2v7)–W(3v6).
- **Final stage:** winners of the semifinals meet in the final; the losers meet
  in the third-place match.
- **Match numbers:** assigned in stage order. Within a stage the third-place
  match comes before the final, so the final is the last match of the round.
  The CSV uses these numbers.

A unit-tested pure function `buildBracket(size, setsToWinByStage)` returns the
match list, so the four layouts are checked against the Visual Guide referenced
in I2g, independent of the database.

### Running a match on competition day

A match is `WAITING` until both sides are known, then `READY`. The stage
leader starts it from the staff screen, and it becomes `IN_PROGRESS`. A
competitor can be in only one `IN_PROGRESS` match. Starting a match creates
set 1 with the scramble set from the plan (*Scrambles*).

The two competitors sit at two ordinary stations in the room running the
round's group. The station protocol does not change. In
`ResultFromDeviceService.enterAttempt`, when the round is H2H:

1. Find the competitor's `IN_PROGRESS` match. If there is none, reply with the
   existing error path and a text like "No match in progress". Nothing is
   saved, so the judge sees it at once and calls the stage leader.
2. Take the current set (the last one without a winner) and put the attempt in
   the competitor's first empty slot in that set. A new `H2hPoint` is created
   if the opponent hasn't reached this point yet.
3. A competitor may be **at most one point ahead** of their opponent. A
   submission two points ahead is rejected with "Waiting for opponent's
   result". That means a missing attempt that a person has to look at, not a
   race.
4. When both slots of a point are filled, decide the point:
   - The faster valid time wins.
   - DNF and DNS are equally worst, so two DNF/DNS results, or equal times,
     mean no winner (I3c, I3d).
   - If the point decides the set, decide the set. If the set decides the
     match, finish the match and advance the winner and loser through the graph.
   - Otherwise, if the match continues, open the next set with its planned
     scramble set.
5. Reply to the station with the usual round result text, replaced by match
   status text, e.g. `Point: you · Set 2–1 · Sets 1–0`. Keep it short enough for
   the station's text field.

All of step 2–4 runs in one transaction that locks the match row, so two
stations submitting at the same instant can't both create point 3, or both
miss that the set is over.

Idempotency is unchanged. A station that reconnects and resends an attempt
with the same `sessionId` gets the stored response and doesn't fill a second
slot.

If a station drops mid-match, the judge writes the result on paper. The stage
leader enters it on the staff screen with the existing manual attempt entry,
and it goes through the same point logic. The scoreboard shows "waiting for
result" for that side until then.

#### Deciding a set (I3b, I3e)

- **Normal case:** the first to 3 points wins the set (`decidedBy = POINTS`).
- **Tie-break:** if 7 points have been played and nobody has 3, the winner is
  decided by the first of these that separates the two:
  1. More points in the set (`MOST_POINTS`).
  2. Better best single in the set (`BEST_IN_SET`).
  3. Better best single in the match (`BEST_IN_MATCH`).
  4. Better single results in the round (`BEST_IN_ROUND`). Compare the sorted
     singles in order: best against best, then second best, and so on. I3e
     doesn't spell out how to compare "single results in the round"; this is
     the agreed reading. DNF and DNS count as the worst result (I3c), and so
     does a missing single when one competitor has played fewer attempts.
  5. Higher seed (`SEED`).
- Storing `decidedBy` lets the UI explain a set decided without 3 points.

#### Extra attempts (11k)

On the staff screen the delegate can choose **Extra granted** on a point.
11k1 requires that both competitors get one, so the action always covers both
sides:

- Both attempts go to `EXTRA_GIVEN`.
- The point is cleared and gets the set's next unused scramble, which by then
  is usually an extra (*Scrambles*).
- The next two submissions fill it again.

There is no single-competitor extra for H2H points. The incident flow from the
station (`notifyDelegate`) still works: a delegate resolving an incident on an
H2H attempt picks between "Extra granted (both competitors)" and "No extra".
The screen also reminds the delegate of 11k2: if the incident couldn't change
who won the point, no extra should be granted.

#### Withdrawals (I2h, 9f5b)

**Withdraw** on an entrant, before their match starts:

- The match is finished as a walkover (`endedBy = WALKOVER`) and the opponent
  advances.
- No points are recorded, and the match is left out of the CSV for both
  competitors.

In the final stage, the walkover still decides the ranking between the two.
If the withdrawn competitor still has a later match (a semifinal walkover
leaves the third-place match), that match becomes a walkover too.

#### Retiring during a match

I2h only covers withdrawing before a match begins. For a competitor who
can't go on once it has started (injury, a broken puzzle, leaving), the
delegate uses **Retire** on their side of the playing match, with a required
comment:

- **The match ends** (`endedBy = RETIRED`), and the opponent wins it and
  advances, as with a walkover.
- **What was played stays.** Points and sets already decided keep their
  winners, and every submitted attempt of both competitors stays in the
  results and the CSV. They are real solves, and 9f5b drops a match's results
  only when a competitor started no attempts in it.
- **The open point.** If the opponent had already solved the open point,
  their attempt stays: it is a real result, and its single counts for records
  (9i4). The point itself gets no winner. The open set gets no winner either.
- **Retired before solving.** If the retiring competitor has no attempt in the
  match, 9f5b applies: the match becomes a walkover, and neither competitor's
  attempts in it are exported.
- **Later matches.** The retired competitor is knocked out at this stage for
  the ranking. If they still have a later match (retiring in a semifinal
  leaves the third-place match), that match becomes a walkover, as with a
  withdrawal. In the final stage, they rank below their opponent.
- **Mistakes.** A mistaken Retire is undone with **Reopen match**, under the
  same conditions as after the match (*Amending after the match*).

Their station submissions are then refused with "No match in progress", like
any competitor without a playing match.

#### Amending after the match (11l)

Before a match is finished, editing an attempt in it re-runs the point, set
and match logic. This covers a judge's typo fixed during the match.

Once a match is `FINISHED`, its winners are frozen:

- Editing an attempt changes the stored time, so the CSV and the competitor's
  best single are corrected, but doesn't change the point winner (11l1).
- The staff screen marks such points "Time amended after the match, winner
  unchanged".
- The one way out is **Reopen match** (delegate role, with a comment), for
  cheating or fraud (the 11l exception). It unfreezes the match and recomputes
  it, including the matches fed by it, but only while those haven't started.

### Final ranking (9f16b)

`rankH2hRound(bracket)`, a pure shared function used by the backend export
and the frontend:

- **Positions 1–4:** winner and loser of the final, then winner and loser of
  the third-place match.
- **Everyone else:** grouped by the stage they were knocked out in, later
  stages first. That gives 5–8 for quarterfinal losers, then 9–12 for the
  Stage of 12 or 9–16 for the Stage of 16.
- **Within a group:** ordered by best single in the round (9f16b). 9f16b names
  no further tie-break, unlike 9f14 for averages, so equal best singles share a
  position (9f15), and the next position is skipped (two at 5th, then 7th).
- **No attempts at all:** a competitor whose only match was a walkover has no
  attempts and gets no row (9f5b).

The existing results table shows this ranking for H2H rounds. It has columns
#, Name, Best and Stage reached, and no average.

### WCA CSV export

The staff round page gets **Download results for WCA (CSV)** once the bracket
is `FINISHED`.

**Where the work happens.** FKMTime stores scrambles encrypted, and the server
never has the password: scrambling devices decrypt in the browser. The export
follows the same rule:

1. `GET /h2h/:roundId/export` returns the rows with encrypted scrambles, plus
   checks.
2. The browser asks for the scramble password (the same unlock as the
   scrambling device), decrypts, and builds the CSV.

**The WCA round id.** The CSV needs the WCA website's numeric round id, which
the WCIF doesn't carry. The WCA website builds the WCIF round `id` as
`"#{event_id}-r#{number}"`. The public API has it instead:

- `GET $WCA_ORIGIN/api/v0/competitions/:competitionId/results/:eventId`
  returns `rounds[] { id, roundTypeId, … }`, sorted by round number, highest
  first.
- The H2H round is the event's last round (9b7b), so it is the first entry.
- On export, the backend fetches it and stores it in `H2hBracket.wcaRoundId`.
- The staff screen shows the value and lets the delegate correct it if the
  call fails.

The dummy WCA used by e2e tests gets this endpoint.

**Rows.** Final data only: one row per counting attempt. Attempts replaced by
an extra are left out, as in the WCA Live sync. `is_extra=1` marks a counting
attempt that was solved on an extra scramble. Rows are sorted by `match_number`, `match_set_number`,
point number, then side A before side B. Each column:

| Column | Value |
|---|---|
| `round_id` | `H2hBracket.wcaRoundId` |
| `match_number` | `H2hMatch.matchNumber` |
| `match_set_number` | `H2hSet.setNumber` |
| `set_attempt_number` | Point number; ignored by the importer, but correct |
| `registration_id` | WCIF `registration.wcaRegistrationId` of the person |
| `final_position` | From `rankH2hRound`, the same on every row of a competitor |
| `time_seconds` | Centiseconds formatted as seconds with two decimals (`6532` → `65.32`); DNF `-1`, DNS `-2` |
| `scramble` | Decrypted text |
| `scramble_set_number` | The point's scramble's set letter as a number (A = 1, B = 2, …), the same lettering TNoodle and the WCA scrambles page use |
| `scramble_number` | `Scramble.num` of the point's scramble |
| `is_extra` | `1` if `Scramble.isExtra`, else `0` |

Walkover matches produce no rows. The file is UTF-8 with `\n` line endings and
a header row, and is named `<competitionId>-<roundId>-h2h.csv`.

**The export refuses** (and lists what to fix) when:

- a match isn't finished, or a point has only one attempt (except the open
  point of a retired match);
- an attempt still has an unresolved incident;
- a person has no `wcaRegistrationId`;
- `wcaRoundId` couldn't be fetched and wasn't entered;
- a set has no scramble set, or a point's scramble is missing;
- the scramble password is wrong.

A unit test parses the generated CSV with the same rules as the WCA rake task
(column by name, `sub(".", "").to_i`) and checks the stored values come out
right. That includes times of 60 s and over, and times with a trailing zero
such as `10.20`.

### API and real-time updates

| Endpoint | Role | Purpose |
|---|---|---|
| `GET /h2h/:roundId` | staff | Bracket, entrants, matches, sets, points with attempt values |
| `POST /h2h/:roundId` | delegate/organiser | Create bracket (size, sets to win per stage) and auto-seed |
| `PUT /h2h/:roundId/seeds` | delegate/organiser | Reorder or replace entrants (until the first match starts) |
| `PUT /h2h/:roundId` | delegate/organiser | Change `wcaRoundId`; change sets to win while no match of that stage has started |
| `DELETE /h2h/:roundId` | delegate/organiser | Delete the bracket, only while no attempt is linked |
| `POST /h2h/match/:id/start` | stage leader+ | Start a `READY` match |
| `POST /h2h/match/:id/withdraw` | delegate | Walkover for one side before the match starts (body: side) |
| `POST /h2h/match/:id/retire` | delegate | End a playing match for one side (body: side, comment) |
| `POST /h2h/point/:id/extra` | delegate | Extra granted to both competitors |
| `POST /h2h/match/:id/reopen` | delegate | Reopen a finished match (comment required) |
| `GET /h2h/:roundId/export` | delegate/organiser | Export rows and checks |
| `GET /h2h/public/:roundId` | public | Bracket for spectators: names, countries, seeds, set and point scores, times. No card ids |

socket.io:

- Clients join with `joinH2h { roundId }`, which adds them to the room
  `h2h-${roundId}`.
- After any change the server emits `h2hUpdated { roundId, matchId }` to that
  room, and clients refetch. This is the same pattern as `resultEntered`.
- The existing `resultEntered` still fires for the round, so the generic
  screens update too.

### Screens

**Staff: round page for an H2H round.** It sits under the existing Results
tabs and has three tabs:

- **Bracket:** the same bracket as the public view, plus setup (size, sets to
  win per stage, seed list with drag to reorder and a "tie broken randomly"
  badge) and the `wcaRoundId` field.
- **Matches:** the main tool on the day.
  - Lists the matches in order with their status: Waiting / Ready / Playing /
    Done.
  - Ready matches have a **Start match** button.
  - The playing match shows a point-by-point log: both times, the point
    winner, the set score, and how each set was decided.
  - Per point: **Extra granted**, plus manual entry for a missing result.
  - Per side: **Withdraw** before the match starts, **Retire** while it is
    playing.
  - Points edited after the match are marked.
- **Ranking:** the final standings, and **Download results for WCA (CSV)** with
  the list of blocking checks.

**Public: bracket** (`/public/h2h/:roundId`, linked from the public sidebar
for H2H rounds):

- **Layout:** stages as columns left to right, labelled as in I2a (Stage of 16
  / Stage of 12, Quarterfinal, Semifinal, Final), with connector lines between
  each match and the match it feeds. The third-place match sits under the
  final, with its own label.
- **Match card:** two rows, each with the seed, flag, name and the set score.
  The winner's row is bold and the loser's row is greyed out. Under a finished
  match, the per-set point scores are shown small (e.g. `3–1 · 2–3 · 3–0`).
  Opening a card shows every point's times.
- **Live state:** the match being played is highlighted. Empty slots read
  "Winner of QF 2" rather than being blank.
- **On phones:** one stage per screen with swipeable stage tabs, instead of a
  wide horizontal scroll.

**Public: match scoreboard** (`/public/h2h/:roundId/match/:matchNumber`,
meant for the projector):

- **The two competitors side by side:** name, flag, seed, and big set score.
- **Per set:** a row of point markers showing won, lost, no winner, or not
  played yet.
- **Live times:** each side's time comes from the existing `currentTimeInfo`
  stream of the station that competitor is at, so spectators see both timers
  running.
- **After each point:** both times, and the winner's side lit up for a few
  seconds.
- **After the match:** the winner banner and who they play next, read from the
  bracket graph.
- **Format:** "First to 2 sets · first to 3 points".

**TV** (`/public/tv`): while an H2H match is in progress, the slide rotation
is replaced by the match scoreboard. Between matches it shows the bracket
slide.

All copy uses task language: "Start match", "Extra granted", "Withdraw",
"Retire",
"Waiting for opponent's result". It never shows enum names.

### Edge cases

- **Competitor can't continue mid-match.** Retire (*Retiring during a
  match*).
- **Station disconnects mid-point.** The point waits with one attempt in.
  Re-sending is idempotent, and manual entry is the fallback. The other
  station can't run ahead by more than one point.
- **Both submit at the same moment.** The match row lock serialises them.
- **Wrong person at a station.** The card belongs to someone who isn't in a
  playing match, so the attempt is rejected and nothing is stored.
- **Person playing in two groups or rooms at once.** Not possible: the round
  is one group, and a person has one playing match at a time.
- **Bracket changed after attempts exist.** Seeds are locked after the first
  start, and a bracket with linked attempts can't be deleted.
- **Time limit reached** (A1a4). The attempt is a DNF as today, so it loses
  the point, or the point has no winner if the other attempt is also DNF/DNS.
- **Out of scrambles.** A set's extras are used first, then a spare set.
  With no spare left, the point can't open, and the UI asks for more sets to
  be imported for the round (*Scrambles*).
- **Scrambles imported after the bracket, or re-imported.** The plan is
  re-matched automatically, except for rows already raced. Deleting a set
  that is in the plan clears its row, and the setup screen shows the gap.

## Acceptance criteria

- [ ] `buildBracket` returns the I2 layout for 4, 8, 12 and 16, including the
      12-competitor bye for seeds 1–4 and the third-place match fed by
      semifinal losers (unit tests).
- [ ] Seeding follows the previous round's ranking. Tied seeds are randomised
      and flagged. Seeds can't be edited once a match has started (e2e).
- [ ] Creating a bracket for a round with a cumulative time limit is refused
      with the message above (e2e).
- [ ] Sets-to-win validation rejects a stage lower than the previous one, and
      a final lower than the third-place match (unit).
- [ ] Point scoring: faster time wins; DNF vs DNS, DNF vs DNF and equal times
      give no winner (unit).
- [ ] Set scoring: first to 3; every I3e tie-break level, ending with the seed.
      The round level compares sorted singles past the first, and counts a
      missing single as worst (unit).
- [ ] Two station submissions for the same match create one point, decide it
      and advance the match. A third submission from the same competitor while
      their opponent is two points behind is rejected (backend e2e over the
      device socket).
- [ ] Re-sending an attempt with the same `sessionId` doesn't create a second
      point entry (e2e).
- [ ] Finishing a match fills the next match's slots with the winner and, for
      semifinals, the loser (e2e).
- [ ] Extra granted on a point marks both attempts `EXTRA_GIVEN` and reopens
      the point on an extra scramble (e2e).
- [ ] The automatic scramble plan gives 2X − 1 rows per match, filled in
      match order, then set order, from sets in letter order. The table's three
      examples come out as shown (unit).
- [ ] An edited plan row is kept when scrambles are matched again, and a raced
      row can't be changed (e2e).
- [ ] Points use the set's normal scrambles, then its extras, then a spare
      set. A scramble or a set is never raced twice in the round (unit + e2e).
- [ ] An imported file with fewer sets than the plan needs, or a set with
      fewer than 5 scrambles, gets the H2H warnings, not the usual
      set-count ones (frontend unit).
- [ ] An attempt edited after its match finished changes the exported time
      but not the point winner (e2e).
- [ ] A walkover advances the opponent, and the match has no CSV rows (unit).
- [ ] Retire during a match advances the opponent. Decided points and every
      submitted attempt stay in the CSV, including the opponent's attempt on
      the open point. A retirement before the competitor's first attempt is
      exported as a walkover. The retired competitor's third-place match
      becomes a walkover (unit + e2e).
- [ ] `rankH2hRound` matches 9f16b and the 9f16b+ example. Equal best
      singles in the same stage share a position (unit).
- [ ] A station scanning a card for an H2H round gets `useInspection: false`
      for that group. Other rounds of the same event keep the event's value
      (backend e2e).
- [ ] The export fetches the WCA round id from the dummy WCA's
      `results/:eventId` endpoint and writes it to every row (e2e).
- [ ] The CSV header and row order match the WCA importer. Parsing it with the
      importer's rules gives back the stored values, including `65.32`,
      `10.20`, `-1` and `-2` (unit).
- [ ] The export lists every blocking check and produces no file while any
      apply (e2e).
- [ ] Public bracket and match scoreboard update live on `h2hUpdated` without
      a reload (Playwright).
- [ ] H2H rounds are not sent to WCA Live (unit).

## Rollout

- **Migration:** additive (new tables and enums only), so older data and
  non-H2H rounds are untouched. Seed data gains an H2H final; `prisma db push`
  and `prisma:seed-test` must pass.
- **Stations:** no firmware or protocol change. Older firmware works,
  because only existing response fields change: the text, and
  `useInspection` for H2H groups.
- **Delivery:** in PRs, each usable alone:
  1. Schema, `buildBracket`, scoring and ranking functions with unit tests.
  2. Bracket setup and the staff Matches screen, with manual entry only.
  3. Station flow for H2H rounds.
  4. CSV export.
  5. Public bracket, scoreboard and TV.

  Until PR 3 lands, the station rejects attempts in format `h` rounds instead
  of recording them as normal attempts.
- **Revert:** drop the bracket tables. The round's `Result`/`Attempt` rows
  stay, and are still visible as plain attempts.
