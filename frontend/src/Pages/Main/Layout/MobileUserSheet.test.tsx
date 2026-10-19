import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MobileUserSheet from "./MobileUserSheet";

vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("MobileUserSheet", () => {
    beforeEach(() => {
        localStorage.setItem(
            "fkmtime-userInfo",
            JSON.stringify({
                username: "u",
                fullName: "Alex Doe",
                roles: ["DELEGATE"],
            })
        );
    });

    const renderSheet = (canAccessSettings: boolean) =>
        render(
            <MemoryRouter>
                <MobileUserSheet
                    isOpen
                    onOpenChange={vi.fn()}
                    canAccessSettings={canAccessSettings}
                />
            </MemoryRouter>
        );

    it("shows the account and its actions without a close button", () => {
        renderSheet(true);
        expect(screen.getByText("Alex Doe")).toBeTruthy();
        expect(screen.getByText("Delegate · FKMTime account")).toBeTruthy();
        expect(screen.getByRole("link", { name: /Settings/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Log out/ })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it("hides Settings when the user cannot access it", () => {
        renderSheet(false);
        expect(screen.queryByRole("link", { name: /Settings/ })).toBeNull();
    });
});
