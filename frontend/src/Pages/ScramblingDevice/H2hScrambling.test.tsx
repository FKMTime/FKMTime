import { fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { ReactElement } from "react";
import {
    MemoryRouter,
    Outlet,
    Route,
    Routes,
    useLocation,
} from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import {
    Competition,
    DecryptedScramble,
    H2hMatchScramble,
    ScrambleSet as ScrambleSetData,
    ScramblingDeviceRoom,
} from "@/lib/interfaces";

import H2hMatchesList from "./Home/Components/H2hMatchesList";
import ScramblingDeviceHome from "./Home/ScramblingDeviceHome";
import H2hScrambleCard from "./ScrambleSet/Components/H2hScrambleCard";
import ScrambleSet from "./ScrambleSet/ScrambleSet";

/** What each live query answers, by its key */
const live = vi.hoisted(() => ({
    data: {} as Record<string, unknown>,
    isError: false,
}));
vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: (query: { key: string }) => ({
        data: live.data[query.key],
        isError: live.isError,
    }),
}));
const unlockable = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./useUnlockableScrambleSet", () => ({
    useUnlockableScrambleSet: () => unlockable.state,
}));

const playing = (
    overrides: Partial<H2hMatchScramble> = {}
): H2hMatchScramble => ({
    matchId: "match-1",
    label: "Semifinal 1",
    setNumber: 1,
    pointNumber: 4,
    scramble: { scrambleSetId: "set-c", set: "C", num: 4, isExtra: false },
    text: "Semifinal 1 · set 1 · Set C, scramble 4",
    warning: null,
    ...overrides,
});

const scrambles: DecryptedScramble[] = [
    { id: "s3", num: 3, isExtra: false, scramble: "R U R' U'" },
    { id: "s4", num: 4, isExtra: false, scramble: "F2 L' D B2" },
    { id: "e1", num: 1, isExtra: true, scramble: "U2 R2 F" },
];

const Location = () => {
    const location = useLocation();
    return <p>At {location.pathname + location.search}</p>;
};

describe("H2hMatchesList", () => {
    const renderList = (matches: H2hMatchScramble[], canScramble = true) =>
        render(
            <MemoryRouter initialEntries={["/scrambling-device"]}>
                <Routes>
                    <Route
                        path="/scrambling-device"
                        element={
                            <H2hMatchesList
                                matches={matches}
                                canScramble={canScramble}
                            />
                        }
                    />
                    <Route path="*" element={<Location />} />
                </Routes>
            </MemoryRouter>
        );

    it("lists both playing matches, and opens the set of the one picked", () => {
        renderList([
            playing(),
            playing({
                matchId: "match-2",
                label: "Semifinal 2",
                scramble: {
                    scrambleSetId: "set-d",
                    set: "D",
                    num: 1,
                    isExtra: false,
                },
                text: "Semifinal 2 · set 1 · Set D, scramble 1",
            }),
        ]);

        expect(
            screen.getByText("Semifinal 1 · set 1 · Set C, scramble 4")
        ).toBeTruthy();
        expect(
            screen.getByText("Semifinal 2 · set 1 · Set D, scramble 1")
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole("button", { name: "Scramble for Semifinal 2" })
        );
        expect(
            screen.getByText("At /scrambling-device/set/set-d?match=match-2")
        ).toBeTruthy();
    });

    it("shows a warning, and no Scramble without a scramble left", () => {
        renderList([
            playing({
                scramble: null,
                text: "Semifinal 1 · set 1",
                warning: "No scramble is left for point 8.",
            }),
        ]);

        expect(
            screen.getByText("No scramble is left for point 8.")
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Scramble/ })).toBeNull();
    });

    it("offers no Scramble when the round isn't running in this room", () => {
        renderList([playing()], false);

        expect(screen.queryByRole("button", { name: /Scramble/ })).toBeNull();
    });

    it("says when no match is playing", () => {
        renderList([]);

        expect(screen.getByText(/No match is playing/)).toBeTruthy();
    });
});

describe("H2hScrambleCard", () => {
    const renderCard = (match: H2hMatchScramble | null) => {
        const onOpenSet = vi.fn();
        const onBack = vi.fn();
        render(
            <H2hScrambleCard
                match={match}
                scrambleSetId="set-c"
                scrambles={scrambles}
                eventId="333oh"
                onOpenSet={onOpenSet}
                onBack={onBack}
            />
        );
        return { onOpenSet, onBack };
    };

    it("shows the next point's scramble, for both cubes", () => {
        renderCard(playing());

        expect(screen.getByText("Semifinal 1")).toBeTruthy();
        expect(screen.getByText("Set 1 · point 4")).toBeTruthy();
        expect(screen.getByText("Scramble 4")).toBeTruthy();
        expect(screen.getByText("F2 L' D B2")).toBeTruthy();
        expect(screen.getByText(/both competitors' cubes/)).toBeTruthy();
    });

    it("shows an extra scramble for a point raced again", () => {
        renderCard(
            playing({
                scramble: {
                    scrambleSetId: "set-c",
                    set: "C",
                    num: 1,
                    isExtra: true,
                },
            })
        );

        expect(screen.getByText("Extra 1")).toBeTruthy();
        expect(screen.getByText("U2 R2 F")).toBeTruthy();
    });

    it("sends the scrambler to the set the match moved on to", () => {
        const { onOpenSet } = renderCard(
            playing({
                setNumber: 2,
                scramble: {
                    scrambleSetId: "set-d",
                    set: "D",
                    num: 1,
                    isExtra: false,
                },
            })
        );

        expect(screen.getByText(/set 2 now races Set D/)).toBeTruthy();
        expect(screen.queryByText("F2 L' D B2")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Open Set D" }));
        expect(onOpenSet).toHaveBeenCalledWith("set-d");
    });

    it("keeps the scramble and shows the warning while an incident is open", () => {
        renderCard(
            playing({
                warning:
                    "An incident on point 4 is open. Wait for the delegate: the point may be raced again.",
            })
        );

        expect(screen.getByRole("alert").textContent).toMatch(
            /incident on point 4/
        );
        expect(screen.getByText("F2 L' D B2")).toBeTruthy();
    });

    it("says when the match isn't playing any more", () => {
        const { onBack } = renderCard(null);

        fireEvent.click(
            screen.getByRole("button", { name: "Back to the matches" })
        );
        expect(onBack).toHaveBeenCalled();
    });
});

describe("H2H views on failed reads", () => {
    it("warns that the matches may be out of date", () => {
        render(
            <MemoryRouter>
                <H2hMatchesList matches={[playing()]} canScramble isStale />
            </MemoryRouter>
        );

        expect(screen.getByRole("alert").textContent).toMatch(
            /Can't reach the server/
        );
    });

    it("warns that the scramble may be out of date", () => {
        render(
            <H2hScrambleCard
                match={playing()}
                scrambleSetId="set-c"
                scrambles={scrambles}
                eventId="333oh"
                onOpenSet={vi.fn()}
                onBack={vi.fn()}
                isStale
            />
        );

        expect(screen.getAllByRole("alert")[0].textContent).toMatch(
            /may be out of date/
        );
        expect(screen.getByText("F2 L' D B2")).toBeTruthy();
    });
});

const room: ScramblingDeviceRoom = {
    id: "room-1",
    name: "Stage",
    color: "#000000",
    currentGroupIds: ["333oh-r2-g1"],
};

const withRoom = (path: string, element: ReactElement, initial: string) => (
    <MemoryRouter initialEntries={[initial]}>
        <Routes>
            <Route element={<Outlet context={{ room }} />}>
                <Route path={path} element={element} />
            </Route>
            <Route path="*" element={<Location />} />
        </Routes>
    </MemoryRouter>
);

describe("ScrambleSet page", () => {
    const setC: ScrambleSetData = {
        id: "set-c",
        roundId: "333oh-r2",
        set: "C",
        scramblesCount: 5,
        extraScramblesCount: 2,
    };

    const renderPage = (search: string, failed = false) => {
        unlockable.state = {
            scrambleSet: setC,
            scrambles,
            unlock: vi.fn(),
            unlockError: "",
            clearUnlockError: vi.fn(),
            isUnlocking: false,
        };
        live.data = failed ? {} : { "scrambling/h2h/333oh-r2": [playing()] };
        live.isError = failed;
        render(
            withRoom(
                "/scrambling-device/set/:id",
                <ScrambleSet />,
                `/scrambling-device/set/set-c${search}`
            )
        );
    };

    it("shows the match's next scramble when opened for a match", () => {
        renderPage("?match=match-1");

        expect(screen.getByText("Set 1 · point 4")).toBeTruthy();
        expect(screen.getByText("F2 L' D B2")).toBeTruthy();
        expect(screen.queryByText("Scan the scrambler's card")).toBeNull();
    });

    it("says the server can't be reached when the first read fails", () => {
        renderPage("?match=match-1", true);

        expect(screen.getByRole("alert").textContent).toMatch(
            /Can't reach the server to find the match's scramble/
        );
    });

    it("scans cards as before otherwise", () => {
        renderPage("");

        expect(screen.getByText("Scan the scrambler's card")).toBeTruthy();
        expect(screen.queryByText("F2 L' D B2")).toBeNull();
    });
});

describe("ScramblingDeviceHome in a head-to-head round", () => {
    const renderHome = (failed = false) => {
        const store = createStore();
        store.set(competitionAtom, {
            wcif: {
                events: [
                    {
                        id: "333oh",
                        rounds: [
                            { id: "333oh-r1", format: "a" },
                            { id: "333oh-r2", format: "h" },
                        ],
                    },
                ],
            },
        } as unknown as Competition);
        live.data = {
            "scrambling/sets/round/333oh-r2": [
                {
                    id: "set-c",
                    roundId: "333oh-r2",
                    set: "C",
                    scramblesCount: 5,
                    extraScramblesCount: 2,
                },
            ],
            "scrambling/h2h/333oh-r2": [playing()],
        };
        live.isError = failed;
        render(
            <Provider store={store}>
                {withRoom(
                    "/scrambling-device",
                    <ScramblingDeviceHome />,
                    "/scrambling-device"
                )}
            </Provider>
        );
    };

    it("scrambles through the matches, not the sets", () => {
        renderHome();

        expect(
            screen.getByRole("button", { name: "Scramble for Semifinal 1" })
        ).toBeTruthy();
        // The set keeps All scrambles, without its own Scramble
        expect(
            screen.getByRole("button", { name: "All scrambles" })
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Scramble" })).toBeNull();
    });

    it("warns when the matches can't be read again", () => {
        renderHome(true);

        expect(screen.getByRole("alert").textContent).toMatch(
            /The matches shown may be out of date/
        );
    });
});
