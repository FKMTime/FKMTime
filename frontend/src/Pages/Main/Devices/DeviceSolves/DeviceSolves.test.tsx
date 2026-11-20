import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
    AttemptStatus,
    AttemptType,
    DeviceAttempts,
    DeviceType,
} from "@/lib/interfaces";

import DeviceSolves from "./DeviceSolves";

const query = vi.hoisted(() => ({
    data: undefined as DeviceAttempts | undefined,
}));
vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({
        data: query.data,
        isError: false,
        refetch: () => {},
    }),
}));
vi.mock("@/lib/permissions", () => ({ isDelegate: () => true }));

const attempt = (
    overrides: Partial<DeviceAttempts["attempts"][number]>
): DeviceAttempts["attempts"][number] => ({
    id: "attempt-1",
    resultId: "result-1",
    attemptNumber: 1,
    penalty: 0,
    value: 1234,
    status: AttemptStatus.STANDARD,
    type: AttemptType.STANDARD_ATTEMPT,
    solvedAt: new Date("2026-04-18T10:00:00Z"),
    createdAt: "2026-04-18T10:00:00Z",
    judge: { name: "Judge Example" } as never,
    result: {
        id: "result-1",
        roundId: "333-r1",
        person: { id: "person-1", name: "Competitor Example" },
    },
    ...overrides,
});

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={["/devices/device-1/solves"]}>
            <Routes>
                <Route path="/devices/:id/solves" element={<DeviceSolves />} />
            </Routes>
        </MemoryRouter>
    );

describe("DeviceSolves", () => {
    it("lists every solve with its competitor, result and status", () => {
        query.data = {
            device: {
                id: "device-1",
                name: "Station Example",
                type: DeviceType.STATION,
            },
            attempts: [
                attempt({}),
                attempt({
                    id: "attempt-2",
                    attemptNumber: 2,
                    status: AttemptStatus.EXTRA_GIVEN,
                }),
            ],
        };
        renderPage();

        const links = screen.getAllByRole("link", {
            name: "Competitor Example",
        });
        expect(links).toHaveLength(2);
        expect(links[0].getAttribute("href")).toBe("/results/result-1");
        expect(screen.getAllByText("12.34")).toHaveLength(2);
        expect(screen.getByText("Attempt 2")).toBeTruthy();
        expect(screen.getByText("Extra granted")).toBeTruthy();
    });

    it("says when the device has no solves yet", () => {
        query.data = {
            device: {
                id: "device-1",
                name: "Station Example",
                type: DeviceType.STATION,
            },
            attempts: [],
        };
        renderPage();

        expect(screen.getByText("No solves on this device yet.")).toBeTruthy();
    });
});
