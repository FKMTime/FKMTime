import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Event } from "wcif-helpers";

import { GroupOption } from "@/lib/currentGroups";

import AddGroupPicker from "./AddGroupPicker";

const events = [
    { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
    { id: "222", rounds: [{ id: "222-r1" }] },
] as unknown as Event[];

const option = (id: string): GroupOption => ({
    id,
    eventId: id.split("-")[0],
    label: id,
});
const groupOptions = [
    "333-r1-g2",
    "333-r1-g1",
    "333-r1-g1",
    "333-r2-g1",
    "222-r1-g1",
].map(option);

beforeEach(() => {
    localStorage.setItem(
        "fkmtime-events",
        JSON.stringify([
            { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            { id: "222", name: "2x2x2 Cube", shortName: "2x2" },
        ])
    );
});

const renderPicker = (currentGroupIds: string[]) => {
    const onAdd = vi.fn();
    render(
        <AddGroupPicker
            events={events}
            groupOptions={groupOptions}
            currentGroupIds={currentGroupIds}
            onAdd={onAdd}
        />
    );
    return onAdd;
};

describe("AddGroupPicker", () => {
    it("picks a round, then one of its groups in order", async () => {
        const onAdd = renderPicker([]);
        await userEvent.click(
            screen.getByRole("button", { name: "Add group" })
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "3x3x3 Cube · Round 1" })
        );
        expect(
            screen
                .getAllByRole("button", { name: /^Group/ })
                .map((b) => b.textContent)
        ).toEqual(["Group 1", "Group 2"]);
        await userEvent.click(screen.getByRole("button", { name: "Group 2" }));
        expect(onAdd).toHaveBeenCalledWith("333-r1-g2");

        // Opening it again starts from the rounds
        await userEvent.click(
            screen.getByRole("button", { name: "Add group" })
        );
        expect(
            await screen.findByRole("button", { name: "2x2x2 Cube · Round 1" })
        ).toBeTruthy();
    });

    it("blocks a second group of an event already in the room", async () => {
        renderPicker(["333-r1-g1"]);
        await userEvent.click(
            screen.getByRole("button", { name: "Add group" })
        );
        await userEvent.click(
            await screen.findByRole("button", {
                name: "3x3x3 Cube · Round 1, live",
            })
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Group 2",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            screen.getByText("A room runs one group of an event at a time.")
        ).toBeTruthy();

        await userEvent.click(
            screen.getByRole("button", { name: "Back to rounds" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "2x2x2 Cube · Round 1" })
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Group 1",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
    });
});
