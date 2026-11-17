import { act, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import ServerLogs from "./ServerLogs";

const fake = vi.hoisted(() => ({
    handlers: new Map<string, Set<(payload: unknown) => void>>(),
    emitted: [] as [string, unknown][],
    admin: true,
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

vi.mock("@/lib/permissions", () => ({ isAdmin: () => fake.admin }));

const fire = (event: string, payload: unknown) =>
    act(() => fake.handlers.get(event)?.forEach((handler) => handler(payload)));

const renderPage = (path = "/logs") =>
    renderWithQueryClient(
        <MemoryRouter initialEntries={[path]}>
            <ServerLogs />
        </MemoryRouter>
    );

describe("ServerLogs", () => {
    beforeEach(() => {
        clearQueryCache();
        fake.handlers.clear();
        fake.emitted.length = 0;
        fake.admin = true;
    });

    it("is not found for anyone but an admin, and joins nothing", () => {
        fake.admin = false;
        renderPage();

        expect(screen.getByText("Page not found")).toBeTruthy();
        expect(fake.emitted).toEqual([]);
    });

    it("opens the backend log by default and shows its lines", () => {
        renderPage();
        expect(fake.emitted).toContainEqual([
            "joinServerLogs",
            { source: "backend" },
        ]);

        fire("serverLogSnapshot", {
            source: "backend",
            available: true,
            lines: ["first line"],
            truncated: false,
        });
        fire("serverLogLines", {
            source: "backend",
            lines: ["second line"],
            skipped: 0,
        });
        fire("serverLogLines", {
            source: "unix",
            lines: ["not this log"],
            skipped: 0,
        });

        const log = screen.getByRole("log", { name: "Backend log" });
        expect(log.textContent).toContain("first line");
        expect(log.textContent).toContain("second line");
        expect(log.textContent).not.toContain("not this log");
    });

    it("opens the tab named in the address", () => {
        renderPage("/logs?tab=unix");

        expect(fake.emitted).toContainEqual([
            "joinServerLogs",
            { source: "unix" },
        ]);
    });

    it("says when the log isn't available on this server", () => {
        renderPage();
        fire("serverLogSnapshot", {
            source: "backend",
            available: false,
            lines: [],
            truncated: false,
        });

        expect(
            screen.getByText("This log isn't available on this server.")
        ).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    });

    it("says when nothing was logged yet", () => {
        renderPage();
        fire("serverLogSnapshot", {
            source: "backend",
            available: true,
            lines: [],
            truncated: false,
        });

        expect(screen.getByText("Nothing logged yet.")).toBeTruthy();
    });

    it("tells an admin to update a connector that writes no log", () => {
        renderPage("/logs?tab=connector");
        fire("serverLogSnapshot", {
            source: "connector",
            available: true,
            lines: [],
            truncated: false,
        });

        expect(screen.getByText(/update the connector/)).toBeTruthy();
    });
});
