import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UncoveredGroup } from "@/lib/delegateGrants";
import { QueryWrapper } from "@/test/queryClient";

import NoFreeDelegateAlert from "./NoFreeDelegateAlert";

vi.mock("@/lib/user", () => ({
    usersQuery: { key: "user", fetch: () => Promise.resolve([]) },
}));

const group = (fields: Partial<UncoveredGroup> = {}): UncoveredGroup => ({
    groupId: "333-r1-g2",
    groupName: "3x3x3 Cube, Round 1, Group 2",
    running: false,
    roomNames: ["Main"],
    competingDelegates: ["Invented One", "Invented Two"],
    ...fields,
});

const renderAlert = (groups: UncoveredGroup[], showRooms = false) =>
    render(<NoFreeDelegateAlert groups={groups} showRooms={showRooms} />, {
        wrapper: QueryWrapper,
    });

describe("NoFreeDelegateAlert", () => {
    it("says nothing when every group has a delegate free", () => {
        const { container } = renderAlert([]);
        expect(container.textContent).toBe("");
    });

    it("names the competing delegates and asks for access before the group starts", () => {
        renderAlert([group()]);
        expect(
            screen.getByText(
                "No delegate free for 3x3x3 Cube, Round 1, Group 2"
            )
        ).toBeTruthy();
        expect(
            screen.getByText(
                "All delegates compete in it: Invented One and Invented Two. Give someone delegate access before it starts."
            )
        ).toBeTruthy();
    });

    it("says where each group runs when there are several rooms", () => {
        renderAlert(
            [
                group({
                    running: true,
                    competingDelegates: ["Invented One"],
                }),
                group({ groupId: "222-r1-g1", roomNames: ["Side"] }),
            ],
            true
        );
        expect(screen.getByText("No delegate free for 2 groups")).toBeTruthy();
        expect(
            screen.getByText(
                "Running in Main. The only delegate, Invented One, competes in it. Give someone delegate access so incidents don't wait."
            )
        ).toBeTruthy();
        expect(screen.getByText(/^Next in Side\./)).toBeTruthy();
    });

    it("opens the dialog for the group", () => {
        renderAlert([group()]);
        fireEvent.click(
            screen.getByRole("button", { name: "Give delegate access…" })
        );
        expect(
            screen.getByRole("dialog", { name: "Give delegate access" })
        ).toBeTruthy();
    });
});
