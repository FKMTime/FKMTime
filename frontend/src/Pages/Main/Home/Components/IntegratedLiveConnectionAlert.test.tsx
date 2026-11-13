import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Competition } from "@/lib/interfaces";

import IntegratedLiveConnectionAlert from "./IntegratedLiveConnectionAlert";

const renderAlert = (competition: Partial<Competition>) =>
    render(
        <MemoryRouter>
            <IntegratedLiveConnectionAlert
                competition={competition as Competition}
            />
        </MemoryRouter>
    );

describe("IntegratedLiveConnectionAlert", () => {
    it("asks to connect when results go to WCA live results and nobody has", () => {
        renderAlert({
            officialResultsDestination: "WCA_INTEGRATED_LIVE",
            integratedLiveConnection: "NOT_CONNECTED",
        });

        expect(
            screen.getByText("Not connected to WCA live results")
        ).toBeTruthy();
        expect(
            screen.getByRole("link", { name: /Connect in settings/ })
        ).toBeTruthy();
    });

    it("asks to reconnect a broken connection", () => {
        renderAlert({
            officialResultsDestination: "WCA_INTEGRATED_LIVE",
            integratedLiveConnection: "BROKEN",
        });

        expect(screen.getByText("WCA live results disconnected")).toBeTruthy();
    });

    it.each([
        ["WCA_INTEGRATED_LIVE", "CONNECTED"],
        ["WCA_LIVE", "NOT_CONNECTED"],
        ["NONE", "NOT_CONNECTED"],
    ] as const)(
        "stays hidden for destination %s with connection %s",
        (officialResultsDestination, integratedLiveConnection) => {
            const { container } = renderAlert({
                officialResultsDestination,
                integratedLiveConnection,
            });

            expect(container.textContent).toBe("");
        }
    );
});
