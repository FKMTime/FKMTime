import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Incident } from "@/lib/interfaces";

import IncidentsLayout from "./IncidentsLayout";
import IncidentListItem from "./OpenIncidents/IncidentListItem";

vi.mock("@/socket", () => ({ socket: { on: vi.fn(), off: vi.fn() } }));
vi.mock("@/lib/incidents", () => ({
    getUnresolvedIncidentsCount: vi.fn().mockResolvedValue({ count: 3 }),
    getResolvedIncidents: vi.fn().mockResolvedValue([{}, {}, {}, {}, {}]),
    getNoteworthyIncidents: vi.fn().mockResolvedValue([{}, {}]),
    getManualIncidents: vi.fn().mockResolvedValue([{}]),
}));
vi.mock("@/lib/warnings", () => ({
    getAllWarnings: vi.fn().mockResolvedValue([{}, {}]),
}));

const renderLayout = (path: string, useFkmTimeDevices: boolean) => {
    const store = createStore();
    store.set(competitionAtom, { useFkmTimeDevices } as Competition);
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/incidents" element={<IncidentsLayout />}>
                        <Route path="*" element={<p>Tab content</p>} />
                        <Route index element={<p>Tab content</p>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

describe("IncidentsLayout", () => {
    it("shows every tab with its count and marks the current one", async () => {
        renderLayout("/incidents/resolved", true);
        expect(
            await screen.findByRole("tab", { name: "Resolved 5" })
        ).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Open 3" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Noteworthy 2" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Warnings 2" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Manual 1" })).toBeTruthy();
        expect(
            screen
                .getByRole("tab", { name: "Resolved 5" })
                .getAttribute("aria-selected")
        ).toBe("true");
        expect(screen.getByText("Tab content")).toBeTruthy();
    });

    it("only offers warnings and manual incidents without FKMTime devices", async () => {
        renderLayout("/incidents/manual", false);
        expect(
            await screen.findByRole("tab", { name: "Manual 1" })
        ).toBeTruthy();
        expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
            "Warnings2",
            "Manual1",
        ]);
    });
});

describe("IncidentListItem", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
    });

    it("summarises the attempt, station, judge, room and age", () => {
        const incident = {
            id: "inc1",
            attemptNumber: 3,
            value: 1284,
            penalty: 0,
            solvedAt: "2026-04-18T11:58:00Z",
            device: { name: "Station 4", roomId: "r1" },
            judge: { name: "Jan Test" },
            result: {
                eventId: "333",
                roundId: "333-r1",
                person: { name: "Anna Example" },
            },
        } as unknown as Incident;
        render(
            <MemoryRouter>
                <IncidentListItem
                    incident={incident}
                    roomName="Main Room"
                    isSelected
                    now={new Date("2026-04-18T12:00:00Z")}
                />
            </MemoryRouter>
        );
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("/incidents/inc1");
        expect(link.getAttribute("aria-current")).toBe("true");
        expect(
            screen.getByText("3x3 R1 · Attempt 3 · Station 4 · Judge Jan Test")
        ).toBeTruthy();
        expect(screen.getByText("12.84")).toBeTruthy();
        expect(screen.getByText("Main Room · 2 min")).toBeTruthy();
    });
});
