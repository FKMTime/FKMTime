import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PublicH2hView } from "@/lib/h2hPublic";
import {
    buildView,
    point,
    set,
    withMatch,
} from "@/lib/tests/h2hPublicFixtures";

import H2hBracket from "./H2hBracket";

const renderBracket = (view: PublicH2hView) =>
    render(
        <MemoryRouter>
            <H2hBracket view={view} narrow={false} />
        </MemoryRouter>
    );

/** Semifinal 1 won 1–0 by side A, 3–1 on points; semifinal 2 playing */
const playedView = () => {
    const view = buildView(4);
    return withMatch(
        withMatch(view, 1, {
            status: "FINISHED",
            winnerSide: "A",
            endedBy: "PLAYED",
            score: { a: 1, b: 0 },
            sets: [
                set(
                    1,
                    [
                        point(1, 912, 1034),
                        point(2, 1100, 1001),
                        point(3, 950, 990),
                        point(4, 899, 1200),
                    ],
                    "A"
                ),
            ],
        }),
        2,
        { status: "IN_PROGRESS", sets: [set(1, [point(1, 1000, 1100)])] }
    );
};

describe("H2hBracket", () => {
    it("labels the stages and puts the third-place match under the final", () => {
        renderBracket(buildView(12));
        expect(
            screen
                .getAllByRole("heading", { level: 2 })
                .map((h) => h.textContent)
        ).toEqual(["Stage of 12", "Quarterfinal", "Semifinal", "Final"]);
        expect(
            screen.getByRole("article", { name: "Third-place match" })
        ).toBeTruthy();
        // A line from each match to the one its winner plays next
        const lines = document.querySelectorAll("[data-connector]");
        expect(
            Array.from(lines).map((l) => l.getAttribute("data-connector"))
        ).toEqual([
            "1-5",
            "2-6",
            "3-7",
            "4-8",
            "5-9",
            "6-9",
            "7-10",
            "8-10",
            "9-12",
            "10-12",
        ]);
    });

    it("names the match an empty slot waits for", () => {
        renderBracket(buildView(12));
        const qf2 = screen.getByRole("article", { name: "Quarterfinal 2" });
        expect(qf2.textContent).toContain("Competitor 4");
        expect(qf2.textContent).toContain("Winner of Stage of 12 2");
        const final = screen.getByRole("article", { name: "Final" });
        expect(final.textContent).toContain("Winner of SF 1");
        expect(final.textContent).toContain("Winner of SF 2");
    });

    it("shows the winner bold and the loser greyed, with the set's points under", () => {
        renderBracket(playedView());
        const semi = screen.getByRole("article", { name: "Semifinal 1" });
        const [winner, loser] = semi.querySelectorAll("[data-result]");
        expect(winner.getAttribute("data-result")).toBe("winner");
        expect(winner.className).toContain("font-bold");
        expect(winner.textContent).toContain("Competitor 1");
        expect(loser.getAttribute("data-result")).toBe("loser");
        expect(loser.className).toContain("text-muted-foreground");
        expect(semi.textContent).toContain("3–1");
    });

    it("highlights the match being played", () => {
        renderBracket(playedView());
        const playing = screen.getByRole("article", { name: "Semifinal 2" });
        expect(playing.getAttribute("aria-current")).toBe("true");
        expect(playing.className).toContain("ring-primary");
        expect(within(playing).getByText("Playing")).toBeTruthy();
        const done = screen.getByRole("article", { name: "Semifinal 1" });
        expect(done.getAttribute("aria-current")).toBeNull();
    });

    it("says a walkover in plain words, with no score", () => {
        renderBracket(
            withMatch(buildView(4), 2, {
                status: "FINISHED",
                winnerSide: "A",
                endedBy: "WALKOVER",
            })
        );
        const semi = screen.getByRole("article", { name: "Semifinal 2" });
        expect(semi.textContent).toContain("Walkover: Competitor 3 withdrew");
        // Seed and name only: no sets were played
        expect(
            Array.from(semi.querySelectorAll("[data-result]")).map(
                (row) => row.textContent
            )
        ).toEqual(["2Competitor 2", "3Competitor 3"]);
    });

    it("opens a card to show every point's times", async () => {
        renderBracket(playedView());
        await userEvent.click(
            within(
                screen.getByRole("article", { name: "Semifinal 1" })
            ).getByRole("button")
        );
        const dialog = screen.getByRole("dialog");
        const firstSet = within(dialog).getByRole("region", { name: "Set 1" });
        expect(firstSet.textContent).toContain(
            "Set 1 · 3–1 · Competitor 1 won"
        );
        const rows = within(firstSet).getAllByRole("row").slice(1);
        expect(rows.map((row) => row.textContent)).toEqual([
            "19.1210.34",
            "211.0010.01",
            "39.509.90",
            "48.9912.00",
        ]);
        expect(
            within(dialog)
                .getByRole("link", { name: "Open scoreboard" })
                .getAttribute("href")
        ).toBe("/public/h2h/333oh-r2/match/1");
    });
});
