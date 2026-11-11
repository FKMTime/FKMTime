import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Competition, SendingResultsFrequency } from "@/lib/interfaces";

import CompetitionForm from "./CompetitionForm";

const competition = {
    id: "c1",
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
});
