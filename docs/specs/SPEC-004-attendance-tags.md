# SPEC-004: Attendance tags — left early, replaced by, no-show for the day

- **Status:** Accepted
- **Created:** 2026-11-06
- **Related:** #260 (the items still open there), #567 (WCIF sync removes
  assignments)

## Problem

Staff leads take attendance for every group. Some situations that come up every
competition can't be recorded today, or only as a comment:

- **Someone left before the group ended.** There's no way to record it, and
  "Most missed" counts that person as having done the whole job.
- **Someone was replaced, but we don't know by whom.** "Present but replaced"
  exists, but the person who did the job shows up as a separate unassigned walk-in,
  unconnected to the person they covered for. When someone just doesn't turn up
  and a volunteer covers, there's nothing linking the two.
- **More than one thing is true.** One `status` value can't say "late, and also
  left early".
- **Someone isn't coming today at all.** Usually a staff lead hears in the
  morning that a person is ill. Their remaining groups that day still show them
  as an ordinary absentee waiting to scan, so nobody knows ahead of time which
  groups need cover.
- **Previous-round rankings show only on absent competitors.** Leads use the
  ranking to decide whether a missing competitor matters (e.g. a likely
  finalist). Once the competitor is present, the ranking disappears.

## Goals

- Record "left early" on any present staff row, combinable with late.
- Record who did a staff member's job instead, whether the original person was
  there (present but replaced) or not (absent, covered).
- Mark a staff member as not coming for the rest of a competition day in one
  action, and have every group that day show it.
- Show the previous-round ranking for every competitor in the group.
- No change to station firmware, the micro-connector, or station messages.
- No data migration: today's rows keep their meaning.

## Non-goals

- A "present but doing nothing" status. Present-but-replaced covers the case
  where someone else did the job. Anything else goes in the comment.
- Starting the next group from the attendance page. Home already does it per
  room and for all rooms.
- Competitors. Tags and no-shows are for staff roles only, as are late and
  replaced today.

## Design

### Data model

`status` keeps its four values. It says what happened to the job:
`PRESENT` (they did it), `LATE` (they did it, after arriving late), `REPLACED`
(they were here, someone else did it), `ABSENT`. These stay mutually exclusive.
Late and replaced don't combine: if someone covered the whole group, the
latecomer was replaced; if cover lasted only until they arrived, they were late.

Three additive columns on `StaffActivity` record everything that can be true
alongside the status:

```prisma
model StaffActivity {
  // …existing fields
  leftEarly    Boolean  @default(false) @map("left_early")
  noShow       Boolean  @default(false) @map("no_show")
  replacedById String?  @map("replaced_by_id")
  replacedBy   Person?  @relation("StaffActivityReplacedBy", fields: [replacedById], references: [id], onDelete: SetNull)
}
```

`Person` gets the back-relation `replacedOthersIn StaffActivity[] @relation("StaffActivityReplacedBy")`.

| Column | Meaningful when | Cleared when |
|---|---|---|
| `leftEarly` | status is `PRESENT` or `LATE` | marked absent or replaced |
| `noShow` | status is `ABSENT` | the row is marked anything but absent, or a card is scanned into it |
| `replacedById` | status is `REPLACED` or `ABSENT` | marked present or late |

The service enforces these rules on every write, so an invalid combination
can't be stored. Each existing `status === ABSENT` check (sync clean-up, staffing
warnings, restarting a group, the person schedule) is still correct as written,
because `noShow` and `replacedById` only add detail to an absent row.

### API

All under `StageLeaderGuard`. Each one emits `newAttendance` for the affected
groups, like the existing endpoints.

- `PUT attendance/left-early/:id` `{ leftEarly: boolean }`. Rejects (409) a row
  that isn't `PRESENT` or `LATE`.
- `POST attendance/replaced/:id` `{ wasPresent: boolean, replacedById?: string }`.
  Sets the status to `REPLACED` (was present) or `ABSENT` (didn't come), and
  sets `replacedById`. If a replacement is given and has no `PRESENT` row in
  that group and role, it is added as present and unassigned, exactly like
  "Add unassigned person". `replacedById` equal to the row's own person is 400.
- `POST attendance/no-show` `{ personId: string, groupIds: string[], noShow: boolean }`.
  Sets `noShow` on that person's non-competitor rows in those groups that are
  `ABSENT`; other rows are left alone. The frontend works out which groups fall
  on the day (below), so the backend needs no schedule logic.
- Existing endpoints clear the columns per the table above. The card-scan
  upserts (`createAttendance`, `markJudgeAsPresent`) clear `noShow`.
- `GET attendance/group/:groupId` and `GET attendance/person/:id` include
  `replacedBy` (id and name).
- `GET attendance/missed` adds `leftEarlyAssignments` and its count, and
  `noShowAssignments` and its count.

### Which groups are "the day"

A no-show is set from a staff row in the attendance view ("Not coming today").
The frontend takes that person's staff activities (`attendance/person/:id`),
places each group on its venue day with the same `venueDay` helper the person
schedule uses, and sends every group on the same day as the clicked row that
hasn't ended yet. Groups already over keep their recorded attendance. The
clicked group is always included.

The same action is on the person page, next to each day of the schedule, for
the case where the lead hears about it before any of that day's groups.

Undo, from the toast or from the row's menu ("Coming after all"), sends the
same group ids with `noShow: false`.

### Attendance view

Absent staff rows. The menu reads, in order: Mark present (primary), Mark
late, Replaced…, Not coming today, Comment, Issue warning.

- **Replaced…** opens a dialog: "Who did the job instead?" with the person
  search used by "Add unassigned person" (optional), and two buttons: **They
  were here** (`wasPresent: true`) and **They didn't come** (`wasPresent:
  false`). This replaces today's "Present but replaced" item.
- An absent row with a replacement shows "Covered by Ann". A no-show row shows a
  "Not coming" badge and drops to the bottom of the Absent list, so the people
  still expected stay on top.

Present staff rows. Badges show every tag that applies: Late, Left early,
Replaced by Ann, Unassigned. A replacement's own row shows "Covering for Bob".
The menu gains **Left early** (toggle; "Didn't leave early" when set) and keeps
Comment, Issue warning, Mark absent.

Competitors. Every competitor row in a later round, absent or present, shows the
previous-round ranking. `RoleCard` computes it from the WCIF itself, so
`describeCompetitor` goes away.

Undo works as it does today: each action's toast puts the previous status and
columns back. Adding a replacement isn't undone: the replacement did the job.

### Elsewhere

- Person page schedule: the attendance badge reads "Not coming" for a no-show,
  and "Left early" and "Replaced by Ann" / "Covered by Ann" are added as extra
  badges.
- Most missed: two new filters, "Left early" and "Not coming". A no-show is
  still counted in "Missed" too, since the job wasn't done.

## Acceptance criteria

- [ ] A present or late judge can be marked left early, and shows both badges
      when late; marking them absent clears it.
- [ ] "Replaced…" → "They were here" with Ann picked stores `REPLACED` +
      `replacedById`, and adds Ann as present and unassigned in that role and
      group; doing it again doesn't add Ann twice.
- [ ] "Replaced…" → "They didn't come" keeps the row `ABSENT`, shows "Covered by
      Ann", and the row is still deleted by a WCIF sync that removes the
      assignment.
- [ ] "Not coming today" from a group's row sets `noShow` on that person's
      absent staff rows in every not-yet-ended group that day, and on no other
      day; present rows are untouched.
- [ ] Scanning a card or marking present on a no-show row clears `noShow` on
      that row only.
- [ ] Undo restores status, `leftEarly`, `replacedById` and `noShow` as they
      were.
- [ ] Present competitors in round 2+ show their round-1 ranking.
- [ ] Most missed shows the new filters and counts.
- [ ] Backend unit tests cover the column-clearing rules; the attendance e2e flow
      covers left early, replaced by and no-show.

## Rollout

The three columns are additive with defaults, so `prisma db push` at startup
applies them to a running instance without touching existing rows. Rows written
before this change read as `leftEarly = false`, `noShow = false`, no
replacement, which matches what they recorded.

Reverting the code and restarting makes `db push` drop the three columns,
losing only the tags recorded since. Nothing else depends on them.

## Open questions

- None open. The choice to keep `status` as is, rather than splitting it into a
  presence boolean plus flags, is deliberate: splitting needs a data migration
  that `db push` can't do safely on an instance in use, and late and replaced
  don't need to combine (see *Data model*).
