import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { renderWithQueryClient } from "@/test/queryClient";

import Results from "./Results";

const fake = vi.hoisted(() => ({
    emitted: [] as string[],
    // Every listener of an event, as socket.io keeps them
    handlers: new Map<string, (() => void)[]>(),
    searches: [] as string[],
    isDelegate: true,
}));

vi.mock("@/socket", () => ({
    socket: {
        connected: true,
        emit: (event: string) => fake.emitted.push(event),
        on: (event: string, handler: () => void) =>
            fake.handlers.set(event, [
                ...(fake.handlers.get(event) ?? []),
                handler,
            ]),
        off: (event: string, handler: () => void) => {
            const left = (fake.handlers.get(event) ?? []).filter(
                (h) => h !== handler
            );
            if (left.length > 0) fake.handlers.set(event, left);
            else fake.handlers.delete(event);
        },
    },
}));
vi.mock("@/lib/permissions", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isDelegate: () => fake.isDelegate,
    isStageLeaderOrOrganizerOrDelegate: () => true,
}));
vi.mock("@/lib/h2h", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    h2hRoundQuery: (roundId: string) => ({
        key: `h2h/${roundId}`,
        fetch: () => Promise.resolve({ bracket: null }),
    }),
}));
vi.mock("./H2h/MatchesTab", () => ({
    default: ({ canManage }: { canManage: boolean }) => (
        <div>{canManage ? "Matches to manage" : "Matches to start"}</div>
    ),
}));
vi.mock("@/lib/rooms", () => ({
    roomsQuery: {
        key: "competition/rooms",
        fetch: () => Promise.resolve([]),
    },
}));
vi.mock("@/lib/results", async (importOriginal) => {
    const queries = new Map<string, object>();
    return {
        ...(await importOriginal<object>()),
        roundResultsSearchQuery: (roundId: string, search: string) => {
            const key = `result/round/${roundId}${search ? `?search=${search}` : ""}`;
            const query = queries.get(key) ?? {
                key,
                fetch: () => {
                    fake.searches.push(search);
                    return Promise.resolve([]);
                },
            };
            queries.set(key, query);
            return query;
        },
    };
});
// The tabs prefetch the Checks tab, which this test doesn't need
vi.mock("./Components/ResultsTabs", () => ({ default: () => null }));

const competition = {
    wcif: {
        events: [
            { id: "333", rounds: [{ id: "333-r1", format: "a" }] },
            { id: "333oh", rounds: [{ id: "333oh-r2", format: "h" }] },
        ],
        persons: [],
        schedule: { venues: [{ id: 1, rooms: [] }] },
    },
} as unknown as Competition;

const renderResults = (roundId = "333-r1") => {
    const store = createStore();
    store.set(competitionAtom, competition);
    renderWithQueryClient(
        <Provider store={store}>
            <ConfirmProvider>
                <MemoryRouter initialEntries={[`/results/round/${roundId}`]}>
                    <Routes>
                        <Route
                            path="/results/round/:id"
                            element={<Results />}
                        />
                        <Route
                            path="/results/public/:id"
                            element={<p>Public view</p>}
                        />
                    </Routes>
                </MemoryRouter>
            </ConfirmProvider>
        </Provider>
    );
};

describe("Results", () => {
    beforeEach(() => {
        clearQueryCache();
        fake.emitted = [];
        fake.handlers.clear();
        fake.searches = [];
        fake.isDelegate = true;
    });

    it("stays in the round's room while searching", async () => {
        renderResults();
        const search = await screen.findByLabelText("Search results");

        await userEvent.type(search, "anna");

        // One request for the round, one once typing pauses
        await waitFor(() => expect(fake.searches).toContain("anna"));
        expect(fake.searches).toEqual(["", "anna"]);
        expect(fake.emitted).toEqual(["joinResults"]);
        expect(fake.handlers.has("resultEntered")).toBe(true);
    });

    it("refetches the bracket and the WCA export checks on h2hUpdated", async () => {
        const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
        renderResults("333oh-r2");
        await waitFor(() => expect(fake.handlers.has("h2hUpdated")).toBe(true));
        invalidate.mockClear();

        fake.handlers.get("h2hUpdated")?.forEach((handler) => handler());

        const keys = invalidate.mock.calls.map(
            ([filters]) => filters?.queryKey
        );
        expect(keys).toContainEqual(["h2h/333oh-r2"]);
        expect(keys).toContainEqual(["h2h/333oh-r2/export/checks"]);
        invalidate.mockRestore();
    });

    it("shows a stage leader only the matches of a head-to-head round", async () => {
        fake.isDelegate = false;
        renderResults("333oh-r2");

        expect(await screen.findByText("Matches to start")).toBeTruthy();
        expect(screen.queryByRole("tab", { name: "Bracket" })).toBeNull();
        expect(screen.queryByText("Public view")).toBeNull();
        expect(screen.queryByLabelText("Search results")).toBeNull();
    });

    it("sends a stage leader to the public view of other rounds", async () => {
        fake.isDelegate = false;
        renderResults();

        expect(await screen.findByText("Public view")).toBeTruthy();
    });
});
