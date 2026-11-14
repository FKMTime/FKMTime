import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import IntegratedLiveProblemsAlert from "./IntegratedLiveProblemsAlert";

const state = vi.hoisted(() => ({
    enabled: true,
    data: undefined as unknown,
}));

vi.mock("@/hooks/useIntegratedLiveRound", () => ({
    useIntegratedLiveEnabled: () => state.enabled,
}));
vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: state.data }),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

const renderAlert = () =>
    render(
        <MemoryRouter>
            <IntegratedLiveProblemsAlert />
        </MemoryRouter>
    );

describe("IntegratedLiveProblemsAlert", () => {
    it("lists each round with what isn't getting through, linking to it", () => {
        state.data = {
            stuck: [{ roundId: "333-r1", count: 2 }],
            refused: [
                { roundId: "333-r1", count: 1 },
                { roundId: "222-r1", count: 3 },
            ],
        };
        renderAlert();

        const items = screen.getAllByRole("listitem").map((i) => i.textContent);
        expect(items).toEqual([
            "333-r1: 2 results still sending after a few minutes, 1 result not taken",
            "222-r1: 3 results not taken",
        ]);
        expect(
            screen.getByRole("link", { name: "222-r1" }).getAttribute("href")
        ).toBe("/results/round/222-r1");
    });

    it("shows nothing when everything gets through", () => {
        state.data = { stuck: [], refused: [] };
        const { container } = renderAlert();
        expect(container.textContent).toBe("");
    });

    it("shows nothing unless results go to WCA Integrated Live Results", () => {
        state.enabled = false;
        state.data = { stuck: [{ roundId: "333-r1", count: 1 }], refused: [] };
        const { container } = renderAlert();
        expect(container.textContent).toBe("");
    });
});
