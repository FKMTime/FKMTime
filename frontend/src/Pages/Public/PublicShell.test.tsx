import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { getActivePublicNavId } from "./publicNavigation";
import PublicSidebar from "./PublicSidebar";
import PublicTabs from "./PublicTabs";

const renderAt = (pathname: string, element: React.ReactNode) =>
    render(<MemoryRouter initialEntries={[pathname]}>{element}</MemoryRouter>);

describe("getActivePublicNavId", () => {
    it("treats every non-results route as live solving", () => {
        expect(getActivePublicNavId("/public")).toBe("live");
        expect(getActivePublicNavId("/public/live")).toBe("live");
        expect(getActivePublicNavId("/public/results")).toBe("results");
        expect(getActivePublicNavId("/public/results/333-r1")).toBe("results");
    });
});

describe("PublicSidebar", () => {
    it("lists live rounds under Results and marks the open one", () => {
        renderAt(
            "/public/results/pyram-r1",
            <PublicSidebar liveRoundIds={["333-r1", "pyram-r1"]} />
        );
        const roundLinks = screen
            .getAllByRole("link")
            .filter((link) =>
                link.getAttribute("href")?.startsWith("/public/results/")
            );
        expect(roundLinks.map((link) => link.getAttribute("href"))).toEqual([
            "/public/results/333-r1",
            "/public/results/pyram-r1",
        ]);
        expect(roundLinks[1].getAttribute("aria-current")).toBe("page");
        expect(
            screen
                .getByRole("link", { name: "Staff sign in" })
                .getAttribute("href")
        ).toBe("/auth/login");
    });
});

describe("PublicTabs", () => {
    it("shows Live solving and Results with live solving active by default", () => {
        renderAt("/public", <PublicTabs />);
        const links = screen.getAllByRole("link");
        expect(links.map((link) => link.textContent)).toEqual([
            "Live solving",
            "Results",
        ]);
        expect(links[0].getAttribute("aria-current")).toBe("page");
    });
});
