import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompetitionStatistics } from "@/lib/interfaces";

import Charts from "./Charts";

const empty = {
    byEventStats: [{ eventId: "333", dnf: 0, incidents: 0, attempts: 0 }],
    byRoundStats: [
        {
            id: 1,
            date: "2026-04-18T00:00:00Z",
            roundsStatistics: [
                { roundId: "333-r1", roundName: "3x3 R1", delayInMinutes: 0 },
            ],
        },
    ],
    attemptsByDevice: [],
    suspiciousAverages: [],
    judgeRanking: [],
    scramblerRanking: [],
} as unknown as CompetitionStatistics;

describe("Charts", () => {
    it("shows a compact placeholder for charts without enough data", () => {
        render(<Charts statistics={empty} />);
        expect(screen.getAllByText("Not enough data yet")).toHaveLength(3);
        expect(screen.getByText("DNF and incidents rate")).toBeTruthy();
        expect(screen.getByText("Attempts by device")).toBeTruthy();
    });
});
