import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyDelegateGrant } from "@/lib/delegateGrants";

import DelegateAccessBanner from "./DelegateAccessBanner";

const grant = (fields: Partial<MyDelegateGrant>): MyDelegateGrant => ({
    id: "grant-1",
    userId: "user-1",
    groupId: "333-r1-g2",
    groupName: "3x3x3 Cube, Round 1, Group 2",
    roundId: "333-r1",
    permissions: ["GIVE_EXTRA"],
    createdAt: "2026-01-01T10:00:00Z",
    activatedAt: "2026-01-01T10:00:00Z",
    endedAt: null,
    createdBy: { id: "d", fullName: "Invented Delegate" },
    active: true,
    ...fields,
});

describe("DelegateAccessBanner", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("says nothing without access", () => {
        const { container } = render(<DelegateAccessBanner grants={[]} />);
        expect(container.textContent).toBe("");
    });

    it("names the group, who gave it and when it ends", () => {
        render(<DelegateAccessBanner grants={[grant({})]} />);
        expect(
            screen.getByText(
                "Delegate access for 3x3x3 Cube, Round 1, Group 2, given by Invented Delegate. Ends when the group ends."
            )
        ).toBeTruthy();
    });

    it("says access waits for the group to start", () => {
        render(<DelegateAccessBanner grants={[grant({ active: false })]} />);
        expect(screen.getByText(/Starts when the group starts\./)).toBeTruthy();
    });

    it("says for a while that access ended", () => {
        const { rerender } = render(
            <DelegateAccessBanner grants={[grant({})]} />
        );
        rerender(<DelegateAccessBanner grants={[]} />);
        expect(
            screen.getByText(
                "Your delegate access for 3x3x3 Cube, Round 1, Group 2 has ended."
            )
        ).toBeTruthy();

        act(() => vi.advanceTimersByTime(10_000));
        expect(screen.queryByText(/has ended/)).toBeNull();
    });
});
