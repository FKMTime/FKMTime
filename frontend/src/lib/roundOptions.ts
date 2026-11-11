import { Competition as WCIF } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { getEventName } from "./events";
import { Room } from "./interfaces";
import { shortRoundName } from "./utils";

export interface RoundOption {
    id: string;
    eventId: string;
    eventName: string;
    /** "3x3 R1" */
    label: string;
    /** "3x3x3 Cube · Round 1" */
    name: string;
    /** Rooms where one of this round's groups is current */
    liveRooms: string[];
    isLive: boolean;
}

/** All rounds in schedule order, with the rooms currently running each one */
export const getRoundOptions = (wcif: WCIF, rooms: Room[]): RoundOption[] =>
    wcif.events.flatMap((event) =>
        event.rounds.map((round) => {
            const liveRooms = rooms
                .filter((room) =>
                    room.currentGroupIds.some((groupId) =>
                        groupId.startsWith(`${round.id}-g`)
                    )
                )
                .map((room) => room.name);
            return {
                id: round.id,
                eventId: event.id,
                eventName: getEventName(event.id) || event.id,
                label: shortRoundName(round.id),
                name: activityCodeToName(round.id).replace(", ", " · "),
                liveRooms,
                isLive: liveRooms.length > 0,
            };
        })
    );

/** The round strip shows the selected round plus every live round */
export const getStripRounds = (options: RoundOption[], selectedId?: string) =>
    options.filter((option) => option.isLive || option.id === selectedId);
