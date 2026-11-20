# SPEC-013: Delegate access for one group

- **Status:** Accepted
- **Created:** 2026-11-19
- **Related:** SPEC-002 (extras for all attempts), SPEC-005 (DNF ruling)

## Problem

Only delegates (and admins) can work incidents. A station's "call delegate"
lands on the Incidents page, and every action that fixes it — resolving the
attempt, giving an extra, adding a missed attempt, putting attempts in the
right order — sits behind `DelegateGuard`.

On the day there are often more incidents than delegates. A delegate who has
to be somewhere else for a group (another room, a dispute, a break) has two
options today, both bad:

- **Leave the incidents waiting.** Competitors stand at the station until the
  delegate is back, and the round runs late.
- **Make someone a delegate.** An organizer edits the user's roles. That gives
  them every delegate action — DNF rulings, extras for several attempts,
  removing results, sending results — for the rest of the competition, until
  someone remembers to take the role away. Nobody can see afterwards what that
  person did while they held it.

What delegates actually want is narrower: "you handle the incidents in this
group, you may give extras and fix the attempt order, and I'll look over what
you did".

## Goals

- A delegate gives a user delegate access for one group. It works only while
  that group is running and ends by itself when it stops.
- With it the user can resolve incidents of competitors in that group.
- The delegate picks, each time, which other actions the user gets. The
  default is giving an extra, adding an attempt and reordering attempts.
  Actions on several attempts at once (DNF all, extras for several attempts)
  are off by default.
- Delegates see every action the user took under the grant, as it happens and
  afterwards.
- A delegate can end the access early.
- No change to station firmware, the micro-connector, or station messages.
- Roles stay as they are: the grant never touches `User.roles`.

## Non-goals

- Access for a whole round, a day, or the competition. Make the user a
  delegate for that, as today.
- Actions that decide a round or leave the venue: removing a result,
  double-checking, sending results to the WCA or WCA Live, restarting a group,
  assigning DNS. These are never grantable.
- Warnings, noteworthy incidents and manual incidents. They stay with
  delegates: a warning is a judgement about a competitor, so the grantee tells
  the delegate instead.
- Granting access to someone without an FKMTime account. The user must
  already exist (an organizer creates it, or they signed in with the WCA
  before).
- Undoing a user's actions in one click. The delegate sees them and fixes
  anything wrong with the normal delegate tools.

## Design

### Words

- **Grant** — one delegate giving one user access for one group.
- **Grantee** — the user who received it.
- **Group** — a WCIF group activity code, e.g. `333-r1-g2`, the same ids as
  `Room.currentGroupIds`.
- **Running** — the group id is in some room's `currentGroupIds`.

### What a grant allows

A grant always includes **resolving incidents**: on an unresolved attempt in
scope, correct its time, penalty, judge and comment and mark it resolved — the
"Resolve" button of the incident form today.

On top of that the delegate ticks permissions when giving access:

| Permission | What it unlocks | Default |
|---|---|---|
| `GIVE_EXTRA` | "Save and give extra" on an incident, and "Give extra attempt" on one attempt | on |
| `ADD_ATTEMPT` | Adding an attempt to a result (`POST /attempt`) | on |
| `REORDER_ATTEMPTS` | Reordering, swapping, and assigning an extra as a replacement | on |
| `EDIT_ATTEMPT` | Editing an attempt that isn't an incident | off |
| `DELETE_ATTEMPT` | Deleting an attempt, including "Delete" on an incident | off |
| `EXTRAS_FOR_SEVERAL` | "Give extras for several attempts" (SPEC-002) | off |
| `DNF_ALL` | "DNF all attempts" (SPEC-005) | off |

The defaults are what the dialog pre-ticks; the delegate can change them
every time. Nothing the grant allows reaches outside its scope, whatever is
ticked.

### Scope

The WCIF assignment alone isn't enough: competitors often solve in a group
other than their own without anyone changing the assignment (they came late,
missed their group, or were sent to fill a free station). So a grant covers a
result in the group's round (`groupIdToRoundId(groupId)`) when **either**:

- **the competitor solved in this group**: the result has an attempt made on
  a station in a room running the group (`Attempt.device.roomId`), created
  since the room started the group (`activatedAt`, below), or
- **the competitor is assigned to the group** in the WCIF, so the grantee can
  add an attempt for a competitor whose station didn't record one.

The time bound keeps out competitors of earlier groups of the same round who
solved in the same room. Stations running a custom round (SPEC-007) still
count: the round must match the grant's round anyway.

An incident always comes from a station, so every incident raised in the room
during the group is in scope, whoever's assignment it is — including those
raised before the delegate gave access. A competitor moved
to another group stays in scope if they already solved in this one.

Every action is checked against scope on the server, by the target result.
Reads follow the same rule: the grantee's incident list shows only in-scope
incidents.

### When a grant is active

A grant is **active** when all of these hold:

- it hasn't been ended (`endedAt` is null),
- its group is running.

A delegate can give access before the group starts (e.g. while the previous
group runs); the grant waits and becomes active when a room starts the group.
The backend then sets `activatedAt` to when the room started the group (the
earliest, if several rooms run it), also when access is given for a group
already running. Rooms keep that time in memory; after a backend restart it is
the time the backend started, so scope never reaches into an earlier group.

When the group stops running — a room moves on, or the group is taken off by
hand — the backend sets `endedAt` on its grants. It syncs grants with the rooms
right after a room changes groups (`rooms.service.ts`) and again before every
access check, so a room changed any other way can't leave a grant working. An
ended grant never comes back, even if the group is started again; the delegate
gives access again if they want it.

A delegate can end a grant at any time; that sets `endedAt` and `endedById`.

A request that arrives after the grant ended fails with 403, even if the page
was opened while it was active.

### Data model

```prisma
enum DelegateGrantPermission {
  GIVE_EXTRA
  ADD_ATTEMPT
  REORDER_ATTEMPTS
  EDIT_ATTEMPT
  DELETE_ATTEMPT
  EXTRAS_FOR_SEVERAL
  DNF_ALL
}

model DelegateGrant {
  id          String                    @id @default(uuid())
  userId      String                    @map("user_id")
  user        User                      @relation("delegate_grant_user", fields: [userId], references: [id], onDelete: Cascade)
  groupId     String                    @map("group_id")
  permissions DelegateGrantPermission[] @default([])
  createdById String?                   @map("created_by_id")
  createdBy   User?                     @relation("delegate_grant_created_by", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime                  @default(now()) @map("created_at")
  // When the room started the group, set once the grant is active; null while waiting
  activatedAt DateTime?                 @map("activated_at")
  endedAt     DateTime?                 @map("ended_at")
  endedById   String?                   @map("ended_by_id")
  endedBy     User?                     @relation("delegate_grant_ended_by", fields: [endedById], references: [id], onDelete: SetNull)
  actions     DelegateGrantAction[]

  @@index([userId, endedAt])
  @@map("delegate_grant")
}

model DelegateGrantAction {
  id        String        @id @default(uuid())
  grantId   String        @map("grant_id")
  grant     DelegateGrant @relation(fields: [grantId], references: [id], onDelete: Cascade)
  kind       String        // RESOLVE_INCIDENT, GIVE_EXTRA, ADD_ATTEMPT, …
  resultId   String?       @map("result_id")
  attemptId  String?       @map("attempt_id")
  personName String?       @map("person_name")
  // What the action changed, in words the delegate reads:
  // "Resolved attempt 2: 12.34 → 14.34 (+2)"
  summary    String
  createdAt DateTime      @default(now()) @map("created_at")

  @@index([grantId, createdAt])
  @@map("delegate_grant_action")
}
```

`User` gets the three back-relations. `resultId`/`attemptId` are plain
columns, not foreign keys: the action stays in the list after the attempt (or
the whole result) is deleted, and `personName` and `summary` still say what it
was.

At most one grant that hasn't ended per user and group: giving access again
for the same pair updates the permissions of the existing grant instead of
creating a second one. The service enforces it; the schema has no partial
unique index, because the repo applies the schema with `prisma db push` and
has no hand-written migrations to put one in.

### Who can give access, and to whom

- Delegates and admins give and end grants. Organizers don't: whoever is
  responsible for incidents decides who resolves them.
- The grantee is any existing user who isn't a delegate or admin already.
  Their roles don't change.

### Checking access on the server

Guards keep reading roles from the database on every request
(`AuthService.validateJwt`), so nothing goes into the JWT and a grant takes
effect, and ends, on the next request.

- `DelegateGuard` stays as it is for everything a grant never allows.
- A new `DelegateOrGrantGuard` lets through delegates, admins, and users with
  a grant that hasn't ended; anyone else gets a 403 saying why ("…has ended",
  "…starts when the group starts", "Only delegates can do this"). It goes on
  the endpoints listed in "What a grant allows", and on the reads they need:
  `GET /incident/unresolved`, `GET /incident/unresolved/count`,
  `GET /attempt/:id`, `GET /attempt/:id/edit-log`, `GET /result/:id`, and the
  extras and DNF ruling reads (`GET /attempt/give-extras-for-all/:resultId`,
  `GET /attempt/dnf/:resultId`), which the result page loads for any covered
  result.
- The guard only answers "might be allowed". Each grantable endpoint decides,
  through one `DelegateGrantService.authorize(user, action, target)` call
  before it calls the service: delegates and admins pass; anyone else needs an
  active grant whose scope contains the target and whose permissions include
  the action. Otherwise 403 with a message saying which: "Your delegate access
  for 3x3x3 Cube, Round 1, Group 2 has ended", "…doesn't include deleting
  attempts", "…doesn't cover this competitor". `PUT /attempt/:id` serves the
  incident form, "Give extra attempt" and the edit form, so the change itself
  says which action it is (`actionForAttemptUpdate`).
- After the change goes through, the endpoint writes a `DelegateGrantAction`
  for a grantee. It isn't in the change's transaction: losing a log line must
  not undo a ruling a competitor is waiting on, so a failed write is logged and
  dropped. Delegates' own actions write nothing new; the attempt edit log keeps
  recording everyone as today.
- A grantee's `PUT /attempt/:id` never saves the incident as noteworthy, and
  `GET /attempt/:id` leaves out the competitor's earlier incidents. A DNF
  ruling that would also remove results in later rounds is refused.
- `GET /incident/unresolved` (and the count) return only in-scope incidents
  for a grantee, across all their active grants.

### Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| `POST` | `/delegate-grant` | delegate | Give access: `{ userId, groupId, permissions }`. Creates, or updates the open grant for that pair |
| `POST` | `/delegate-grant/:id/end` | delegate | End a grant early |
| `GET` | `/delegate-grant?groupId=` | delegate | Grants for a group (or all), with grantee, giver, state, action count |
| `GET` | `/delegate-grant/:id/actions` | delegate | The grantee's actions under that grant, newest first |
| `GET` | `/delegate-grant/mine` | any user | The caller's grants that are active or waiting, with group name, permissions and who gave them |

### Socket.io

- `joinIncidents` accepts delegates and users with a grant that hasn't ended;
  the panel joins again when its access changes. A grantee
  receives the same incident events as delegates; the frontend shows only
  in-scope ones. The payloads hold nothing a signed-in user can't already read
  on the round's results page.
- New event `delegateGrantChanged` to the grantee's sockets (a
  `user-${userId}` room every signed-in panel joins with `joinDelegateAccess`) when a grant is given, changed,
  activated or ended, so their panel updates without a reload.
- New event `delegateGrantAction` to a `delegate-grants` room, which only
  delegates join (`joinDelegateGrants`), when a grantee acts, and
  `delegateGrantsChanged` there when any grant changes, so the delegates' list
  updates live. Grantees in the `incidents` room don't receive them.

### Frontend

**Delegate side.**

- Home's room card menu ("…") gets "Give delegate access…". It opens a
  dialog: pick a user (delegates and admins left out), the group (the room's
  running and next groups), and the permission checkboxes with the defaults
  ticked.
- The Incidents page gets a "Delegate access" tab, counting the grants that
  haven't ended: active and waiting grants, then ended ones from today, each
  with "End" while it's open. Each row opens the grantee's actions — time,
  competitor (linking to the result) and summary. The tab also gives access
  for any running group.

**Grantee side.**

- With an active or waiting grant the grantee sees the Incidents nav item,
  showing only the open incidents tab, filtered to their scope.
- No past incidents. Resolved incidents, noteworthy incidents, warnings,
  manual incidents and a competitor's incident history (`GET /incident/resolved`,
  `/noteworthy`, `/warnings…`, `/manual`, `/person/:id`, `/round/:roundId`)
  stay behind `DelegateGuard`. An incident the grantee resolves leaves their
  list like any other; what they did with it stays visible to delegates in the
  grant's actions. The only history they can open is the edit log of an
  attempt in scope, which they need to see what the station recorded.
- A banner across the panel: "Delegate access for 3x3 Cube Round 1 Group 2,
  given by <name>. Ends when the group ends." While waiting: "starts when the
  group starts". When it ends the banner says so for a few seconds and the
  Incidents item goes away.
- On the incident form and the result page, buttons for actions the grant
  doesn't include are hidden, not disabled; so are the result-wide actions a
  grant never allows (resubmit, assign DNS, delete, remove). A result outside
  the grant's scope doesn't open (403): the grantee has no reason to be there.

### Edge cases

- **Group ends mid-edit.** The save fails with the "has ended" message; the
  incident stays open for delegates.
- **Two rooms run the same group id.** The grant is active while any room runs
  it, and ends when the last one stops.
- **Grantee becomes a delegate.** Their grants stop mattering; they are left
  as they are and end with their group.
- **Grant's giver loses the delegate role.** The grant stays; another delegate
  can end it.
- **Competitor solves in this group without being assigned to it.** In scope
  from their first attempt on a station in the room, incidents included.
- **Competitor moved out of the group mid-group.** In scope if they already
  solved in this group; otherwise out from the next request.
- **Station offline / reconnects.** Unaffected: stations don't know about
  grants.

## Acceptance criteria

- [ ] A delegate gives a staff user access for a group that is running; the
      user sees the Incidents page and the banner without reloading.
- [ ] The grantee resolves an in-scope incident; the attempt is resolved and a
      `RESOLVE_INCIDENT` action appears in the delegate's list live.
- [ ] With default permissions the grantee can give an extra, add an attempt
      and reorder attempts; DNF all, extras for several attempts, editing a
      non-incident attempt and deleting an attempt are hidden and return 403
      when called directly.
- [ ] Ticking `DNF_ALL` on the grant lets the grantee DNF all attempts of an
      in-scope result, and nothing else changes.
- [ ] An incident raised in the room during the group by a competitor
      assigned to another group is in the grantee's list and can be resolved.
- [ ] An incident raised in the group before the delegate gave access is in the
      grantee's list.
- [ ] An incident from another room, from the same room before the group
      started, or from another round, is not in the grantee's list and returns
      403 when acted on directly.
- [ ] The grantee can add an attempt for a competitor assigned to the group who
      has no attempt yet.
- [ ] Resolved, noteworthy and manual incidents, warnings and a competitor's
      incident history return 403 for a grantee, and their tabs don't show.
- [ ] Access given before the group starts does nothing until a room starts
      the group, then works.
- [ ] When the room moves to the next group, the grant ends: the grantee's next
      action returns 403 with the "has ended" message, and the Incidents item
      disappears.
- [ ] Starting the same group again does not bring an ended grant back.
- [ ] A delegate ends a grant early; the grantee's next request returns 403.
- [ ] Remove result, double-check, send results, restart group and assign DNS
      return 403 for a grantee whatever the permissions.
- [ ] Giving access to a delegate or admin is refused.
- [ ] `User.roles` of the grantee is unchanged throughout.
- [ ] Unit tests for `DelegateGrantService.authorize` cover: delegate, no
      grant, waiting grant, ended grant, out-of-scope result, missing
      permission, allowed.

## Rollout

- Additive schema change, applied with `prisma db push`: the enum and two
  tables. No data changes; existing users and roles keep their meaning.
- No station, firmware or micro-connector change.
- Revert: drop the guard from the endpoints (they go back to `DelegateGuard`)
  and hide the UI. The tables can stay until a later migration removes them.
- User docs: a short page on giving delegate access for a group.
