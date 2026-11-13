# SPEC-006: Sending results where the WCA says, and running rounds in WCA integrated live results

- **Status:** Accepted
- **Created:** 2026-11-08
- **Related:** WCA live API docs
  (https://next.worldcubeassociation.org/api.html#/live), WCA source
  `next-frontend/openapi/paths/competitions/live/`,
  `app/controllers/api/v1/live/live_controller.rb`

## Problem

FKMTime sends results to two places today, and neither of them is chosen. The
code picks one for each event:

- Official events go to **WCA Live** (live.worldcubeassociation.org) if a
  scoretaking token is set.
- Unofficial events go to **Cubing Contests** if a Cubing Contests token is
  set.

One setting, "Send results to WCA Live/CubingContests", covers both. It can be
"after every solve", "every 5 minutes" or "do not send".

The WCA website now has its own live results, called **integrated live
results** (ILR, "Internal" scoretaking in the WCA competition settings). These
are the facts that affect us:

- **ILR is on in production.** Competitions that hold the `fto` event *must*
  use it.
- **A competition uses one scoretaking tool.** On the WCA site,
  `scoretaking_software` is `external`, `wca_live` or `internal`. ILR only
  accepts writes when it is `internal`. When it is `internal`, the WCA site no
  longer imports results from WCA Live through the WCIF.

So an organiser whose competition is set to ILR has no way to get FKMTime
results onto the WCA site. They either type everything in again, or they
switch the competition back to WCA Live, which a competition with `fto` can't
do.

ILR is harder to talk to than WCA Live:

| | WCA Live (today) | Integrated live results |
|---|---|---|
| Auth | Per-competition scoretaking token, pasted once, doesn't expire | A WCA OAuth access token of a person allowed to enter scores. It lasts about 2 h and must be refreshed |
| Round | `eventId` + `roundNumber` | WCIF round id (`333-r1`) |
| Person | `registrantId` | `registration_id`, the WCA registration's database id (WCIF `persons[].registration.wcaRegistrationId`) |
| Round lifecycle | Rounds are open; WCA Live handles them | A round must be **opened** first. Opening round *n* + 1 **locks** round *n*, which freezes who advances from it. Only the people already in the round can get results |
| Response | Synchronous 200 / 422 | **Checked now, written later.** Everything ILR checks (sign-in, rights, round open, person in round, no `0` values) is answered immediately with 4xx. A valid request gets 202 and is written by a background job a moment later. If that job crashes, nobody is told: FKMTime only finds out by reading the round back |
| Validation | Server applies time limit, cutoff, attempt count | **None.** Whatever we send is stored |
| Batch failure | Per result | **The whole batch is rejected** if one entry is bad (e.g. a person not in the round) |
| Rate limit | — | 60 requests a minute per IP |
| API stability | Stable | `0.1.0`, "currently in progress" |

## Goals

- Official results go where the competition's **scoretaking setting on the
  WCA website** says: WCA Live, WCA integrated live results, or nowhere.
  FKMTime reads that setting and follows it. There is no second choice in
  FKMTime that could disagree with it. To change it, FKMTime sends the user to
  the WCA website.
- With integrated live results selected, every result path that sends to WCA
  Live today sends to ILR instead: after a solve, every 5 minutes, "resubmit
  round", "resubmit scorecard", extras, removing an attempt from live,
  restarting a group, and removing later-round results under Regulation 9t
  (SPEC-005).
- A delegate or organiser connects FKMTime to ILR once. It keeps working for
  the whole competition without signing in again.
- Organisers can see when a result didn't make it to ILR, and why, without
  reading backend logs.
- The round steps ILR needs happen from FKMTime, at the moment FKMTime already
  knows about them: opening a round when its first group starts, adding a
  competitor who turns up in a group, removing a competitor who doesn't come,
  and emptying results when a group is restarted. Nobody has to keep the WCA
  admin pages open next to the panel.
- FKMTime shows who advances, as ILR works it out.
- **Nobody has to open the WCA live admin pages during the competition.**
  Everything those pages do fits into FKMTime's existing pages (section 5),
  with no new page to learn. The WCA
  website is still needed before and after the competition, for things that
  aren't part of live results: setting the competition to integrated live
  results, editing rounds (time limits, cutoffs, advancement), registrations,
  and submitting results afterwards.
- Unofficial events keep going to Cubing Contests, unchanged.
- No change to station firmware, the micro-connector, or station messages.

## Non-goals

- **Sending to WCA Live and ILR at the same time.** The WCA site lets only one
  be in charge, and two live sites with different numbers would confuse
  competitors.
- **Working out who advances.** ILR does it from the WCIF advancement
  condition. FKMTime only shows ILR's answer and never sends its own.
- **Group assignments for the next round.** FKMTime takes them from the WCIF,
  as today. ILR's list of who advances isn't turned into group assignments.
- **Changing WCA registrations from FKMTime**, e.g. adding an event to
  someone's registration so they can compete in it. It isn't needed to run a
  competition: the WCA website already lets organisers and Delegates edit
  registrations. It would also need the `manage_registrations` OAuth scope,
  which the WCA is limiting to applications its admins approve. FKMTime
  points to the WCA website instead.
- **Importing results from ILR into FKMTime.** FKMTime reads ILR to compare
  it with its own results, and can make ILR match FKMTime. It never copies
  ILR's results into its own database. Results typed into ILR by hand show up
  as differences.
- **Editing rounds on the WCA website** (time limits, cutoffs, advancement
  conditions) and changing registrations. Those are WCA competition settings,
  not live results.
- **ILR's live updates** (the AnyCable channel). Reading the round back
  confirms a write within about 10–30 s, which is enough for live results. The
  websocket would confirm within about 1 s, but its message format is
  undocumented. It stays a possible later improvement, with the read-back
  kept as the fallback.
- **Replacing the Cubing Contests integration.**

## Design

### 1. Where results go: following the WCA setting

On the WCA website every competition has a **scoretaking software** setting:
`external`, `wca_live` or `internal` (integrated live results). It is in the
Website section of the competition edit form, which stays editable after the
competition is announced. This setting already decides everything that
matters on the WCA side:

- ILR refuses every write unless it is `internal`;
- when it is `internal`, the WCA stops importing results from WCA Live;
- the competition page links to the matching live results site;
- the delegate's results submission imports from the matching tool.

A destination chosen in FKMTime that differs from it would only send results
where the WCA ignores them. So FKMTime doesn't keep its own choice; it
follows the WCA.

The WCA's OAuth API can read the setting but not change it. The competition
edit form is a website page that needs a signed-in browser session. So
FKMTime reads it, and to change it, sends the user to the WCA website.

| WCA `scoretaking_software` | Official results go to |
|---|---|
| `wca_live` | WCA Live |
| `internal` | WCA integrated live results |
| `external` | Nowhere |

- **Pausing:** the existing "When to send" setting set to "Do not send" stops
  sending to any destination, as today.
- **Unofficial events** go to Cubing Contests whatever the WCA says, as today.

#### Data model

```prisma
model Competition {
  // ...
  // Mirrors the WCA's scoretaking_software; null until first read
  wcaScoretakingSoftware      String?   @map("wca_scoretaking_software")
  wcaScoretakingCheckedAt     DateTime? @map("wca_scoretaking_checked_at")
  // Off: FKMTime suggests opening later rounds in ILR and a person clicks
  openRoundsAutomatically     Boolean   @default(false) @map("open_rounds_automatically")
}
```

- `sendingResultsFrequency` keeps its meaning: *when* to send, for whichever
  destination the WCA setting gives, and for Cubing Contests.
- **Before the first read** (`wcaScoretakingSoftware` null, e.g. a competition
  imported before this change), FKMTime behaves as today: WCA Live if a
  scoretaking token is set, otherwise nowhere. The first read replaces this.

#### Reading the WCA setting

`GET /api/v0/competitions/{id}` returns `scoretaking_software`. It is a
public read with no sign-in. FKMTime reads it:

- on import;
- on every WCIF sync;
- on the existing 5-minute cron;
- when someone clicks **Check again** in the settings.

If the WCA can't be reached, FKMTime keeps the last value it read and shows
when that was.

**When the value changes mid-competition**, e.g. the delegate switches the
competition to integrated live results on the WCA website:

1. FKMTime switches destination at the next read.
2. Every open panel shows a notice, whatever page it is on (socket event
   `scoretakingSoftwareChanged`): "The WCA website changed where results go.
   FKMTime sends official results to WCA live results on the WCA website
   from now on." The first read after import or deploy only replaces the
   guess made before it, so it shows no notice.
3. Unless sending is paused ("Do not send"), it sends every official result
   already entered to the new destination, so nothing entered before the
   switch is missing there. For integrated live results,
   it marks every result `DIRTY` and the normal delivery runs. For WCA Live,
   it resubmits every round.
4. Switching to integrated live results without a connection makes the
   connection card the first thing Home asks for.

#### Settings screen

The current "Scoretaking token" field and frequency select become a
**Live results** section:

- **Results go to:** a read-only line, e.g. "WCA live results on the WCA
  website (set on the WCA website, checked 2 minutes ago)". Next to it,
  **Check again** and **Change on the WCA website**, which opens
  `https://www.worldcubeassociation.org/competitions/{id}/edit` in a new tab.
  After the user changes it there, Check again picks it up straight away.
- **When:** the existing frequency select, renamed "When to send".
- **WCA Live:** the scoretaking token field, shown only for `wca_live`.
- **Integrated live results:** a connection card, shown only for `internal`
  (see section 2), and the **Open later rounds automatically** switch (off by
  default; section 4).
- **External:** "The WCA website says results are entered with another tool,
  so FKMTime doesn't send official results anywhere."
- **Cubing Contests token:** unchanged.

#### Backend routing

`ResultService.enterWholeScorecardToWcaLiveOrCubingContests` and
`enterRoundToWcaLiveOrCubingContests` become `sendResult(resultId)` and
`sendRound(roundId)`, and they dispatch on event type and the WCA setting:

```
unofficial event        -> ContestsService (unchanged)
wca_live                -> WcaService (today's WCA Live code)
internal                -> IntegratedLiveService (new)
external                -> nothing
```

Every caller uses these two: attempt edits, extras, `removeFromLive`, restart
group, solves from stations, the 5-minute cron, and the "resubmit" buttons.
The backend also adds `officialResultsDestination` to the panel's
competition data, so the panel names the destination in its messages and
hides the "Resubmit to …" actions when official results go nowhere. `sendingResultsFrequency
= NEVER` still blocks the automatic paths, and the manual "resubmit" buttons
still work, as today.

### 2. Connecting to integrated live results

#### Who the token belongs to

ILR needs the bearer token of a WCA user who is allowed to enter scores for the
competition. That is anyone who manages the competition (an organiser, a
delegate, or above), or a person added as a scoretaker on the WCA site. Every
write is recorded on the WCA side as entered by that user.

FKMTime already signs users in with WCA OAuth (`public manage_competitions`),
but it keeps only the access token on `User`, and never the refresh token. A
per-user token won't do: results are sent from crons and station events, with
nobody signed in. So the connection belongs to the **competition**:

```prisma
model Competition {
  // ...
  wcaLiveConnectedById       String?   @map("wca_live_connected_by_id")   // FKMTime user who connected
  wcaLiveConnectedWcaUserId  Int?      @map("wca_live_connected_wca_user_id")
  wcaLiveConnectedName       String?   @map("wca_live_connected_name")     // shown on the card
  wcaLiveCanEnterScores      Boolean?  @map("wca_live_can_enter_scores")   // null: the WCA couldn't tell
  wcaLiveAccessToken         String?   @map("wca_live_access_token")      // encrypted
  wcaLiveRefreshToken        String?   @map("wca_live_refresh_token")     // encrypted
  wcaLiveTokenExpiresAt      DateTime? @map("wca_live_token_expires_at")
  wcaLiveConnectionBrokenAt  DateTime? @map("wca_live_connection_broken_at")
}
```

- **Encryption:** the tokens are encrypted at rest with AES-256-GCM, using a
  key derived from the server's `SECRET` (`src/secret-box.ts`). Device tokens
  are only hashed, but these have to be sent back to the WCA, so they need
  reversible encryption.
- **Never sent to the panel:** the settings response leaves out the tokens.
  The panel only gets the connection's state (`NOT_CONNECTED`, `CONNECTED`
  or `BROKEN`) and the card's details from
  `GET /competition/integrated-live/connection`.

#### Connect flow

1. An organiser, Delegate or admin clicks **Connect to WCA Integrated Live Results** on
   the settings page.
2. FKMTime runs the WCA OAuth authorisation-code flow with the existing client
   and the scope `public manage_competitions`, the same as the login. ILR
   checks no scope today, but asking for the same scope as the login avoids
   every competition having to reconnect if the WCA starts checking one. It
   also lets the connection make WCIF writes. It uses a dedicated redirect
   path, so it doesn't change the login flow.
3. The backend swaps the code for the access token, refresh token and
   `expires_in`, and stores them on the competition.
4. The backend checks the connection and shows the result straight away:
   - **The competition uses ILR:** `wcaScoretakingSoftware` is `internal`
     after a fresh read from the WCA site. The connection card only shows
     then, so this just guards against a change in between.
   - **The user may enter scores:** either the user manages the competition
     (it appears in `GET /api/v0/competitions?managed_by_me=true`), or they are
     in `GET /api/v1/competitions/{id}/scoretakers`, which any signed-in user
     can read. If neither holds, the card says so and offers to reconnect as
     someone else.
5. The card shows "Connected as <name>. Results are entered as this
   person.", with **Reconnect** and **Disconnect** buttons.

The redirect path is `/competition/wca-live-connect`. It has to be registered
as a redirect URI on FKMTime's WCA OAuth application, for each deployment
origin.

#### Keeping the token alive

- **Before each call:** if `wcaLiveTokenExpiresAt` is less than 5 minutes
  away, refresh it with `grant_type=refresh_token`.
  - Store the new pair. Doorkeeper rotates refresh tokens, so the old one stops
    working.
  - One refresh at a time per competition, behind an in-process lock, so two
    sends can't both use the same refresh token.
- **On a 401:** refresh once and retry.
- **If the refresh fails:** mark the connection broken. Until someone
  reconnects:
  - Home shows organisers and Delegates "WCA Integrated Live Results disconnected", with
    a link to reconnect in settings. It shows "Not connected to WCA
    Integrated Live Results" the same way when nobody has connected yet;
  - the settings card shows the same message;
  - every open panel updates straight away, through the socket event
    `integratedLiveConnectionChanged`. Results keep being stored and are sent after reconnecting (see
  Sync state).

### 3. Sending results to ILR

#### Ids

- **Round:** FKMTime's `roundId` is already the WCIF round id (`333-r1`),
  which ILR expects. No mapping is needed.
- **Person:** ILR wants `registration_id`. Add `wcaRegistrationId Int?` to
  `Person`, filled from `persons[].registration.wcaRegistrationId` on import
  and on every WCIF sync. It is in the public WCIF, so no private scope is
  needed.
  - People FKMTime created on site have no WCA registration, so they can't be
    sent to ILR. Their results are marked `NOT_SENDABLE` with the reason "No
    WCA registration". Once the person is registered on the WCA site and the
    WCIF is synced, the next send picks them up.

#### Attempts

ILR stores exactly what we send and deletes any attempts we leave out. It
validates nothing.

- Send the **full** list of counted attempts every time, as today:
  `getCountingAttempts`, extras resolved.
- Send `{"value": <WCA-encoded result>, "attempt_number": n}`, with `n` being
  the 1-based position among counted attempts. Values are the same as for WCA
  Live: centiseconds, `-1` DNF, `-2` DNS, the standard multi-blind and FMC
  encodings.
- **Never send `0`.** ILR rejects the whole request. Attempts not done yet are
  left out.
- FKMTime has to do the time limit (DNF on overtime), the cutoff (no attempts
  after a missed cutoff) and the attempt count itself, because ILR won't.
  - The station already enforces these for live solves.
  - The new part is a guard in `IntegratedLiveService`: before sending, it
    checks the result against the round's `timeLimit`, `cutoff` and format
    from the WCIF.
  - A result that fails the check is not sent. It is marked `REJECTED` with
    the reason, so an edit in the panel that breaks a rule shows up instead of
    reaching the WCA site.
- **An empty result** (every attempt removed, or the result deleted by
  restarting a group) uses
  `PUT /live/rounds/{round}/{registration_id}/clear`, because the write
  endpoint can't express "no attempts".

#### Endpoints used

Base: `${WCA_ORIGIN}/api/v1/competitions/{competitionId}/live`.

| Purpose | Call |
|---|---|
| One scorecard | `POST /rounds/{roundId}` with `{registration_id, attempts}` |
| A round, or several dirty results | `POST /rounds/{roundId}/batch` with `{results: [...]}` |
| Empty a result | `PUT /rounds/{roundId}/{registration_id}/clear` |
| Who is in the round, what ILR has, who advances | `GET /rounds/{roundId}` (public) |
| States of all rounds | `GET /rounds` |

The round actions in section 4 use the rest of the API.

#### Delivery: an outbox, not a fetch per solve

The rate limit (60 requests a minute) and the 202 replies rule out sending one
request per solve straight from the attempt handler. A competition with 20
stations can produce more than one solve a second.

- Every send path marks the result **dirty**. It no longer calls the API
  inline.
- A worker in `IntegratedLiveService` drains the dirty results every 3 s while
  any are waiting:
  - It groups them by round and sends one batch per round. A batch holds at
    most 100 results; that number is a guess, not a documented ILR limit.
  - It sends at most 30 requests a minute in total, which leaves room for the
    other WCA calls (WCIF sync, imports) coming from the same IP.
  - On a 429 or 5xx, it backs off exponentially, up to 1 minute.
- "After every solve" therefore means "within a few seconds of the solve".
  "Every 5 minutes" marks all results of the active rounds dirty every 5
  minutes, as the cron does today. "Resubmit round" marks the round's results
  dirty and runs the worker straight away.
- The manual buttons wait for the worker run. They report how many results
  were accepted, and which ones weren't accepted and why.

#### Sync state and checking delivery

A 202 only means ILR queued the write. FKMTime confirms delivery by reading
the round back.

New table:

```prisma
enum LiveSyncStatus {
  DIRTY          // changed since last successful send
  SENT           // 202 received, not yet confirmed
  CONFIRMED      // read back from ILR and matches
  NOT_IN_ROUND
  NOT_SENDABLE   // e.g. no WCA registration id
  REJECTED       // 4xx from ILR, or failed the local regulation guard
}

model LiveSync {
  resultId     String         @id @map("result_id")
  result       Result         @relation(fields: [resultId], references: [id], onDelete: Cascade)
  status       LiveSyncStatus
  sentHash     String?        @map("sent_hash")     // hash of the attempts last sent
  error        String?
  attempts     Int            @default(0)           // send attempts, for backoff
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@map("live_sync")
}
```

- **After a batch is accepted:** the results become `SENT`. About 10 s later
  the worker reads the round (`GET /rounds/{roundId}`) and compares each
  result's attempts to `sentHash`.
  - If they match, the result is `CONFIRMED`.
  - If they don't match after three reads, the result goes back to `DIRTY`
    and is sent again.
  - ILR's queue may reorder writes, so an older write can overwrite a newer
    one, and comparing against the last thing we sent catches this.
- **Deleted results:** a result deleted in FKMTime ("Delete result" or restart group) needs its
  ILR result cleared. That needs a row that outlives the `Result`, so the
  clear goes into a small `LiveClear(roundId, wcaRegistrationId)` queue that
  the same worker drains.
- **Only for ILR.** WCA Live answers synchronously, so its reply already
  says whether the result was stored, and there is nothing to read back.
  Cubing Contests is the same. Both keep today's behaviour: send, then log the
  reply.

### 4. Running rounds from FKMTime

ILR runs every round through these states: `pending` (the previous round isn't
fully entered), `blocked` (too few competitors under regulation 9m), `ready`,
`open` and `locked`. FKMTime already knows when a round starts, who turned up,
and when a group is restarted, so it makes the matching ILR calls itself.

Every call below uses the competition's connection, so ILR records it as done
by the person who connected. FKMTime logs who triggered it in the panel, as it
does for attempt edits.

**Who can do what:** every WCA live results action in this spec is available
to users with the `ORGANIZER`, `DELEGATE` or `ADMIN` role, i.e. the backend
endpoints use `OrganizerGuard`. That covers:

- opening, closing and clearing rounds;
- resending and clearing results, and adding competitors to rounds;
- removing no-shows;
- withdrawals, with or without a replacement;
- placing a replacement in a group;
- scoretakers.

Stage leaders see the attendance changes but not the WCA live results
actions. The automatic actions (first-round opening, opt-in later-round
opening, adding registered competitors, clearing on restart or delete) need no
role, because nobody clicks them.

| FKMTime moment | ILR call | Automatic? |
|---|---|---|
| First group of a round starts | `PUT /rounds/{roundId}/open` | Yes, when it is safe (see below) |
| A round was opened by mistake | `DELETE /rounds/{roundId}/close` | No, a button |
| A result arrives for someone not in the ILR round | `PUT /rounds/{roundId}/{registration_id}` | First rounds: yes, only when the WCA data shows they may compete in the event. Otherwise a Delegate decides. Later rounds: never |
| A round's last group ends and some competitors never came | `DELETE /rounds/{roundId}/bulk_quit` | FKMTime finds them and asks; one confirmation removes them |
| A competitor says before a later round that they won't compete | `GET .../next_if_quit`, then `DELETE /rounds/{roundId}/{registration_id}` | No, a button that shows who advances instead |
| A group is restarted, or a result is emptied | `PUT /rounds/{roundId}/{registration_id}/clear` | Yes |

#### Opening a round

FKMTime opens a round in ILR when the round's first group becomes current in a
room, whether it was started from Home or by the automatic group change. If
the group start was missed, the first result to send for the round opens it.

- **First rounds** open straight away when they are `ready`. Opening a first
  round touches no other round.
- **Later rounds** lock the previous round when they open. A locked round
  still accepts corrections (read from the WCA code, not yet tried against the
  real API), but ILR no longer recomputes who advances from it. A correction
  that changes the ranking near the advancement line no longer changes who is
  in the next round. So by default FKMTime **suggests** opening a later round
  and a person decides:
  - When the round's first group starts, FKMTime sends a `roundShouldBeOpened`
    socket event. The panel shows a browser notification, "Open 333-r2 in WCA
    live results?", the same way it already does for "Group should be
    changed".
  - Home's room card shows **Open 333-r2 in WCA live results** with one click
    to confirm. The card also lists anything that argues against opening yet:
    results of the previous round not yet confirmed in ILR, results waiting
    for an extra, open extra grants. Each one links to its result.
  - Until someone opens the round, its results queue up as `DIRTY` and are
    sent once it is open. Nothing is lost.
- **Opt-in automatic opening:** with **Open later rounds automatically** on in
  the competition settings, FKMTime opens a later round itself when its first
  group starts, but only when **all** of these are true:
  - every result of the previous round is `CONFIRMED` in ILR;
  - no result of the previous round is waiting for an extra (the existing
    "round finished" check in `CompetitionService`);
  - no extra grant on the previous round is still open.

  When a check fails, it falls back to the suggestion above, with the reasons
  listed.
- **When ILR says no** (`pending`, `blocked`, or "score taking is not finished
  in the previous round"), FKMTime shows ILR's reason as it is and tries again
  on the next result or group start.

**Close round** sits on the round page while the round is open in ILR and has
no results in it. It undoes an opening by mistake and unlocks the previous
round; ILR refuses it once any result is entered.

#### Competitors not in the ILR round

ILR fills a round when it is opened: everyone registered for the event for a
first round, and the people advancing for later rounds. A person can be in an
FKMTime group without being in the ILR round. One such person in a batch makes
ILR reject the whole batch.

- Before a batch, FKMTime fetches `GET /rounds/{roundId}`, which is cached for
  the batch run. It sends only the people listed in `competitors`. The others
  are marked `NOT_IN_ROUND`, and the rest of the batch goes through.

ILR's own check for adding someone to a first round is loose. Anyone accepted
for the competition can be added, even to an event they didn't register for.
So FKMTime makes the regulation checks itself, from the WCA API, before it
adds anyone. The rules are the WCA Regulations (2c1: no competing without a
completed registration) and the WCA Competition Requirements Policy v5.5:

- **6.4:** a competitor may add events up to the deadline for adding events.
  - **6.4.2:** if there is no deadline, they may add events until the event
    takes place.
  - **6.4.2.1:** with no deadline, once the round has started it is at the
    Delegate's discretion.
  - **6.4.4:** the Delegate may make an exception to the deadline when the
    competitor made a mistake while registering.
- **5.2.1:** if on-site registration was advertised and the competitor limit
  was reached when registration closed, on-site registrations must not be
  accepted.

For each person missing from a first round, FKMTime reads two things fresh.
`GET .../addable_competitors` gives their registration and its `competing.event_ids`.
`GET /api/v0/competitions/{id}` gives `event_change_deadline_date`,
`on_the_spot_registration` and `competitor_limit`. Then:

| The WCA data says | FKMTime does |
|---|---|
| Accepted, registered for this event | Adds them automatically. This is the ordinary case: the registration was accepted after the round was opened |
| Accepted, not registered for this event | Doesn't add them. Shows "Not registered for 3x3x3 on the WCA website", with a link to the competition's registrations on the WCA website, and the rule that applies: before the deadline for adding events, "they can add it until <deadline>" (WCRP 6.4); after it, or with no deadline once the round has started, "adding it now is the Delegate's decision (WCRP 6.4.2.1 / 6.4.4)". Once the event is on their registration and the WCIF is synced, FKMTime adds them automatically, as in the row above |
| Not in `addable_competitors` (no accepted registration on the WCA website) | Can't add them. Shows "No accepted WCA registration". If the competition offers on-site registration, it adds "Register them on the WCA website first", and, when `competitor_limit` is set, "On-site registration isn't allowed if the competitor limit was reached when registration closed (WCRP 5.2.1)". The next WCIF sync and run pick them up once they are accepted |

People created by hand in FKMTime have no WCA registration, so they always
fall in the last row.

#### Adding a competitor by hand

An organiser can add a competitor to a first round before they've competed,
e.g. someone moved between groups at the desk.

- **Where:** **Add competitor to round** in the round header menu on the
  Results page. A picker lists the competitors whose accepted WCA
  registration includes the event and who aren't in the round yet.
- **First rounds only.** Later rounds stay as described below.
- **What it writes:** the competitor in the ILR round
  (`PUT /live/rounds/{roundId}/{registration_id}`). The dialog then offers
  **Put them in a group**, the same one-click placement as for replacements
  (section 4, "Competitors who don't come").
- **Not registered for the event:** the person isn't in the picker. Below
  it, FKMTime says that adding an event happens on the WCA website, with the
  link and the rule from the table above. FKMTime doesn't change
  registrations (see Non-goals).

**Later rounds:** FKMTime never adds anyone. Getting into a later round is
decided by advancement (Regulation 9p). The only regular way in for someone
who didn't advance is replacing a competitor who withdraws (9p3), which ILR
does when the withdrawal is confirmed (see below). A result in a later round
for someone ILR doesn't list there is almost always a group assignment mistake,
and the result says so: "Didn't advance to 333-r2 in WCA live results". If a
Delegate does decide otherwise, they do it on the WCA website.

#### Competitors who don't come

A competitor who never came still has an empty result in ILR. ILR keeps the
next round `pending` until every result in the round is complete. So an
unremoved no-show, even in a first round, stops the next round from opening.
FKMTime finds the no-shows itself, and a person confirms the removal.

**When a round's last group ends:**

1. FKMTime lists the competitors who are assigned to the round, were absent in
   every group of it they were assigned to, and have no attempts.
2. Home shows "3 competitors didn't come to 333-r1", with the names and
   **Remove from round in WCA live results**.
3. One confirmation removes them all with
   `DELETE /rounds/{roundId}/bulk_quit`, with no replacements. The round is
   over, so nobody could take their place anyway.

- **The list is a proposal.** The confirmation lets the person untick
  competitors, e.g. someone the Delegate allowed to compete late (Regulation
  2u1+). Unticked competitors keep their empty result until it is filled or
  removed by hand.
- **Late arrivals:** if a removed competitor turns up anyway, the panel
  explains that the WCA has already removed them from the round. Adding them
  back follows the rules above.
- **ILR refuses** to remove anyone with attempts. FKMTime leaves those out of
  the list, so this only happens if attempts arrive between the list and the
  confirmation. Then FKMTime shows ILR's answer and drops that person from the
  list.

**Before a later round, when someone says they won't compete:**

Regulation 9p3 lets the best-ranked non-qualifying competitor from the previous
round take their place. It only matters before the round runs, and it is
optional ("may").

- **The button:** **Remove from round**, for a competitor of a later round
  with no attempts. It is in Attendance and in the result's menu.
- **The round must be open in ILR.** ILR only holds the round's competitors
  once it is open. If it isn't open yet, the dialog offers to open it first,
  with the same checks and the same warning about locking the previous round
  as in "Opening a round".
- **The preview:** before anything is sent, FKMTime asks ILR who would take
  the place (`GET .../next_if_quit`). ILR re-applies the round's advancement
  condition without the withdrawing competitor, and can answer with nobody,
  one person, or several people.
- **The person decides; FKMTime only shows who.** The dialog never picks for
  them and has no default.

| ILR's answer | The dialog shows | The choices |
|---|---|---|
| One person | "Anna Example withdraws from 333-r2. Next in line: Jan Example." | **Withdraw, Jan Example advances** (`advancing_ids: [Jan]`) or **Withdraw, nobody advances** (no `advancing_ids`) |
| Several people | "… Next in line: Jan Example and Ola Example." | **Withdraw, both advance** (`advancing_ids: [Jan, Ola]`) or **Withdraw, nobody advances** |
| Nobody | "… Nobody is next in line." | **Withdraw** only (no `advancing_ids`) |

- **Several people, not only on a tie.** Besides ties for the last place,
  ILR's calculation (`next_participating_without`) also sets aside the round's
  top-placed competitor, so a withdrawal by anyone else frees two places and
  ILR names two people. FKMTime doesn't second-guess this. It shows the names
  as ILR gives them and doesn't call them tied.
- **The list can't be split.** ILR accepts a replacement only if
  `advancing_ids` is exactly its own list, so letting only some of the named
  people advance isn't possible through the API. The choice is everyone ILR
  names or nobody, and the dialog says so.

- **Why nobody advances:** when the answer is nobody, the dialog adds the most
  likely reason, worked out from the WCIF and the previous round:
  - The advancement condition is a result, not a ranking ("all competitors
    under 20.00"), so a withdrawal doesn't free a place.
  - Everyone left from the previous round has only DNF/DNS, and can't advance
    (Regulation 9p4).
  - Everyone from the previous round already advances, or has withdrawn.

  If none of these fits, it just says ILR found nobody.
- **Warning in the dialog:** a removed competitor can't be added back once
  the round is closed. This is the WCA's own warning.
- **On confirm:** FKMTime calls `DELETE /rounds/{roundId}/{registration_id}`
  with the ids from the preview if the person chose to let them advance, and
  without `advancing_ids` if they chose nobody.
- **If ILR's answer changed in the meantime**, e.g. because someone else
  withdrew or a result in the previous round was corrected, ILR refuses and
  returns `should_advance`. This only happens when they chose to let someone
  advance. The dialog shows the new answer, which may now be nobody or
  several people, and asks them to choose again. FKMTime never sends a replacement
  the person didn't see.
- **Afterwards, with replacements:** they usually have no group in 333-r2.
  They can already compete in it, because a station accepts anyone registered
  for the event (`PersonForDeviceService`). But they aren't in the group lists
  or attendance, so nobody calls them up or notices if they don't come.
  - The confirmation offers, per replacement, **Put Jan Example in Anna
    Example's group (333-r2 g3)**. The group is pre-filled with the
    withdrawing competitor's group and can be changed to any group of the
    round that hasn't ended yet. If that group has already ended, the
    pre-fill is the round's next group that hasn't started.
  - A person clicks it; nothing is assigned automatically.
  - It works like the existing "move competitor to another group" action in
    `PersonService`: it adds a `competitor` assignment to the person in the
    WCIF through `WcaService.patchWcif`, with the clicking user's WCA sign-in
    (or the competition's connection, if that sign-in has expired), and then
    creates the FKMTime group record (`StaffActivity`, role
    competitor). Because the assignment is on the WCA side too, the next WCIF
    sync keeps it.
  - If the WCA rejects the WCIF write, nothing changes in FKMTime, and the
    dialog shows the WCA's error. The withdrawal itself has already
    happened, and the message says so.
- **Afterwards, with nobody advancing:** nothing else changes. The round has
  one competitor fewer.
- **When a replacement declines too** (allowed by 9p3+): they are now in the
  round with no attempts, so the same button works on them. The next preview
  names whoever is next, or nobody.

#### Results removed under Regulation 9t (SPEC-005)

SPEC-005 removes a competitor's later-round results when a ruling means they
wouldn't have advanced. Today it sends an empty scorecard. In ILR an empty
result leaves the competitor in the round with nothing entered, and that
keeps the round incomplete, which blocks the next round from opening. So
with integrated live results a removal does two things:

1. **Clears** the result (`PUT /rounds/{roundId}/{registration_id}/clear`).
2. **Removes the competitor from the round**
   (`DELETE /rounds/{roundId}/{registration_id}`) with no `advancing_ids`.
   Regulation 9t doesn't move anyone else up, and ILR can't recompute
   advancement from a locked round anyway.

**Restoring the ruling** (SPEC-005 lets it be restored) adds them back with
`PUT /rounds/{roundId}/{registration_id}` and sends the result again. ILR only
allows that while the round is open. Once it is locked, the result shows
"Can't be restored in WCA live results: 333-r2 is closed", and the Delegate
fixes it in the results submission on the WCA website.

#### Who advances

`GET /rounds/{roundId}` gives `advancing` and `advancing_questionable` for each
result. FKMTime already reads the round to confirm delivery, so the round page
shows an "advances" badge from these flags, plus "may advance" while the round
is still running. The badge says it comes from WCA live results.

### 5. Where it shows up in FKMTime

There is no separate live results page. Each piece goes on the FKMTime page
where people already handle that thing: rounds on Results, competitors on
Attendance, group changes on Home, the connection in competition settings.
None of it shows unless the WCA setting is `internal`. Labels say
"WCA live results" and use plain actions, not ILR's state names.

#### Everything the WCA live admin does, and where it is in FKMTime

This list comes from the WCA live admin pages (`next-frontend/.../live/admin`,
`.../rounds/[roundId]/admin`, `.../live/scoretakers`) and the live API.

| WCA live admin | In FKMTime |
|---|---|
| Rounds overview with each round's state | Results: the round strip and the round header |
| Open a round | First rounds: automatic at the first group. Later rounds: suggested by a notification and Home's room card, one click to open, or automatic if the competition opted in. Also in the round header menu |
| Close a round with no results | Round header menu |
| Clear a whole round | Round header menu, followed by an automatic resend |
| Warning when too few competitors are left (regulation 9m) | Round header, as the reason the round can't open |
| Enter or edit attempts | FKMTime's stations and attempt editing, as today. Sending is automatic (section 3) |
| Double-check page | FKMTime's double-check, as today |
| Add a person to a round | Automatic, or **Add competitor to round** in the round header menu, for people registered for the event. Adding an event to a registration stays on the WCA website (section 4) |
| Quit a competitor, with who advances instead | Attendance and the result's menu (section 4) |
| Remove several competitors at once | Home's room card at the end of a round (section 4) |
| Clear one competitor's result | Automatic on restart group and delete result, plus the result's menu |
| Round's time limit and cutoff | Round header, as today |
| A competitor's results across rounds | Person page, as today |
| Manage scoretakers | Competition settings, in the live results section |

The public live pages (results, podiums, competitor pages, projector view)
aren't admin pages and stay on the WCA website. The round header menu links to
the round's public page.

#### Results page

- **Round strip:** each round gets a small dot for its WCA state: not open
  yet, open, done (locked), or needs attention.
- **Round header:** a line under the time limit and cutoff, e.g. "WCA live
  results: open, 38 of 40 done, all sent". When the round can't open, the
  reason replaces the line, in plain words: "Waiting for 333-r1: 2 empty
  results" or "Needs at least 8 competitors (regulation 9m), 6 left".
- **Round header menu:** the existing "Resubmit to <platform>" item stays and
  means "send the whole round again". Next to it, depending on the round's
  state: **Open in WCA live results**, **Close in WCA live results**, **Clear
  in WCA live results**, and **View on WCA live results** (public page).
  - Clear asks for the round id to be typed in, then empties the round in ILR
    (`PUT /rounds/{roundId}/clear`). FKMTime then sends the round again, so
    ILR ends up matching FKMTime. It is for when ILR holds something nobody
    can explain, e.g. results typed in by hand on the WCA website.
- **Results table:**
  - Each row gets a sync badge (sent, or needs attention with the reason on
    hover) and ILR's "advances" / "may advance" flag. Confirmed results show
    no badge, to keep the table quiet.
  - The row menu gets **Clear in WCA live results** and **Remove from
    round** when they apply, next to "Delete result". A result marked "not in
    round" links to the reason (section 4).
  - A result that is in ILR but has no FKMTime result gets a greyed row,
    "Only in WCA live results". Its only action is Clear. FKMTime never copies
    it in.

#### Single result page

- **"WCA live results" card**, next to the warnings and limits card: sync
  status, the last send, and the reason if something is wrong.
- **Differences:** when ILR's attempts differ from FKMTime's, the card lists
  ILR's attempts and highlights the differences.
- **Menu:** the existing "Resubmit scorecard to <platform>" item stays. The
  same Clear, Add and Remove items as in the table go next to it.

#### Home

- **Room card:** when the first group of a later round starts, the card
  suggests **Open 333-r2 in WCA live results**, with anything that argues
  against opening yet (section 4).
- **End of a round:** when the last group of a round ends, the room card shows
  "3 competitors didn't come to 333-r1", with **Remove from round in WCA live
  results** (section 4).
- **Connection or sending problems:** a broken connection, or results stuck for
  more than a few minutes, show one alert above the rooms, linking to the
  affected round. When everything is fine, Home shows nothing extra.

#### Attendance

On a group of a later round, competitors with no attempts get **Remove from
round** in their row menu: the withdrawal flow with who advances instead
(section 4).

#### Competition settings

The live results section from section 1 holds:

- **The connection card** (section 2): connected as whom, the last successful
  send, the last error, and Reconnect / Disconnect.
- **Scoretakers:** the WCA users who may enter results for the competition.
  FKMTime needs them so that someone other than the organisers can be the
  connected person.
  - **List** them with `GET /api/v1/competitions/{id}/scoretakers`.
  - **Add** one by WCA ID: FKMTime resolves the WCA user id with the lookup
    it already has (`WcaService.getUserInfoByWcaId`), then calls
    `POST .../scoretakers` with `user_id`. A person without a WCA ID can't be
    added from FKMTime.
  - **Remove** one with `DELETE .../scoretakers/{user_id}`.
  - **Whose token:** adding and removing need someone who manages the
    competition. FKMTime uses the connection if the connected person manages
    it. Otherwise it uses the WCA sign-in of the FKMTime user clicking the
    button, and asks them to sign in with WCA again if it has expired.
  - Only users with the `ADMIN`, `ORGANIZER` or `DELEGATE` role see the list.

#### Reading ILR

The round header line, the badges, the "only in WCA" rows and the differences
all come from the same `GET /rounds/{roundId}` read that confirms delivery
(section 3), plus `GET /rounds` for the round strip. While a round's results
are on screen, these reads refresh every 10 seconds. They are public and don't
count against the writes FKMTime rations.

### 6. Failure modes

| Situation | Behaviour |
|---|---|
| Venue internet down | Results stay `DIRTY`. The worker backs off, then sends everything when the connection is back. Stations and the panel are unaffected |
| Token refresh fails | The connection is marked broken and shown on Home. Results stay `DIRTY` until someone reconnects |
| WCA competition switched away from `internal` mid-competition | Writes made before the next read get 403 "Scoretaking software needs to be set to Internal". The 403 triggers an immediate re-read, FKMTime switches destination, and it sends everything to the new one. Nothing is lost |
| The user who connected loses their rights | 403 "Score taking privileges required". Shown on the card; someone with rights reconnects |
| ILR changes its API (it is `0.1.0`) | Unexpected 4xx responses mark results `REJECTED` with the body as the reason, so it shows up in the panel |

## Acceptance criteria

- [ ] Official results go to WCA Live for `wca_live`, to integrated live
      results for `internal`, and nowhere for `external`, on every send path.
      FKMTime has no setting that overrides this.
- [ ] The WCA setting is read on import, on WCIF sync, every 5 minutes and on
      "Check again". When the WCA can't be reached, the last value is kept.
- [ ] Settings shows the WCA setting read-only, with a link that opens the
      competition's edit page on the WCA website.
- [ ] A change of the WCA setting mid-competition switches the destination,
      tells the user on Home, and sends every entered result to the new
      destination.
- [ ] A competition never read yet behaves as before this change.
- [ ] "Do not send" stops all sending, whatever the WCA setting.
- [ ] Unofficial events still go to Cubing Contests, whatever the WCA setting.
- [ ] Connecting stores an encrypted access and refresh token on the
      competition. A token about to expire is refreshed before use, and a 401
      triggers one refresh and a retry (unit test with a fake WCA).
- [ ] A failed refresh marks the connection broken and shows it on Home.
- [ ] `Person.wcaRegistrationId` is filled on import and on WCIF sync.
- [ ] Results are sent as `{registration_id, attempts:[{value, attempt_number}]}`,
      never contain a `0`, and always carry the full list of counted attempts.
- [ ] A result that breaks the round's time limit, cutoff or attempt count is
      not sent and shows as rejected, with the reason.
- [ ] People not in the ILR round are left out of the batch and marked "not in
      round". The rest of the batch is sent.
- [ ] A round is opened in ILR when its first group starts, or failing that
      when its first result is sent.
- [ ] By default a later round is not opened by FKMTime. When its first
      group starts, the panel shows a browser notification and Home's room
      card offers a one-click open, listing anything that argues against it.
- [ ] With "Open later rounds automatically" on, a later round opens by
      itself only when the previous round is fully confirmed in ILR and has
      no result waiting for an extra and no open extra grant. Otherwise it
      falls back to the suggestion.
- [ ] "Close round" undoes an opening while the round has no results.
- [ ] A first-round competitor missing from the ILR round is added
      automatically only when the WCA data shows an accepted registration for
      that event. Each other case in the table shows its reason, with a link
      to the WCA website, and doesn't add them.
- [ ] FKMTime never adds anyone to a later round.
- [ ] A result removed under Regulation 9t (SPEC-005) is cleared in ILR and
      the competitor is removed from that round with nobody advancing.
      Restoring the ruling adds them back while the round is open, and says
      why when it isn't.
- [ ] "Add competitor to round" adds a competitor registered for the event to
      a first round, and offers to put them in a group. FKMTime never
      changes a WCA registration.
- [ ] When a round's last group ends, Home lists its no-shows. One
      confirmation removes the ticked ones from the ILR round, without
      replacements, and the next round can then open.
- [ ] "Remove from round" for a later round shows ILR's answer before
      anything is sent: one person, several people, or nobody, with the
      likely reason when it is nobody. The person must choose between letting
      them advance and nobody advancing; there is no default. A changed answer
      from the WCA, including a change to nobody, asks again.
- [ ] A withdrawal with nobody advancing is sent without `advancing_ids`, and
      the round keeps everyone else unchanged.
- [ ] After a withdrawal with replacements, each replacement can be put into
      a group with one click. The group is pre-filled with the withdrawing
      competitor's group. The assignment is written to the WCIF and survives
      the next WCIF sync.
- [ ] The round page shows ILR's advancing flags for each result.
- [ ] Every row of the WCA live admin table in section 5 can be done from
      FKMTime's existing pages. A competition day run on the dev stack
      against dummy WCA never needs the WCA live admin pages, and FKMTime
      gets no new page or navigation entry.
- [ ] The round strip and round header show each round's WCA state, with the
      reason when it can't open. The round header menu offers Open, Close
      and Clear only where ILR accepts them.
- [ ] The single result page shows ILR's attempts when they differ from
      FKMTime's. Clear followed by the automatic resend leaves no
      differences.
- [ ] Results in ILR with no FKMTime result show as "Only in WCA live
      results" rows that can be cleared.
- [ ] Scoretakers can be listed, added by WCA ID and removed in competition
      settings, by someone who manages the competition.
- [ ] With the WCA set to anything but `internal`, none of these additions
      show.
- [ ] Every WCA live results action is allowed for organisers, Delegates and
      admins, and refused for stage leaders and staff.
- [ ] No more than 30 ILR requests a minute, under a load test of 20 stations
      solving at once.
- [ ] A result goes `DIRTY` → `SENT` → `CONFIRMED` once the read-back matches.
      A result whose read-back doesn't match is sent again.
- [ ] Restarting a group clears those people's results in ILR.
- [ ] With the internet cut and then restored, every result reaches
      `CONFIRMED` with no manual action.
- [ ] Dummy WCA (`dummy_wca`) implements the ILR endpoints used here, with
      202, async apply, round open/lock, and the 422 cases, so e2e tests can
      run against it.

## Rollout

- **Migration:** additive. It adds the `Competition` and `Person` columns and
  the `LiveSync` and `LiveClear` tables, with no backfill. Existing
  competitions behave as today until the first read of the WCA setting, which
  happens within 5 minutes of deploying.
- **Dummy WCA image:** its competition endpoint has to return
  `scoretaking_software`, so each value can be tried on the dev stack.
- **No station or connector changes.**
- **Dummy WCA image:** it needs the ILR endpoints before the e2e tests can
  run. It is a separate repository, so that change goes first.
- **WCA OAuth client:** the connect flow's redirect URI has to be registered
  on FKMTime's WCA OAuth application, for each deployment origin.
- **First real use:** a small competition already set to `internal` on the
  WCA site, with the delegate checking the WCA round pages during the first
  rounds.
- **Revert:** pause with "Do not send", or switch the competition on the WCA
  website. The ILR code is only reached when the WCA setting is `internal`.
