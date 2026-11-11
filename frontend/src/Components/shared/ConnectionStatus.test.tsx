import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConnectionStatus from "./ConnectionStatus";

const handlers = new Map<string, () => void>();
const fakeSocket = vi.hoisted(() => ({ connected: false }));

vi.mock("@/socket", () => ({
    socket: {
        get connected() {
            return fakeSocket.connected;
        },
        on: (event: string, handler: () => void) =>
            handlers.set(event, handler),
        off: (event: string) => handlers.delete(event),
    },
}));

const emit = (event: "connect" | "disconnect") =>
    act(() => {
        fakeSocket.connected = event === "connect";
        handlers.get(event)?.();
    });

describe("ConnectionStatus", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        fakeSocket.connected = false;
    });
    afterEach(() => vi.useRealTimers());

    it("stays hidden while the first connect is in progress", () => {
        render(<ConnectionStatus />);
        expect(screen.queryByRole("status")).toBeNull();
        emit("connect");
        act(() => vi.advanceTimersByTime(5000));
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows Reconnecting while the connection is down", () => {
        render(<ConnectionStatus />);
        emit("connect");
        emit("disconnect");
        expect(screen.getByRole("status").textContent).toBe("Reconnecting…");
        emit("connect");
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows it when the socket never connects", () => {
        render(<ConnectionStatus />);
        act(() => vi.advanceTimersByTime(3000));
        expect(screen.getByRole("status")).toBeTruthy();
    });
});
