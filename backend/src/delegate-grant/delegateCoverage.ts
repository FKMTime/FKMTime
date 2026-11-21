import { Competition as Wcif } from 'wcif-helpers';

import { groupName } from './delegateGrantRules';

/** WCIF roles of the competition's delegates, trainees included */
const DELEGATE_ROLES = ['delegate', 'trainee-delegate'];

interface WcifActivity {
  id: number;
  activityCode: string;
  childActivities?: WcifActivity[];
}

/** A group nobody can take incidents in: every delegate competes in it */
export interface UncoveredGroup {
  groupId: string;
  /** "3x3x3 Cube, Round 1, Group 2" */
  groupName: string;
  /** A room runs it now; otherwise it is a room's next group */
  running: boolean;
  /** The rooms running it, or running it next */
  roomNames: string[];
  /** Names of the delegates competing in it: all of them */
  competingDelegates: string[];
}

/** Ids of the group's activities, one per room scheduling it */
const groupActivityIds = (wcif: Wcif, groupId: string) => {
  const ids = new Set<number>();
  const visit = (activity: WcifActivity) => {
    if (activity.activityCode === groupId) ids.add(activity.id);
    activity.childActivities?.forEach(visit);
  };
  wcif.schedule.venues.forEach((venue) =>
    venue.rooms.forEach((room) =>
      (room.activities as unknown as WcifActivity[]).forEach(visit),
    ),
  );
  return ids;
};

/**
 * The delegates competing in the group, when that is all of them (SPEC-015).
 * Null when at least one delegate doesn't compete in it, or the WCIF lists
 * no delegates at all.
 */
export const delegatesAllCompetingIn = (
  wcif: Wcif,
  groupId: string,
): string[] | null => {
  const delegates = (wcif.persons ?? []).filter((person) =>
    person.roles?.some((role) => DELEGATE_ROLES.includes(role)),
  );
  if (delegates.length === 0) return null;
  const activityIds = groupActivityIds(wcif, groupId);
  const competing = delegates.filter((person) =>
    person.assignments?.some(
      (assignment) =>
        assignment.assignmentCode === 'competitor' &&
        activityIds.has(assignment.activityId),
    ),
  );
  return competing.length === delegates.length
    ? competing.map((person) => person.name)
    : null;
};

/**
 * The running and next groups of the rooms that no delegate is free for,
 * leaving out those someone already has delegate access for (an open
 * grant, waiting or active). Running groups first.
 */
export const findUncoveredGroups = (
  wcif: Wcif,
  rooms: { name: string; currentGroupIds: string[]; nextGroupIds: string[] }[],
  coveredGroupIds: Set<string>,
): UncoveredGroup[] => {
  const groups = new Map<string, UncoveredGroup>();
  const add = (groupId: string, roomName: string, running: boolean) => {
    if (coveredGroupIds.has(groupId)) return;
    const existing = groups.get(groupId);
    if (existing) {
      existing.running ||= running;
      if (!existing.roomNames.includes(roomName)) {
        existing.roomNames.push(roomName);
      }
      return;
    }
    const competingDelegates = delegatesAllCompetingIn(wcif, groupId);
    if (!competingDelegates) return;
    groups.set(groupId, {
      groupId,
      groupName: groupName(groupId),
      running,
      roomNames: [roomName],
      competingDelegates,
    });
  };
  for (const room of rooms) {
    room.currentGroupIds.forEach((id) => add(id, room.name, true));
  }
  for (const room of rooms) {
    room.nextGroupIds
      .filter((id) => !room.currentGroupIds.includes(id))
      .forEach((id) => add(id, room.name, false));
  }
  return [...groups.values()].sort(
    (a, b) => Number(b.running) - Number(a.running),
  );
};
