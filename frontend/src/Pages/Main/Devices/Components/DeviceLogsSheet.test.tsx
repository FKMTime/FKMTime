import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Device, DeviceType, HardwareVersion } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import DeviceLogsSheet from "./DeviceLogsSheet";

const fake = vi.hoisted(() => ({
    handlers: new Map<string, Set<(payload: unknown) => void>>(),
    emitted: [] as [string, unknown][],
    toast: vi.fn(),
    download: vi.fn(),
}));

vi.mock("@/socket", () => ({
    socket: {
        connected: true,
        on: (event: string, handler: (payload: unknown) => void) => {
            const set = fake.handlers.get(event) ?? new Set();
            set.add(handler);
            fake.handlers.set(event, set);
        },
        off: (event: string, handler: (payload: unknown) => void) =>
            fake.handlers.get(event)?.delete(handler),
        emit: (event: string, payload: unknown) =>
            fake.emitted.push([event, payload]),
    },
}));

vi.mock("@/hooks/useToast", () => ({
    useToast: () => ({ toast: fake.toast }),
}));

vi.mock("@/lib/deviceLogs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/deviceLogs")>()),
    downloadDeviceLogs: fake.download,
}));

const fire = (event: string, payload: unknown) =>
    act(() => fake.handlers.get(event)?.forEach((handler) => handler(payload)));

const device: Device = {
    id: "device-1",
    name: "Station Example",
    espId: 0x5a5a,
    roomId: "room-1",
    type: DeviceType.STATION,
    hwVersion: HardwareVersion.V4,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const snapshot = (overrides: Record<string, unknown> = {}) => ({
    deviceId: device.id,
    available: true,
    lines: ["first line", "second line"],
    truncated: false,
    ...overrides,
});

const renderSheet = () =>
    renderWithQueryClient(
        <DeviceLogsSheet device={device} isOpen onClose={() => {}} />
    );

describe("DeviceLogsSheet", () => {
    beforeEach(() => {
        clearQueryCache();
        fake.handlers.clear();
        fake.emitted.length = 0;
        fake.toast.mockReset();
        fake.download.mockReset();
    });

    afterEach(() => vi.restoreAllMocks());

    it("joins the device's log room while open", () => {
        renderSheet();

        expect(fake.emitted).toContainEqual([
            "joinDeviceLogs",
            { deviceId: device.id },
        ]);
    });

    it("shows the snapshot, then new lines", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());
        fire("deviceLogLines", {
            deviceId: device.id,
            lines: ["third line"],
            skipped: 0,
        });

        const log = screen.getByRole("log");
        expect(log.textContent).toContain("first line");
        expect(log.textContent).toContain("third line");
    });

    it("ignores events for other devices", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());
        fire("deviceLogLines", {
            deviceId: "other",
            lines: ["not mine"],
            skipped: 0,
        });

        expect(screen.getByRole("log").textContent).not.toContain("not mine");
    });

    it("says when the server can't see the logs, without a download", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot({ available: false, lines: [] }));

        expect(
            screen.getByText(/Device logs aren't available on this server/)
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    });

    it("says when the station has no logs yet", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot({ lines: [] }));

        expect(screen.getByText("No logs from this station yet.")).toBeTruthy();
    });

    it("points to the download when older lines aren't shown", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot({ truncated: true }));

        expect(screen.getByText(/Older lines aren't shown/)).toBeTruthy();
    });

    it("shows how many lines were skipped", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());
        fire("deviceLogLines", {
            deviceId: device.id,
            lines: ["late"],
            skipped: 12,
        });

        expect(screen.getByText("… 12 lines skipped")).toBeTruthy();
    });

    it("filters lines by text", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());

        fireEvent.change(screen.getByLabelText("Filter lines"), {
            target: { value: "SECOND" },
        });

        const log = screen.getByRole("log");
        expect(log.textContent).toContain("second line");
        expect(log.textContent).not.toContain("first line");
    });

    it("colours levels and renders markup as text", () => {
        renderSheet();
        fire(
            "deviceLogSnapshot",
            snapshot({ lines: ["\u001b[31mE <b>bad</b>\u001b[0m"] })
        );

        const coloured = screen.getByText("E <b>bad</b>");
        expect(coloured.className).toContain("text-destructive");
        expect(screen.getByRole("log").querySelector("b")).toBeNull();
    });

    it("stops following when scrolled up, and jumps back to the latest", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());
        const log = screen.getByRole("log");
        Object.defineProperty(log, "scrollHeight", {
            configurable: true,
            value: 1000,
        });
        Object.defineProperty(log, "clientHeight", {
            configurable: true,
            value: 200,
        });

        log.scrollTop = 100;
        fireEvent.scroll(log);
        expect(
            screen.getByRole("button", { name: /Jump to latest/ })
        ).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Jump to latest/ }));

        expect(log.scrollTop).toBe(1000);
        expect(
            screen.queryByRole("button", { name: /Jump to latest/ })
        ).toBeNull();
    });

    it("keeps following new lines while at the bottom", () => {
        renderSheet();
        fire("deviceLogSnapshot", snapshot());
        const log = screen.getByRole("log");
        Object.defineProperty(log, "scrollHeight", {
            configurable: true,
            value: 1500,
        });

        fire("deviceLogLines", {
            deviceId: device.id,
            lines: ["more"],
            skipped: 0,
        });

        expect(log.scrollTop).toBe(1500);
    });

    it("downloads the file", async () => {
        fake.download.mockResolvedValue(200);
        renderSheet();
        fire("deviceLogSnapshot", snapshot());

        await act(async () =>
            fireEvent.click(screen.getByRole("button", { name: /Download/ }))
        );

        expect(fake.download).toHaveBeenCalledWith(device.id, device.name);
        expect(fake.toast).not.toHaveBeenCalled();
    });

    it("shows an error when there is nothing to download", async () => {
        fake.download.mockResolvedValue(404);
        renderSheet();
        fire("deviceLogSnapshot", snapshot());

        await act(async () =>
            fireEvent.click(screen.getByRole("button", { name: /Download/ }))
        );

        expect(fake.toast).toHaveBeenCalledWith(
            expect.objectContaining({
                description: "No logs from this station yet",
                variant: "destructive",
            })
        );
    });
});
