import { Activity, Competition as WCIF } from 'wcif-helpers';

/**
 * The group a station in tutorial mode gives at the card scan, and sends
 * back with the solve. Every attempt with it is a tutorial solve and is never
 * saved, whatever the station's mode is when it arrives (SPEC-012)
 */
export const TUTORIAL_GROUP_ID = 'tutorial';

/** Tutorial mode ends this long after it was last used */
export const TUTORIAL_QUIET_MS = 15 * 60_000;

/** What delegates are told when a room's groups change (SPEC-012) */
export interface TutorialNotice {
  kind: 'stillOn' | 'endedByGroupStart';
  espId: number | null;
  deviceName: string;
}

export const tutorialEndsAtFrom = (now: number) =>
  new Date(now + TUTORIAL_QUIET_MS);

export const isInTutorial = (
  device: { tutorialEndsAt: Date | null } | null | undefined,
  now = Date.now(),
) => !!device?.tutorialEndsAt && device.tutorialEndsAt.getTime() > now;

/** "2026-11-17" for the moment in the given timezone */
const localDate = (time: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time));

const scheduledGroupStarts = (wcif: WCIF, groupId: string) =>
  wcif.schedule.venues.flatMap((venue) =>
    venue.rooms.flatMap((room) =>
      room.activities
        .flatMap((activity: Activity) => activity.childActivities ?? [])
        .filter((group: Activity) => group.activityCode === groupId)
        .map((group: Activity) => ({
          startTime: group.startTime,
          timezone: venue.timezone,
        })),
    ),
  );

/**
 * Whether a room that had started these groups before has started none
 * scheduled on today's date at the venue, so a group starting now is its
 * first of the day
 */
export const isFirstGroupOfDay = (
  wcif: WCIF,
  startedBefore: string[],
  now = Date.now(),
) =>
  !startedBefore.some((groupId) =>
    scheduledGroupStarts(wcif, groupId).some(
      ({ startTime, timezone }) =>
        localDate(new Date(startTime).getTime(), timezone) ===
        localDate(now, timezone),
    ),
  );
