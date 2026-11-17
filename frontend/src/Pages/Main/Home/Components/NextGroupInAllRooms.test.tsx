import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Room } from "@/lib/interfaces";

import NextGroupInAllRooms from "./NextGroupInAllRooms";

const rooms = [
    { id: "a", name: "Hall A", currentGroupIds: ["333-r1-g1"] },
    { id: "b", name: "Hall B", currentGroupIds: ["222-r1-g2"] },
    { id: "c", name: "Hall C", currentGroupIds: ["444-r1-g1"] },
] as Room[];

const nextGroups = { a: ["333-r1-g2"], b: ["222-r1-g3"], c: ["444-r1-g2"] };

const renderNotice = ({
    ready = ["a", "b", "c"],
    next = nextGroups as Record<string, string[]>,
    onSwitch = vi.fn(() => Promise.resolve<string | null>(null)),
} = {}) => {
    render(
        <NextGroupInAllRooms
            rooms={rooms}
            nextGroups={next}
            isReady={(room) => ready.includes(room.id)}
            onSwitch={onSwitch}
        />
    );
    return onSwitch;
};

describe("NextGroupInAllRooms", () => {
    it("moves every room once all of them are ready", async () => {
        const onSwitch = renderNotice();
        expect(
            screen.getByText("Hall A, Hall B and Hall C").parentElement
                ?.textContent
        ).toBe("Hall A, Hall B and Hall C are ready for their next group.");
        await userEvent.click(
            screen.getByRole("button", { name: "Next group in all rooms" })
        );
        await userEvent.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Start next groups",
            })
        );
        expect(onSwitch).toHaveBeenCalledWith(
            rooms.map((room) => ({
                ...room,
                currentGroupIds: nextGroups[room.id as "a" | "b" | "c"],
            }))
        );
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("moves only the ready rooms, leaving one still running alone", async () => {
        const onSwitch = renderNotice({ ready: ["a", "b"] });
        await userEvent.click(
            screen.getByRole("button", { name: "Next group in 2 rooms" })
        );
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).queryByText("Hall C")).toBeNull();
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Start next groups" })
        );
        // A room not saved keeps any groups it got meanwhile
        expect(onSwitch).toHaveBeenCalledWith([
            { ...rooms[0], currentGroupIds: ["333-r1-g2"] },
            { ...rooms[1], currentGroupIds: ["222-r1-g3"] },
        ]);
    });

    it("keeps the dialog open with the error when switching fails", async () => {
        renderNotice({
            onSwitch: vi.fn(() => Promise.resolve("Room is locked")),
        });
        await userEvent.click(
            screen.getByRole("button", { name: "Next group in all rooms" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Start next groups" })
        );
        expect(
            within(screen.getByRole("dialog")).getByText("Room is locked")
        ).toBeTruthy();
    });

    it("stays hidden until two rooms are ready with something next", () => {
        renderNotice({ ready: ["a"] });
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("doesn't count a ready room with nothing next", () => {
        renderNotice({ ready: ["a", "b"], next: { a: ["333-r1-g2"], b: [] } });
        expect(screen.queryByRole("button")).toBeNull();
    });
});
