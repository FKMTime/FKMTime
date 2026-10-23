import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDialogError } from "@/hooks/useDialogError";

import { Modal } from "./Modal";

describe("Modal", () => {
    it("shows the error inside the dialog", () => {
        render(
            <Modal
                isOpen
                onClose={vi.fn()}
                title="Edit user"
                error="Username already taken"
            >
                <p>Form</p>
            </Modal>
        );
        expect(screen.getByRole("alert").textContent).toBe(
            "Username already taken"
        );
        expect(screen.getByText("Form")).toBeTruthy();
    });
});

describe("useDialogError", () => {
    it("clears the error when the dialog closes", () => {
        const { result, rerender } = renderHook(
            ({ isOpen }) => useDialogError(isOpen),
            { initialProps: { isOpen: true } }
        );
        act(() => result.current[1]("Something went wrong"));
        expect(result.current[0]).toBe("Something went wrong");
        rerender({ isOpen: false });
        expect(result.current[0]).toBe("");
    });
});
