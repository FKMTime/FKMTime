import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Competition, Person } from "@/lib/interfaces";

import PersonsList from "./PersonsList";

const person = {
    id: "p1",
    registrantId: 7,
    name: "Anna Example",
    wcaId: "2019EXAM01",
    canCompete: true,
    gender: "f",
} as Person;

const competition = (useFkmTimeDevices: boolean) =>
    ({ useFkmTimeDevices, wcif: { persons: [] } }) as unknown as Competition;

const loginAs = (roles: string[]) =>
    localStorage.setItem(
        "fkmtime-userInfo",
        JSON.stringify({ username: "u", roles })
    );

const desktopRow = () => screen.getAllByRole("row")[1];

describe("PersonsList", () => {
    afterEach(() => localStorage.clear());

    it("gives delegates card assignment first and the rest in the menu", async () => {
        loginAs(["DELEGATE"]);
        const onOpenDialog = vi.fn();
        render(
            <MemoryRouter>
                <PersonsList
                    persons={[person]}
                    competition={competition(true)}
                    onOpenDialog={onOpenDialog}
                />
            </MemoryRouter>
        );
        const row = desktopRow();
        await userEvent.click(
            within(row).getByRole("button", { name: "Assign card" })
        );
        expect(onOpenDialog).toHaveBeenCalledWith("card", person);

        await userEvent.click(
            within(row).getByRole("button", {
                name: "More actions for Anna Example",
            })
        );
        expect(
            (await screen.findAllByRole("menuitem")).map((i) => i.textContent)
        ).toEqual(["Groups", "All results", "Warnings", "Issue warning"]);
    });

    it("shows staff without devices only the groups", () => {
        loginAs(["STAGE_LEADER"]);
        render(
            <MemoryRouter>
                <PersonsList
                    persons={[person]}
                    competition={competition(false)}
                    onOpenDialog={vi.fn()}
                />
            </MemoryRouter>
        );
        const row = desktopRow();
        expect(
            within(row).getByRole("button", { name: "Groups" })
        ).toBeTruthy();
        expect(
            within(row).queryByRole("button", { name: /More actions/ })
        ).toBeNull();
        expect(screen.queryByText("Card")).toBeNull();
    });
});
