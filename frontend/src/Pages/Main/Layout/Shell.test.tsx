import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { findActiveNavItem, getNavItems } from "@/lib/navigation";

import DesktopHeader from "./DesktopHeader";
import DesktopSidebar from "./DesktopSidebar";
import MobileTabBar from "./MobileTabBar";

// The search and user menu aren't under test here
vi.mock("./GlobalSearch", () => ({ default: () => null }));
vi.mock("./UserMenu", () => ({ default: () => null }));

const items = getNavItems({
    useFkmTimeDevices: true,
    isDelegate: true,
    isOrganizerOrDelegate: true,
    isStageLeaderOrAbove: true,
    canAccessSettings: true,
});

const renderTabBar = (pathname: string, unresolvedIncidentsCount = 0) =>
    render(
        <MemoryRouter>
            <MobileTabBar
                items={items}
                activeItem={findActiveNavItem(pathname, items)}
                pathname={pathname}
                unresolvedIncidentsCount={unresolvedIncidentsCount}
            />
        </MemoryRouter>
    );

describe("MobileTabBar", () => {
    it("shows the four main tabs plus More", () => {
        renderTabBar("/");
        const labels = screen
            .getAllByRole("link")
            .map((link) => link.textContent);
        expect(labels).toEqual([
            "Home",
            "Incidents",
            "Results",
            "Persons",
            "More",
        ]);
    });

    it("marks More active for pages listed under it", () => {
        renderTabBar("/check-in");
        expect(
            screen
                .getByRole("link", { name: "More" })
                .getAttribute("aria-current")
        ).toBe("page");
    });

    it("shows the open incident count on the Incidents tab", () => {
        renderTabBar("/", 3);
        expect(
            screen.getByRole("link", { name: /Incidents/ }).textContent
        ).toContain("3");
    });

    it("lifts toasts above the bar while mounted", () => {
        const { unmount } = renderTabBar("/");
        expect(
            document.documentElement.style.getPropertyValue("--toast-offset")
        ).toBe("76px");
        unmount();
        expect(
            document.documentElement.style.getPropertyValue("--toast-offset")
        ).toBe("");
    });
});

describe("DesktopSidebar", () => {
    const renderSidebar = (pathname: string) =>
        render(
            <MemoryRouter>
                <DesktopSidebar
                    items={items}
                    activeItem={findActiveNavItem(pathname, items)}
                    unresolvedIncidentsCount={2}
                />
            </MemoryRouter>
        );

    it("keeps Settings out of the sidebar", () => {
        renderSidebar("/");
        expect(screen.queryByRole("link", { name: /Settings/ })).toBeNull();
        expect(screen.getByText("Admin")).toBeTruthy();
    });

    it("marks the current section", () => {
        renderSidebar("/results/live");
        expect(
            screen
                .getByRole("link", { name: /Live solving/ })
                .getAttribute("aria-current")
        ).toBe("page");
        expect(
            screen
                .getByRole("link", { name: /^Results/ })
                .getAttribute("aria-current")
        ).toBeNull();
    });
});

describe("DesktopHeader", () => {
    const renderHeader = (crumbs: { label: string; to?: string }[]) =>
        render(
            <MemoryRouter>
                <DesktopHeader
                    competitionName="Test Open 2026"
                    crumbs={crumbs}
                    canEnterAttempts={false}
                    canAccessSettings={false}
                    onEnterAttempt={() => {}}
                />
            </MemoryRouter>
        );

    it("leads the breadcrumbs with the competition, linking home", () => {
        renderHeader([
            { label: "Results", to: "/results" },
            { label: "Round 1" },
        ]);
        expect(
            screen
                .getByRole("link", { name: "Test Open 2026" })
                .getAttribute("href")
        ).toBe("/");
        expect(screen.getByRole("heading", { name: "Round 1" })).toBeTruthy();
    });

    it("makes the competition the heading on Home", () => {
        renderHeader([]);
        expect(
            screen.getByRole("heading", { name: "Test Open 2026" })
        ).toBeTruthy();
        expect(
            screen.queryByRole("link", { name: "Test Open 2026" })
        ).toBeNull();
    });
});
