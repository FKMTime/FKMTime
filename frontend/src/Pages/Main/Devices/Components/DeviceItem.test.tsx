import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

const permissions = vi.hoisted(() => ({ admin: false, delegate: false }));
vi.mock("@/lib/permissions", () => ({
    isAdmin: () => permissions.admin,
    isDelegate: () => permissions.delegate,
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
            <MemoryRouter>
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
            </MemoryRouter>
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

    it.each(["row", "card"] as const)(
        "shows a station's last error in the %s view (SPEC-010)",
        (variant) => {
            renderItem(
                device({
                    lastError: {
                        key: "noGroups",
                        kind: "problem",
                        message: "There are no active rounds at the moment",
                        at: new Date().toISOString(),
                        count: 1,
                        cardId: null,
                        competitorName: null,
                    },
                }),
                variant
            );

            expect(
                screen.getByRole("button", {
                    name: "There are no active rounds at the moment",
                })
            ).toBeTruthy();
        }
    );

    describe("tutorial mode (SPEC-012)", () => {
        const inMinutes = (minutes: number) =>
            new Date(Date.now() + minutes * 60_000).toISOString();
        const menuItems = async (value: Device) => {
            renderItem(value, "card");
            await userEvent.click(
                screen.getByRole("button", {
                    name: "More actions for Station Example",
                })
            );
            const items = await screen.findAllByRole("menuitem");
            return items.map((item) => item.textContent);
        };

        it.each(["row", "card"] as const)(
            "marks a station in tutorial mode in the %s view",
            (variant) => {
                renderItem(device({ tutorialEndsAt: inMinutes(10) }), variant);

                expect(
                    screen.getByRole("button", { name: "Tutorial" })
                ).toBeTruthy();
            }
        );

        it("drops the mark once the tutorial has ended", () => {
            renderItem(device({ tutorialEndsAt: inMinutes(-1) }), "card");

            expect(
                screen.queryByRole("button", { name: "Tutorial" })
            ).toBeNull();
        });

        it("lets delegates start and end it", async () => {
            permissions.delegate = true;

            expect(await menuItems(device({}))).toContain("Start tutorial");
            permissions.delegate = false;
        });

        it("offers to end a running one", async () => {
            permissions.delegate = true;

            const items = await menuItems(
                device({ tutorialEndsAt: inMinutes(10) })
            );
            permissions.delegate = false;

            expect(items).toContain("End tutorial");
            expect(items).not.toContain("Start tutorial");
        });
    });

    it.each(["row", "card"] as const)(
        "links the solve count to the device's solves in the %s view",
        (variant) => {
            renderItem(device({ count: 12 }), variant);

            expect(
                screen
                    .getByRole("link", {
                        name: "12 solves on Station Example",
                    })
                    .getAttribute("href")
            ).toBe("/devices/device-1/solves");
        }
    );

    describe("View logs", () => {
        const menuItems = async (value: Device) => {
            renderItem(value, "card");
            await userEvent.click(
                screen.getByRole("button", {
                    name: "More actions for Station Example",
                })
            );
            const items = await screen.findAllByRole("menuitem");
            return items.map((item) => item.textContent);
        };

        it("is offered to admins", async () => {
            permissions.admin = true;

            expect(await menuItems(device({}))).toContain("View logs");
        });

        it("is hidden from everyone else", async () => {
            permissions.admin = false;

            expect(await menuItems(device({}))).not.toContain("View logs");
        });

        it("is hidden for a device without an esp id", async () => {
            permissions.admin = true;

            expect(
                await menuItems(device({ espId: null as unknown as number }))
            ).not.toContain("View logs");
        });
    });
});
