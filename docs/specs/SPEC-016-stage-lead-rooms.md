# SPEC-016: Stage leads for one room

- **Status:** Accepted
- **Created:** 2026-11-21
- **Related:** #278, SPEC-004 (attendance tags), SPEC-013 (delegate access for one group)

## Problem

A competition with several rooms has a stage lead per room. Each takes
attendance for the groups on their stage: marks competitors, judges, runners
and scramblers present, late, absent or replaced, and adds people who weren't
assigned.

The `STAGE_LEADER` role knows nothing about rooms. `StageLeaderGuard` lets a
stage lead read and change attendance for every group of the competition, and
the panel offers them all of it: the Attendance page's group picker lists every
round, Home shows "Attendance" on every room's card, the Schedule and a
person's page list every group.

That causes two problems on the day:

- **Mistakes in the wrong room.** A stage lead who picks the wrong group, often
  the same round's group running next door, marks people absent who are
  standing in the other room. Nobody notices until that room's stage lead
  finds their attendance changed.
- **Too much to wade through.** A stage lead only ever needs their own room,
  but has to find it among every group of the day.

Also, today the attendance socket room (`joinAttendance`) is behind
`OrganizerGuard`, so a stage lead's Attendance page doesn't update live when
someone else marks a person or a station checks a competitor in. It only
refreshes after their own changes.

## Goals

- An organizer assigns a stage lead to one or more rooms.
- A stage lead reads and changes attendance only for groups in their rooms.
  The competition-wide reports (statistics, most missed assignments) stay
  open to them: they change nothing.
  The server enforces it; the panel shows only those groups.
- A stage lead's Attendance page updates live, like an organizer's.
- Organizers, delegates and admins keep attendance for the whole competition,
  whether or not they also hold `STAGE_LEADER`.
- Competitions already running keep working after the upgrade without anyone
  editing users.

## Non-goals

- Assigning rooms per day or per time slot. An organizer changes a stage lead's
  rooms between days if they move.
- Room scope for other roles. Delegates, organizers and staff work as today.
- Anything stage leads can't do today. Group controls (starting and switching
  groups) stay with organizers and delegates.
- Station, firmware or micro-connector changes.

## Design

### Words

- **Stage lead** — a user with `STAGE_LEADER` and none of `ADMIN`, `ORGANIZER`,
  `DELEGATE`. Users holding one of those as well have full access; this spec
  doesn't touch them.
- **Their rooms** — the rooms an organizer assigned to the stage lead.
- **A room's groups** — the groups the WCIF schedule puts in the room, plus any
  group the room has started (`Room.startedGroupIds`) or is running now
  (`Room.currentGroupIds`). The second part covers a group moved to another
  room on the day: the room that ran it owns its attendance too.

A FKMTime room is matched to its WCIF room by name, the same way the import,
the sync and `sortRoomsBySchedule` already do.

### Scope

A stage lead with rooms may read and change attendance for a group only when
it is one of their rooms' groups.

A stage lead with **no rooms** has the whole competition, as today. That is
what every existing stage lead is after the upgrade, so nothing breaks, and the
Users page says "All rooms" for them so an organizer sees the difference.

### Data model

```prisma
model StageLeadRoom {
  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomId String @map("room_id")
  room   Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@id([userId, roomId])
  @@map("stage_lead_room")
}
```

`User` and `Room` get the back-relations. Rows stay when the user loses
`STAGE_LEADER`: they do nothing without the role, and come back into effect if
the role is given again. Editing the user on the Users page clears them along
with the role (below), so stale rows only come from direct database edits.

### Checking access on the server

A new `AttendanceScopeService` answers two questions, reading the user's roles
and rooms from the database on every request, like the guards already do:

- `scopeFor(user)` → `{ allGroups: true }` or `{ allGroups: false, groupIds }`.
- `assertGroup(user, groupId)` → throws 403 "You take attendance for Main Hall
  only" (the user's room names) when the group is out of scope.

`StageLeaderGuard` stays as the "might be allowed" check on every attendance
endpoint. Each endpoint then checks scope:

| Endpoint | Check |
|---|---|
| `GET /attendance/group/:groupId` | `groupId` in scope |
| `POST /attendance/unassigned/:groupId` | `groupId` in scope |
| `POST present/:id`, `absent/:id`, `late/:id`, `replaced/:id`, `PUT left-early/:id`, `restore/:id`, `comment/:id` | the activity's `groupId` in scope, looked up before the change |
| `POST /attendance/no-show` | at least one id in `groupIds` in scope; then applies to all of them (below) |
| `GET /attendance/round/:roundId/staffing` | at least one group of the round in scope |
| `GET /attendance/person/:id` | stage leads get only the activities in scope |
| `GET /attendance/statistics`, `GET /attendance/missed` | none: competition-wide reports, read-only, open to every stage lead as today |

New endpoint `GET /attendance/scope` returns the caller's scope with room ids
and names, for the panel to filter by. It is a separate call rather than a
field of the login response so a change of rooms reaches the panel without
signing in again.

### Socket.io

`joinAttendance` and `leaveAttendance` move from `OrganizerGuard` to
`StageLeaderGuard`, and `joinAttendance` refuses a group out of the caller's
scope. The stray `@UseGuards(OrganizerGuard)` on `handleNewAttendance` (a
server-side emitter, not a handler) goes.

### Assigning rooms

- Organizers (and admins) assign rooms, the same people who edit roles today.
- `CreateUserDto` and `UpdateUserDto` get an optional `stageLeadRoomIds:
  string[]`. Saved only when the roles include `STAGE_LEADER`; otherwise the
  user's rows are cleared.
- `GET /user` returns each user's rooms.

### Frontend

**Users page (Setup → Users).** In the create and edit dialogs, ticking
"Stage leader" shows a "Rooms" multi-select of the competition's rooms, in
schedule order, empty meaning all rooms. The user's row shows "Stage leader ·
Main Hall" or "Stage leader · All rooms".

**For a stage lead with rooms**, everything filters by `GET /attendance/scope`:

- **Attendance page.** The group picker offers only rounds and groups in scope;
  the page opens on their room's running group. Previous/next step through
  their groups only. Opening an out-of-scope group by URL shows "You take
  attendance for Main Hall only" instead of the page.
- **Home.** "Attendance" shows only on their rooms' cards.
- **Schedule.** The attendance link shows only on groups in scope.
- **Person page.** Attendance rows show only groups in scope.
- **Reports.** "Attendance statistics" and "Most missed assignments" stay
  as they are, covering the whole competition.

A stage lead with no rooms sees everything, as today.

### Edge cases

- **Group moved to another room on the day.** Both rooms' stage leads see it:
  the scheduled room's through the WCIF, the running room's through
  `startedGroupIds`/`currentGroupIds`.
- **Room renamed in the WCIF.** The sync creates a new room with the new name;
  the stage lead stays assigned to the old one and loses the scheduled groups.
  An organizer reassigns. Already the case for room colours and ordering.
- **Competition re-imported.** Import deletes users, so assignments go with
  them.
- **Rooms changed while the page is open.** The next request uses the new
  scope; a refused change shows the 403 message and the panel refetches the
  scope.
- **No-show for the day across rooms.** "No-show for the day" (SPEC-004)
  tags the person in every group of the day, and those can be in other rooms.
  A stage lead may set or clear it for the whole day as long as one of the
  groups is theirs: not coming is a fact about the person, and the other
  room's stage lead would otherwise wait for someone who isn't there. This is
  the one change a stage lead makes outside their rooms; a person with no
  group in their rooms that day is refused.
- **Station check-in.** Stations marking competitors present are unaffected:
  they don't act as a user.

## Acceptance criteria

- [ ] An organizer gives a user `STAGE_LEADER` with rooms Main Hall; the Users
      page shows "Stage leader · Main Hall".
- [ ] That stage lead's Attendance page offers only Main Hall's groups and
      opens on the group Main Hall is running.
- [ ] Marking someone present, absent, late, replaced, left early, restored,
      commented or added unassigned works for a Main Hall group and returns 403
      with the "Main Hall only" message for a Side Hall group, called directly.
- [ ] A group scheduled in Side Hall but started in Main Hall is in the Main
      Hall stage lead's scope.
- [ ] A stage lead with no rooms can read and change attendance for every
      group, as before the change.
- [ ] A user with `STAGE_LEADER` and `ORGANIZER` has the whole competition
      whatever rooms are assigned.
- [ ] A stage lead's Attendance page updates live when another user marks
      someone in the same group.
- [ ] `joinAttendance` for an out-of-scope group is refused.
- [ ] A Main Hall stage lead sets "no-show for the day" for a person with
      groups in Main Hall and Side Hall; both are tagged. For a person with no
      Main Hall group that day it returns 403.
- [ ] A stage lead with rooms still opens attendance statistics and most
      missed assignments for the whole competition.
- [ ] Removing `STAGE_LEADER` from a user clears their rooms.
- [ ] Unit tests for `AttendanceScopeService` cover: admin, organizer,
      delegate, stage lead with no rooms, stage lead with rooms (scheduled
      group, started group, running group, other room's group), stage lead
      also organizer.

## Rollout

- Additive schema change applied with `prisma db push`: one table. No data
  migration: existing stage leads have no rooms and keep the whole
  competition.
- No station, firmware or micro-connector change.
- Revert: drop the scope checks from the attendance endpoints and hide the
  rooms field. The table can stay until a later change removes it.
- User docs: a line on the Users page doc and the Attendance doc.

