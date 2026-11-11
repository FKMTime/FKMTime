import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CreateFKMTimeAccountForm from "./CreateFKMTimeAccountForm";
import CreateWCAUserForm from "./CreateWCAUserForm";

describe("creating a user", () => {
    it("explains what is missing from a blank FKMTime account", async () => {
        const handleSubmit = vi.fn();
        render(<CreateFKMTimeAccountForm handleSubmit={handleSubmit} />);

        await userEvent.click(screen.getByRole("button", { name: "Create" }));

        expect(await screen.findByText("Username is required")).toBeTruthy();
        expect(screen.getByText("Full name is required")).toBeTruthy();
        expect(screen.getByText("Password is required")).toBeTruthy();
        expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("asks for a person before creating a WCA user", async () => {
        const handleSubmit = vi.fn();
        render(<CreateWCAUserForm handleSubmit={handleSubmit} />);

        await userEvent.click(screen.getByRole("button", { name: "Create" }));

        expect(await screen.findByText("Please select a person")).toBeTruthy();
        expect(handleSubmit).not.toHaveBeenCalled();
    });
});
