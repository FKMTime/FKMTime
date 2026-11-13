import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WithdrawFromRoundModal from "./WithdrawFromRoundModal";

const preview = vi.hoisted(() => vi.fn());
const withdraw = vi.hoisted(() => vi.fn());
const openRound = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    previewWithdrawal: preview,
    withdrawFromRound: withdraw,
    openIntegratedLiveRound: openRound,
    invalidateIntegratedLiveRounds: vi.fn(),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));
vi.mock("./GroupPlacement", () => ({
    default: ({ name }: { name: string }) => <p>Place {name}</p>,
}));

const renderModal = () =>
    render(
        <WithdrawFromRoundModal
            isOpen
            onClose={vi.fn()}
            roundId="333-r2"
            personId="p-anna"
        />
    );

const jan = { registrationId: 301, name: "Jan Example", personId: "p-jan" };

describe("WithdrawFromRoundModal", () => {
    beforeEach(() => {
        preview.mockReset();
        withdraw.mockReset();
        openRound.mockReset();
    });

    it("shows who is next in line and lets the person choose; no default", async () => {
        preview.mockResolvedValue({
            ok: true,
            roundOpen: true,
            name: "Anna Example",
            next: [jan],
        });
        withdraw.mockResolvedValue({
            ok: true,
            message: "Anna Example withdrew from 333-r2",
            replacements: [
                {
                    personId: "p-jan",
                    name: "Jan Example",
                    suggestedGroupId: "333-r2-g3",
                },
            ],
        });
        renderModal();

        expect(
            await screen.findByText(/Next in line: Jan Example/)
        ).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Withdraw, nobody advances" })
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", {
                name: "Withdraw, Jan Example advances",
            })
        );

        expect(withdraw).toHaveBeenCalledWith("333-r2", "p-anna", [301]);
        expect(await screen.findByText("Place Jan Example")).toBeTruthy();
    });

    it("sends nobody when the person chooses nobody", async () => {
        preview.mockResolvedValue({
            ok: true,
            roundOpen: true,
            name: "Anna Example",
            next: [jan],
        });
        withdraw.mockResolvedValue({
            ok: true,
            message: "Done",
            replacements: [],
        });
        renderModal();

        await userEvent.click(
            await screen.findByRole("button", {
                name: "Withdraw, nobody advances",
            })
        );

        expect(withdraw).toHaveBeenCalledWith("333-r2", "p-anna", []);
    });

    it("asks again when the WCA's next in line changed", async () => {
        preview.mockResolvedValue({
            ok: true,
            roundOpen: true,
            name: "Anna Example",
            next: [jan],
        });
        withdraw.mockResolvedValue({
            ok: false,
            changed: true,
            message: "changed",
            next: [
                { registrationId: 302, name: "Ola Example", personId: null },
            ],
        });
        renderModal();

        await userEvent.click(
            await screen.findByRole("button", {
                name: "Withdraw, Jan Example advances",
            })
        );

        expect(await screen.findByText(/Choose again/)).toBeTruthy();
        expect(screen.getByText(/Next in line: Ola Example/)).toBeTruthy();
    });

    it("explains why nobody is next in line", async () => {
        preview.mockResolvedValue({
            ok: true,
            roundOpen: true,
            name: "Anna Example",
            next: [],
            nobodyReason: "Advancement is by result, not by ranking",
        });
        renderModal();

        expect(await screen.findByText(/Nobody is next in line/)).toBeTruthy();
        expect(screen.getByText(/by result, not by ranking/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    });

    it("offers to open a round that isn't open yet", async () => {
        preview
            .mockResolvedValueOnce({
                ok: true,
                roundOpen: false,
                roundState: "ready",
                name: "Anna Example",
            })
            .mockResolvedValueOnce({
                ok: true,
                roundOpen: true,
                name: "Anna Example",
                next: [],
            });
        openRound.mockResolvedValue({ ok: true, message: "opened" });
        renderModal();

        await userEvent.click(
            await screen.findByRole("button", { name: "Open 333-r2 first" })
        );

        expect(openRound).toHaveBeenCalledWith("333-r2");
        expect(await screen.findByText(/Nobody is next in line/)).toBeTruthy();
    });
});
