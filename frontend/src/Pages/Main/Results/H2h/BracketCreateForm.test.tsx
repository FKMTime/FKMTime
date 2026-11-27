import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { H2hRoundView } from "@/lib/h2h";

import BracketCreateForm from "./BracketCreateForm";

const { createBracket } = vi.hoisted(() => ({ createBracket: vi.fn() }));
vi.mock("@/lib/h2h", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    createBracket,
}));

const view = (overrides: Partial<H2hRoundView> = {}): H2hRoundView => ({
    roundId: "333oh-r2",
    eventId: "333oh",
    cannotCreate: null,
    suggestedSize: 12,
    candidates: [],
    bracket: null,
    scramblePlan: null,
    ...overrides,
});

const setsToWin = (stage: string, value: string) =>
    fireEvent.click(
        within(
            screen.getByRole("radiogroup", {
                name: `Sets to win in the ${stage}`,
            })
        ).getByRole("radio", { name: value })
    );

const size = (value: string) =>
    within(screen.getByRole("radiogroup", { name: "Competitors" })).getByRole(
        "radio",
        { name: value }
    );

describe("BracketCreateForm", () => {
    beforeEach(() => createBracket.mockReset());

    it("starts at the suggested size, one set to win per stage", () => {
        render(<BracketCreateForm view={view()} />);

        expect(size("12").getAttribute("aria-checked")).toBe("true");
        expect(
            screen.getAllByRole("radiogroup", { name: /^Sets to win/ })
        ).toHaveLength(5);
    });

    it("explains sets to win the rules forbid, and doesn't create", () => {
        render(<BracketCreateForm view={view({ suggestedSize: 4 })} />);

        setsToWin("Third-place match", "2");

        expect(screen.getByRole("alert").textContent).toBe(
            "Sets to win in the Final can't be lower than in the Third-place match"
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Create bracket",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it("creates with the chosen size and only its stages", async () => {
        createBracket.mockResolvedValue({ ok: true, view: view() });
        render(<BracketCreateForm view={view()} />);

        fireEvent.click(size("4"));
        setsToWin("Final", "2");
        fireEvent.click(screen.getByRole("button", { name: "Create bracket" }));

        await waitFor(() =>
            expect(createBracket).toHaveBeenCalledWith("333oh-r2", {
                size: 4,
                setsToWin: { SEMIFINAL: 1, THIRD_PLACE: 1, FINAL: 2 },
            })
        );
    });

    it("says why a round can't have a bracket", () => {
        render(
            <BracketCreateForm
                view={view({
                    cannotCreate:
                        "Head-to-head rounds can't use a cumulative time limit.",
                })}
            />
        );

        expect(screen.getByRole("alert").textContent).toContain(
            "cumulative time limit"
        );
        expect(
            (
                screen.getByRole("button", {
                    name: "Create bracket",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });
});
