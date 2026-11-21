import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { QueryWrapper } from "@/test/queryClient";

import GiveDelegateAccessModal from "./GiveDelegateAccessModal";

const { giveDelegateGrant } = vi.hoisted(() => ({
    giveDelegateGrant: vi.fn(),
}));

vi.mock("@/lib/user", () => ({
    usersQuery: {
        key: "user",
        fetch: () =>
            Promise.resolve([
                { id: "staff", fullName: "Invented Helper", roles: ["STAFF"] },
                {
                    id: "delegate",
                    fullName: "Invented Delegate",
                    roles: ["DELEGATE"],
                },
            ]),
    },
}));
vi.mock("@/lib/delegateGrants", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    giveDelegateGrant,
}));

const renderModal = () =>
    render(
        <GiveDelegateAccessModal
            isOpen
            onClose={vi.fn()}
            groupIds={["333-r1-g2"]}
        />,
        { wrapper: QueryWrapper }
    );

describe("GiveDelegateAccessModal", () => {
    beforeEach(() => {
        clearQueryCache();
        giveDelegateGrant.mockReset();
    });

    it("ticks extras, adding attempts and reordering, and nothing for several attempts", () => {
        renderModal();
        const checked = (name: string) =>
            screen.getByRole("checkbox", { name }).getAttribute("aria-checked");
        expect(checked("Give an extra")).toBe("true");
        expect(checked("Add an attempt")).toBe("true");
        expect(checked("Reorder attempts")).toBe("true");
        expect(checked("Give extras for several attempts")).toBe("false");
        expect(checked("DNF all attempts")).toBe("false");
        expect(checked("Delete an attempt")).toBe("false");
    });

    it("asks who gets access before saving", async () => {
        renderModal();
        fireEvent.click(screen.getByRole("button", { name: "Give access" }));
        expect(await screen.findByText("Choose who gets access")).toBeTruthy();
        expect(giveDelegateGrant).not.toHaveBeenCalled();
    });

    it("names the group when there is only one", () => {
        renderModal();
        expect(screen.getByText("3x3x3 Cube, Round 1, Group 2")).toBeTruthy();
    });

    it("gives access to the user it was opened for, without asking who", async () => {
        giveDelegateGrant.mockResolvedValue({ status: 201 });
        render(
            <GiveDelegateAccessModal
                isOpen
                onClose={vi.fn()}
                groupIds={["333-r1-g2"]}
                user={
                    {
                        id: "staff",
                        fullName: "Invented Helper",
                        roles: ["STAFF"],
                    } as never
                }
            />,
            { wrapper: QueryWrapper }
        );
        expect(screen.getByText("Invented Helper")).toBeTruthy();
        expect(screen.queryByRole("combobox", { name: "User" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Give access" }));
        await vi.waitFor(() =>
            expect(giveDelegateGrant).toHaveBeenCalledWith({
                userId: "staff",
                groupId: "333-r1-g2",
                permissions: ["GIVE_EXTRA", "ADD_ATTEMPT", "REORDER_ATTEMPTS"],
            })
        );
    });

    it("leaves delegates out of the users to choose from", async () => {
        const { grantableUsers } = await vi.importActual<
            typeof import("@/lib/delegateGrants")
        >("@/lib/delegateGrants");
        const users = [
            { id: "a", roles: ["STAFF"] },
            { id: "b", roles: ["DELEGATE"] },
            { id: "c", roles: ["ADMIN"] },
        ];
        expect(grantableUsers(users as never).map((user) => user.id)).toEqual([
            "a",
        ]);
    });
});
