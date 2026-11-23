import { isSameDay } from 'src/wcif-helpers';
import { Activity, Competition } from 'wcif-helpers';

export interface RoundSlot {
  activityCode: string;
  startTime: Date;
  endTime: Date;
}

/**
 * The scheduled activities of a day, one per activity code.
 *
 * A round run in several rooms has one activity per room; they are merged
 * into one slot spanning from the earliest start to the latest end, because
 * the round's attempts are not split by room.
 */
export const getRoundSlotsForDay = (
  wcif: Pick<Competition, 'schedule'>,
  day: Date,
): RoundSlot[] => {
  const slots = new Map<string, RoundSlot>();
  const activities: Activity[] = wcif.schedule.venues.flatMap((venue) =>
    venue.rooms.flatMap((room) => room.activities),
  );
  for (const activity of activities) {
    const startTime = new Date(activity.startTime);
    if (!isSameDay(startTime, day)) {
      continue;
    }
    const endTime = new Date(activity.endTime);
    const slot = slots.get(activity.activityCode);
    if (!slot) {
      slots.set(activity.activityCode, {
        activityCode: activity.activityCode,
        startTime,
        endTime,
      });
      continue;
    }
    if (startTime < slot.startTime) slot.startTime = startTime;
    if (endTime > slot.endTime) slot.endTime = endTime;
  }
  return [...slots.values()].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
};
