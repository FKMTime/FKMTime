import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { H2hBracketStatus, H2hRoundView } from "@/lib/h2h";

import RankingTab from "./RankingTab";

const state = vi.hoisted(() => ({ view: undefined as unknown }));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: (query: { key: string }) => ({
        data: query.key.endsWith("/export/checks")
            ? { fileName: "x.csv", wcaRoundId: 1, blockers: [] }
            : state.view,
        isError: false,
        refetch: vi.fn(),
    }),
}));

const viewWith = (status: H2hBracketStatus) =>
    ({
        roundId: "333oh-r2",
        eventId: "333oh",
        cannotCreate: null,
        suggestedSize: 4,
        candidates: [],
        scramblePlan: null,
        bracket: {
            id: "bracket",
            size: 4,
            status,
            wcaRoundId: 1,
            seedsLocked: true,
            attemptsLinked: true,
            stages: [],
            matches: [],
            // An invented competitor
            entrants: [
                {
                    id: "entrant-1",
                    seed: 1,
                    seedTieBroken: false,
                    withdrawnAt: null,
                    person: {
                        id: "person-1",
                        name: "Ada Example",
                        wcaId: null,
                        registrantId: 1,
                        countryIso2: null,
                    },
                    bestSingle: 912,
                    position: 1,
                    stageReached: "FINAL",
                },
            ],
        },
    }) satisfies H2hRoundView;

describe("RankingTab", () => {
    it("offers the WCA CSV once the bracket is finished", () => {
        state.view = viewWith("FINISHED");
        render(<RankingTab roundId="333oh-r2" />);

        expect(
            screen.getByRole("button", {
                name: "Download results for WCA (CSV)",
            })
        ).toBeTruthy();
    });

    it("doesn't offer it while matches are still to play", () => {
        state.view = viewWith("IN_PROGRESS");
        render(<RankingTab roundId="333oh-r2" />);

        expect(screen.getByText("Ada Example")).toBeTruthy();
        expect(
            screen.queryByRole("button", {
                name: "Download results for WCA (CSV)",
            })
        ).toBeNull();
    });
});
