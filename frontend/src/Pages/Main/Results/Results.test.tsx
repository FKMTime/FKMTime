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
    handlers: new Map<string, () => void>(),
    searches: [] as string[],
}));

vi.mock("@/socket", () => ({
    socket: {
        connected: true,
        emit: (event: string) => fake.emitted.push(event),
        on: (event: string, handler: () => void) =>
            fake.handlers.set(event, handler),
        off: (event: string) => fake.handlers.delete(event),
    },
}));
vi.mock("@/lib/permissions", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isDelegate: () => true,
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
        events: [{ id: "333", rounds: [{ id: "333-r1", format: "a" }] }],
        persons: [],
        schedule: { venues: [{ id: 1, rooms: [] }] },
    },
} as unknown as Competition;

const renderResults = () => {
    const store = createStore();
    store.set(competitionAtom, competition);
    renderWithQueryClient(
        <Provider store={store}>
            <ConfirmProvider>
                <MemoryRouter initialEntries={["/results/round/333-r1"]}>
                    <Routes>
                        <Route
                            path="/results/round/:id"
                            element={<Results />}
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
});
