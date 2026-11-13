import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";

import GroupPlacement from "./GroupPlacement";

const place = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({ placeInGroup: place }));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
    getGroupsByRoundId: () => [
        { activityCode: "333-r2-g1" },
        { activityCode: "333-r2-g3" },
    ],
}));

describe("GroupPlacement", () => {
    it("puts the person in the suggested group with one click", async () => {
        place.mockResolvedValue({ ok: true, message: "Put in 333-r2-g3" });
        const store = createStore();
        store.set(competitionAtom, { wcif: {} } as Competition);
        render(
            <Provider store={store}>
                <GroupPlacement
                    roundId="333-r2"
                    personId="p-jan"
                    name="Jan Example"
                    suggestedGroupId="333-r2-g3"
                />
            </Provider>
        );

        await userEvent.click(
            screen.getByRole("button", {
                name: "Put Jan Example in this group",
            })
        );

        expect(place).toHaveBeenCalledWith("333-r2", "p-jan", "333-r2-g3");
        expect(
            await screen.findByText("Jan Example is in 333-r2-g3.")
        ).toBeTruthy();
    });
});
