import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Room } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { GroupProgress } from "@/lib/rooms";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { renderWithQueryClient } from "@/test/queryClient";

import CurrentGroups from "./CurrentGroups";

/** What the fake backend answers, and what the page sent it */
const backend = vi.hoisted(() => ({
    rooms: [] as unknown[],
    progress: [] as unknown[],
    nextGroups: {} as Record<string, string[]>,
    autoChange: false,
    puts: [] as { path: string; body: unknown }[],
}));

/** Answers like the backend would, from `backend` */
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
            if (method === "PUT") {
                backend.puts.push({ path, body });
                return json({});
            }
            if (path === "competition/rooms") return json(backend.rooms);
            if (path === "competition/rooms/progress")
                return json(backend.progress);
            if (path === "competition/settings")
                return json({
                    shouldChangeGroupsAutomatically: backend.autoChange,
                });
            const next = /^competition\/rooms\/(.+)\/next-groups/.exec(path);
            if (next) return json(backend.nextGroups[next[1]] ?? []);
            return json({}, 404);
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

const MINUTE = 60_000;
/** Times relative to now, so the schedule status is predictable */
const at = (minutes: number) =>
    new Date(Date.now() + minutes * MINUTE).toISOString();

const group = (activityCode: string, start: number, end: number) => ({
    activityCode,
    startTime: at(start),
    endTime: at(end),
    childActivities: [],
});

// Group numbers run across rooms: the Main Hall has 1, 3, 5, the Side Hall 2, 4
const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }] },
        { id: "222", rounds: [{ id: "222-r1" }] },
    ],
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
                                ...group("333-r1", -70.5, 19.5),
                                childActivities: [
                                    group("333-r1-g1", -70.5, -40.5),
                                    group("333-r1-g3", -40.5, -10.5),
                                    group("333-r1-g5", -10.5, 19.5),
                                ],
                            },
                            {
                                ...group("222-r1", 120, 150),
                                childActivities: [group("222-r1-g1", 120, 150)],
                            },
                        ],
                    },
                    {
                        name: "Side Hall",
                        activities: [
                            {
                                ...group("333-r1", 40.5, 100.5),
                                childActivities: [
                                    group("333-r1-g2", 40.5, 70.5),
                                    group("333-r1-g4", 70.5, 100.5),
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

const room = (id: string, name: string, currentGroupIds: string[]) =>
    ({ id, name, color: "#304a96", currentGroupIds }) as Room;

const progress = (groupId: string, entered: number): GroupProgress => ({
    groupId,
    roundId: groupId.split("-g")[0],
    competitors: 7,
    entered,
    expected: 35,
});

const renderPage = async () => {
    const store = createStore();
    store.set(competitionAtom, {
        id: "comp",
        wcif,
    } as unknown as Competition);
    renderWithQueryClient(
        <Provider store={store}>
            <ConfirmProvider>
                <MemoryRouter>
                    <CurrentGroups />
                </MemoryRouter>
            </ConfirmProvider>
        </Provider>
    );
    await screen.findAllByRole("region");
};

const row = (name: string) => screen.getByRole("region", { name });

const confirmDialog = async (label: string) => {
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: label }));
};

const openMenuItem = async (roomName: string, item: string) => {
    await userEvent.click(
        within(row(roomName)).getByRole("button", {
            name: `More for ${roomName}`,
        })
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
};

const pickGroup = async (
    roomName: string,
    round: string,
    groupName: string
) => {
    await openMenuItem(roomName, "Change group…");
    const picker = await screen.findByRole("group", {
        name: `Change group in ${roomName}`,
    });
    await userEvent.click(within(picker).getByRole("button", { name: round }));
    await userEvent.click(
        within(picker).getByRole("button", { name: groupName })
    );
    return picker;
};

describe("CurrentGroups", () => {
    beforeEach(() => {
        clearQueryCache();
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
                { id: "222", name: "2x2x2 Cube", shortName: "2x2" },
            ])
        );
        backend.rooms = [
            room("main", "Main Hall", ["333-r1-g3"]),
            room("side", "Side Hall", ["333-r1-g2"]),
        ];
        backend.progress = [
            { roomId: "main", groups: [progress("333-r1-g3", 20)] },
            { roomId: "side", groups: [progress("333-r1-g2", 5)] },
        ];
        backend.nextGroups = { main: ["333-r1-g5"], side: ["333-r1-g4"] };
        backend.autoChange = false;
        backend.puts = [];
    });

    it("numbers each room's groups by their place in that room", async () => {
        await renderPage();
        expect(
            within(row("Main Hall")).getByText("Group 3 · 2 of 3 here")
        ).toBeTruthy();
        expect(
            within(row("Side Hall")).getByText(/Group 2 · 1 of 2 here/)
        ).toBeTruthy();
    });

    it("shows how far behind or ahead each room is, never 'Starts' while it runs", async () => {
        await renderPage();
        expect(
            within(row("Main Hall")).getByText("11 min behind")
        ).toBeTruthy();
        // The Side Hall started its group 41 minutes before its slot
        expect(within(row("Side Hall")).getByText("41 min ahead")).toBeTruthy();
        expect(within(row("Side Hall")).queryByText(/^Starts/)).toBeNull();
    });

    it("says when an empty room starts its next group", async () => {
        backend.rooms = [room("main", "Main Hall", [])];
        backend.nextGroups = { main: ["222-r1-g1"] };
        await renderPage();
        const start = new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
        }).format(new Date(at(120)));
        expect(
            await within(row("Main Hall")).findByText(`Starts ${start}`)
        ).toBeTruthy();
    });

    it("keeps starting the next group secondary while results come in", async () => {
        await renderPage();
        const start = await within(row("Main Hall")).findByRole("button", {
            name: "Start group 5",
        });
        expect(start.classList.contains("bg-primary")).toBe(false);
    });

    it("makes starting the next group the main action once all results are in", async () => {
        backend.progress = [
            { roomId: "main", groups: [progress("333-r1-g3", 35)] },
        ];
        await renderPage();
        const start = await within(row("Main Hall")).findByRole("button", {
            name: "Start group 5",
        });
        await vi.waitFor(() =>
            expect(start.classList.contains("bg-primary")).toBe(true)
        );
        expect(
            screen.getByText("All in · ready for the next group")
        ).toBeTruthy();
    });

    it("tells the room moves on by itself when automatic change is on", async () => {
        backend.autoChange = true;
        backend.progress = [
            { roomId: "main", groups: [progress("333-r1-g3", 35)] },
        ];
        await renderPage();
        expect(
            await screen.findByText("All in · moving on by itself")
        ).toBeTruthy();
        expect(screen.getByText("Automatic group change on")).toBeTruthy();
    });

    it("starts the next group after confirming, saving only that room", async () => {
        await renderPage();
        await userEvent.click(
            await within(row("Main Hall")).findByRole("button", {
                name: "Start group 5",
            })
        );
        await confirmDialog("Start group 5");

        expect(backend.puts).toEqual([
            {
                path: "competition/rooms",
                body: {
                    rooms: [
                        expect.objectContaining({
                            id: "main",
                            currentGroupIds: ["333-r1-g5"],
                        }),
                    ],
                },
            },
        ]);
    });

    it("switches the room to a picked group", async () => {
        await renderPage();
        await pickGroup("Main Hall", "2x2x2 Cube · Round 1", "Group 1");
        expect(
            screen.getByText(
                "Stations in this room will accept results for both groups."
            )
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Switch to 2x2 R1 G1" })
        );

        expect(backend.puts).toHaveLength(1);
        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({
                    id: "main",
                    currentGroupIds: ["222-r1-g1"],
                }),
            ],
        });
    });

    it("runs a picked group next to the one already running", async () => {
        await renderPage();
        await pickGroup("Main Hall", "2x2x2 Cube · Round 1", "Group 1");
        await userEvent.click(screen.getByRole("button", { name: "Run both" }));

        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({
                    id: "main",
                    currentGroupIds: ["333-r1-g3", "222-r1-g1"],
                }),
            ],
        });
    });

    it("can only switch to another group of an event already running", async () => {
        await renderPage();
        await pickGroup("Main Hall", "3x3x3 Cube · Round 1, live", "Group 5");
        expect(
            (
                screen.getByRole("button", {
                    name: "Run both",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            screen.getByText(/A room runs one group of an event at a time/)
        ).toBeTruthy();
    });

    it("starts a picked group in an empty room after confirming", async () => {
        backend.rooms = [room("main", "Main Hall", [])];
        await renderPage();
        await pickGroup("Main Hall", "2x2x2 Cube · Round 1", "Group 1");
        expect(screen.queryByRole("button", { name: "Run both" })).toBeNull();
        await confirmDialog("Start 2x2 R1 G1");

        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({
                    id: "main",
                    currentGroupIds: ["222-r1-g1"],
                }),
            ],
        });
    });

    it("stops one group of a room running several", async () => {
        backend.rooms = [room("main", "Main Hall", ["333-r1-g3", "222-r1-g1"])];
        await renderPage();
        await userEvent.click(
            within(row("Main Hall")).getByRole("button", {
                name: "Stop 2x2 R1 G1",
            })
        );
        await confirmDialog("Stop 2x2 R1 G1");

        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({
                    id: "main",
                    currentGroupIds: ["333-r1-g3"],
                }),
            ],
        });
    });

    it("has no per-group stop for a room running one group", async () => {
        await renderPage();
        expect(
            within(row("Main Hall")).queryByRole("button", {
                name: "Stop 3x3 R1 G3",
            })
        ).toBeNull();
    });

    it("stops the whole room after confirming", async () => {
        await renderPage();
        await openMenuItem("Main Hall", "Stop the room");
        await confirmDialog("Stop the room");

        expect(backend.puts[0].body).toEqual({
            rooms: [
                expect.objectContaining({ id: "main", currentGroupIds: [] }),
            ],
        });
    });
});
