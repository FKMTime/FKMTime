import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import JudgesCard from "./JudgesCard";

vi.mock("./AddNotAssignedPersonModal", () => ({ default: () => null }));
vi.mock("./DetailsModal", () => ({ default: () => null }));

const attendance = [
    {
        id: "judge",
        groupId: "333-r1-g1",
        role: "JUDGE",
        person: { name: "Test Judge" },
        device: { name: "12" },
        status: StaffActivityStatus.PRESENT,
        isAssigned: true,
    },
] as StaffActivity[];

const props = {
    attendance,
    groupId: "333-r1-g1",
    fetchData: vi.fn(),
    handleMarkAsPresent: vi.fn(),
    handleMarkAsAbsent: vi.fn(),
    handleMarkAsLate: vi.fn(),
    handleMarkAsPresentButReplaced: vi.fn(),
};

describe("JudgesCard", () => {
    it("hides recorded stations for running judges", () => {
        render(<JudgesCard {...props} showStations={false} />);

        expect(screen.getByText("Test Judge")).toBeTruthy();
        expect(screen.queryByText(/station 12/)).toBeNull();
    });

    it("shows stations with assigned runners and updates when switching rounds", () => {
        const { rerender } = render(
            <JudgesCard {...props} showStations={true} />
        );

        expect(screen.getByText(/Test Judge - station 12/)).toBeTruthy();

        rerender(<JudgesCard {...props} showStations={false} />);

        expect(screen.getByText("Test Judge")).toBeTruthy();
        expect(screen.queryByText(/station 12/)).toBeNull();
    });
});
