import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Attempt, AttemptStatus, AttemptType } from "@/lib/interfaces";

import AttemptWarnings from "./AttemptWarnings";

const attempt: Attempt = {
    id: "attempt",
    resultId: "result",
    attemptNumber: 1,
    penalty: 0,
    status: AttemptStatus.STANDARD,
    type: AttemptType.STANDARD_ATTEMPT,
    solvedAt: new Date(),
    value: 1000,
};

describe("AttemptWarnings", () => {
    it("shows the role, group, and staffed attempt with a link for review", () => {
        render(
            <MemoryRouter>
                <AttemptWarnings
                    attempt={{
                        ...attempt,
                        inspectionTime: 16000,
                        staffingWarnings: [
                            {
                                role: "SCRAMBLER",
                                groupId: "333-r1-g2",
                                staffedAttemptId: "staffed",
                                staffedResultId: "bob-result",
                                staffedPersonName: "Bob",
                                staffedAttemptNumber: 2,
                                staffedAttemptType: AttemptType.EXTRA_ATTEMPT,
                            },
                        ],
                    }}
                />
            </MemoryRouter>
        );
        expect(
            screen
                .getByRole("link", {
                    name: "Scrambled Bob's attempt E2 before competing in group 2",
                })
                .getAttribute("href")
        ).toBe("/results/bob-result");
        expect(screen.getByText(/Inspection:/)).toBeTruthy();
    });

    it("renders attempts without staffing warnings", () => {
        const { container } = render(<AttemptWarnings attempt={attempt} />);
        expect(container.innerHTML).toBe("");
    });
});
