import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Person } from "@/lib/interfaces";
import { updatePerson } from "@/lib/persons";

import AssignCardModal from "./AssignCardModal";

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
