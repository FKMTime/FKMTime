import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DNF_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Competition,
    ResultToDoubleCheck,
} from "@/lib/interfaces";

import ResultCheckCard from "./ResultCheckCard";

const competition = {
    wcif: {
        events: [
            {
                id: "333",
                rounds: [
                    {
                        id: "333-r1",
                        format: "a",
                        timeLimit: {
                            centiseconds: 6000,
                            cumulativeRoundIds: [],
                        },
                        cutoff: null,
                        advancementCondition: null,
                        results: [],
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

const attempt = (n: number, value: number): Attempt =>
    ({
        id: `a${n}`,
        resultId: "res1",
        attemptNumber: n,
        value,
        penalty: 0,
        replacedBy: null,
        status: AttemptStatus.STANDARD,
        type: AttemptType.STANDARD_ATTEMPT,
    }) as Attempt;

const result = {
    id: "res1",
    roundId: "333-r1",
    eventId: "333",
    combinedName: "Anna Example (7)",
    person: { name: "Anna Example", registrantId: 7 },
    attempts: [
        attempt(1, 1000),
        attempt(2, 1100),
        attempt(3, 1200),
        attempt(4, 900),
        attempt(5, 1300),
    ],
} as unknown as ResultToDoubleCheck;

const renderCard = (overrides = {}) => {
    const props = {
        result,
        competition,
        cumulativeLimit: null,
        isSubmitting: false,
        updateAttempt: vi.fn(),
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
    render(
        <MemoryRouter>
            <ResultCheckCard {...props} />
        </MemoryRouter>
    );
    return props;
};

describe("ResultCheckCard", () => {
    it("shows the competitor with average, best and the limit", () => {
        renderCard();
        expect(screen.getByRole("heading").textContent).toBe(
            "Anna Example (7)"
        );
        expect(screen.getByText("Average 11.00 · Best 9.00")).toBeTruthy();
        expect(screen.getByText("Limit 1:00.00")).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "Details" }).getAttribute("href")
        ).toBe("/results/res1");
    });

    it("confirms and skips", () => {
        const { onConfirm, onSkip } = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        fireEvent.click(screen.getByRole("button", { name: "Skip" }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onSkip).toHaveBeenCalledOnce();
    });

    it("turns a time over the limit into a DNF", () => {
        const { updateAttempt } = renderCard();
        const input = screen.getAllByPlaceholderText("Time")[0];
        fireEvent.change(input, { target: { value: "10000" } });
        fireEvent.blur(input);
        expect(updateAttempt).toHaveBeenCalledWith(
            expect.objectContaining({ id: "a1", penalty: DNF_VALUE })
        );
    });
});
