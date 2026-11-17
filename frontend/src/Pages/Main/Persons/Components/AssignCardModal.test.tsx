import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Person } from "@/lib/interfaces";
import { updatePerson } from "@/lib/persons";

import AssignCardModal from "./AssignCardModal";

const toast = vi.fn();
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/persons", () => ({
    updatePerson: vi.fn(() => Promise.resolve(200)),
}));
const roles = vi.hoisted(() => ({ delegate: true }));
vi.mock("@/lib/permissions", () => ({
    isOrganizerOrDelegate: () => roles.delegate,
}));

const person = (cardId: string) =>
    ({ id: "p1", name: "Anna Example", cardId }) as Person;

describe("AssignCardModal", () => {
    afterEach(() => {
        vi.clearAllMocks();
        roles.delegate = true;
    });

    it("clears the assigned card in one click", async () => {
        const onClose = vi.fn();
        render(
            <AssignCardModal isOpen onClose={onClose} person={person("123")} />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Clear card" })
        );

        expect(updatePerson).toHaveBeenCalledWith(
            expect.objectContaining({ id: "p1", cardId: "" })
        );
        expect(onClose).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith({
            title: "Card removed from Anna Example",
            variant: "success",
        });
    });

    it("confirms the assigned card with a toast", async () => {
        const onClose = vi.fn();
        render(
            <AssignCardModal isOpen onClose={onClose} person={person("")} />
        );

        await userEvent.type(screen.getByLabelText("Card"), "456");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(updatePerson).toHaveBeenCalledWith(
            expect.objectContaining({ id: "p1", cardId: "456" })
        );
        expect(onClose).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith({
            title: "Card assigned to Anna Example",
            variant: "success",
        });
    });

    it("shows no toast when the card is taken", async () => {
        vi.mocked(updatePerson).mockResolvedValueOnce(409);
        const onClose = vi.fn();
        render(
            <AssignCardModal isOpen onClose={onClose} person={person("")} />
        );

        await userEvent.type(screen.getByLabelText("Card"), "456");
        await userEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(toast).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("labels the card field", () => {
        render(
            <AssignCardModal isOpen onClose={vi.fn()} person={person("123")} />
        );

        expect(screen.getByText("Card", { selector: "label" })).toBeTruthy();
        expect((screen.getByLabelText("Card") as HTMLInputElement).value).toBe(
            "123"
        );
    });

    it("offers no clear option when the person has no card", () => {
        render(
            <AssignCardModal isOpen onClose={vi.fn()} person={person("")} />
        );

        expect(screen.queryByRole("button", { name: "Clear card" })).toBeNull();
    });

    it("offers no clear option to read-only roles", () => {
        roles.delegate = false;
        render(
            <AssignCardModal isOpen onClose={vi.fn()} person={person("123")} />
        );

        expect(screen.queryByRole("button", { name: "Clear card" })).toBeNull();
    });
});
