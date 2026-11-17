import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ServerLogsButton from "./ServerLogsButton";

const roles = vi.hoisted(() => ({ admin: false }));

vi.mock("@/lib/permissions", () => ({ isAdmin: () => roles.admin }));

const renderButton = () =>
    render(
        <MemoryRouter>
            <ServerLogsButton />
        </MemoryRouter>
    );

describe("ServerLogsButton", () => {
    it("links an admin to the server logs", () => {
        roles.admin = true;
        renderButton();

        expect(
            screen
                .getByRole("link", { name: "Server logs" })
                .getAttribute("href")
        ).toBe("/logs");
    });

    it("is hidden from everyone else", () => {
        roles.admin = false;
        renderButton();

        expect(screen.queryByRole("link", { name: "Server logs" })).toBeNull();
    });
});
