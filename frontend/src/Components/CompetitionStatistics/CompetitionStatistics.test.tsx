import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompetitionStatistics as ICompetitionStatistics } from "@/lib/interfaces";
import { clearQueryCache, QueryError, setQueryData } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { renderWithQueryClient } from "@/test/queryClient";

import CompetitionStatistics from "./CompetitionStatistics";

const fetchStatistics = vi.hoisted(() => vi.fn());

vi.mock("@/lib/competition", () => ({
    competitionStatisticsQuery: {
        key: "competition/statistics/",
        fetch: fetchStatistics,
    },
}));
vi.mock("@/hooks/useSocketRoom", () => ({ useSocketRoom: () => {} }));
// The charts need far more data than these tests are about
vi.mock("./Charts", () => ({ default: () => null }));

const statistics = {
    allAttempts: 120,
    attemptsEnteredManually: 3,
    extraAttemptsUsed: 2,
    scorecardsCount: 40,
    personsCompeted: 30,
    byRoundAttemptStats: [],
} as unknown as ICompetitionStatistics;

describe("CompetitionStatistics", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchStatistics.mockReset();
    });

    it("tells users without access instead of loading forever", async () => {
        fetchStatistics.mockRejectedValue(new QueryError(403));
        renderWithQueryClient(<CompetitionStatistics />);

        expect(
            await screen.findByText(
                "Only organizers and delegates can see statistics."
            )
        ).toBeTruthy();
    });

    it("offers a retry when loading fails for another reason", async () => {
        fetchStatistics.mockRejectedValue(new QueryError(500));
        renderWithQueryClient(<CompetitionStatistics />);

        expect(await screen.findByText(/Couldn't load this page/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });

    it("keeps the statistics on screen when a refresh fails", async () => {
        setQueryData("competition/statistics/", statistics);
        fetchStatistics.mockResolvedValueOnce(statistics);
        renderWithQueryClient(<CompetitionStatistics />);
        expect(await screen.findByText("120")).toBeTruthy();

        fetchStatistics.mockRejectedValueOnce(new QueryError(503));
        await queryClient
            .refetchQueries({ queryKey: ["competition/statistics/"] })
            .catch(() => {});

        expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
        expect(screen.getByText("120")).toBeTruthy();
    });
});
