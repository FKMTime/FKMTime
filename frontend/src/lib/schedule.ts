import { Activity, Competition as WCIF } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { shortRoundName } from "./utils";

export interface GroupSchedule {
    groupId: string;
    roundId: string;
    /** WCIF room the group is scheduled in */
    roomName: string;
    timezone: string;
    groupNumber: number;
    groupCount: number;
    startTime: string;
    endTime: string;
    /** End of the whole round in this room */
    roundEndTime: string;
}

/** Where and when a group is scheduled, or undefined if it is not */
export const findGroupSchedule = (
    wcif: WCIF,
    groupId: string,
    roomName?: string
): GroupSchedule | undefined => {
    const roundId = groupId.split("-g")[0];
    for (const venue of wcif.schedule.venues) {
        for (const room of venue.rooms) {
            if (roomName && room.name !== roomName) continue;
            for (const round of room.activities) {
                if (round.activityCode !== roundId) continue;
                const groups = round.childActivities ?? [];
                const index = groups.findIndex(
                    (group) => group.activityCode === groupId
                );
                if (index === -1) continue;
                return {
                    groupId,
                    roundId,
                    roomName: room.name,
                    timezone: venue.timezone,
                    groupNumber: Number(groupId.split("-g")[1]) || index + 1,
                    groupCount: groups.length,
                    startTime: groups[index].startTime,
                    endTime: groups[index].endTime,
                    roundEndTime: round.endTime,
                };
            }
        }
    }
    return undefined;
};

/**
 * Minutes behind (positive) or ahead of (negative) schedule. Behind once the
 * group runs past its scheduled end, ahead while it runs before its
 * scheduled start, otherwise 0.
 */
export const getScheduleOffsetMinutes = (
    startTime: string,
    endTime: string,
    now = new Date()
) => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const current = now.getTime();
    if (current > end) return Math.ceil((current - end) / 60_000);
    if (current < start) return -Math.ceil((start - current) / 60_000);
    return 0;
};

export interface NextActivity {
    name: string;
    startTime: string;
    endTime: string;
}

/** The first activity in the room that starts once the given round has ended */
export const getNextActivityInRoom = (
    wcif: WCIF,
    roomName: string,
    afterTime: string
): NextActivity | undefined => {
    const after = new Date(afterTime).getTime();
    const candidates: Activity[] = wcif.schedule.venues
        .flatMap((venue) => venue.rooms)
        .filter((room) => room.name === roomName)
        .flatMap((room) => room.activities)
        .filter((activity) => new Date(activity.startTime).getTime() >= after)
        .sort(
            (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
        );
    const next = candidates[0];
    if (!next) return undefined;
    return {
        name: next.activityCode.startsWith("other-")
            ? next.name
            : activityCodeToName(next.activityCode).replace(", ", " · "),
        startTime: next.startTime,
        endTime: next.endTime,
    };
};

/** "10:30–12:00" in the venue's timezone */
export const formatTimeRange = (
    startTime: string,
    endTime: string,
    timezone?: string
) => {
    const format = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
    });
    return `${format.format(new Date(startTime))}–${format.format(new Date(endTime))}`;
};

/** "+4 min", "−3 min" or "On time" */
export const formatScheduleOffset = (minutes: number) => {
    if (minutes > 0) return `+${minutes} min`;
    if (minutes < 0) return `−${Math.abs(minutes)} min`;
    return "On time";
};

/** "Start group 3", or the next round's name when the round changes */
export const getStartLabel = (currentGroupIds: string[], next: string[]) => {
    const nextGroupId = next[0];
    if (!nextGroupId) return null;
    const nextRoundId = nextGroupId.split("-g")[0];
    const groupNumber = nextGroupId.split("-g")[1];
    const isSameRound = currentGroupIds.some((id) =>
        id.startsWith(`${nextRoundId}-g`)
    );
    if (isSameRound) return `Start group ${groupNumber}`;
    return `Start ${shortRoundName(nextRoundId)} · Group ${groupNumber}`;
};
