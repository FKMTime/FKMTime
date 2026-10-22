import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeviceCodeForm from "./DeviceCodeForm";
import SignInForm from "./SignInForm";

const signInProps = {
    error: "",
    isLoading: false,
    showScramblingDevice: false,
    onSubmit: vi.fn(),
    onChange: vi.fn(),
    onWcaLogin: vi.fn(),
    onScramblingDevice: vi.fn(),
};

describe("SignInForm", () => {
    it("submits the username and password", () => {
        const onSubmit = vi.fn();
        render(<SignInForm {...signInProps} onSubmit={onSubmit} />);
        fireEvent.change(screen.getByLabelText("Username"), {
            target: { value: "delegate" },
        });
        fireEvent.change(screen.getByLabelText("Password"), {
            target: { value: "secret" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
        expect(onSubmit).toHaveBeenCalledWith("delegate", "secret");
    });

    it("offers the scrambling device only when the competition uses it", () => {
        const { rerender } = render(<SignInForm {...signInProps} />);
        expect(
            screen.queryByRole("button", { name: "Scrambling device" })
        ).toBeNull();
        rerender(<SignInForm {...signInProps} showScramblingDevice />);
        expect(
            screen.getByRole("button", { name: "Scrambling device" })
        ).toBeTruthy();
    });

    it("shows the error inline", () => {
        render(
            <SignInForm {...signInProps} error="Wrong username or password" />
        );
        expect(screen.getByRole("alert").textContent).toBe(
            "Wrong username or password"
        );
    });
});

describe("DeviceCodeForm", () => {
    const deviceProps = {
        error: "",
        isLoading: false,
        onSubmit: vi.fn(),
        onChange: vi.fn(),
        onBack: vi.fn(),
    };

    // input-otp re-reads the caret on timers (up to 50ms) after every
    // change and never clears them on unmount. Let them run out while the
    // DOM still exists; otherwise they can fire after jsdom is torn down
    // and fail the run with "window is not defined".
    afterEach(() => new Promise((resolve) => setTimeout(resolve, 100)));

    it("sends the code as soon as the 6th digit is typed", async () => {
        const onSubmit = vi.fn();
        render(<DeviceCodeForm {...deviceProps} onSubmit={onSubmit} />);
        const input = screen.getByLabelText("Device code");
        const button = screen.getByRole("button", { name: "Continue" });

        await userEvent.type(input, "12345");
        expect(button.hasAttribute("disabled")).toBe(true);
        expect(onSubmit).not.toHaveBeenCalled();

        await userEvent.type(input, "6");
        expect(onSubmit).toHaveBeenCalledWith("123456");
    });
});
