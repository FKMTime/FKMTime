import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";

const addUnassignedPerson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/attendance", () => ({ addUnassignedPerson }));
vi.mock("@/Components/PersonAutocomplete", () => ({
    default: ({ onSelect }: { onSelect: (p: unknown) => void }) => (
        <button
            type="button"
            onClick={() => onSelect({ id: "p-1", name: "Ada Example" })}
        >
            Pick Ada
        </button>
    ),
}));

const activity = (role: string, personId: string) =>
    ({
        id: `${role}-${personId}`,
        groupId: "333-r1-g1",
        role,
        status: StaffActivityStatus.ABSENT,
        isAssigned: true,
        person: { id: personId, name: "Someone" },
    }) as StaffActivity;

const renderModal = (role: string, groupAttendance: StaffActivity[]) => {
    const onClose = vi.fn();
    render(
        <AddNotAssignedPersonModal
            isOpen
            onClose={onClose}
            groupId="333-r1-g1"
            role={role}
            groupAttendance={groupAttendance}
        />
    );
    return { onClose };
};

describe("AddNotAssignedPersonModal", () => {
    beforeEach(() => {
        addUnassignedPerson.mockReset();
    });

    it("warns when the person is competing in this group, and still adds them", async () => {
        addUnassignedPerson.mockResolvedValue({ status: 201 });
        const { onClose } = renderModal("JUDGE", [
            activity("COMPETITOR", "p-1"),
        ]);

        await userEvent.click(screen.getByRole("button", { name: "Pick Ada" }));

        expect(screen.getByRole("alert").textContent).toBe(
            "Ada Example is competing in this group. Add them as judge anyway?"
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Add anyway" })
        );
        expect(addUnassignedPerson).toHaveBeenCalledWith(
            "333-r1-g1",
            "p-1",
            "JUDGE"
        );
        expect(onClose).toHaveBeenCalled();
    });

    it("does not warn when the person is not competing in this group", async () => {
        renderModal("JUDGE", [
            activity("COMPETITOR", "p-2"),
            activity("SCRAMBLER", "p-1"),
        ]);

        await userEvent.click(screen.getByRole("button", { name: "Pick Ada" }));

        expect(screen.queryByText(/is competing/)).toBeNull();
        expect(
            screen.getByRole("button", { name: "Add and mark as present" })
        ).toBeTruthy();
    });

    it("does not warn when adding them as a competitor", async () => {
        renderModal("COMPETITOR", [activity("COMPETITOR", "p-1")]);

        await userEvent.click(screen.getByRole("button", { name: "Pick Ada" }));

        expect(screen.queryByText(/is competing/)).toBeNull();
    });

    it("shows the backend's reason when the person is already in this role", async () => {
        addUnassignedPerson.mockResolvedValue({
            status: 409,
            message:
                "This person is already marked as late in this role in this group.",
        });
        const { onClose } = renderModal("RUNNER", []);

        await userEvent.click(screen.getByRole("button", { name: "Pick Ada" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Add and mark as present" })
        );

        expect(
            await screen.findByText(
                "This person is already marked as late in this role in this group."
            )
        ).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
