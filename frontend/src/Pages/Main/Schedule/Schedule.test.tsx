import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { getRoomActivities } from "@/lib/competition";
import { Activity, Competition } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import Schedule from "./Schedule";

vi.mock("@/lib/competition", () => {
    const mocks = {
        getRoomActivities: vi.fn(),
    };
    return {
        ...mocks,
        roomActivitiesQuery: (venueId: number, roomId: number, date: Date) => ({
            key: `activities-${venueId}-${roomId}-${date.toISOString()}`,
            fetch: () => mocks.getRoomActivities(venueId, roomId, date),
        }),
    };
});
vi.mock("@/lib/permissions", () => ({
    isDelegate: vi.fn(() => false),
    isStageLeaderOrOrganizerOrDelegate: vi.fn(() => false),
}));

const round = {
    id: 1,
    activityCode: "333-r1",
    name: "3x3x3 Cube, Round 1",
    startTime: "2026-04-18T08:00:00Z",
    endTime: "2026-04-18T09:00:00Z",
    childActivities: [
        { activityCode: "333-r1-g1" },
        { activityCode: "333-r1-g2" },
    ],
    realStartTime: "2026-04-18T08:05:00Z",
    realEndTime: "2026-04-18T09:10:00Z",
} as unknown as Activity;

const lunch = {
    id: 2,
    activityCode: "other-lunch",
    name: "Lunch",
    startTime: "2026-04-18T10:00:00Z",
    endTime: "2026-04-18T11:00:00Z",
    childActivities: [],
} as unknown as Activity;

const wcif = {
    events: [
        {
            id: "333",
            rounds: [
                {
                    id: "333-r1",
                    format: "a",
                    timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
                    cutoff: null,
                },
            ],
        },
    ],
    schedule: {
        startDate: "2026-04-18",
        numberOfDays: 2,
        venues: [
            {
                id: 1,
                name: "Sports hall",
                timezone: "Europe/Warsaw",
                rooms: [
                    { id: 1, name: "Main", activities: [] },
                    { id: 2, name: "Side", activities: [] },
                ],
            },
        ],
    },
};

const renderPage = (useFkmTimeDevices = true) => {
    const store = createStore();
    store.set(competitionAtom, {
        useFkmTimeDevices,
        wcif,
    } as unknown as Competition);
    renderWithQueryClient(
        <Provider store={store}>
            <MemoryRouter>
                <Schedule />
            </MemoryRouter>
        </Provider>
    );
};

beforeEach(() => clearQueryCache());

describe("Schedule", () => {
    beforeEach(() => {
        vi.mocked(getRoomActivities).mockReset();
        vi.mocked(getRoomActivities).mockResolvedValue([round, lunch]);
        vi.mocked(isDelegate).mockReturnValue(false);
    });

    it("lists the room's activities with scheduled and real times", async () => {
        renderPage();

        expect(
            (await screen.findAllByText("3x3x3 Cube · Round 1")).length
        ).toBeGreaterThan(0);
        expect(screen.getAllByText("Lunch").length).toBeGreaterThan(0);
        expect(screen.getByText("10:05–11:10")).toBeTruthy();
        expect(screen.getAllByText("10:00.00").length).toBeGreaterThan(0);
        expect(getRoomActivities).toHaveBeenCalledWith(
            1,
            1,
            new Date("2026-04-18T12:00:00Z")
        );
    });

    it("loads the chosen day and room", async () => {
        renderPage();
        await screen.findAllByText("Lunch");

        await userEvent.click(
            screen.getByRole("radio", { name: "Sun 19 Apr" })
        );
        await userEvent.click(screen.getByRole("radio", { name: "Side" }));

        expect(getRoomActivities).toHaveBeenLastCalledWith(
            1,
            2,
            new Date("2026-04-19T12:00:00Z")
        );
    });

    it("says when nothing is scheduled", async () => {
        vi.mocked(getRoomActivities).mockResolvedValue([]);
        renderPage();

        expect(
            await screen.findByText(
                "Nothing scheduled in this room on this day"
            )
        ).toBeTruthy();
    });

    it("says when the competition has no rooms", async () => {
        const store = createStore();
        store.set(competitionAtom, {
            wcif: {
                ...wcif,
                schedule: { ...wcif.schedule, venues: [] },
            },
        } as unknown as Competition);
        renderWithQueryClient(
            <Provider store={store}>
                <MemoryRouter>
                    <Schedule />
                </MemoryRouter>
            </Provider>
        );

        expect(
            screen.getByText("The competition has no schedule yet")
        ).toBeTruthy();
        expect(getRoomActivities).not.toHaveBeenCalled();
    });

    it("shows the error when the schedule can't be loaded", async () => {
        vi.mocked(getRoomActivities).mockRejectedValue(
            new Error("Could not load the schedule")
        );
        renderPage();

        expect((await screen.findByRole("alert")).textContent).toContain(
            "Could not load the schedule"
        );
    });

    it("links rounds to their results for delegates only", async () => {
        vi.mocked(isDelegate).mockReturnValue(true);
        renderPage();
        await screen.findAllByText("Lunch");

        const links = screen.getAllByRole("link", { name: "Results" });
        expect(links[0].getAttribute("href")).toBe("/results/round/333-r1");
        // One per layout (mobile list and desktop table), none for the break
        expect(links).toHaveLength(2);
        expect(
            within(screen.getByRole("list")).queryByRole("link", {
                name: "Attendance",
            })
        ).toBeNull();
    });
});
