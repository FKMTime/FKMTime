import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import {
    getNextGroupsFromScheduleForRoom,
    getPreviousGroupsFromScheduleForRoom,
} from "@/lib/competition";
import { Competition, Room } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";

import CurrentGroups from "./CurrentGroups";

vi.mock("@/lib/competition", () => ({
    competitionSettingsQuery: {
        key: "competition/settings",
        fetch: () => new Promise(() => {}),
    },
    getCompetitionInfo: vi.fn(),
    getNextGroupsFromScheduleForRoom: vi.fn(),
    getPreviousGroupsFromScheduleForRoom: vi.fn(),
}));
vi.mock("@/lib/rooms", () => ({
    roomsQuery: { key: "competition/rooms", fetch: vi.fn() },
    updateCurrentRound: vi.fn(),
}));

const room = (currentGroupIds: string[]) =>
    ({ id: "r1", name: "Main Hall", currentGroupIds }) as Room;

const renderPage = async () => {
    const store = createStore();
    store.set(competitionAtom, {
        wcif: { events: [], schedule: { venues: [] } },
    } as unknown as Competition);
    render(
        <Provider store={store}>
            <MemoryRouter>
                <CurrentGroups />
            </MemoryRouter>
        </Provider>
    );
    await screen.findByRole("region", { name: "Main Hall" });
};

describe("CurrentGroups", () => {
    beforeEach(() => {
        clearQueryCache();
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
        vi.mocked(getNextGroupsFromScheduleForRoom).mockResolvedValue([
            "333-r1-g1",
        ]);
    });

    it("offers the suggested group in an empty room", async () => {
        vi.mocked(roomsQuery.fetch).mockResolvedValue([room([])]);
        await renderPage();

        await userEvent.click(
            await screen.findByRole("button", {
                name: "Add 3x3x3 Cube · Round 1 · Group 1",
            })
        );

        expect(screen.getByText("1 group")).toBeTruthy();
        expect(screen.queryByText("No groups in progress")).toBeNull();
    });

    it("keeps the plain empty state when the schedule has nothing", async () => {
        vi.mocked(getNextGroupsFromScheduleForRoom).mockResolvedValue([]);
        vi.mocked(roomsQuery.fetch).mockResolvedValue([room([])]);
        await renderPage();

        expect(await screen.findByText("No groups in progress")).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: /^Add .+ · Group/ })
        ).toBeNull();
    });

    it("steps from the groups on screen, not the saved ones", async () => {
        vi.mocked(roomsQuery.fetch).mockResolvedValue([room(["333-r1-g1"])]);
        vi.mocked(getNextGroupsFromScheduleForRoom).mockResolvedValue([
            "333-r1-g3",
        ]);
        vi.mocked(getPreviousGroupsFromScheduleForRoom).mockResolvedValue([
            "333-r1-g1",
        ]);
        await renderPage();

        await userEvent.click(
            screen.getByRole("button", { name: "Next from schedule" })
        );
        await screen.findByText("3x3x3 Cube · Round 1 · Group 3");
        await userEvent.click(
            screen.getByRole("button", { name: "Previous from schedule" })
        );

        await screen.findByText("3x3x3 Cube · Round 1 · Group 1");
        expect(getPreviousGroupsFromScheduleForRoom).toHaveBeenLastCalledWith(
            "r1",
            ["333-r1-g3"]
        );
    });

    it("keeps the room as it is at the edge of the schedule", async () => {
        vi.mocked(roomsQuery.fetch).mockResolvedValue([room(["333-r1-g1"])]);
        vi.mocked(getPreviousGroupsFromScheduleForRoom).mockResolvedValue([]);
        await renderPage();

        await userEvent.click(
            screen.getByRole("button", { name: "Previous from schedule" })
        );

        expect(screen.getByText("3x3x3 Cube · Round 1 · Group 1")).toBeTruthy();
        expect(screen.queryByText("No groups in progress")).toBeNull();
    });
});
