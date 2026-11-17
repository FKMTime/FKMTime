import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Room } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { GroupProgress } from "@/lib/rooms";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { renderWithQueryClient } from "@/test/queryClient";

import Home from "./Home";

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
                if (path === "competition/rooms")
                    for (const sent of (body as { rooms: Room[] }).rooms) {
                        const saved = (backend.rooms as Room[]).find(
                            (r) => r.id === sent.id
                        );
                        if (saved) saved.currentGroupIds = sent.currentGroupIds;
                    }
                return json({});
            }
            // Copies, so a PUT doesn't change what the page already loaded
            if (path === "competition/rooms")
                return json((backend.rooms as Room[]).map((r) => ({ ...r })));
            if (path === "competition/rooms/progress")
                return json(backend.progress);
            if (path === "competition/settings")
                return json({
                    shouldChangeGroupsAutomatically: backend.autoChange,
                });
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

// Group numbers run across rooms: the Main Hall has 1, 3, 5, the Side Hall 2, 4.
// 3x3 has two rounds; 2x2 one round with a group in each room.
const wcif = {
    events: [
        { id: "333", rounds: [{ id: "333-r1" }, { id: "333-r2" }] },
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
                            {
                                ...group("333-r2", 200, 230),
                                childActivities: [group("333-r2-g1", 200, 230)],
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
                            {
                                ...group("222-r1", 120, 150),
                                childActivities: [group("222-r1-g2", 120, 150)],
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

const renderPage = async (
    officialResultsDestination: Competition["officialResultsDestination"] = "NONE"
) => {
    const store = createStore();
    store.set(competitionAtom, {
        id: "comp",
        wcif,
        useFkmTimeDevices: true,
        officialResultsDestination,
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
    await screen.findAllByRole("region");
};

/** The desktop card; phones get a copy of the selected room above it */
const row = (name: string) => screen.getAllByRole("region", { name }).at(-1)!;

/** Confirms in the confirm dialog, even with the picker's dialog open */
const confirmDialog = async (label: string) => {
    await waitFor(() =>
        expect(
            screen
                .getAllByRole("dialog")
                .some((d) => within(d).queryByRole("button", { name: label }))
        ).toBe(true)
    );
    const dialog = screen
        .getAllByRole("dialog")
        .find((d) => within(d).queryByRole("button", { name: label }))!;
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

/** The picker: a dialog from md up, a panel in the room card on phones */
const openPicker = async (roomName: string) => {
    await openMenuItem(roomName, "Change group…");
    const name = `Change group in ${roomName}`;
    return window.innerWidth < 768
        ? screen.findByRole("group", { name })
        : screen.findByRole("dialog", { name });
};

/** Opens the picker and clicks through the given chips */
const pickGroup = async (roomName: string, chips: (string | RegExp)[]) => {
    const picker = await openPicker(roomName);
    for (const chip of chips)
        await userEvent.click(
            within(picker).getByRole("button", { name: chip })
        );
    return picker;
};

const setViewportWidth = (width: number) => {
    window.innerWidth = width;
    window.dispatchEvent(new Event("resize"));
};

describe("Home group controls", () => {
    beforeEach(() => {
        clearQueryCache();
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
                { id: "222", name: "2x2x2 Cube", shortName: "2x2" },
            ])
        );
        localStorage.setItem(
            "fkmtime-userInfo",
            JSON.stringify({ roles: ["DELEGATE"] })
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
            screen.getAllByText("All in · ready for the next group")[0]
        ).toBeTruthy();
    });

    it("tells the room moves on by itself when automatic change is on", async () => {
        backend.autoChange = true;
        backend.progress = [
            { roomId: "main", groups: [progress("333-r1-g3", 35)] },
        ];
        await renderPage();
        expect(
            (await screen.findAllByText("All in · moving on by itself"))[0]
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

    describe("change group on a wide screen", () => {
        it("goes event → round → group in columns, then switches", async () => {
            await renderPage();
            const dialog = await pickGroup("Main Hall", ["3x3x3 Cube"]);
            const rounds = within(dialog).getByRole("region", {
                name: "Round",
            });
            expect(
                within(rounds)
                    .getAllByRole("button")
                    .map((b) => b.textContent)
            ).toEqual([
                expect.stringMatching(/^Round 1Running · Main Hall, Side Hall/),
                expect.stringMatching(/^Round 2Upcoming/),
            ]);
            await userEvent.click(
                within(rounds).getByRole("button", { name: /^Round 1/ })
            );
            const groups = within(dialog).getByRole("region", {
                name: "Group",
            });
            // Sorted by number, whichever room runs them
            expect(
                within(groups)
                    .getAllByRole("button")
                    .map((b) => b.getAttribute("aria-label"))
            ).toEqual([
                "Group 1",
                "Group 2",
                "Group 3, running here",
                "Group 4",
                "Group 5",
            ]);
            await userEvent.click(
                within(groups).getByRole("button", { name: "Group 5" })
            );

            // Another group of a running event can only replace it
            expect(
                (
                    within(dialog).getByRole("button", {
                        name: "Run both",
                    }) as HTMLButtonElement
                ).disabled
            ).toBe(true);
            await userEvent.click(
                within(dialog).getByRole("button", {
                    name: "Switch to 3x3 R1 G5",
                })
            );
            expect(backend.puts[0].body).toEqual({
                rooms: [
                    expect.objectContaining({
                        id: "main",
                        currentGroupIds: ["333-r1-g5"],
                    }),
                ],
            });
        });

        it("changes an earlier column in place, dropping the group picked", async () => {
            await renderPage();
            const dialog = await pickGroup("Main Hall", [
                "3x3x3 Cube",
                /^Round 1/,
                "Group 5",
            ]);
            expect(
                within(dialog).getByRole("button", { name: "Run both" })
            ).toBeTruthy();
            await userEvent.click(
                within(dialog).getByRole("button", { name: "2x2x2 Cube" })
            );
            expect(
                within(dialog).queryByRole("button", { name: "Run both" })
            ).toBeNull();
            expect(
                within(dialog).getByRole("button", { name: "Group 2" })
            ).toBeTruthy();
        });

        it("keeps the running group out of reach", async () => {
            await renderPage();
            const dialog = await pickGroup("Main Hall", [
                "3x3x3 Cube",
                /^Round 1/,
            ]);
            expect(
                (
                    within(dialog).getByRole("button", {
                        name: "Group 3, running here",
                    }) as HTMLButtonElement
                ).disabled
            ).toBe(true);
        });

        it("chooses an event's only round at once and runs both groups", async () => {
            await renderPage();
            const dialog = await pickGroup("Main Hall", ["2x2x2 Cube"]);
            // The round column still shows, with its round chosen
            expect(
                within(dialog)
                    .getByRole("button", { name: /^Round 1/ })
                    .getAttribute("aria-pressed")
            ).toBe("true");
            await userEvent.click(
                within(dialog).getByRole("button", { name: "Group 1" })
            );
            expect(
                within(dialog).getByText(
                    "Stations in this room will accept results for both groups."
                )
            ).toBeTruthy();
            await userEvent.click(
                within(dialog).getByRole("button", { name: "Run both" })
            );
            expect(backend.puts[0].body).toEqual({
                rooms: [
                    expect.objectContaining({
                        id: "main",
                        currentGroupIds: ["333-r1-g3", "222-r1-g1"],
                    }),
                ],
            });
        });

        it("offers the room's next group first", async () => {
            await renderPage();
            const dialog = await pickGroup("Main Hall", [
                /^Next in this room: 3x3 R1 G5/,
            ]);
            expect(
                within(dialog).getByRole("button", {
                    name: "Switch to 3x3 R1 G5",
                })
            ).toBeTruthy();
        });

        it("can be driven from the keyboard", async () => {
            await renderPage();
            const dialog = await openPicker("Main Hall");
            // Focus starts in the search box; ArrowDown enters the events
            expect(document.activeElement).toBe(
                within(dialog).getByRole("textbox")
            );
            await userEvent.keyboard("{ArrowDown}");
            expect(document.activeElement).toBe(
                within(dialog).getByRole("button", { name: "3x3x3 Cube" })
            );
            await userEvent.keyboard("{Enter}");
            // Picking moves on to the rounds; arrows move within a column
            await waitFor(() =>
                expect(document.activeElement).toBe(
                    within(dialog).getByRole("button", { name: /^Round 1/ })
                )
            );
            await userEvent.keyboard("{ArrowDown}");
            expect(document.activeElement).toBe(
                within(dialog).getByRole("button", { name: /^Round 2/ })
            );
            // ArrowLeft goes back to the chosen event
            await userEvent.keyboard("{ArrowLeft}");
            expect(document.activeElement).toBe(
                within(dialog).getByRole("button", { name: "3x3x3 Cube" })
            );
            await userEvent.keyboard("{ArrowRight}{ArrowDown}{Enter}");
            await waitFor(() =>
                expect(document.activeElement).toBe(
                    within(dialog).getByRole("button", { name: "Group 1" })
                )
            );
            await userEvent.keyboard("{Enter}");
            expect(
                within(dialog).getByRole("button", {
                    name: "Switch to 3x3 R2 G1",
                })
            ).toBeTruthy();
        });

        it("starts a picked group in an empty room after confirming", async () => {
            backend.rooms = [room("main", "Main Hall", [])];
            await renderPage();
            await pickGroup("Main Hall", ["2x2x2 Cube", "Group 1"]);
            expect(
                screen.queryByRole("button", { name: "Run both" })
            ).toBeNull();
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
    });

    describe("change group on a phone", () => {
        beforeEach(() => setViewportWidth(390));
        afterEach(() => setViewportWidth(1024));

        it("goes one step at a time under the row, with a breadcrumb back", async () => {
            await renderPage();
            const panel = await pickGroup("Main Hall", ["3x3x3 Cube"]);
            expect(screen.queryByRole("dialog")).toBeNull();
            const crumbs = within(panel).getByRole("navigation", {
                name: "Picker steps",
            });
            expect(crumbs.textContent).toContain("Event3x3 · Round");

            await userEvent.click(
                within(crumbs).getByRole("button", { name: "Event" })
            );
            expect(
                within(panel).getByRole("button", { name: "2x2x2 Cube" })
            ).toBeTruthy();

            await userEvent.click(
                within(panel).getByRole("button", { name: "3x3x3 Cube" })
            );
            await userEvent.click(
                within(panel).getByRole("button", { name: /^Round 1/ })
            );
            expect(crumbs.textContent).toContain("Event3x3 R1Group");
            await userEvent.click(
                within(panel).getByRole("button", { name: "Group 1" })
            );
            await userEvent.click(
                within(panel).getByRole("button", {
                    name: "Switch to 3x3 R1 G1",
                })
            );
            expect(backend.puts[0].body).toEqual({
                rooms: [
                    expect.objectContaining({
                        id: "main",
                        currentGroupIds: ["333-r1-g1"],
                    }),
                ],
            });
        });

        it("skips the round step for a one-round event and goes back on Escape", async () => {
            await renderPage();
            const panel = await pickGroup("Main Hall", ["2x2x2 Cube"]);
            expect(
                within(panel).getByRole("button", { name: "Group 2" })
            ).toBeTruthy();
            expect(
                within(panel).queryByRole("button", { name: /^Round/ })
            ).toBeNull();

            within(panel).getByRole("button", { name: "Group 2" }).focus();
            await userEvent.keyboard("{Escape}");
            expect(
                within(panel).getByRole("button", { name: "3x3x3 Cube" })
            ).toBeTruthy();
            await userEvent.click(
                within(panel).getByRole("button", { name: "2x2x2 Cube" })
            );
            await userEvent.click(
                within(panel).getByRole("button", { name: "Group 2" })
            );
            await userEvent.click(
                within(panel).getByRole("button", { name: "Run both" })
            );
            expect(backend.puts[0].body).toEqual({
                rooms: [
                    expect.objectContaining({
                        id: "main",
                        currentGroupIds: ["333-r1-g3", "222-r1-g2"],
                    }),
                ],
            });
        });
    });

    it("stops one group of a room running several", async () => {
        backend.rooms = [room("main", "Main Hall", ["333-r1-g3", "222-r1-g1"])];
        await renderPage();
        await openMenuItem("Main Hall", "Stop 2x2 R1 G1");
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
        await userEvent.click(
            within(row("Main Hall")).getByRole("button", {
                name: "More for Main Hall",
            })
        );
        expect(
            await screen.findByRole("menuitem", { name: "Stop the room" })
        ).toBeTruthy();
        expect(
            screen.queryByRole("menuitem", { name: "Stop 3x3 R1 G3" })
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

    it("shows every group a room runs, each with its progress", async () => {
        backend.rooms = [room("main", "Main Hall", ["333-r1-g3", "222-r1-g1"])];
        backend.progress = [
            {
                roomId: "main",
                groups: [progress("333-r1-g3", 35), progress("222-r1-g1", 10)],
            },
        ];
        await renderPage();
        const card = row("Main Hall");
        expect(
            within(card).getByRole("heading", { name: "3x3x3 Cube · Round 1" })
        ).toBeTruthy();
        expect(
            within(card).getByRole("heading", { name: "2x2x2 Cube · Round 1" })
        ).toBeTruthy();
        expect(
            within(card).getByRole("progressbar", {
                name: "Results entered for 2x2 R1 G1 in Main Hall",
            })
        ).toBeTruthy();
        // One group still has results to come, so the room isn't done
        expect(within(card).queryByText(/^All in/)).toBeNull();
        // Each group has its own attendance, not just the first one
        expect(
            within(card)
                .getByRole("link", { name: "Attendance for 2x2 R1 G1" })
                .getAttribute("href")
        ).toBe("/attendance/222-r1-g1");
        expect(
            within(card).queryByRole("link", { name: "Attendance" })
        ).toBeNull();
    });

    it("turns automatic group change on from Home", async () => {
        await renderPage();
        const toggle = await screen.findByRole("switch", {
            name: "Automatic group change",
        });
        await vi.waitFor(() =>
            expect((toggle as HTMLButtonElement).disabled).toBe(false)
        );
        await userEvent.click(toggle);
        await waitFor(() =>
            expect(backend.puts).toEqual([
                {
                    path: expect.stringContaining("settings"),
                    body: expect.objectContaining({
                        shouldChangeGroupsAutomatically: true,
                    }),
                },
            ])
        );
    });

    it("asks to open the rounds a change started in WCA Live", async () => {
        await renderPage("WCA_LIVE");
        await pickGroup("Main Hall", ["2x2x2 Cube", "Group 1"]);
        await userEvent.click(screen.getByRole("button", { name: "Run both" }));
        const dialog = await screen.findByRole("dialog", {
            name: "Open these rounds in WCA Live",
        });
        expect(within(dialog).getByText("2x2x2 Cube · Round 1")).toBeTruthy();
    });

    it("gives no group controls to someone who can't change groups", async () => {
        localStorage.setItem(
            "fkmtime-userInfo",
            JSON.stringify({ roles: ["STAGE_LEADER"] })
        );
        await renderPage();
        expect(
            within(row("Main Hall")).queryByRole("button", {
                name: "More for Main Hall",
            })
        ).toBeNull();
        expect(
            screen.queryByRole("switch", { name: "Automatic group change" })
        ).toBeNull();
    });
});
