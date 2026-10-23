import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Room } from "@/lib/interfaces";

import NextGroupInAllRooms from "./NextGroupInAllRooms";

const rooms = [
    { id: "a", name: "Hall A", currentGroupIds: ["333-r1-g1"] },
    { id: "b", name: "Hall B", currentGroupIds: ["222-r1-g2"] },
] as Room[];

const nextGroups = { a: ["333-r1-g2"], b: [] };

const renderButton = (
    onSwitch = vi.fn(() => Promise.resolve<string | null>(null)),
    props: Partial<Parameters<typeof NextGroupInAllRooms>[0]> = {}
) => {
    render(
        <NextGroupInAllRooms
            rooms={rooms}
            nextGroups={nextGroups}
            onSwitch={onSwitch}
            {...props}
        />
    );
    return onSwitch;
};

describe("NextGroupInAllRooms", () => {
    it("lists each room's change and switches only rooms with a next group", async () => {
        const onSwitch = renderButton();
        await userEvent.click(
            screen.getByRole("button", { name: "Next group in all rooms" })
        );
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("Hall A")).toBeTruthy();
        expect(
            within(dialog).getByText(/nothing next, stays as is/)
        ).toBeTruthy();

        await userEvent.click(
            within(dialog).getByRole("button", { name: "Switch all rooms" })
        );
        expect(onSwitch).toHaveBeenCalledWith([
            { ...rooms[0], currentGroupIds: ["333-r1-g2"] },
            rooms[1],
        ]);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("keeps the dialog open with the error when switching fails", async () => {
        renderButton(vi.fn(() => Promise.resolve("Room is locked")));
        await userEvent.click(
            screen.getByRole("button", { name: "Next group in all rooms" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Switch all rooms" })
        );
        expect(
            within(screen.getByRole("dialog")).getByText("Room is locked")
        ).toBeTruthy();
    });

    it("hides with a single room or when no room has a next group", () => {
        const { rerender } = render(
            <NextGroupInAllRooms
                rooms={[rooms[0]]}
                nextGroups={nextGroups}
                onSwitch={vi.fn()}
            />
        );
        expect(screen.queryByRole("button")).toBeNull();
        rerender(
            <NextGroupInAllRooms
                rooms={rooms}
                nextGroups={{ a: [], b: [] }}
                onSwitch={vi.fn()}
            />
        );
        expect(screen.queryByRole("button")).toBeNull();
    });
});
