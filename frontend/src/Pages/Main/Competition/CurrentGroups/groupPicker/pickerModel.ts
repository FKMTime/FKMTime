/**
 * Steps of picking a group to run in a room: event → round → group. Pure
 * functions over the WCIF and the rooms, plus a hook holding the step, so
 * every picker layout shares the same rules (ordering, skipping a step with
 * a single choice, going back).
 */
import { KeyboardEvent, useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { getEventName, getEventShortName } from "@/lib/events";
import { GroupProgress } from "@/lib/rooms";

export interface PickerRoom {
    id: string;
    name: string;
    currentGroupIds: string[];
    /** Every group the room has started; the backend sends it */
    startedGroupIds?: string[];
}

interface ScheduledGroup {
    groupId: string;
    roundId: string;
    eventId: string;
    roomName: string;
    startTime: string;
    endTime: string;
}

const time = (iso: string) => new Date(iso).getTime();

/** Every group in the schedule, with the room it is scheduled in */
const getScheduledGroups = (wcif: WCIF): ScheduledGroup[] =>
    wcif.schedule.venues.flatMap((venue) =>
        venue.rooms.flatMap((room) =>
            room.activities.flatMap((round) =>
                (round.childActivities ?? []).map((group) => ({
                    groupId: group.activityCode,
                    roundId: round.activityCode,
                    eventId: round.activityCode.split("-")[0],
                    roomName: room.name,
                    startTime: group.startTime,
                    endTime: group.endTime,
                }))
            )
        )
    );

export interface PickerEvent {
    id: string;
    name: string;
    shortName: string;
    /** Whether the event has any group scheduled in this room */
    isHere: boolean;
}

/**
 * The competition's events, those scheduled in this room first in the order
 * the room first runs them, then the rest in the competition's order.
 */
export const getPickerEvents = (wcif: WCIF, roomName: string) => {
    const firstHere = new Map<string, number>();
    for (const group of getScheduledGroups(wcif)) {
        if (group.roomName !== roomName) continue;
        const start = time(group.startTime);
        const known = firstHere.get(group.eventId);
        if (known === undefined || start < known)
            firstHere.set(group.eventId, start);
    }
    const events: PickerEvent[] = wcif.events.map((event) => ({
        id: event.id,
        name: getEventName(event.id) ?? event.id,
        shortName: getEventShortName(event.id) ?? event.id,
        isHere: firstHere.has(event.id),
    }));
    const here = events
        .filter((event) => event.isHere)
        .sort((a, b) => firstHere.get(a.id)! - firstHere.get(b.id)!);
    return { here, elsewhere: events.filter((event) => !event.isHere) };
};

export const filterEvents = (events: PickerEvent[], search: string) => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter(
        (event) =>
            event.name.toLowerCase().includes(query) ||
            event.shortName.toLowerCase().includes(query) ||
            event.id.toLowerCase().includes(query)
    );
};

export type RoundState =
    | { kind: "running"; roomNames: string[] }
    | { kind: "done" }
    | { kind: "upcoming"; startTime?: string };

export interface PickerRound {
    roundId: string;
    number: number;
    state: RoundState;
}

/**
 * The event's rounds and where each stands: running in some room, done
 * once every one of its groups has been started and none runs, otherwise
 * upcoming at its first group's start.
 */
export const getPickerRounds = (
    wcif: WCIF,
    eventId: string,
    rooms: PickerRoom[]
): PickerRound[] => {
    const scheduled = getScheduledGroups(wcif);
    const started = new Set(
        rooms.flatMap((room) => room.startedGroupIds ?? [])
    );
    const event = wcif.events.find((e) => e.id === eventId);
    return (event?.rounds ?? []).map((round) => {
        const groups = scheduled.filter((g) => g.roundId === round.id);
        const runningIn = rooms
            .filter((room) =>
                room.currentGroupIds.some((id) =>
                    id.startsWith(`${round.id}-g`)
                )
            )
            .map((room) => room.name);
        const number = Number(round.id.split("-r")[1]);
        if (runningIn.length > 0)
            return {
                roundId: round.id,
                number,
                state: { kind: "running", roomNames: runningIn },
            };
        if (groups.length > 0 && groups.every((g) => started.has(g.groupId)))
            return { roundId: round.id, number, state: { kind: "done" } };
        const first = [...groups].sort(
            (a, b) => time(a.startTime) - time(b.startTime)
        )[0];
        return {
            roundId: round.id,
            number,
            state: { kind: "upcoming", startTime: first?.startTime },
        };
    });
};

export interface PickerGroup {
    groupId: string;
    number: number;
    startTime: string;
    endTime: string;
    roomName: string;
    isHere: boolean;
    /** Already running in the room picking; can't be picked again */
    isRunningHere: boolean;
    /** Other rooms running it now */
    runningElsewhere: string[];
    isStarted: boolean;
    progress?: GroupProgress;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

/** The round's groups by number: 1, 2, 3 …, whichever room runs them */
export const getPickerGroups = (
    wcif: WCIF,
    roundId: string,
    room: PickerRoom,
    rooms: PickerRoom[],
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined
): PickerGroup[] => {
    const started = new Set(rooms.flatMap((r) => r.startedGroupIds ?? []));
    return getScheduledGroups(wcif)
        .filter((group) => group.roundId === roundId)
        .sort(
            (a, b) =>
                groupNumber(a.groupId) - groupNumber(b.groupId) ||
                Number(b.roomName === room.name) -
                    Number(a.roomName === room.name)
        )
        .map((group) => {
            const runningIn = rooms.filter((r) =>
                r.currentGroupIds.includes(group.groupId)
            );
            return {
                groupId: group.groupId,
                number: groupNumber(group.groupId),
                startTime: group.startTime,
                endTime: group.endTime,
                roomName: group.roomName,
                isHere: group.roomName === room.name,
                isRunningHere: room.currentGroupIds.includes(group.groupId),
                runningElsewhere: runningIn
                    .filter((r) => r.id !== room.id)
                    .map((r) => r.name),
                isStarted: started.has(group.groupId),
                progress: runningIn
                    .map((r) => getProgress(r.id, group.groupId))
                    .find((p) => p && p.entered > 0),
            };
        });
};

export type PickerStep = "event" | "round" | "group";

export interface UsePickerStepsOptions {
    wcif: WCIF;
    room: PickerRoom;
    rooms: PickerRoom[];
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined;
    onPick: (groupId: string) => void;
    onCancel: () => void;
}

/**
 * The step a picker is on. A step with a single choice is skipped: an event
 * with one round goes straight to its groups, and a round with one group
 * is picked at once. Back undoes the last step the user took.
 */
export const usePickerSteps = ({
    wcif,
    room,
    rooms,
    getProgress,
    onPick,
    onCancel,
}: UsePickerStepsOptions) => {
    const [eventId, setEventId] = useState<string>();
    const [roundId, setRoundId] = useState<string>();
    const [search, setSearch] = useState("");

    const rounds = eventId ? getPickerRounds(wcif, eventId, rooms) : [];
    const isRoundSkipped = rounds.length === 1;
    const groups = roundId
        ? getPickerGroups(wcif, roundId, room, rooms, getProgress)
        : [];
    const step: PickerStep = !eventId ? "event" : !roundId ? "round" : "group";

    const pickGroup = (groupId: string) => onPick(groupId);

    const pickRound = (id: string) => {
        const roundGroups = getPickerGroups(wcif, id, room, rooms, getProgress);
        const pickable = roundGroups.filter((g) => !g.isRunningHere);
        setRoundId(id);
        if (roundGroups.length === 1 && pickable.length === 1)
            pickGroup(pickable[0].groupId);
    };

    const pickEvent = (id: string) => {
        setEventId(id);
        setRoundId(undefined);
        const eventRounds = getPickerRounds(wcif, id, rooms);
        if (eventRounds.length === 1) pickRound(eventRounds[0].roundId);
    };

    /** Goes back to a step, forgetting the choices after it */
    const goTo = (target: PickerStep) => {
        if (target === "event") {
            setEventId(undefined);
            setRoundId(undefined);
        } else if (target === "round") {
            if (isRoundSkipped) {
                setEventId(undefined);
                setRoundId(undefined);
            } else setRoundId(undefined);
        }
    };

    const back = () => {
        if (step === "group") goTo("round");
        else if (step === "round") goTo("event");
        else onCancel();
    };

    return {
        step,
        eventId,
        roundId,
        rounds,
        groups,
        isRoundSkipped,
        search,
        setSearch,
        pickEvent,
        pickRound,
        pickGroup,
        goTo,
        back,
    };
};

export type PickerSteps = ReturnType<typeof usePickerSteps>;

const CHIPS = "button[data-picker-chip]:not(:disabled)";

const chipsIn = (scope: Element | null) =>
    scope ? [...scope.querySelectorAll<HTMLButtonElement>(CHIPS)] : [];

/**
 * Keyboard for a picker: arrow keys move focus between chips, Enter or
 * Space picks (as buttons do). With `columns`, Up/Down move within a column
 * ([data-picker-column]) and Left/Right jump to the next column's chosen
 * chip, or its first. Escape calls `onEscape` unless the container (a
 * dialog) handles it itself.
 */
export const handlePickerKeys = (
    event: KeyboardEvent<HTMLElement>,
    {
        onEscape,
        columns = false,
    }: { onEscape?: () => void; columns?: boolean } = {}
) => {
    if (event.key === "Escape") {
        if (!onEscape) return;
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
    }
    const target = event.target as HTMLElement;
    // In the search box only ArrowDown leaves for the chips
    if (target.tagName === "INPUT" && event.key !== "ArrowDown") return;
    const isAcross = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
        event.key as "ArrowRight"
    ];
    if (!step) return;

    if (columns && isAcross) {
        const all = [
            ...event.currentTarget.querySelectorAll("[data-picker-column]"),
        ];
        const column = target.closest("[data-picker-column]");
        const next = all[all.indexOf(column as Element) + step];
        const chips = chipsIn(next ?? null);
        const chosen =
            chips.find(
                (chip) => chip.getAttribute("aria-pressed") === "true"
            ) ?? chips[0];
        if (!chosen) return;
        event.preventDefault();
        chosen.focus();
        return;
    }

    const scope = columns
        ? target.closest("[data-picker-column]")
        : target.closest("[data-picker-grid]") ?? event.currentTarget;
    const chips = chipsIn(scope);
    if (chips.length === 0) return;
    const index = chips.indexOf(target as HTMLButtonElement);
    const next =
        index === -1
            ? chips[step > 0 ? 0 : chips.length - 1]
            : chips[(index + step + chips.length) % chips.length];
    event.preventDefault();
    next.focus();
};
