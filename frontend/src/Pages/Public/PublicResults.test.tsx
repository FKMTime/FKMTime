import { screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { buildView } from "@/lib/tests/h2hPublicFixtures";
import { renderWithQueryClient } from "@/test/queryClient";

import PublicResults from "./PublicResults";

const fake = vi.hoisted(() => ({
    emitted: [] as string[],
    fetched: [] as string[],
}));

vi.mock("@/socket", () => ({
    socket: {
        connected: true,
        emit: (event: string) => fake.emitted.push(event),
        on: () => undefined,
        off: () => undefined,
    },
}));
vi.mock("@/lib/results", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    publicRoundResultsQuery: (roundId: string) => ({
        key: `result/public/round/${roundId}`,
        fetch: () => {
            fake.fetched.push(`result/public/round/${roundId}`);
            return Promise.resolve([]);
        },
    }),
}));
vi.mock("@/lib/h2hPublic", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    publicH2hQuery: (roundId: string) => ({
        key: `h2h/public/${roundId}`,
        fetch: () => {
            fake.fetched.push(`h2h/public/${roundId}`);
            return Promise.resolve(buildView(4));
        },
    }),
}));

const competition = {
    wcif: {
        events: [
            { id: "333", rounds: [{ id: "333-r1", format: "a" }] },
            { id: "333oh", rounds: [{ id: "333oh-r2", format: "h" }] },
        ],
        persons: [],
    },
} as unknown as Competition;

const renderAt = (roundId: string) => {
    const store = createStore();
    store.set(competitionAtom, competition);
    renderWithQueryClient(
        <Provider store={store}>
            <MemoryRouter initialEntries={[`/public/results/${roundId}`]}>
                <Routes>
                    <Route element={<Outlet context={{ liveRoundIds: [] }} />}>
                        <Route
                            path="/public/results/:id"
                            element={<PublicResults />}
                        />
                    </Route>
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

describe("PublicResults", () => {
    beforeEach(() => {
        clearQueryCache();
        fake.emitted = [];
        fake.fetched = [];
    });

    it("reads a head-to-head round from its bracket only", async () => {
        renderAt("333oh-r2");
        await screen.findByRole("table");
        // The shared results route gives attempt statuses: not fetched here
        expect(fake.fetched).toEqual(["h2h/public/333oh-r2"]);
        expect(fake.emitted).toEqual(["joinH2h"]);
    });

    it("reads any other round from its results", async () => {
        renderAt("333-r1");
        await waitFor(() =>
            expect(fake.fetched).toEqual(["result/public/round/333-r1"])
        );
        expect(fake.emitted).toEqual(["joinResults"]);
    });
});
