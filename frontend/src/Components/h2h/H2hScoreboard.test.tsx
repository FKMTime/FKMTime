import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicH2hView } from "@/lib/h2hPublic";
import { StationInfo } from "@/lib/liveSolving";
import {
    buildView,
    point,
    set,
    withMatch,
} from "@/lib/tests/h2hPublicFixtures";

import H2hScoreboard, { POINT_LIT_MS } from "./H2hScoreboard";

const NOW = new Date("2026-11-24T12:00:00Z").getTime();

const station = (registrantId: number, timeMs: number): StationInfo => ({
    espId: registrantId,
    deviceName: `Station ${registrantId}`,
    roomId: "room",
    personName: null,
    registrantId,
    groupId: "333oh-r2-g1",
    time: timeMs,
    inspection: null,
    timerRunning: true,
    inspectionRunning: false,
    cumulativeLimitCentiseconds: null,
    cumulativeRemainingCentiseconds: null,
    serverReceivedAt: NOW,
    lastSolve: null,
});

/** Semifinal 1 playing, first to 2 sets: A won set 1, set 2 at 1–0 to B */
const playing = (extraPoints = 0): PublicH2hView =>
    withMatch(buildView(4), 1, {
        status: "IN_PROGRESS",
        setsToWin: 2,
        score: { a: 1, b: 0 },
        sets: [
            set(
                1,
                [
                    point(1, 900, 1000),
                    point(2, 1000, 1000),
                    point(3, 900, 1000),
                    point(4, 900, 1000),
                ],
                "A"
            ),
            set(2, [
                point(1, 1000, 900),
                ...Array.from({ length: extraPoints }, (_, i) =>
                    point(i + 2, 1000, 950)
                ),
            ]),
        ],
    });

const renderBoard = (view: PublicH2hView, stations: StationInfo[] = []) =>
    render(
        <H2hScoreboard
            view={view}
            match={view.matches[0]}
            stations={stations}
        />
    );

const markers = (side: string, setNumber: number) =>
    within(
        within(screen.getByRole("region", { name: side })).getByRole("list", {
            name: `Set ${setNumber}`,
        })
    )
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-marker"));

describe("H2hScoreboard", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows both competitors, their sets and the format", () => {
        renderBoard(playing());
        expect(
            screen.getByText("First to 2 sets · first to 3 points")
        ).toBeTruthy();
        const a = screen.getByRole("region", { name: "Competitor 1" });
        const b = screen.getByRole("region", { name: "Competitor 4" });
        expect(within(a).getByLabelText("Sets won").textContent).toBe("1");
        expect(within(b).getByLabelText("Sets won").textContent).toBe("0");
        expect(markers("Competitor 1", 1)).toEqual([
            "won",
            "none",
            "won",
            "won",
        ]);
        expect(markers("Competitor 4", 1)).toEqual([
            "lost",
            "none",
            "lost",
            "lost",
        ]);
        // Set 2 at 0–1: four more points can still be needed
        expect(markers("Competitor 1", 2)).toEqual([
            "lost",
            "pending",
            "pending",
            "pending",
            "pending",
        ]);
        expect(
            within(b).getByLabelText("Point 1: won", { selector: "li" })
        ).toBeTruthy();
    });

    it("runs each side's station timer, found by registrant id", () => {
        renderBoard(playing(), [station(101, 5230)]);
        const a = screen.getByRole("region", { name: "Competitor 1" });
        const live = a.querySelector("[data-live]");
        expect(live?.textContent).toBe("5.23");
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(a.querySelector("[data-live]")?.textContent).toBe("6.23");
        // No station for B: their time on the last point
        const b = screen.getByRole("region", { name: "Competitor 4" });
        expect(b.querySelector("[data-live]")).toBeNull();
        expect(b.textContent).toContain("9.00");
    });

    it("lights up the winner of a new point for a few seconds", () => {
        const { rerender } = renderBoard(playing());
        // Nothing lights up for what was decided before it opened
        expect(document.querySelector("[data-lit]")).toBeNull();

        const next = playing(1);
        rerender(
            <H2hScoreboard view={next} match={next.matches[0]} stations={[]} />
        );
        const b = screen.getByRole("region", { name: "Competitor 4" });
        expect(b.getAttribute("data-lit")).toBe("true");
        // Both times of that point
        expect(b.textContent).toContain("9.50");
        expect(
            screen.getByRole("region", { name: "Competitor 1" }).textContent
        ).toContain("10.00");

        act(() => {
            vi.advanceTimersByTime(POINT_LIT_MS);
        });
        expect(document.querySelector("[data-lit]")).toBeNull();
    });

    it("announces the winner and who they play next", () => {
        const view = withMatch(playing(), 1, {
            status: "FINISHED",
            winnerSide: "A",
            endedBy: "PLAYED",
            score: { a: 2, b: 0 },
        });
        renderBoard(view);
        expect(screen.getByRole("status").textContent).toBe(
            "Competitor 1 wins Semifinal 1Next: Final against Winner of SF 2"
        );
    });

    it("has no banner while the match is on", () => {
        renderBoard(playing());
        expect(screen.queryByRole("status")).toBeNull();
    });
});
