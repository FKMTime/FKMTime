import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { dnfAttempts, getExtrasContext } from "@/lib/attempt";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Competition,
    SendingResultsFrequency,
} from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import DnfAttemptsModal from "./DnfAttemptsModal";

vi.mock("@/lib/attempt", () => {
    const mocks = {
        getExtrasContext: vi.fn(),
        dnfAttempts: vi.fn(),
    };
    return {
        ...mocks,
        extrasContextQuery: (id: string) => ({
            key: `attempt/give-extras-for-all/${id}`,
            fetch: () => mocks.getExtrasContext(id),
        }),
    };
});
vi.mock("@/Components/QuickActions", () => ({
    default: () => null,
}));
vi.mock("@/hooks/useToast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

const attempt = (id: string, attemptNumber: number, penalty = 0) =>
    ({
        id,
        attemptNumber,
        type: AttemptType.STANDARD_ATTEMPT,
        status: AttemptStatus.STANDARD,
        replacedBy: null,
        penalty,
        value: 1234,
    }) as unknown as Attempt;

const firstRound = {
    id: "result-1",
    roundId: "333-r1",
    attempts: [attempt("a1", 1), attempt("a2", 2, -1), attempt("a3", 3)],
};
const secondRound = {
    id: "result-2",
    roundId: "333-r2",
    attempts: [attempt("b1", 1, 2)],
};

const renderModal = (
    results = [firstRound],
    frequency = SendingResultsFrequency.AFTER_SOLVE
) => {
    const store = createStore();
    store.set(competitionAtom, {
        sendingResultsFrequency: frequency,
        wcif: { events: [] },
    } as unknown as Competition);
    const onDone = vi.fn();
    renderWithQueryClient(
        <Provider store={store}>
            <DnfAttemptsModal
                isOpen
                onClose={vi.fn()}
                onDone={onDone}
                personName="Anna Example"
                results={results}
            />
        </Provider>
    );
    return onDone;
};

beforeEach(() => clearQueryCache());

describe("DnfAttemptsModal", () => {
    beforeEach(() => {
        vi.mocked(dnfAttempts).mockReset();
        vi.mocked(dnfAttempts).mockResolvedValue({ status: 200 });
        vi.mocked(getExtrasContext).mockResolvedValue({
            hasNextGroup: false,
            nextRoundStarted: false,
            grant: null,
        });
    });

    it("ticks every attempt that is not already DNF", async () => {
        const onDone = renderModal();

        expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(
            2
        );
        expect(
            screen.getByText(/These 2 attempts count as DNF for Anna Example/)
        ).toBeTruthy();

        await userEvent.click(
            screen.getByRole("button", { name: "Set to DNF" })
        );
        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(dnfAttempts).toHaveBeenCalledWith({
            attemptIds: ["a1", "a3"],
            comment: "",
        });
    });

    it("only sets the ticked attempts", async () => {
        renderModal();

        await userEvent.click(
            screen.getByRole("checkbox", { name: /Attempt 1/ })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Set to DNF" })
        );

        expect(dnfAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ attemptIds: ["a3"] })
        );
    });

    it("covers every round of an event", async () => {
        renderModal([firstRound, secondRound]);

        expect(screen.getByText(/R1$/)).toBeTruthy();
        expect(screen.getByText(/R2$/)).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Set to DNF" })
        );

        expect(dnfAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ attemptIds: ["a1", "a3", "b1"] })
        );
        expect(getExtrasContext).toHaveBeenCalledWith("result-2");
    });

    it("warns when the next round has started", async () => {
        vi.mocked(getExtrasContext).mockResolvedValue({
            hasNextGroup: false,
            nextRoundStarted: true,
            grant: null,
        });
        renderModal();

        expect(
            await screen.findByText(/The next round has started/)
        ).toBeTruthy();
    });

    it("says nothing about WCA Live on a competition that never sends", () => {
        renderModal([firstRound], SendingResultsFrequency.NEVER);

        expect(screen.queryByText(/sent to WCA Live/)).toBeNull();
    });

    it("shows what went wrong", async () => {
        vi.mocked(dnfAttempts).mockResolvedValue({
            status: 409,
            message: "Resolve the open incident first",
        });
        renderModal();

        await userEvent.click(
            screen.getByRole("button", { name: "Set to DNF" })
        );

        expect(
            await screen.findByText("Resolve the open incident first")
        ).toBeTruthy();
    });
});
