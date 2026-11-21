import { Activity, Competition } from 'wcif-helpers';

import { Role } from '../generated/prisma/client';

/** A room as far as a stage lead's scope is concerned */
export interface ScopeRoom {
  id: string;
  name: string;
  currentGroupIds: string[];
  startedGroupIds: string[];
}

/**
 * Which groups' attendance a user may read and change (SPEC-016): every
 * group, or only the groups of some rooms.
 */
export interface AttendanceScope {
  allRooms: boolean;
  /** The stage lead's rooms; empty with all rooms */
  rooms: { id: string; name: string }[];
  /** Their rooms' groups; empty with all rooms */
  groupIds: Set<string>;
}

export const ALL_ROOMS: AttendanceScope = {
  allRooms: true,
  rooms: [],
  groupIds: new Set(),
};

const FULL_ACCESS_ROLES: Role[] = [Role.ADMIN, Role.ORGANIZER, Role.DELEGATE];

/** Admins, organizers and delegates take attendance anywhere */
export const hasFullAttendanceAccess = (roles: Role[]) =>
  roles.some((role) => FULL_ACCESS_ROLES.includes(role));

/** A stage lead whose rooms matter: no role above it */
export const isScopedStageLead = (roles: Role[]) =>
  roles.includes(Role.STAGE_LEADER) && !hasFullAttendanceAccess(roles);

const childCodes = (activity: Activity): string[] =>
  (activity.childActivities ?? []).flatMap((child) => [
    child.activityCode,
    ...childCodes(child),
  ]);

/**
 * A room's groups: those the WCIF schedule puts in it (matched by name, as
 * the import and sync do), plus any it started or is running, so a group
 * moved to another room on the day belongs to the room that ran it too.
 */
export const roomsGroupIds = (
  rooms: ScopeRoom[],
  wcif: Pick<Competition, 'schedule'> | null,
) => {
  const names = new Set(rooms.map((room) => room.name));
  const scheduled = (wcif?.schedule.venues ?? [])
    .flatMap((venue) => venue.rooms)
    .filter((room) => names.has(room.name))
    .flatMap((room) => room.activities.flatMap(childCodes));
  return new Set([
    ...scheduled,
    ...rooms.flatMap((room) => [
      ...room.startedGroupIds,
      ...room.currentGroupIds,
    ]),
  ]);
};

export const scopeIncludes = (scope: AttendanceScope, groupId: string) =>
  scope.allRooms || scope.groupIds.has(groupId);

const listNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** Why a stage lead can't touch a group: "You take attendance for Main Hall only" */
export const outOfScopeMessage = (rooms: { name: string }[]) =>
  `You take attendance for ${listNames(rooms.map((room) => room.name))} only`;
