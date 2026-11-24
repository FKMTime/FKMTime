import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Competition } from "wcif-helpers";

import { getActivePublicNavId, getH2hRoundIds } from "./publicNavigation";
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
        expect(getActivePublicNavId("/public/h2h/333oh-r2")).toBe(
            "h2h-333oh-r2"
        );
    });
});

describe("getH2hRoundIds", () => {
    it("finds the rounds in the head-to-head format", () => {
        const wcif = {
            events: [
                { id: "333", rounds: [{ id: "333-r1", format: "a" }] },
                {
                    id: "333oh",
                    rounds: [
                        { id: "333oh-r1", format: "a" },
                        { id: "333oh-r2", format: "h" },
                    ],
                },
            ],
        } as unknown as Competition;
        expect(getH2hRoundIds(wcif)).toEqual(["333oh-r2"]);
        expect(getH2hRoundIds(undefined)).toEqual([]);
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

describe("bracket links", () => {
    it("adds a Bracket item after Results for a head-to-head round", () => {
        renderAt(
            "/public/h2h/333oh-r2",
            <PublicSidebar liveRoundIds={[]} h2hRoundIds={["333oh-r2"]} />
        );
        const bracket = screen.getByRole("link", { name: "Bracket" });
        expect(bracket.getAttribute("href")).toBe("/public/h2h/333oh-r2");
        expect(bracket.getAttribute("aria-current")).toBe("page");
        const names = screen.getAllByRole("link").map((l) => l.textContent);
        expect(names.indexOf("Bracket")).toBe(names.indexOf("Results") + 1);
    });

    it("gives phones a Bracket tab, and nothing without such a round", () => {
        const { unmount } = renderAt(
            "/public/results/333oh-r2",
            <PublicTabs h2hRoundIds={["333oh-r2"]} />
        );
        expect(
            screen.getAllByRole("link").map((link) => link.textContent)
        ).toEqual(["Live solving", "Results", "Bracket"]);
        unmount();
        renderAt("/public", <PublicTabs h2hRoundIds={[]} />);
        expect(screen.queryByRole("link", { name: "Bracket" })).toBeNull();
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
