import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { getExtrasContext, giveExtras } from "@/lib/attempt";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Competition,
    SendingResultsFrequency,
} from "@/lib/interfaces";

import GiveExtrasModal from "./GiveExtrasModal";

vi.mock("@/lib/attempt", () => ({
    getExtrasContext: vi.fn(),
    giveExtras: vi.fn(),
}));
vi.mock("@/Components/QuickActions", () => ({ default: () => null }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const attempt = (id: string, attemptNumber: number) =>
    ({
        id,
        attemptNumber,
        type: AttemptType.STANDARD_ATTEMPT,
        status: AttemptStatus.STANDARD,
        replacedBy: null,
        penalty: 0,
        value: 1234,
    }) as unknown as Attempt;

const threeAttempts = [attempt("s1", 1), attempt("s2", 2), attempt("s3", 3)];

const renderModal = ({
    attempts = threeAttempts,
    frequency = SendingResultsFrequency.AFTER_SOLVE,
    ...props
}: {
    attempts?: Attempt[];
    frequency?: SendingResultsFrequency;
    lockedAttempt?: Attempt;
    beforeGrant?: (comment: string) => Promise<string | undefined>;
} = {}) => {
    const store = createStore();
    store.set(competitionAtom, {
        sendingResultsFrequency: frequency,
        wcif: {
            events: [{ id: "333", rounds: [{ id: "333-r1", format: "a" }] }],
        },
    } as unknown as Competition);
    const onDone = vi.fn();
    render(
        <Provider store={store}>
            <GiveExtrasModal
                isOpen
                onClose={vi.fn()}
                onDone={onDone}
                resultId="result-1"
                roundId="333-r1"
                personName="Anna Example"
                attempts={attempts}
                {...props}
            />
        </Provider>
    );
    return onDone;
};

describe("GiveExtrasModal", () => {
    beforeEach(() => {
        vi.mocked(giveExtras).mockReset();
        vi.mocked(giveExtras).mockResolvedValue({ status: 200 });
        vi.mocked(getExtrasContext).mockResolvedValue({
            hasNextGroup: true,
            nextRoundStarted: false,
            restorableGrantId: null,
            restorableAttemptIds: [],
        });
    });

    it("says what will happen and ticks every attempt", async () => {
        renderModal();

        expect(
            await screen.findByText(
                /Attempts 1, 2 and 3 will no longer count\. Anna Example redoes them, then continues from attempt 4\./
            )
        ).toBeTruthy();
        expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(
            4
        );
    });

    it("gives a fresh set for three attempts by default", async () => {
        const onDone = renderModal();

        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(giveExtras).toHaveBeenCalledWith({
            resultId: "result-1",
            attemptIds: ["s1", "s2", "s3"],
            comment: "",
            useFreshSet: true,
            removeFromLive: true,
        });
    });

    it("uses extras for fewer attempts and says how many", async () => {
        renderModal();

        await userEvent.click(
            screen.getByRole("checkbox", { name: /Attempt 3/ })
        );

        expect(
            await screen.findByText("This needs 2 extra scrambles.")
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );
        expect(giveExtras).toHaveBeenCalledWith(
            expect.objectContaining({
                attemptIds: ["s1", "s2"],
                useFreshSet: false,
            })
        );
    });

    it("lets the delegate change the scrambles", async () => {
        renderModal();

        await userEvent.click(screen.getByText("Extra scrambles"));
        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        expect(giveExtras).toHaveBeenCalledWith(
            expect.objectContaining({ useFreshSet: false })
        );
    });

    it("hints at adding a set when no later group follows", async () => {
        vi.mocked(getExtrasContext).mockResolvedValue({
            hasNextGroup: false,
            nextRoundStarted: false,
            restorableGrantId: null,
            restorableAttemptIds: [],
        });
        renderModal();

        expect(
            await screen.findByText(/Generate a set and add it under Scrambles/)
        ).toBeTruthy();
    });

    it("warns when the next round has started", async () => {
        vi.mocked(getExtrasContext).mockResolvedValue({
            hasNextGroup: true,
            nextRoundStarted: true,
            restorableGrantId: null,
            restorableAttemptIds: [],
        });
        renderModal();

        expect(
            await screen.findByText(/The next round has started/)
        ).toBeTruthy();
    });

    it("can leave the times on WCA Live", async () => {
        renderModal();

        await userEvent.click(
            screen.getByRole("checkbox", {
                name: "Remove these times from WCA Live now",
            })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        expect(giveExtras).toHaveBeenCalledWith(
            expect.objectContaining({ removeFromLive: false })
        );
    });

    it("hides the WCA Live option when results are never sent", async () => {
        renderModal({ frequency: SendingResultsFrequency.NEVER });

        expect(
            screen.queryByRole("checkbox", {
                name: "Remove these times from WCA Live now",
            })
        ).toBeNull();
        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        expect(giveExtras).toHaveBeenCalledWith(
            expect.objectContaining({ removeFromLive: false })
        );
    });

    it("saves the incident first and keeps it in the list", async () => {
        const beforeGrant = vi.fn().mockResolvedValue(undefined);
        renderModal({
            attempts: threeAttempts.slice(0, 2),
            lockedAttempt: attempt("s3", 3),
            beforeGrant,
        });

        expect(
            await screen.findByText(/Attempts 1, 2 and 3 will no longer count/)
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        await waitFor(() => expect(giveExtras).toHaveBeenCalled());
        expect(beforeGrant).toHaveBeenCalled();
        expect(vi.mocked(giveExtras).mock.calls[0][0].attemptIds).toEqual([
            "s1",
            "s2",
        ]);
    });

    it("stops when saving the incident fails", async () => {
        renderModal({
            attempts: threeAttempts.slice(0, 2),
            lockedAttempt: attempt("s3", 3),
            beforeGrant: vi.fn().mockResolvedValue("Could not save"),
        });

        await userEvent.click(
            screen.getByRole("button", { name: "Give extras" })
        );

        expect(await screen.findByText("Could not save")).toBeTruthy();
        expect(giveExtras).not.toHaveBeenCalled();
    });
});
