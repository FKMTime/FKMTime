import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Competition as WCIF } from "wcif-helpers";

import { Attempt, AttemptStatus, AttemptType, Result } from "@/lib/interfaces";

import TvResultsSlide from "./TvResultsSlide";

const wcif = {
    events: [{ id: "333", rounds: [{ id: "333-r1", format: "a" }] }],
} as unknown as WCIF;

const result = (i: number, base: number): Result =>
    ({
        id: `r${i}`,
        person: { name: `Person ${i}` },
        attempts: [0, 1, 2, 3, 4].map(
            (k) =>
                ({
                    id: `a${i}-${k}`,
                    attemptNumber: k + 1,
                    value: base + k * 10,
                    penalty: 0,
                    replacedBy: null,
                    status: AttemptStatus.STANDARD,
                    type: AttemptType.STANDARD_ATTEMPT,
                }) as Attempt
        ),
    }) as unknown as Result;

describe("TvResultsSlide", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
    });

    it("shows the top ten of the ranking, fastest first", () => {
        const results = Array.from({ length: 12 }, (_, i) =>
            result(i, 2000 - i * 100)
        );
        render(
            <TvResultsSlide wcif={wcif} roundId="333-r1" results={results} />
        );
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows).toHaveLength(10);
        expect(rows[0].textContent).toContain("Person 11");
        expect(rows[0].textContent).toContain("9.20");
    });

    it("stays blank while the round's results load", () => {
        render(<TvResultsSlide wcif={wcif} roundId="333-r1" results={null} />);
        expect(screen.queryByText("No results yet")).toBeNull();
        expect(screen.queryByRole("table")).toBeNull();
    });
});
