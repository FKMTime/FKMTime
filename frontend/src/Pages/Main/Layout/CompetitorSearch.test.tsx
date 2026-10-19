import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPersons } from "@/lib/persons";

import CompetitorSearch from "./CompetitorSearch";

vi.mock("@/lib/persons", () => ({ getPersons: vi.fn() }));

const persons = [
    { id: "p1", registrantId: 1, name: "Anna Example", wcaId: "2019EXAM01" },
    { id: "p2", registrantId: 2, name: "Andrew Sample" },
];

const renderSearch = () =>
    render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route path="/" element={<CompetitorSearch />} />
                <Route
                    path="/persons/:id/results"
                    element={<p>Person results page</p>}
                />
            </Routes>
        </MemoryRouter>
    );

describe("CompetitorSearch", () => {
    beforeEach(() => {
        vi.mocked(getPersons).mockResolvedValue({ data: persons, count: 2 });
    });

    it("waits for two characters before searching", async () => {
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "a");
        await new Promise((r) => setTimeout(r, 300));
        expect(getPersons).not.toHaveBeenCalled();
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("lists matches with their ID and WCA ID", async () => {
        renderSearch();
        await userEvent.type(screen.getByRole("combobox"), "an");
        expect(await screen.findByText("Anna Example")).toBeTruthy();
        expect(screen.getByText("ID 1 · 2019EXAM01")).toBeTruthy();
        expect(screen.getByText("ID 2 · Newcomer")).toBeTruthy();
        expect(getPersons).toHaveBeenCalledWith(1, 8, "an");
    });

    it("opens the highlighted competitor with the keyboard", async () => {
        renderSearch();
        const input = screen.getByRole("combobox");
        await userEvent.type(input, "an");
        await screen.findByText("Andrew Sample");
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(await screen.findByText("Person results page")).toBeTruthy();
    });
});
