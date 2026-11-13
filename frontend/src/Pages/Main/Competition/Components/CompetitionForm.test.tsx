import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { refreshScoretakingSoftware } from "@/lib/competition";
import { Competition, SendingResultsFrequency } from "@/lib/interfaces";

import CompetitionForm from "./CompetitionForm";

vi.mock("@/lib/competition", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/competition")>()),
    refreshScoretakingSoftware: vi.fn(),
}));

const competition = {
    id: "c1",
    wcaId: "ExampleOpen2026",
    scoretakingToken: "token",
    sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
    shouldChangeGroupsAutomatically: false,
    useFkmTimeDevices: true,
} as Competition;

describe("CompetitionForm", () => {
    it("shows Save only once something changed, and hides it after saving", async () => {
        const handleSubmit = vi.fn(() => Promise.resolve(true));
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={handleSubmit}
            />
        );
        expect(
            screen.queryByRole("region", { name: "Unsaved changes" })
        ).toBeNull();

        await userEvent.click(
            screen.getByRole("switch", { name: /Change groups automatically/ })
        );
        expect(
            screen.getByRole("region", { name: "Unsaved changes" })
        ).toBeTruthy();

        await userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ shouldChangeGroupsAutomatically: true })
        );
        await waitFor(() =>
            expect(
                screen.queryByRole("region", { name: "Unsaved changes" })
            ).toBeNull()
        );
    });

    it("discards changes", async () => {
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={vi.fn(() => Promise.resolve(true))}
            />
        );
        const toggle = screen.getByRole("switch", {
            name: /Change groups automatically/,
        });
        await userEvent.click(toggle);
        await userEvent.click(screen.getByRole("button", { name: "Discard" }));
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        expect(
            screen.queryByRole("region", { name: "Unsaved changes" })
        ).toBeNull();
    });

    it("shows where official results go and the WCA Live token for wca_live", () => {
        render(
            <CompetitionForm
                competition={{
                    ...competition,
                    wcaScoretakingSoftware: "wca_live",
                    officialResultsDestination: "WCA_LIVE",
                }}
                handleSubmit={vi.fn(() => Promise.resolve(true))}
            />
        );

        expect(screen.getByText("WCA Live")).toBeTruthy();
        expect(screen.getByPlaceholderText("Scoretaking token")).toBeTruthy();
        expect(
            screen
                .getByRole("link", { name: /Change on the WCA website/ })
                .getAttribute("href")
        ).toMatch(/\/competitions\/ExampleOpen2026\/edit$/);
    });

    it("hides the WCA Live token when the WCA website names another tool", () => {
        render(
            <CompetitionForm
                competition={{
                    ...competition,
                    wcaScoretakingSoftware: "external",
                    officialResultsDestination: "NONE",
                }}
                handleSubmit={vi.fn(() => Promise.resolve(true))}
            />
        );

        expect(screen.getByText("Nowhere")).toBeTruthy();
        expect(screen.queryByPlaceholderText("Scoretaking token")).toBeNull();
    });

    it("checks the WCA setting again on request", async () => {
        vi.mocked(refreshScoretakingSoftware).mockResolvedValue({
            status: 200,
            data: {
                wcaScoretakingSoftware: "wca_live",
                wcaScoretakingCheckedAt: "2026-11-13T10:00:00Z",
                officialResultsDestination: "WCA_LIVE",
            },
        });
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={vi.fn(() => Promise.resolve(true))}
            />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Check again" })
        );

        expect(refreshScoretakingSoftware).toHaveBeenCalled();
    });
});
