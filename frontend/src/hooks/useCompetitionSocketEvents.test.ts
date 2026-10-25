import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompetitionSocketEvents } from "./useCompetitionSocketEvents";

type Listener = (data: unknown) => void;

const createSocket = () => {
    const listeners = new Map<string, Set<Listener>>();
    return {
        emit: vi.fn(),
        on: vi.fn((event: string, listener: Listener) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(listener);
        }),
        off: vi.fn((event: string, listener: Listener) => {
            listeners.get(event)?.delete(listener);
        }),
        /** Pretends the server sent an event */
        receive: (event: string, data: unknown) =>
            listeners.get(event)?.forEach((listener) => listener(data)),
        listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    };
};

describe("useCompetitionSocketEvents", () => {
    let socket: ReturnType<typeof createSocket>;
    const emitted = () => socket.emit.mock.calls.map(([event]) => event);
    const render = (initialUserId: string | undefined, initialCount = 1) =>
        renderHook(
            ({ userId, connectionCount }) =>
                useCompetitionSocketEvents(
                    socket as never,
                    userId,
                    connectionCount,
                    {
                        onNewIncident: vi.fn(),
                        onGroupShouldBeChanged: vi.fn(),
                    }
                ),
            {
                initialProps: {
                    userId: initialUserId,
                    connectionCount: initialCount,
                },
            }
        );

    beforeEach(() => {
        socket = createSocket();
    });

    it("joins the incidents and competition rooms", () => {
        render("user-1");
        expect(emitted()).toEqual(["joinIncidents", "joinCompetition"]);
    });

    it("does not leave and re-join the rooms when the shell re-renders", () => {
        const { rerender } = render("user-1");
        rerender({ userId: "user-1", connectionCount: 1 });
        rerender({ userId: "user-1", connectionCount: 1 });

        expect(emitted()).toEqual(["joinIncidents", "joinCompetition"]);
        expect(socket.listenerCount("newIncident")).toBe(1);
    });

    it("joins again after a reconnect without leaving first", () => {
        const { rerender } = render("user-1", 1);
        rerender({ userId: "user-1", connectionCount: 2 });

        expect(emitted()).toEqual([
            "joinIncidents",
            "joinCompetition",
            "joinIncidents",
            "joinCompetition",
        ]);
    });

    it("leaves the rooms and stops listening on unmount", () => {
        const { unmount } = render("user-1");
        unmount();

        expect(emitted().slice(-2)).toEqual([
            "leaveIncidents",
            "leaveCompetition",
        ]);
        expect(socket.listenerCount("newIncident")).toBe(0);
        expect(socket.listenerCount("groupShouldBeChanged")).toBe(0);
    });

    it("passes events to the latest handlers", () => {
        const first = vi.fn();
        const latest = vi.fn();
        const { rerender } = renderHook(
            ({ onNewIncident }) =>
                useCompetitionSocketEvents(socket as never, "user-1", 1, {
                    onNewIncident,
                    onGroupShouldBeChanged: vi.fn(),
                }),
            { initialProps: { onNewIncident: first } }
        );
        rerender({ onNewIncident: latest });

        const incident = { id: "a1", competitorName: "C", deviceName: "D" };
        socket.receive("newIncident", incident);

        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledWith(incident);
    });

    it("does nothing while signed out", () => {
        render(undefined);
        expect(socket.emit).not.toHaveBeenCalled();
        expect(socket.on).not.toHaveBeenCalled();
    });
});
