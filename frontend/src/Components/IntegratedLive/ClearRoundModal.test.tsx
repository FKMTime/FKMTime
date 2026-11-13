import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ClearRoundModal from "./ClearRoundModal";

const clear = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integratedLive", () => ({
    clearIntegratedLiveRound: clear,
    invalidateIntegratedLiveRounds: vi.fn(),
}));
vi.mock("@/lib/activities", () => ({
    activityCodeToName: (id: string) => id,
}));

describe("ClearRoundModal", () => {
    it("only clears once the round id is typed", async () => {
        clear.mockResolvedValue({ ok: true, message: "cleared" });
        render(<ClearRoundModal isOpen onClose={vi.fn()} roundId="333-r1" />);
        const button = screen.getByRole("button", { name: "Clear round" });

        expect(button.hasAttribute("disabled")).toBe(true);
        await userEvent.type(screen.getByRole("textbox"), "333-r1");
        await userEvent.click(button);

        expect(clear).toHaveBeenCalledWith("333-r1");
    });
});
