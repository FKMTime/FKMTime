import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Room } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { PROGRESS_REFRESH_INTERVAL_MS } from "@/lib/rooms";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { socket } from "@/socket";
import { renderWithQueryClient } from "@/test/queryClient";

import Home from "./Home";

/** The backend's rooms and what the page sent it */
const backend = vi.hoisted(() => ({
    rooms: [] as { id: string; currentGroupIds: string[] }[],
    progress: [] as unknown[],
    nextGroups: {} as Record<string, string[]>,
    puts: [] as { path: string; body: unknown }[],
    progressReads: 0,
}));

/** Answers like the backend would; a PUT updates only the rooms sent */
const fakeRequest = vi.hoisted(
    () =>
        async (path: string, method = "GET", ...rest: unknown[]) => {
            // backendRequest(path, method, useAuth, body)
            const body = rest[1];
            const json = (data: unknown, status = 200) =>
                ({
                    ok: status < 400,
                    status,
                    json: async () => data,
                }) as unknown as Response;
            if (method === "PUT" && path === "competition/rooms") {
                backend.puts.push({ path, body });
                for (const sent of (body as { rooms: Room[] }).rooms) {
                    const saved = backend.rooms.find((r) => r.id === sent.id);
                    if (saved) saved.currentGroupIds = sent.currentGroupIds;
                }
                return json({});
            }
            if (path === "competition/rooms")
                return json(backend.rooms.map((r) => ({ ...r })));
            if (path === "competition/rooms/progress") {
                backend.progressReads++;
                return json(backend.progress);
            }
            const next = /^competition\/rooms\/(.+)\/next-groups/.exec(path);
            if (next) return json(backend.nextGroups[next[1]] ?? []);
            return json([]);
        }
);

vi.mock("@/lib/request", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    backendRequest: fakeRequest,
    backendQuery: (path: string) => ({
        key: path,
        fetch: async () => (await fakeRequest(path)).json(),
    }),
}));
vi.mock("@/socket", () => ({
    socket: { connected: true, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

const group = (activityCode: string, start: string, end: string) => ({
    activityCode,
    startTime: `2026-04-18T${start}:00Z`,
    endTime: `2026-04-18T${end}:00Z`,
    childActivities: [],
});

// Group numbers run across rooms: the Main Hall has 1, 3, the Side Hall 2, 4
const wcif = {
    events: [{ id: "333", rounds: [{ id: "333-r1" }] }],
    persons: [],
    schedule: {
        venues: [
            {
                timezone: "UTC",
                rooms: [
                    {
                        name: "Main Hall",
                        activities: [
                            {
                                ...group("333-r1", "09:00", "11:00"),
                                childActivities: [
                                    group("333-r1-g1", "09:00", "10:00"),
                                    group("333-r1-g3", "10:00", "11:00"),
                                ],
                            },
                        ],
                    },
                    {
                        name: "Side Hall",
                        activities: [
                            {
                                ...group("333-r1", "09:00", "11:00"),
                                childActivities: [
                                    group("333-r1-g2", "09:00", "10:00"),
                                    group("333-r1-g4", "10:00", "11:00"),
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

const renderHome = async () => {
    const store = createStore();
    store.set(competitionAtom, {
        id: "comp",
        wcif,
        useFkmTimeDevices: true,
        officialResultsDestination: "WCA_LIVE",
    } as unknown as Competition);
    renderWithQueryClient(
        <Provider store={store}>
            <ConfirmProvider>
                <MemoryRouter>
                    <Home />
                </MemoryRouter>
            </ConfirmProvider>
        </Provider>
    );
    await screen.findAllByRole("region", { name: "Main Hall" });
};

/** The desktop card; phones get a copy of the selected room above it */
const card = (name: string) => screen.getAllByRole("region", { name }).at(-1)!;

describe("Home", () => {
    beforeEach(() => {
        clearQueryCache();
        localStorage.setItem(
            "fkmtime-userInfo",
            JSON.stringify({ roles: ["DELEGATE"] })
        );
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
        backend.rooms = [
            { id: "main", currentGroupIds: ["333-r1-g1"] },
            { id: "side", currentGroupIds: ["333-r1-g2"] },
        ].map((r, i) => ({
            ...r,
            name: i === 0 ? "Main Hall" : "Side Hall",
            color: "#304a96",
        }));
        // Every result of the Main Hall's group is in, so it can move on
        backend.progress = [
            {
                roomId: "main",
                groups: [
                    {
                        groupId: "333-r1-g1",
                        roundId: "333-r1",
                        competitors: 7,
                        finished: 7,
                        entered: 35,
                        expected: 35,
                        expectedIsFinal: true,
                    },
                ],
            },
        ];
        backend.nextGroups = { main: ["333-r1-g3"], side: ["333-r1-g4"] };
        backend.puts = [];
        backend.progressReads = 0;
    });
    afterEach(() => vi.useRealTimers());

    it("starts the next group in one room without touching the others", async () => {
        await renderHome();
        const start = await within(card("Main Hall")).findByRole("button", {
            name: "Start group 3",
        });

        // The Side Hall moves on (an automatic change) after Home loaded it
        backend.rooms[1].currentGroupIds = ["333-r1-g4"];

        await userEvent.click(start);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Start group 3" })
        );

        await waitFor(() => expect(backend.puts).toHaveLength(1));
        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({
                    id: "main",
                    currentGroupIds: ["333-r1-g3"],
                }),
            ],
        });
        expect(backend.rooms.map((r) => r.currentGroupIds)).toEqual([
            ["333-r1-g3"],
            ["333-r1-g4"],
        ]);
    });

    it("refetches the rooms' progress at most once per interval while results come in", async () => {
        await renderHome();
        await waitFor(() => expect(backend.progressReads).toBe(1));
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const listeners = vi.mocked(socket.on).mock.calls as unknown as [
            string,
            () => void,
        ][];
        const resultEntered = listeners
            .filter(([event]) => event === "resultEntered")
            .at(-1)?.[1];
        if (!resultEntered) throw new Error("Home doesn't listen for results");

        // Ten stations enter an attempt at once
        act(() => {
            for (let i = 0; i < 10; i++) resultEntered();
        });
        // The first shows at once
        await waitFor(() => expect(backend.progressReads).toBe(2));

        act(() => {
            vi.advanceTimersByTime(PROGRESS_REFRESH_INTERVAL_MS - 100);
        });
        expect(backend.progressReads).toBe(2);

        // The rest of the burst, in one refetch at the end of the interval
        act(() => {
            vi.advanceTimersByTime(100);
        });
        await waitFor(() => expect(backend.progressReads).toBe(3));
        act(() => {
            vi.advanceTimersByTime(PROGRESS_REFRESH_INTERVAL_MS * 3);
        });
        expect(backend.progressReads).toBe(3);
    });
});
