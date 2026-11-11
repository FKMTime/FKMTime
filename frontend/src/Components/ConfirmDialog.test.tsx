import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
    it("defaults to a generic destructive confirmation", () => {
        render(<ConfirmDialog onConfirm={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText("Are you sure?")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    });

    it("uses the given label and reports the choice", async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(
            <ConfirmDialog
                title="Start group 3 in Main Room?"
                confirmLabel="Start group 3"
                variant="default"
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Start group 3" })
        );
        expect(onConfirm).toHaveBeenCalled();
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalled();
    });
});
