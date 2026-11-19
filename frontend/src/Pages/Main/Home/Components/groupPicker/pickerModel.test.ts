import { act, renderHook } from "@testing-library/react";
import { KeyboardEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import {
    getPickerEvents,
    getPickerGroups,
    getPickerRounds,
    handlePickerKeys,
    PickerRoom,
    usePickerSteps,
} from "./pickerModel";
import { usePickerContext } from "./usePickerContext";

const at = (hour: number) =>
    `2026-04-18T${String(hour).padStart(2, "0")}:00:00Z`;
const group = (activityCode: string, hour: number) => ({
    activityCode,
    startTime: at(hour),
    endTime: at(hour + 1),
    childActivities: [],
});
const round = (activityCode: string, groups: ReturnType<typeof group>[]) => ({
    activityCode,
    startTime: groups[0].startTime,
    endTime: groups[groups.length - 1].endTime,
    childActivities: groups,
});

// Group numbers run across rooms: the Main Hall has 333 groups 1 and 3,
// the Side Hall group 2. 6x6 runs only in the Side Hall.
const wcif = {
    events: [
        { id: "222", rounds: [{ id: "222-r1" }] },
        { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
        { id: "666", rounds: [{ id: "666-r1" }] },
    ],
    schedule: {
        venues: [
            {
                timezone: "UTC",
                rooms: [
                    {
                        name: "Main Hall",
                        activities: [
                            round("333-r1", [
                                group("333-r1-g3", 9),
                                group("333-r1-g1", 8),
                            ]),
                            round("222-r1", [group("222-r1-g1", 10)]),
                            round("333-r2", [group("333-r2-g1", 12)]),
                        ],
                    },
                    {
                        name: "Side Hall",
                        activities: [
                            round("333-r1", [group("333-r1-g2", 8)]),
                            round("222-r1", [group("222-r1-g2", 10)]),
                            round("666-r1", [group("666-r1-g1", 11)]),
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

const main: PickerRoom = {
    id: "main",
    name: "Main Hall",
    currentGroupIds: ["333-r1-g3"],
    startedGroupIds: ["333-r1-g1", "333-r1-g3"],
};
const side: PickerRoom = {
    id: "side",
    name: "Side Hall",
    currentGroupIds: ["333-r1-g2"],
    startedGroupIds: ["333-r1-g2"],
};
const rooms = [main, side];
const noProgress = () => undefined;

beforeEach(() => {
    localStorage.setItem(
        "fkmtime-events",
        JSON.stringify([
            { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            { id: "222", name: "2x2x2 Cube", shortName: "2x2" },
            { id: "666", name: "6x6x6 Cube", shortName: "6x6" },
        ])
    );
});

describe("getPickerEvents", () => {
    it("puts this room's events first, in the order the room runs them", () => {
        const { here, elsewhere } = getPickerEvents(wcif, "Main Hall");
        expect(here.map((e) => e.id)).toEqual(["333", "222"]);
        // Shown after an "Other rooms" divider
        expect(elsewhere.map((e) => e.id)).toEqual(["666"]);
        expect(here[0]).toMatchObject({ name: "3x3x3 Cube", shortName: "3x3" });
    });
});

describe("getPickerRounds", () => {
    it("says where a round runs, whether it's done, or when it starts", () => {
        expect(getPickerRounds(wcif, "333", rooms)).toEqual([
            {
                roundId: "333-r1",
                number: 1,
                state: {
                    kind: "running",
                    roomNames: ["Main Hall", "Side Hall"],
                },
            },
            {
                roundId: "333-r2",
                number: 2,
                state: { kind: "upcoming", startTime: at(12) },
            },
        ]);
        const allStarted = rooms.map((room) => ({
            ...room,
            currentGroupIds: [],
            startedGroupIds: ["222-r1-g1", "222-r1-g2"],
        }));
        expect(getPickerRounds(wcif, "222", allStarted)[0].state).toEqual({
            kind: "done",
        });
    });
});

describe("getPickerGroups", () => {
    it("sorts groups by number, saying which room each is in", () => {
        const groups = getPickerGroups(wcif, "333-r1", main, rooms, noProgress);
        expect(
            groups.map((g) => [g.number, g.isHere ? "here" : g.roomName])
        ).toEqual([
            [1, "here"],
            [2, "Side Hall"],
            [3, "here"],
        ]);
    });

    it("marks the group running in this room, and those running elsewhere", () => {
        const progress = {
            groupId: "333-r1-g2",
            roundId: "333-r1",
            competitors: 7,
            finished: 2,
            entered: 12,
            expected: 35,
            expectedIsFinal: true,
        };
        const groups = getPickerGroups(wcif, "333-r1", main, rooms, (roomId) =>
            roomId === "side" ? progress : undefined
        );
        expect(groups[2]).toMatchObject({ number: 3, isRunningHere: true });
        expect(groups[1]).toMatchObject({
            isRunningHere: false,
            runningElsewhere: ["Side Hall"],
            progress,
        });
        expect(groups[0]).toMatchObject({
            isStarted: true,
            progress: undefined,
        });
    });
});

describe("usePickerSteps", () => {
    const renderSteps = (room: PickerRoom = main) => {
        const onPick = vi.fn();
        const onCancel = vi.fn();
        const hook = renderHook(() =>
            usePickerSteps({
                wcif,
                room,
                rooms,
                getProgress: noProgress,
                onPick,
                onCancel,
            })
        );
        return { ...hook, onPick, onCancel };
    };

    it("goes event → round → group, and back one step at a time", () => {
        const { result, onPick, onCancel } = renderSteps();
        expect(result.current.step).toBe("event");

        act(() => result.current.pickEvent("333"));
        expect(result.current.step).toBe("round");
        act(() => result.current.pickRound("333-r1"));
        expect(result.current.step).toBe("group");
        act(() => result.current.pickGroup("333-r1-g1"));
        expect(onPick).toHaveBeenCalledWith("333-r1-g1");

        act(() => result.current.back());
        expect(result.current.step).toBe("round");
        act(() => result.current.back());
        expect(result.current.step).toBe("event");
        act(() => result.current.back());
        expect(onCancel).toHaveBeenCalled();
    });

    it("skips the round step when the event has one round", () => {
        const { result } = renderSteps();
        act(() => result.current.pickEvent("222"));
        expect(result.current.step).toBe("group");
        expect(result.current.roundId).toBe("222-r1");
        expect(result.current.isRoundSkipped).toBe(true);
        // Going back to the skipped step goes back to the events
        act(() => result.current.goTo("round"));
        expect(result.current.step).toBe("event");
    });

    it("picks the group at once when the round has only one", () => {
        const { result, onPick } = renderSteps();
        act(() => result.current.pickEvent("666"));
        expect(onPick).toHaveBeenCalledWith("666-r1-g1");
    });

    it("forgets the round when another event is picked", () => {
        const { result } = renderSteps();
        act(() => result.current.pickEvent("333"));
        act(() => result.current.pickRound("333-r2"));
        act(() => result.current.pickEvent("333"));
        expect(result.current.step).toBe("round");
        expect(result.current.roundId).toBeUndefined();
    });
});

describe("handlePickerKeys", () => {
    const key = (k: string) =>
        ({
            key: k,
            target: document.body,
            currentTarget: document.body,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }) as unknown as KeyboardEvent<HTMLElement>;

    it("goes back on Escape when the container asks for it", () => {
        const onEscape = vi.fn();
        handlePickerKeys(key("Escape"), { onEscape });
        expect(onEscape).toHaveBeenCalled();
    });

    it("leaves Escape to a dialog that closes on it", () => {
        const event = key("Escape");
        handlePickerKeys(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("usePickerContext", () => {
    it("suggests the room's next scheduled group it isn't running", () => {
        const { result } = renderHook(() =>
            usePickerContext({
                wcif,
                room: main,
                rooms,
                getProgress: noProgress,
                nextGroupIds: ["333-r1-g3", "222-r1-g1"],
                onPick: vi.fn(),
                onCancel: vi.fn(),
            })
        );
        expect(result.current.suggestion).toEqual({
            groupId: "222-r1-g1",
            startTime: at(10),
        });
    });
});
