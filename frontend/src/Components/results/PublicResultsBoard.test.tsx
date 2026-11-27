import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import { AttemptStatus, AttemptType, Result } from "@/lib/interfaces";
import { QueryError } from "@/lib/queryCache";
import { buildView, entrant } from "@/lib/tests/h2hPublicFixtures";

import PublicResultsBoard from "./PublicResultsBoard";

const wcif = {
    events: [
        {
            id: "333",
            rounds: [
                { id: "333-r1", format: "m", timeLimit: null, cutoff: null },
                { id: "333-r2", format: "m", timeLimit: null, cutoff: null },
            ],
        },
        {
            id: "333oh",
            rounds: [
                { id: "333oh-r1", format: "a", timeLimit: null, cutoff: null },
                { id: "333oh-r2", format: "h", timeLimit: null, cutoff: null },
            ],
        },
        {
            id: "pyram",
            rounds: [
                { id: "pyram-r1", format: "m", timeLimit: null, cutoff: null },
            ],
        },
    ],
} as unknown as Competition;

const result = (name: string, value: number) =>
    ({
        id: name,
        person: { name, countryIso2: "PL" },
        attempts: [1, 2, 3].map((n) => ({
            id: `${name}${n}`,
            attemptNumber: n,
            value,
            penalty: 0,
            type: AttemptType.STANDARD_ATTEMPT,
            status: AttemptStatus.STANDARD,
            replacedBy: null,
        })),
    }) as unknown as Result;

describe("PublicResultsBoard", () => {
    it("ranks results and highlights the podium", () => {
        render(
            <PublicResultsBoard
                wcif={wcif}
                roundId="333-r1"
                results={[
                    result("D", 1400),
                    result("A", 1000),
                    result("C", 1300),
                    result("B", 1200),
                ]}
                liveRoundIds={["333-r1"]}
                onRoundChange={vi.fn()}
            />
        );
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows.map((row) => row.textContent?.slice(0, 2))).toEqual([
            "1A",
            "2B",
            "3C",
            "4D",
        ]);
        expect(rows[2].className).toContain("bg-success-soft");
        expect(rows[3].className).not.toContain("bg-success-soft");
    });

    it("shows whether the round is in progress", () => {
        const { rerender } = render(
            <PublicResultsBoard
                wcif={wcif}
                roundId="333-r1"
                results={[result("A", 1000)]}
                liveRoundIds={["333-r1"]}
                onRoundChange={vi.fn()}
            />
        );
        expect(screen.getByText(/In progress/)).toBeTruthy();
        rerender(
            <PublicResultsBoard
                wcif={wcif}
                roundId="333-r1"
                results={[result("A", 1000), result("B", 1200)]}
                liveRoundIds={[]}
                onRoundChange={vi.fn()}
            />
        );
        expect(screen.getByText(/2 competitors/)).toBeTruthy();
    });

    it("switches rounds and picks the live round of another event", async () => {
        const onRoundChange = vi.fn();
        render(
            <PublicResultsBoard
                wcif={wcif}
                roundId="333-r1"
                results={[]}
                liveRoundIds={["pyram-r1"]}
                onRoundChange={onRoundChange}
            />
        );
        expect(screen.getByText("No results yet.")).toBeTruthy();
        await userEvent.click(screen.getByRole("radio", { name: "Round 2" }));
        expect(onRoundChange).toHaveBeenLastCalledWith("333-r2");
        await userEvent.click(screen.getByRole("radio", { name: /pyram/i }));
        expect(onRoundChange).toHaveBeenLastCalledWith("pyram-r1");
    });

    it("ranks a head-to-head round by its bracket, with the stage reached", () => {
        const h2h = {
            ...buildView(4),
            entrants: [
                {
                    ...entrant(1),
                    bestSingle: 1200,
                    position: 2,
                    stageReached: "FINAL" as const,
                },
                {
                    ...entrant(2),
                    bestSingle: 1000,
                    position: 1,
                    stageReached: "FINAL" as const,
                },
                {
                    ...entrant(3),
                    bestSingle: -1,
                    position: 4,
                    stageReached: "THIRD_PLACE" as const,
                },
                {
                    ...entrant(4),
                    bestSingle: 1100,
                    position: 3,
                    stageReached: "THIRD_PLACE" as const,
                },
            ],
        };
        render(
            <MemoryRouter>
                <PublicResultsBoard
                    wcif={wcif}
                    roundId="333oh-r2"
                    // The attempts alone would rank seed 2, 4, 1, 3
                    results={[result("Competitor 3", 900)]}
                    liveRoundIds={[]}
                    onRoundChange={vi.fn()}
                    h2h={h2h}
                    bracketHref="/public/h2h/333oh-r2"
                />
            </MemoryRouter>
        );
        const table = screen.getByRole("table");
        expect(
            screen.getAllByRole("columnheader").map((th) => th.textContent)
        ).toEqual(["#", "Name", "Representing", "Stage reached", "Best"]);
        const rows = table.querySelectorAll("tbody tr");
        expect(
            Array.from(rows).map((row) =>
                Array.from(row.querySelectorAll("td")).map(
                    (td) => td.textContent
                )
            )
        ).toEqual([
            ["1", "Competitor 2", "Poland", "Final", "10.00"],
            ["2", "Competitor 1", "Poland", "Final", "12.00"],
            ["3", "Competitor 4", "Poland", "Third-place match", "11.00"],
            ["4", "Competitor 3", "Poland", "Third-place match", "DNF"],
        ]);
        expect(screen.getByText(/4 competitors/)).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "Bracket" }).getAttribute("href")
        ).toBe("/public/h2h/333oh-r2");
    });

    it("says when a head-to-head round's bracket couldn't load, and retries", async () => {
        const onRetry = vi.fn();
        const board = (h2hError: unknown) => (
            <MemoryRouter>
                <PublicResultsBoard
                    wcif={wcif}
                    roundId="333oh-r2"
                    results={[]}
                    liveRoundIds={[]}
                    onRoundChange={vi.fn()}
                    h2h={null}
                    h2hError={h2hError}
                    onRetryH2h={onRetry}
                />
            </MemoryRouter>
        );
        const { rerender } = render(board(null));
        // Still loading: neither "No results yet" nor "Not started"
        expect(screen.getByLabelText("Loading results")).toBeTruthy();
        expect(screen.queryByText("No results yet.")).toBeNull();
        expect(screen.queryByText(/Not started/)).toBeNull();

        rerender(board(new QueryError(500)));
        expect(screen.getByRole("alert").textContent).toContain(
            "Couldn't load"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Try again" })
        );
        expect(onRetry).toHaveBeenCalled();

        // No bracket yet is no results yet
        rerender(board(new QueryError(404)));
        expect(screen.getByText("No results yet.")).toBeTruthy();
        expect(screen.getByText(/Not started/)).toBeTruthy();
    });
});
