import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache, QueryError } from "@/lib/queryCache";
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
});
