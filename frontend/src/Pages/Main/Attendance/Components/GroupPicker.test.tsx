import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import GroupPicker from "./GroupPicker";

const group = (activityCode: string, startTime: string) => ({
    activityCode,
    startTime,
    childActivities: [],
});

// 3x3 group 1 and 2x2 run in Main Hall, 3x3 group 2 in Side Hall
const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }] },
        { id: "222", rounds: [{ id: "222-r1" }] },
    ],
    schedule: {
        venues: [
            {
                rooms: [
                    {
                        name: "Main Hall",
                        activities: [
                            {
                                activityCode: "333-r1",
                                startTime: "2026-05-01T09:00:00Z",
                                childActivities: [
                                    group("333-r1-g1", "2026-05-01T09:00:00Z"),
                                ],
                            },
                            {
                                activityCode: "222-r1",
                                startTime: "2026-05-01T10:00:00Z",
                                childActivities: [
                                    group("222-r1-g1", "2026-05-01T10:00:00Z"),
                                ],
                            },
                        ],
                    },
                    {
                        name: "Side Hall",
                        activities: [
                            {
                                activityCode: "333-r1",
                                startTime: "2026-05-01T09:00:00Z",
                                childActivities: [
                                    group("333-r1-g2", "2026-05-01T09:00:00Z"),
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

const options = () =>
    screen
        .getAllByRole("radio")
        .map((option) => option.getAttribute("aria-label") ?? "");
const groupOptions = () =>
    options().filter((label) => label.startsWith("Group"));
const roundOptions = () =>
    options().filter((label) => !label.startsWith("Group"));

describe("GroupPicker", () => {
    it("offers every group of the round by default", () => {
        render(
            <GroupPicker
                wcif={wcif}
                rooms={[]}
                value="333-r1-g1"
                onValueChange={vi.fn()}
            />
        );
        expect(groupOptions()).toEqual(["Group 1", "Group 2"]);
        expect(roundOptions()).toHaveLength(2);
    });

    it("offers a stage lead only their rooms' groups", () => {
        render(
            <GroupPicker
                wcif={wcif}
                rooms={[]}
                value="333-r1-g2"
                onValueChange={vi.fn()}
                hasGroup={(groupId) => groupId === "333-r1-g2"}
            />
        );
        expect(groupOptions()).toEqual(["Group 2"]);
        // 2x2 isn't offered: it runs only in Main Hall
        expect(roundOptions()).toHaveLength(1);
        // Nor stepped to
        expect(
            screen
                .getByRole("button", { name: "Next group" })
                .hasAttribute("disabled")
        ).toBe(true);
    });
});
