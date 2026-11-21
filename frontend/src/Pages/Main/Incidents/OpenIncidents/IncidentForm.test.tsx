import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AttemptStatus, AttemptType, Incident } from "@/lib/interfaces";
import { QueryWrapper } from "@/test/queryClient";

import IncidentForm from "./IncidentForm";

vi.mock("@/Components/PersonAutocomplete", () => ({
    default: () => <input aria-label="Judge" />,
}));

const incident = {
    id: "attempt-1",
    attemptNumber: 2,
    value: 1234,
    penalty: 0,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.UNRESOLVED,
    comment: "",
    result: {
        id: "result-1",
        roundId: "333-r1",
        person: { id: "person-1", name: "Invented Competitor" },
    },
} as unknown as Incident;

const renderForm = (props: Partial<Parameters<typeof IncidentForm>[0]>) =>
    render(
        <IncidentForm
            editedIncident={incident}
            isLoading={false}
            handleSubmit={vi.fn()}
            {...props}
        />,
        { wrapper: QueryWrapper }
    );

describe("IncidentForm", () => {
    it("offers every action to a delegate", () => {
        renderForm({ handleDelete: vi.fn() });
        expect(screen.getByRole("button", { name: "Mark as resolved" }));
        expect(screen.getByRole("button", { name: "Save and give extra" }));
        expect(screen.getByRole("button", { name: "Delete attempt" }));
        expect(screen.getByText("Mark as noteworthy incident")).toBeTruthy();
    });

    it("leaves out what delegate access for a group doesn't include", () => {
        renderForm({ canGiveExtra: false, canMarkNoteworthy: false });
        expect(screen.getByRole("button", { name: "Mark as resolved" }));
        expect(
            screen.queryByRole("button", { name: "Save and give extra" })
        ).toBeNull();
        expect(
            screen.queryByRole("button", { name: "Delete attempt" })
        ).toBeNull();
        expect(screen.queryByText("Mark as noteworthy incident")).toBeNull();
    });
});
