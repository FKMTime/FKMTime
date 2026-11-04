import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";

import AssignCards from "./AssignCards";

const person = { id: "p1", name: "Alex Example", registrantId: 7 };
const other = { id: "p2", name: "Alexis Sample", registrantId: 8 };

vi.mock("@/lib/persons", () => ({
    getAllPersons: vi.fn(() => Promise.resolve([person, other])),
    personsWithoutCardQuery: {
        key: "person/all?withoutCardAssigned=true",
        fetch: vi.fn(() => Promise.resolve([person, other])),
    },
    firstPersonsPageQuery: {
        key: "person?page=1&pageSize=10",
        fetch: () => new Promise(() => {}),
    },
    assignCard: vi.fn(() => Promise.resolve(200)),
    checkedInCount: vi.fn(() => Promise.resolve({ totalPersonsCount: 1 })),
    getPersonsWithoutCardAssigned: vi.fn(() => Promise.resolve({ count: 1 })),
}));
vi.mock("@/lib/scanSound", () => ({ playScanSound: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("AssignCards", () => {
    beforeEach(() => clearQueryCache());

    it("goes back to an empty search after assigning a card", async () => {
        render(
            <MemoryRouter>
                <AssignCards />
            </MemoryRouter>
        );
        const search = screen.getByLabelText("Search persons without a card");
        await userEvent.type(search, "Alex");
        await userEvent.click(
            await screen.findByRole("option", { name: /Alex Example/ })
        );
        await userEvent.type(screen.getByLabelText("Card ID"), "12345{Enter}");

        await waitFor(() => expect(document.activeElement).toBe(search));
        expect((search as HTMLInputElement).value).toBe("");
        expect(screen.queryByLabelText("Card ID")).toBeNull();
    });

    it("picks a person from the search with the arrow keys and Enter", async () => {
        render(
            <MemoryRouter>
                <AssignCards />
            </MemoryRouter>
        );
        const search = screen.getByLabelText("Search persons without a card");
        await userEvent.type(search, "Alex");
        await screen.findByRole("option", { name: /Alexis Sample/ });

        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(
            await screen.findByRole("heading", { name: "Alexis Sample" })
        ).toBeTruthy();
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByLabelText("Card ID")
            )
        );
    });
});
