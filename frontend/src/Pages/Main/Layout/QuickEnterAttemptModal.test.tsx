import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { createAttempt } from "@/lib/attempt";
import { AttemptType, Competition, Person } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { getResultsByRoundId } from "@/lib/results";
import { renderWithQueryClient } from "@/test/queryClient";

import QuickEnterAttemptModal from "./QuickEnterAttemptModal";

vi.mock("@/lib/persons", () => {
    const mocks = {
        getAllPersons: vi.fn().mockResolvedValue([
            {
                id: "p1",
                registrantId: 7,
                name: "Anna Example",
                canCompete: true,
            } as Person,
        ]),
    };
    return {
        ...mocks,
        allPersonsQuery: {
            key: "person/all?",
            fetch: () => mocks.getAllPersons(),
        },
    };
});
vi.mock("@/lib/attempt", () => ({
    createAttempt: vi.fn(),
}));
vi.mock("@/lib/results", () => {
    const mocks = {
        getResultsByRoundId: vi.fn(),
    };
    return {
        ...mocks,
        roundResultsQuery: (roundId: string) => ({
            key: `result/round/${roundId}`,
            fetch: () => mocks.getResultsByRoundId(roundId),
        }),
    };
});
vi.mock("@/hooks/useToast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

const competition = {
    wcif: {
        events: [{ id: "333", rounds: [{ id: "333-r1", format: "a" }] }],
        persons: [{ registrantId: 7, registration: { eventIds: ["333"] } }],
    },
} as unknown as Competition;

const renderModal = (onClose = vi.fn()) => {
    const store = createStore();
    store.set(competitionAtom, competition);
    renderWithQueryClient(
        <Provider store={store}>
            <QuickEnterAttemptModal
                isOpen
                onClose={onClose}
                roundOptions={[
                    { roundId: "333-r1", meta: "Main room · Group 1" },
                ]}
            />
        </Provider>
    );
    return onClose;
};

beforeEach(() => clearQueryCache());

describe("QuickEnterAttemptModal", () => {
    beforeEach(() => {
        vi.mocked(createAttempt).mockReset();
        vi.mocked(getResultsByRoundId).mockResolvedValue([]);
        localStorage.setItem(
            "fkmtime-events",
            JSON.stringify([
                { id: "333", name: "3x3x3 Cube", shortName: "3x3" },
            ])
        );
    });

    it("saves an attempt from the keyboard alone", async () => {
        vi.mocked(createAttempt).mockResolvedValue({ status: 201 } as never);
        const onClose = renderModal();

        await userEvent.type(
            screen.getByPlaceholderText("Type a name or registrant ID"),
            "anna{Enter}"
        );
        expect(screen.getByText("Anna Example")).toBeTruthy();

        await userEvent.click(screen.getByRole("radio", { name: "Attempt 2" }));
        await userEvent.type(screen.getByLabelText("Time"), "984{Enter}");

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(createAttempt).toHaveBeenCalledWith(
            expect.objectContaining({
                roundId: "333-r1",
                competitorId: "p1",
                attemptNumber: 2,
                type: AttemptType.STANDARD_ATTEMPT,
                value: 984,
                penalty: 0,
            })
        );
    });

    it("preselects the competitor's next free attempt", async () => {
        vi.mocked(getResultsByRoundId).mockResolvedValue([
            {
                person: { id: "p1" },
                attempts: [1, 2].map((attemptNumber) => ({
                    attemptNumber,
                    type: AttemptType.STANDARD_ATTEMPT,
                })),
            },
        ]);
        renderModal();
        await waitFor(() => expect(getResultsByRoundId).toHaveBeenCalled());

        await userEvent.type(
            screen.getByPlaceholderText("Type a name or registrant ID"),
            "anna{Enter}"
        );
        expect(
            screen
                .getByRole("radio", { name: "Attempt 3" })
                .getAttribute("aria-checked")
        ).toBe("true");
    });

    it("explains what is missing instead of saving", async () => {
        renderModal();
        await userEvent.click(
            screen.getByRole("button", { name: "Save attempt" })
        );
        expect(screen.getByRole("alert").textContent).toContain(
            "Choose a competitor."
        );
        expect(createAttempt).not.toHaveBeenCalled();
    });
});
