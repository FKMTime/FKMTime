import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmProvider } from "@/providers/ConfirmProvider";

import Scoretakers from "./Scoretakers";

const state = vi.hoisted(() => ({ data: undefined as unknown }));
const api = vi.hoisted(() => ({
    add: vi.fn(),
    remove: vi.fn(),
}));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: state.data }),
}));
vi.mock("@/lib/integratedLive", () => ({
    integratedLiveScoretakersQuery: { key: "scoretakers" },
    addIntegratedLiveScoretaker: api.add,
    removeIntegratedLiveScoretaker: api.remove,
}));

const renderCard = () =>
    render(
        <ConfirmProvider>
            <form
                onSubmit={() => {
                    throw new Error("the settings form was submitted");
                }}
            >
                <Scoretakers />
            </form>
        </ConfirmProvider>
    );

describe("Scoretakers", () => {
    beforeEach(() => {
        api.add.mockReset().mockResolvedValue({ ok: true, message: "added" });
        api.remove
            .mockReset()
            .mockResolvedValue({ ok: true, message: "removed" });
        state.data = {
            ok: true,
            scoretakers: [{ wcaUserId: 9000005, name: "Scoretaker Example" }],
        };
    });

    it("adds someone by WCA ID with Enter, without saving the settings", async () => {
        renderCard();
        await userEvent.type(
            screen.getByRole("textbox", { name: "WCA ID" }),
            "2020EXAM01{Enter}"
        );

        expect(api.add).toHaveBeenCalledWith("2020EXAM01");
    });

    it("removes a scoretaker after confirming", async () => {
        renderCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Remove Scoretaker Example" })
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "Remove" })
        );

        expect(api.remove).toHaveBeenCalledWith(9000005);
    });

    it("says why when they can't be listed, without the add field", () => {
        state.data = {
            ok: false,
            scoretakers: [],
            needsWcaSignIn: true,
            message: "Connect, or sign in with WCA, to see the scoretakers",
        };
        renderCard();

        expect(
            screen.getByText(
                "Connect, or sign in with WCA, to see the scoretakers"
            )
        ).toBeTruthy();
        expect(screen.queryByRole("textbox")).toBeNull();
    });
});
