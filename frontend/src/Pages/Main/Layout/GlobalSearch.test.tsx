import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { getAllDevices } from "@/lib/devices";
import { getUnresolvedIncidents } from "@/lib/incidents";
import { Competition } from "@/lib/interfaces";
import { getPersons } from "@/lib/persons";

import GlobalSearch from "./GlobalSearch";

vi.mock("@/lib/persons", () => ({ getPersons: vi.fn() }));
vi.mock("@/lib/devices", () => ({ getAllDevices: vi.fn() }));
vi.mock("@/lib/incidents", () => ({ getUnresolvedIncidents: vi.fn() }));
const roles = vi.hoisted(() => ({ delegate: true }));
vi.mock("@/lib/permissions", () => ({
    isDelegate: () => roles.delegate,
    isOrganizerOrDelegate: () => roles.delegate,
    isStageLeaderOrOrganizerOrDelegate: () => roles.delegate,
}));

const persons = [
    { id: "p1", registrantId: 1, name: "Anna Example", wcaId: "2019EXAM01" },
    { id: "p2", registrantId: 2, name: "Andrew Sample" },
];

const competition = {
    useFkmTimeDevices: true,
    wcif: {
        events: [{ id: "333", rounds: [{ id: "333-r1" }] }],
        schedule: { venues: [] },
    },
} as unknown as Competition;

const renderSearch = () => {
    const store = createStore();
    store.set(competitionAtom, competition);
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={["/"]}>
                <Routes>
                    <Route path="/" element={<GlobalSearch />} />
                    <Route
                        path="/persons/:id/results"
                        element={<p>Person results page</p>}
                    />
                    <Route
                        path="/attendance/missed"
                        element={<p>Most missed page</p>}
                    />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

describe("GlobalSearch", () => {
    beforeEach(() => {
        roles.delegate = true;
        vi.mocked(getPersons).mockResolvedValue({ data: persons, count: 2 });
        vi.mocked(getAllDevices).mockResolvedValue([
            { id: "d1", name: "Station Andromeda", espId: 1234 },
        ]);
        vi.mocked(getUnresolvedIncidents).mockResolvedValue([]);
    });

    it("waits for two characters before searching", async () => {
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "a");
        await new Promise((r) => setTimeout(r, 300));
        expect(getPersons).not.toHaveBeenCalled();
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("lists competitors and devices under their sections", async () => {
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "an");
        const competitors = await screen.findByRole("group", {
            name: "Competitors",
        });
        expect(within(competitors).getByText("Anna Example")).toBeTruthy();
        expect(within(competitors).getByText("ID 1 · 2019EXAM01")).toBeTruthy();
        expect(
            within(
                await screen.findByRole("group", { name: "Devices" })
            ).getByText("Station Andromeda")
        ).toBeTruthy();
        expect(getPersons).toHaveBeenCalledWith(1, 5, "an");
    });

    it("finds tabs inside sections and opens them with the keyboard", async () => {
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "most missed");
        await screen.findByText("Most missed");
        await userEvent.keyboard("{Enter}");
        expect(await screen.findByText("Most missed page")).toBeTruthy();
    });

    it("opens the highlighted competitor with the arrow keys", async () => {
        vi.mocked(getAllDevices).mockResolvedValue([]);
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "andr");
        await screen.findByText("Andrew Sample");
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(await screen.findByText("Person results page")).toBeTruthy();
    });

    it("leaves out what the user can't open", async () => {
        roles.delegate = false;
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "an");
        await screen.findByText("Anna Example");
        expect(screen.queryByRole("group", { name: "Devices" })).toBeNull();
        expect(getAllDevices).not.toHaveBeenCalled();
        expect(getUnresolvedIncidents).not.toHaveBeenCalled();
    });
});
