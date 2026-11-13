import { Competition as WCIF } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { Room } from "./interfaces";

/** Rounds with a group in progress in any room, each listed once */
export const getLiveRoundIds = (rooms: Room[]): string[] => [
    ...new Set(
        rooms.flatMap((room) =>
            room.currentGroupIds.map((groupId) => groupId.split("-g")[0])
        )
    ),
];

export interface ScheduledRound {
    roundId: string;
    /** Earliest start of the round in any room; missing if unscheduled */
    startTime?: string;
}

/**
 * Every round in the order the schedule runs them: by the earliest start of
 * the round in any room. Rounds missing from the schedule come last, in event
 * order.
 */
export const getScheduledRounds = (wcif: WCIF): ScheduledRound[] => {
    const starts = new Map<string, string>();
    for (const venue of wcif.schedule?.venues ?? []) {
        for (const room of venue.rooms) {
            for (const activity of room.activities) {
                const known = starts.get(activity.activityCode);
                if (!known || new Date(activity.startTime) < new Date(known))
                    starts.set(activity.activityCode, activity.startTime);
            }
        }
    }
    const startOf = (round: ScheduledRound) =>
        round.startTime ? new Date(round.startTime).getTime() : Infinity;
    // Array sort is stable, so ties and unscheduled rounds keep event order
    return wcif.events
        .flatMap((event) =>
            event.rounds.map((round) => ({
                roundId: round.id,
                startTime: starts.get(round.id),
            }))
        )
        .sort((a, b) =>
            startOf(a) === startOf(b) ? 0 : startOf(a) - startOf(b)
        );
};

export const getRoundsInScheduleOrder = (wcif: WCIF): string[] =>
    getScheduledRounds(wcif).map((round) => round.roundId);

/** "3x3x3 Cube · Round 1" */
export const roundName = (roundId: string) =>
    activityCodeToName(roundId).replace(", ", " · ");
