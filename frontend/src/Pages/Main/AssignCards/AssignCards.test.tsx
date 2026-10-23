import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AssignCards from "./AssignCards";

const person = { id: "p1", name: "Alex Example", registrantId: 7 };

vi.mock("@/lib/persons", () => ({
    getAllPersons: vi.fn(() => Promise.resolve([person])),
    assignCard: vi.fn(() => Promise.resolve(200)),
    checkedInCount: vi.fn(() => Promise.resolve({ totalPersonsCount: 1 })),
    getPersonsWithoutCardAssigned: vi.fn(() => Promise.resolve({ count: 1 })),
}));
vi.mock("@/lib/scanSound", () => ({ playScanSound: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("AssignCards", () => {
    it("goes back to an empty search after assigning a card", async () => {
        render(
            <MemoryRouter>
                <AssignCards />
            </MemoryRouter>
        );
        const search = screen.getByLabelText("Search persons without a card");
        await userEvent.type(search, "Alex");
        await userEvent.click(
            await screen.findByRole("button", { name: /Alex Example/ })
        );
        await userEvent.type(screen.getByLabelText("Card ID"), "12345{Enter}");

        await waitFor(() => expect(document.activeElement).toBe(search));
        expect((search as HTMLInputElement).value).toBe("");
        expect(screen.queryByLabelText("Card ID")).toBeNull();
    });
});
