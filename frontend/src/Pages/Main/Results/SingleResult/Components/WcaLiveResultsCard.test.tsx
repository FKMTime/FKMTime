import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Attempt, IntegratedLiveResultView, Result } from "@/lib/interfaces";
import { ConfirmProvider } from "@/providers/ConfirmProvider";

import WcaLiveResultsCard from "./WcaLiveResultsCard";

const view = vi.hoisted(() => ({ current: undefined as unknown }));
const rules = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({ data: rules.current }),
}));

vi.mock("@/hooks/useIntegratedLiveRound", () => ({
    useIntegratedLiveRound: () => ({
        byResultId: new Map(view.current ? [["res1", view.current]] : []),
    }),
}));

const result = {
    id: "res1",
    roundId: "333-r1",
    person: { name: "Anna Example" },
} as unknown as Result;

const attempt = (value: number) =>
    ({ value, penalty: 0 }) as unknown as Attempt;

const base: IntegratedLiveResultView = {
    resultId: "res1",
    personId: "p1",
    registrationId: 301,
    status: "CONFIRMED",
    error: null,
    sentAt: null,
    advancing: null,
    wcaAttempts: [1000, 1100],
    differs: false,
};

const renderCard = () =>
    render(
        <ConfirmProvider>
            <WcaLiveResultsCard
                result={result}
                submittedAttempts={[attempt(1000), attempt(1100)]}
            />
        </ConfirmProvider>
    );

describe("WcaLiveResultsCard", () => {
    it("shows nothing unless results go to WCA Integrated Live Results", () => {
        view.current = undefined;
        const { container } = renderCard();
        expect(container.textContent).toBe("");
    });

    it("says a matching result is confirmed, without a differences table", () => {
        view.current = base;
        renderCard();
        expect(screen.getByText("Confirmed")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("lists the WCA's attempts next to FKMTime's when they differ", () => {
        view.current = { ...base, wcaAttempts: [1000, -1], differs: true };
        renderCard();
        expect(screen.getByText("Differs")).toBeTruthy();
        const rows = screen.getAllByRole("row").map((r) => r.textContent);
        expect(rows).toEqual(["#FKMTimeWCA", "110.0010.00", "211.00DNF"]);
        expect(
            screen.getByRole("button", { name: "Clear in WCA live results" })
        ).toBeTruthy();
    });

    it("gives the reason when the WCA didn't take the result", () => {
        view.current = {
            ...base,
            status: "NOT_IN_ROUND",
            error: "Didn't advance to 333-r2 in WCA Integrated Live Results",
            wcaAttempts: null,
        };
        renderCard();
        expect(screen.getByText("Not in round")).toBeTruthy();
        expect(
            screen.getByText(
                "Didn't advance to 333-r2 in WCA Integrated Live Results"
            )
        ).toBeTruthy();
    });

    it("gives the rule and a link when the event isn't on their registration", () => {
        view.current = {
            ...base,
            status: "NOT_IN_ROUND",
            error: "Not registered for 333 on the WCA website",
            wcaAttempts: null,
        };
        rules.current = {
            eventChangeDeadline: null,
            onTheSpotRegistration: false,
            competitorLimit: null,
        };
        renderCard();
        expect(screen.getByText(/WCRP 6\.4\.2\b/)).toBeTruthy();
    });
});
