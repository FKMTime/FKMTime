# SPEC-015: Warning when no delegate is free for a group

- **Status:** Implemented
- **Created:** 2026-11-21
- **Related:** #440, SPEC-013 (delegate access for one group)

## Problem

At small competitions every delegate often competes in the same group. While
they solve, nobody can take the incidents in that group: competitors wait at
the station until a delegate finishes. SPEC-013 lets a delegate give someone
delegate access for one group, but only if they think of it in time. Nothing
in the panel tells them that a group coming up has no delegate free.

## Goals

- Delegates see on Home which running and next groups have no delegate free,
  with a button that gives someone delegate access for that group.
- Delegates get a notification, on their phone too, when such a group becomes
  a room's next group, so they can give access before it starts.
- The warning goes away once someone has delegate access for the group.

## Non-goals

- Staff work. Judging, scrambling and running don't make a delegate busy:
  only competing does.
- Delegates competing in another group that runs at the same time in another
  room. Only the group itself counts.
- FKMTime's `DELEGATE` role. Who is a delegate comes from the WCIF; panel
  roles say who may use the panel, not who is at the competition.
- Push notifications to a closed panel. The notification uses the same
  browser notifications as a new incident does, so the panel has to be open
  (in a tab, or as the installed app on a phone).

## Design

### Who is free

A group has **no delegate free** when the WCIF lists at least one person with
the `delegate` or `trainee-delegate` role, and every one of them has a
`competitor` assignment to the group (to any of its activities, in any room).
A WCIF with no delegates never warns.

A group is **covered** when someone has delegate access for it (SPEC-013) that
hasn't ended, whether it's active or still waiting for the group.

The groups checked are each room's running groups, and its next groups: the
groups "Start next" would start (`getNextGroupsInRoom`, the same as
`GET /competition/rooms/:id/next-groups`).

### Backend

- `delegateCoverage.ts` holds the rule as pure functions:
  `delegatesAllCompetingIn(wcif, groupId)` and
  `findUncoveredGroups(wcif, rooms, coveredGroupIds)`.
- `GET /delegate-grant/uncovered-groups`, for delegates and admins, returns the
  running and next groups with no delegate free that aren't covered, running
  ones first:

  ```json
  [{
    "groupId": "333-r1-g2",
    "groupName": "3x3x3 Cube, Round 1, Group 2",
    "running": false,
    "roomNames": ["Main"],
    "competingDelegates": ["Invented One", "Invented Two"]
  }]
  ```

- After rooms change groups (`RoomsService.afterGroupsChanged`, by hand or
  automatically), the backend checks the same list and sends groups it hasn't
  announced before as `noFreeDelegate` `{ groups }` to the `delegate-grants`
  room, which every delegate's panel joins. Each group is announced once per
  backend run. The check isn't awaited, so it never slows a group change.

### Frontend

- Home shows a warning for delegates listing the groups, with "Give delegate
  access…" opening the SPEC-013 dialog for that group. With several rooms each
  group says whether it runs now or next, and where. The list refreshes when
  grants change, when this panel changes groups, and when a warning arrives.
- On `noFreeDelegate` the panel shows a browser notification per group (through
  the service worker on phones): "No delegate free for 3x3x3 Cube, Round 1,
  Group 2" / "All delegates compete in it: Invented One and Invented Two. Give
  someone delegate access before it starts." Clicking it opens Home.

### Edge cases

- **The room's first group of the day.** No group starts before it, so the
  notification comes when it starts; Home shows it as next already.
- **Access given, then ended early.** The group is listed again on Home. No
  second notification: the delegate ended it on purpose.
- **WCIF changes during the day** (a synced assignment). Home follows on its
  next refresh; the notification only on the next group change.
- **Backend restart.** Groups may be announced again once.

## Acceptance criteria

- [x] Starting a group whose next group every WCIF delegate competes in sends
      `noFreeDelegate` with that group to delegates, once.
- [x] `GET /delegate-grant/uncovered-groups` lists the group for a delegate and
      returns 403 for other users.
- [x] Giving someone delegate access for the group removes it from the list.
- [x] A delegate who judges the group, or doesn't compete in it, counts as free.
- [x] Home shows the warning with the competing delegates and a button that
      opens the delegate access dialog.

## Rollout

No schema change and no station, firmware or micro-connector change. To
revert, remove the Home warning and the call in `afterGroupsChanged`.
