import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Competition,
} from "@/lib/interfaces";

import AttemptForm from "./AttemptForm";

vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const competition = {
    wcif: { events: [{ id: "333", rounds: [{ id: "333-r1", format: "a" }] }] },
} as unknown as Competition;

const renderForm = (
    attempt?: Attempt,
    existingAttempts?: Pick<Attempt, "attemptNumber" | "type">[]
) => {
    const handleSubmit = vi.fn();
    const store = createStore();
    store.set(competitionAtom, competition);
    render(
        <Provider store={store}>
            <AttemptForm
                attempt={attempt}
                competitorId="p1"
                existingAttempts={existingAttempts}
                roundId="333-r1"
                isLoading={false}
                handleSubmit={handleSubmit}
            />
        </Provider>
    );
    return handleSubmit;
};

const typeTime = (time: string) => {
    const input = screen.getByLabelText(/^Time/);
    fireEvent.change(input, { target: { value: time } });
    fireEvent.blur(input);
};

describe("AttemptForm", () => {
    it("starts a new attempt at the competitor's next one", () => {
        renderForm(undefined, [
            { attemptNumber: 1, type: AttemptType.STANDARD_ATTEMPT },
            { attemptNumber: 2, type: AttemptType.STANDARD_ATTEMPT },
        ]);
        expect(
            screen
                .getByRole("radio", { name: "Attempt 3" })
                .getAttribute("aria-checked")
        ).toBe("true");
    });

    it("saves a counted attempt with type and number from the attempt chips", async () => {
        const handleSubmit = renderForm();
        await userEvent.click(screen.getByRole("radio", { name: "Attempt 3" }));
        typeTime("984");
        await userEvent.click(
            screen.getByRole("button", { name: "Save attempt" })
        );
        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                type: AttemptType.STANDARD_ATTEMPT,
                attemptNumber: 3,
                status: AttemptStatus.STANDARD,
                value: 984,
                replacedBy: 0,
            })
        );
    });

    it("turns Extra granted into the extra-given status with its replacement", async () => {
        const handleSubmit = renderForm();
        await userEvent.click(
            screen.getByRole("radio", { name: "Extra granted" })
        );
        expect(screen.getByText(/optional/)).toBeTruthy();
        await userEvent.click(
            screen.getByRole("radio", { name: "Replaced by E1" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Save attempt" })
        );
        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                status: AttemptStatus.EXTRA_GIVEN,
                replacedBy: 1,
                type: AttemptType.STANDARD_ATTEMPT,
                attemptNumber: 1,
            })
        );
    });

    it("asks for a time instead of saving an empty counted attempt", async () => {
        const handleSubmit = renderForm();
        await userEvent.click(
            screen.getByRole("button", { name: "Save attempt" })
        );
        expect(screen.getByRole("alert").textContent).toBe(
            "Enter the time, or choose DNF or DNS."
        );
        expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("keeps an open incident's state and resolves it when it counts", async () => {
        const handleSubmit = renderForm({
            id: "a1",
            type: AttemptType.EXTRA_ATTEMPT,
            attemptNumber: 1,
            status: AttemptStatus.UNRESOLVED,
            value: 1234,
            penalty: 0,
            replacedBy: null,
        } as Attempt);
        expect(
            screen
                .getByRole("radio", { name: "Extra attempt 1" })
                .getAttribute("aria-checked")
        ).toBe("true");
        expect(
            screen
                .getByRole("radio", { name: "Open incident" })
                .getAttribute("aria-checked")
        ).toBe("true");
        await userEvent.click(screen.getByRole("radio", { name: "Counts" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Save attempt" })
        );
        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                status: AttemptStatus.RESOLVED,
                type: AttemptType.EXTRA_ATTEMPT,
                value: 1234,
            })
        );
    });

    it("saves the typed time when Enter is pressed in the time field", async () => {
        const handleSubmit = renderForm();
        await userEvent.type(screen.getByLabelText(/^Time/), "1102{Enter}");
        await vi.waitFor(() =>
            expect(handleSubmit).toHaveBeenCalledWith(
                expect.objectContaining({ value: 1102 })
            )
        );
    });
});
