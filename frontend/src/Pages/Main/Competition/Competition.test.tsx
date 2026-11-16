import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    updateCompetitionSettings,
    updateDevicesSettings,
} from "@/lib/competition";
import { Competition as CompetitionData } from "@/lib/interfaces";

import Competition from "./Competition";

const toast = vi.hoisted(() => vi.fn());
const refetch = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/Pages/Main/Setup/SetupTabs", () => ({ default: () => null }));
vi.mock("@/lib/competition", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/competition")>()),
    updateCompetitionSettings: vi.fn(),
    updateDevicesSettings: vi.fn(),
}));

const competition = {
    id: "c1",
    name: "Example Open 2026",
    wcaId: "ExampleOpen2026",
    wcaScoretakingSoftware: "wca_live",
    officialResultsDestination: "WCA_LIVE",
    scoretakingToken: "token",
    scoretakingTokenUpdatedAt: new Date().toISOString(),
    cubingContestsToken: "",
    sendingResultsFrequency: "AFTER_SOLVE",
    shouldChangeGroupsAutomatically: false,
    useFkmTimeDevices: true,
    openRoundsAutomatically: false,
    shouldUpdateDevices: true,
    mdns: true,
    wsUrl: "",
    wifiSsid: "Venue WiFi",
    wifiPassword: "venue-password",
    defaultLocale: "en",
    hilTesting: false,
    secureRfid: false,
    soundEnabled: true,
    buzzerVolume: 5,
} as unknown as CompetitionData;

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: (query: { key: string }) =>
        query.key === "competition/settings"
            ? { data: competition, version: 1, error: null, refetch }
            : { data: [{ locale: "en", localeName: "English" }] },
}));

const renderPage = () =>
    render(
        <MemoryRouter>
            <Competition />
        </MemoryRouter>
    );

const editCompetitionField = () =>
    userEvent.click(
        screen.getByRole("switch", { name: /Change groups automatically/ })
    );
const editDeviceField = () =>
    userEvent.click(screen.getByRole("switch", { name: /Secure RFID/ }));
const save = () =>
    userEvent.click(screen.getByRole("button", { name: "Save" }));

describe("Competition settings save", () => {
    beforeEach(() => {
        toast.mockReset();
        refetch.mockReset();
        vi.mocked(updateCompetitionSettings).mockReset().mockResolvedValue(200);
        vi.mocked(updateDevicesSettings).mockReset().mockResolvedValue(200);
    });

    it("sends only the device settings after a device edit", async () => {
        renderPage();
        await editDeviceField();
        await save();

        await waitFor(() => expect(updateDevicesSettings).toHaveBeenCalled());
        expect(updateDevicesSettings).toHaveBeenCalledWith(
            "c1",
            expect.objectContaining({ secureRfid: true })
        );
        expect(updateCompetitionSettings).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith({
            title: "Settings saved",
            variant: "success",
        });
    });

    it("sends only the competition settings after a competition edit", async () => {
        renderPage();
        await editCompetitionField();
        await save();

        await waitFor(() =>
            expect(updateCompetitionSettings).toHaveBeenCalledWith(
                "c1",
                expect.objectContaining({
                    shouldChangeGroupsAutomatically: true,
                })
            )
        );
        expect(updateDevicesSettings).not.toHaveBeenCalled();
    });

    it("sends both after edits in both, with one toast", async () => {
        renderPage();
        await editCompetitionField();
        await editDeviceField();
        await save();

        await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
        expect(updateCompetitionSettings).toHaveBeenCalledTimes(1);
        expect(updateDevicesSettings).toHaveBeenCalledTimes(1);
        expect(toast).toHaveBeenCalledWith({
            title: "Settings saved",
            variant: "success",
        });
        // The device fields come back from the server too
        expect(refetch).toHaveBeenCalled();
    });

    it("says which part failed and keeps it unsaved", async () => {
        vi.mocked(updateDevicesSettings).mockResolvedValue(500);
        renderPage();
        await editCompetitionField();
        await editDeviceField();
        await save();

        await waitFor(() =>
            expect(toast).toHaveBeenCalledWith({
                title: "Error",
                description:
                    "Competition settings were saved, but the device settings could not be. Try again.",
                variant: "destructive",
            })
        );
        expect(
            screen.getByRole("region", { name: "Unsaved changes" })
        ).toBeTruthy();
    });
});
