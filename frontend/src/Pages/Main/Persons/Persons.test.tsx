import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition } from "@/lib/interfaces";
import { getPersons } from "@/lib/persons";

import Persons from "./Persons";

vi.mock("@/lib/persons", () => ({
    getPersons: vi.fn(() =>
        Promise.resolve({ data: [], count: 0, personsWithCardAssigned: 0 })
    ),
    getPersonsWithoutCardAssigned: vi.fn(() => Promise.resolve([])),
    checkedInCount: vi.fn(() =>
        Promise.resolve({ checkedInPersonsCount: 0, totalPersonsCount: 0 })
    ),
}));

const renderAt = (width: number) => {
    window.innerWidth = width;
    const store = createStore();
    store.set(competitionAtom, {
        useFkmTimeDevices: true,
        wcif: { events: [], persons: [] },
    } as unknown as Competition);
    render(
        <Provider store={store}>
            <MemoryRouter>
                <Persons />
            </MemoryRouter>
        </Provider>
    );
};

describe("Persons filters", () => {
    const initialWidth = window.innerWidth;
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => {
        window.innerWidth = initialWidth;
    });

    it("keeps the filters inline on wider screens", async () => {
        renderAt(1280);
        expect(await screen.findByLabelText("Registrant ID")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^Filters/ })).toBeNull();
    });

    it("moves the filters into a sheet on phones and counts the active ones", async () => {
        renderAt(390);
        const button = await screen.findByRole("button", { name: /^Filters/ });
        expect(screen.queryByLabelText("Registrant ID")).toBeNull();

        await userEvent.click(button);
        await userEvent.click(
            await screen.findByRole("button", { name: "Newcomers" })
        );
        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(
            screen.getByRole("button", { name: /^Filters/ }).textContent
        ).toBe("Filters1");
    });
});

describe("Persons loading", () => {
    it("keeps the tabs and filters on screen while the list loads", async () => {
        vi.mocked(getPersons).mockReturnValueOnce(new Promise(() => {}));
        renderAt(1280);

        expect(screen.getByRole("tab", { name: /All persons/ })).toBeTruthy();
        expect(screen.getByRole("tab", { name: /Assign cards/ })).toBeTruthy();
        expect(screen.getByLabelText("Search persons")).toBeTruthy();
        expect(await screen.findByLabelText("Loading persons")).toBeTruthy();
    });
});
