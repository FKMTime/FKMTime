import { screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache, QueryError } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { buildView } from "@/lib/tests/h2hPublicFixtures";
import { renderWithQueryClient } from "@/test/queryClient";

import PublicH2hMatch from "./PublicH2hMatch";

const fake = vi.hoisted(() => ({ hasBracket: true }));

vi.mock("@/socket", () => ({
    socket: {
        connected: false,
        connect: () => undefined,
        disconnect: () => undefined,
        emit: () => undefined,
        on: () => undefined,
        off: () => undefined,
        io: { on: () => undefined, off: () => undefined },
    },
}));
vi.mock("@/lib/competition", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getPublicCompetitionInfo: () => Promise.resolve({ status: 503 }),
}));
vi.mock("@/lib/events", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getEvents: () => Promise.resolve(),
}));
vi.mock("@/lib/h2hPublic", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    publicH2hQuery: (roundId: string) => ({
        key: `h2h/public/${roundId}`,
        fetch: () =>
            fake.hasBracket
                ? Promise.resolve(buildView(4))
                : Promise.reject(new QueryError(404)),
    }),
}));

const renderAt = (matchNumber: number) =>
    renderWithQueryClient(
        <Provider store={createStore()}>
            <MemoryRouter
                initialEntries={[`/public/h2h/333oh-r2/match/${matchNumber}`]}
            >
                <Routes>
                    <Route
                        path="/public/h2h/:roundId/match/:matchNumber"
                        element={<PublicH2hMatch />}
                    />
                </Routes>
            </MemoryRouter>
        </Provider>
    );

describe("PublicH2hMatch", () => {
    beforeEach(() => {
        clearQueryCache();
        queryClient.setQueryDefaults(["h2h/public/333oh-r2"], { retry: false });
    });

    it("says the bracket isn't ready while the round has none", async () => {
        fake.hasBracket = false;
        renderAt(1);
        expect(
            await screen.findByText(
                "The bracket for this round isn't ready yet."
            )
        ).toBeTruthy();
    });

    it("says there's no such match in a bracket without it", async () => {
        fake.hasBracket = true;
        renderAt(9);
        expect(
            await screen.findByText("There's no such match in this round.")
        ).toBeTruthy();
    });

    it("shows the match's scoreboard", async () => {
        fake.hasBracket = true;
        renderAt(1);
        expect(
            await screen.findByRole("heading", { name: "Semifinal 1" })
        ).toBeTruthy();
    });
});
