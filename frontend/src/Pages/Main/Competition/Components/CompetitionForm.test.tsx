import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { refreshScoretakingSoftware } from "@/lib/competition";
import { Competition, SendingResultsFrequency } from "@/lib/interfaces";

import CompetitionForm from "./CompetitionForm";

vi.mock("@/lib/competition", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/competition")>()),
    refreshScoretakingSoftware: vi.fn(),
}));
// Only the language list is loaded here
vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: (query: { key: string }) => ({
        data: query.key.includes("available-locales")
            ? [
                  { locale: "en", localeName: "English" },
                  { locale: "pl", localeName: "Polski" },
              ]
            : undefined,
    }),
}));

const competition = {
    id: "c1",
    wcaId: "ExampleOpen2026",
    scoretakingToken: "token",
    cubingContestsToken: "cc-token",
    sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
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
} as Competition;

const allSaved = { competition: true, devices: true };
const savesAll = () => vi.fn(() => Promise.resolve(allSaved));

const card = (name: string) => screen.getByRole("region", { name });

describe("CompetitionForm", () => {
    it("shows Save only once something changed, and hides it after saving", async () => {
        const handleSubmit = savesAll();
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
            expect.objectContaining({ shouldChangeGroupsAutomatically: true }),
            { competition: true, devices: false }
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
                handleSubmit={savesAll()}
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
                handleSubmit={savesAll()}
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
                handleSubmit={savesAll()}
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
                handleSubmit={savesAll()}
            />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Check again" })
        );

        expect(refreshScoretakingSoftware).toHaveBeenCalled();
    });
    it("groups the settings into cards", () => {
        render(
            <CompetitionForm
                competition={{
                    ...competition,
                    wcaScoretakingSoftware: "wca_live",
                    officialResultsDestination: "WCA_LIVE",
                }}
                handleSubmit={savesAll()}
            />
        );

        for (const title of [
            "Results",
            "Network",
            "Competition day",
            "Devices",
            "Advanced",
        ]) {
            expect(screen.getByRole("heading", { name: title })).toBeTruthy();
        }
        // Integrated Live only: nothing to manage for WCA Live
        expect(
            screen.queryByRole("region", { name: "Scoretakers" })
        ).toBeNull();
        expect(
            within(card("Results")).getByPlaceholderText("Scoretaking token")
        ).toBeTruthy();
        expect(
            within(card("Results")).getByRole("combobox", {
                name: "When to send results",
            })
        ).toBeTruthy();
        expect(
            within(card("Competition day")).getByRole("switch", {
                name: /Change groups automatically/,
            })
        ).toBeTruthy();
        for (const name of [
            /Use FKMTime devices/,
            /Update devices/,
            /Enable sound/,
            /Secure RFID/,
        ]) {
            expect(
                within(card("Devices")).getByRole("switch", { name })
            ).toBeTruthy();
        }
        expect(
            within(card("Devices")).getByRole("slider", {
                name: /Device volume/,
            })
        ).toBeTruthy();
        expect(
            within(card("Devices")).getByRole("combobox", {
                name: "Default language",
            })
        ).toBeTruthy();
        expect(
            within(card("Network")).getByLabelText("WiFi SSID")
        ).toBeTruthy();
        expect(
            within(card("Network")).getByRole("switch", {
                name: /Auto server discovery/,
            })
        ).toBeTruthy();
        // HIL testing waits in the closed Advanced card
        const advanced = card("Advanced");
        expect(advanced.querySelector("details")?.open).toBe(false);
        expect(
            within(advanced).getByRole("switch", {
                name: /HIL Testing/,
                hidden: true,
            })
        ).toBeTruthy();
    });

    it("keeps only the Devices card while FKMTime devices are off", () => {
        render(
            <CompetitionForm
                competition={{ ...competition, useFkmTimeDevices: false }}
                handleSubmit={savesAll()}
            />
        );

        expect(
            within(card("Devices")).getByRole("switch", {
                name: /Use FKMTime devices/,
            })
        ).toBeTruthy();
        expect(
            within(card("Devices")).queryByRole("switch", {
                name: /Update devices/,
            })
        ).toBeNull();
        for (const name of [
            "Results",
            "Network",
            "Competition day",
            "Advanced",
        ]) {
            expect(screen.queryByRole("region", { name })).toBeNull();
        }
    });

    it("saves the values of every card with one Save", async () => {
        const handleSubmit = savesAll();
        render(
            <CompetitionForm
                competition={{
                    ...competition,
                    wcaScoretakingSoftware: "wca_live",
                    officialResultsDestination: "WCA_LIVE",
                }}
                handleSubmit={handleSubmit}
            />
        );

        const token = within(card("Results")).getByPlaceholderText(
            "Scoretaking token"
        );
        await userEvent.clear(token);
        await userEvent.type(token, "new-token");
        await userEvent.click(
            within(card("Competition day")).getByRole("switch", {
                name: /Change groups automatically/,
            })
        );
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                scoretakingToken: "new-token",
                cubingContestsToken: "cc-token",
                sendingResultsFrequency: SendingResultsFrequency.AFTER_SOLVE,
                shouldChangeGroupsAutomatically: true,
                useFkmTimeDevices: true,
                openRoundsAutomatically: false,
                wifiSsid: "Venue WiFi",
                wifiPassword: "venue-password",
                secureRfid: false,
                buzzerVolume: 5,
            }),
            { competition: true, devices: false }
        );
    });

    it("marks only the device part as changed after a device edit", async () => {
        const handleSubmit = savesAll();
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={handleSubmit}
            />
        );

        const ssid = within(card("Network")).getByLabelText("WiFi SSID");
        await userEvent.clear(ssid);
        await userEvent.type(ssid, "Hall B");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ wifiSsid: "Hall B" }),
            { competition: false, devices: true }
        );
    });

    it("marks both parts as changed after edits in both", async () => {
        const handleSubmit = savesAll();
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={handleSubmit}
            />
        );

        await userEvent.click(
            screen.getByRole("switch", { name: /Secure RFID/ })
        );
        await userEvent.click(
            screen.getByRole("switch", { name: /Change groups automatically/ })
        );
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                secureRfid: true,
                shouldChangeGroupsAutomatically: true,
            }),
            { competition: true, devices: true }
        );
    });

    it("keeps the part that failed to save as unsaved changes", async () => {
        const handleSubmit = vi
            .fn()
            .mockResolvedValueOnce({ competition: true, devices: false })
            .mockResolvedValueOnce(allSaved);
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={handleSubmit}
            />
        );

        await userEvent.click(
            screen.getByRole("switch", { name: /Secure RFID/ })
        );
        await userEvent.click(
            screen.getByRole("switch", { name: /Change groups automatically/ })
        );
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(
            screen.getByRole("region", { name: "Unsaved changes" })
        ).toBeTruthy();
        expect(
            screen
                .getByRole("switch", { name: /Secure RFID/ })
                .getAttribute("aria-checked")
        ).toBe("true");

        // The retry sends only the device part again
        await userEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(handleSubmit).toHaveBeenLastCalledWith(
            expect.objectContaining({
                secureRfid: true,
                shouldChangeGroupsAutomatically: true,
            }),
            { competition: false, devices: true }
        );
        await waitFor(() =>
            expect(
                screen.queryByRole("region", { name: "Unsaved changes" })
            ).toBeNull()
        );
    });

    it("hides the WiFi password until shown, and keeps it from autofill", async () => {
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={savesAll()}
            />
        );

        const password = within(card("Network")).getByLabelText(
            "WiFi password"
        );
        expect(password.getAttribute("type")).toBe("password");
        expect(password.getAttribute("autocomplete")).toBe("new-password");
        expect(
            within(card("Network"))
                .getByLabelText("WiFi SSID")
                .getAttribute("autocomplete")
        ).toBe("off");

        await userEvent.click(
            screen.getByRole("button", { name: "Show WiFi password" })
        );
        expect(password.getAttribute("type")).toBe("text");
        await userEvent.click(
            screen.getByRole("button", { name: "Hide WiFi password" })
        );
        expect(password.getAttribute("type")).toBe("password");
    });

    it("asks for the server URL only without auto discovery", async () => {
        render(
            <CompetitionForm
                competition={competition}
                handleSubmit={savesAll()}
            />
        );

        expect(screen.queryByLabelText("micro-connector ws URL")).toBeNull();
        await userEvent.click(
            screen.getByRole("switch", { name: /Auto server discovery/ })
        );
        expect(screen.getByLabelText("micro-connector ws URL")).toBeTruthy();
    });
});
