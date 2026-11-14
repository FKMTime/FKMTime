import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Table, TableBody } from "@/Components/ui/table";
import {
    Device,
    DeviceType,
    HardwareVersion,
    StationSignal,
} from "@/lib/interfaces";
import { ConfirmProvider } from "@/providers/ConfirmProvider";

import DeviceItem from "./DeviceItem";

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: [] }),
}));

const signal: StationSignal = {
    level: "weak",
    rssi: -66,
    link: null,
    reportedRssi: true,
};

describe("DeviceItem signal", () => {
    const device = (overrides: Partial<Device>): Device => ({
        id: "device-1",
        name: "Station Example",
        espId: 0x5a5a,
        roomId: "room-1",
        type: DeviceType.STATION,
        hwVersion: HardwareVersion.V4,
        createdAt: new Date(),
        updatedAt: new Date(),
        signal,
        ...overrides,
    });

    const renderItem = (value: Device, variant: "row" | "card") =>
        render(
            <ConfirmProvider>
                {variant === "row" ? (
                    <Table>
                        <TableBody>
                            <DeviceItem
                                device={value}
                                fetchData={() => {}}
                                variant="row"
                            />
                        </TableBody>
                    </Table>
                ) : (
                    <DeviceItem
                        device={value}
                        fetchData={() => {}}
                        variant="card"
                    />
                )}
            </ConfirmProvider>
        );

    it.each(["row", "card"] as const)(
        "shows a station's signal in the %s view",
        (variant) => {
            renderItem(device({}), variant);

            expect(
                screen.getByRole("button", { name: /^Weak signal/ })
            ).toBeTruthy();
        }
    );

    it("shows no signal for an attendance device", () => {
        const { container } = renderItem(
            device({
                type: DeviceType.ATTENDANCE_RUNNER,
                signal: undefined,
            }),
            "card"
        );

        expect(
            within(container).queryByRole("button", {
                name: /signal|firmware|waiting/i,
            })
        ).toBeNull();
    });
});
