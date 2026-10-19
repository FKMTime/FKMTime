import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Competition } from "wcif-helpers";

import { AttemptStatus, AttemptType, Result } from "@/lib/interfaces";

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
});
