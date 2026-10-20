import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Competition,
    Result,
} from "@/lib/interfaces";

import WarningsAndLimitsCard from "./WarningsAndLimitsCard";

const attempt = (n: number, value: number): Attempt =>
    ({
        id: `a${n}`,
        attemptNumber: n,
        value,
        penalty: 0,
        replacedBy: null,
        status: AttemptStatus.STANDARD,
        type: AttemptType.STANDARD_ATTEMPT,
    }) as Attempt;

const submitted = [attempt(1, 1000), attempt(2, 1100)];

const competitionWithLive = (liveValues: number[]) =>
    ({
        wcif: {
            events: [
                {
                    id: "333",
                    rounds: [
                        {
                            id: "333-r1",
                            format: "a",
                            cutoff: null,
                            timeLimit: null,
                            results: [
                                {
                                    personId: 7,
                                    attempts: liveValues.map((value) => ({
                                        value,
                                    })),
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }) as unknown as Competition;

const result = {
    id: "res1",
    eventId: "333",
    roundId: "333-r1",
    person: { registrantId: 7 },
    attempts: submitted,
} as unknown as Result;

const renderCard = (liveValues: number[]) =>
    render(
        <WarningsAndLimitsCard
            competition={competitionWithLive(liveValues)}
            result={result}
            submittedAttempts={submitted}
            limit={{ centiseconds: 60000, cumulativeRoundIds: [] }}
            maxAttempts={5}
        />
    );

describe("WarningsAndLimitsCard", () => {
    it("shows no warnings when FKMTime matches WCA Live", () => {
        renderCard([1000, 1100]);
        expect(screen.getByText("No warnings")).toBeTruthy();
        expect(screen.queryByText("Differs from WCA Live")).toBeNull();
    });

    it("flags a mismatch with WCA Live", () => {
        renderCard([1000, 1200]);
        expect(screen.getByText("Differs from WCA Live")).toBeTruthy();
        expect(screen.queryByText("No warnings")).toBeNull();
    });

    it("shows the round limits", () => {
        renderCard([1000, 1100]);
        expect(screen.getByText("10:00.00")).toBeTruthy();
        expect(screen.getByText("5")).toBeTruthy();
    });
});
