import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WCACompetition } from "@/lib/interfaces";

import CompetitionsList from "./CompetitionsList";

const competition = (id: string, name: string): WCACompetition => ({
    id,
    name,
    url: "",
    country_iso2: "PL",
    registration_open: "",
    start_date: "2026-04-18",
    end_date: "2026-04-19",
    city: "Sampletown",
});

const competitions = [
    competition("FirstOpen2026", "First Open 2026"),
    competition("SecondOpen2026", "Second Open 2026"),
];

describe("CompetitionsList", () => {
    it("shows dates and place under each name", () => {
        render(
            <CompetitionsList
                competitions={competitions}
                importingId={null}
                error={null}
                onImport={vi.fn()}
            />
        );
        expect(
            screen.getAllByText("18–19 Apr 2026 · Sampletown, Poland")
        ).toHaveLength(2);
    });

    it("disables every row while one imports", () => {
        render(
            <CompetitionsList
                competitions={competitions}
                importingId="FirstOpen2026"
                error={null}
                onImport={vi.fn()}
            />
        );
        const importing = screen.getByRole("button", { name: "Importing…" });
        const other = screen.getByRole("button", { name: "Import" });
        expect(importing.hasAttribute("disabled")).toBe(true);
        expect(other.hasAttribute("disabled")).toBe(true);
    });

    it("shows the error under the row that failed", () => {
        render(
            <CompetitionsList
                competitions={competitions}
                importingId={null}
                error={{
                    competitionId: "SecondOpen2026",
                    message: "Competition has already been imported",
                }}
                onImport={vi.fn()}
            />
        );
        const alert = screen.getByRole("alert");
        expect(alert.closest("li")?.textContent).toContain("Second Open 2026");
    });

    it("shows the empty state without competitions", () => {
        render(
            <CompetitionsList
                competitions={[]}
                importingId={null}
                error={null}
                onImport={vi.fn()}
            />
        );
        expect(
            screen.getByText("You have no upcoming competitions to manage")
        ).toBeTruthy();
    });
});
