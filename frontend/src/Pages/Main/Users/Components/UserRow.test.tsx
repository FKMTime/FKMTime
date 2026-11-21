import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "@/lib/interfaces";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { QueryWrapper } from "@/test/queryClient";

import UserRow from "./UserRow";

const user = (roles: string[]) =>
    ({
        id: "user-1",
        fullName: "Invented Helper",
        username: "helper",
        roles,
        wcaUserId: null,
    }) as unknown as User;

/** The row's actions, as the mobile sheet lists them */
const actions = async (roles: string[], accessGroupIds: string[]) => {
    render(
        <ConfirmProvider>
            <ul>
                <UserRow
                    user={user(roles)}
                    fetchData={vi.fn()}
                    variant="list"
                    accessGroupIds={accessGroupIds}
                />
            </ul>
        </ConfirmProvider>,
        { wrapper: QueryWrapper }
    );
    await userEvent.click(
        screen.getByRole("button", {
            name: "More actions for Invented Helper",
        })
    );
    const sheet = await screen.findByRole("dialog");
    return within(sheet)
        .getAllByRole("button")
        .map((button) => button.textContent);
};

describe("UserRow", () => {
    beforeEach(() => {
        window.innerWidth = 375;
    });
    afterEach(() => {
        window.innerWidth = 1024;
    });

    it("offers delegate access for a staff user when a group can get it", async () => {
        expect(await actions(["STAFF"], ["333-r1-g1"])).toContain(
            "Give delegate access…"
        );
    });

    it("leaves it out for a delegate, who can do it all already", async () => {
        expect(await actions(["DELEGATE"], ["333-r1-g1"])).not.toContain(
            "Give delegate access…"
        );
    });

    it("leaves it out when no group can get it, as for an organizer", async () => {
        expect(await actions(["STAFF"], [])).not.toContain(
            "Give delegate access…"
        );
    });
});
