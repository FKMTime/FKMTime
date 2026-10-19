import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

    it("enables Continue only once all six digits are entered", () => {
        const onSubmit = vi.fn();
        render(<DeviceCodeForm {...deviceProps} onSubmit={onSubmit} />);
        const input = screen.getByLabelText("Device code");
        const button = screen.getByRole("button", { name: "Continue" });

        fireEvent.change(input, { target: { value: "12345" } });
        expect(button.hasAttribute("disabled")).toBe(true);

        fireEvent.change(input, { target: { value: "123456" } });
        expect(button.hasAttribute("disabled")).toBe(false);
        fireEvent.click(button);
        expect(onSubmit).toHaveBeenCalledWith("123456");
    });
});
