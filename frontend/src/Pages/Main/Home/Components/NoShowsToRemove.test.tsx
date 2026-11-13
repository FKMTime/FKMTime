import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import NoShowsToRemove from "./NoShowsToRemove";

const fetchNoShows = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    integratedLiveNoShowsQuery: {
        key: "competition/integrated-live/rounds/no-shows",
        fetch: fetchNoShows,
    },
    removeNoShows: remove,
    invalidateIntegratedLiveRounds: vi.fn(),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

describe("NoShowsToRemove", () => {
    beforeEach(() => {
        clearQueryCache();
        fetchNoShows.mockReset();
        remove.mockReset();
    });

    it("removes the ticked competitors, leaving out anyone unticked", async () => {
        fetchNoShows.mockResolvedValue([
            {
                roundId: "333-r1",
                competitors: [
                    {
                        personId: "a",
                        name: "Absent Example",
                        registrationId: 201,
                    },
                    {
                        personId: "b",
                        name: "Late Example",
                        registrationId: 202,
                    },
                ],
            },
        ]);
        remove.mockResolvedValue({ ok: true, message: "1 removed" });
        renderWithQueryClient(<NoShowsToRemove />);

        expect(
            await screen.findByText("2 competitors didn't come to 333-r1")
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("checkbox", { name: "Late Example" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: /Remove from 333-r1/ })
        );

        expect(remove).toHaveBeenCalledWith("333-r1", [201]);
    });
});
