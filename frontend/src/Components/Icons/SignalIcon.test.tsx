import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { StationSignal } from "@/lib/interfaces";

import SignalIcon from "./SignalIcon";

const signal = (overrides: Partial<StationSignal> = {}): StationSignal => ({
    level: "ok",
    rssi: -58,
    link: null,
    reportedRssi: true,
    ...overrides,
});

const renderIcon = (value: StationSignal) => {
    render(<SignalIcon signal={value} />);
    const trigger = screen.getByRole("button");
    const iconName = trigger.querySelector("svg")?.getAttribute("class");
    return { trigger, iconName };
};

describe("SignalIcon", () => {
    it.each([
        ["ok, above -55 dBm", signal({ rssi: -48 }), "lucide-wifi ", ""],
        ["ok, the rest", signal({ rssi: -58 }), "lucide-wifi-high", ""],
        [
            "weak",
            signal({ level: "weak", rssi: -66 }),
            "lucide-wifi-low",
            "text-warning",
        ],
        [
            "unknown",
            signal({ level: "unknown", rssi: null }),
            "lucide-wifi-zero",
            "text-faint",
        ],
    ])("shows the icon and tone for %s", (_, value, icon, tone) => {
        const { trigger, iconName } = renderIcon(value);

        expect(`${iconName} `).toContain(icon);
        if (tone) expect(trigger.className).toContain(tone);
    });

    it("says what to do with a weak station, and its reading", () => {
        const { trigger } = renderIcon(signal({ level: "weak", rssi: -66 }));

        expect(trigger.getAttribute("aria-label")).toBe(
            "Weak signal — move closer to the router. −66 dBm (median of the last 5 readings)"
        );
    });

    it("tells waiting for a station from one that needs newer firmware", () => {
        render(
            <>
                <SignalIcon signal={signal({ level: "unknown", rssi: null })} />
                <SignalIcon
                    signal={signal({
                        level: "unknown",
                        rssi: null,
                        reportedRssi: false,
                    })}
                />
            </>
        );

        const [waiting, oldFirmware] = screen.getAllByRole("button");
        expect(waiting.getAttribute("aria-label")).toBe(
            "Waiting for the station"
        );
        expect(oldFirmware.getAttribute("aria-label")).toBe(
            "Needs newer station firmware"
        );
    });

    it("adds what the router reports only when there is a link", async () => {
        const { trigger } = renderIcon(
            signal({
                level: "weak",
                rssi: -66,
                link: {
                    apSignal: -68,
                    txBitrateKbps: 6000,
                    txRetriesPercent: 120,
                },
            })
        );
        const routerLine =
            "Router hears it at −68 dBm, sends at 6 Mbit/s, retries 120%";

        expect(trigger.getAttribute("aria-label")).toContain(routerLine);
        await userEvent.hover(trigger);
        const tooltip = await screen.findByRole("tooltip");
        expect(tooltip.textContent).toContain(routerLine);
        expect(tooltip.textContent).toContain(
            "Weak signal — move closer to the router"
        );
    });

    it("shows no router line, and no placeholder, without a link", async () => {
        const { trigger } = renderIcon(signal({ rssi: -58 }));

        expect(trigger.getAttribute("aria-label")).toBe(
            "Good signal. −58 dBm (median of the last 5 readings)"
        );
        await userEvent.hover(trigger);
        const tooltip = await screen.findByRole("tooltip");
        expect(tooltip.textContent).not.toMatch(/Router|unavailable/);
    });
});
