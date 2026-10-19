import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { findActiveNavItem, getNavItems } from "@/lib/navigation";

import DesktopSidebar from "./DesktopSidebar";
import MobileTabBar from "./MobileTabBar";

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
                    competitionName="Test Open 2026"
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
