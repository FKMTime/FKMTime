import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import AttendanceStatistics from "./AttendanceStatistics/AttendanceStatistics";
import MostMissedAssignments from "./MostMissedAssignments/MostMissedAssignments";

const { activities } = vi.hoisted(() => ({
    activities: (n: number) =>
        Array.from({ length: n }, (_, i) => ({
            id: `x${i}`,
            groupId: "333-r1-g1",
            role: "JUDGE",
        })),
}));

vi.mock("@/lib/attendance", () => ({
    attendanceStatisticsQuery: {
        key: "attendance/statistics",
        fetch: vi.fn().mockResolvedValue([
            {
                personName: "Ben Test",
                presentPercentage: 50,
                totalAssignedStaffing: 4,
                totalPresentAtStaffingComparedToRounds: 1,
                totalStaffingComparedToRounds: 2,
            },
            {
                personName: "Ada Demo",
                presentPercentage: 100,
                totalAssignedStaffing: 3,
                totalPresentAtStaffingComparedToRounds: 3,
                totalStaffingComparedToRounds: 3,
            },
        ]),
    },
    mostMissedAssignmentsQuery: {
        key: "attendance/missed",
        fetch: vi.fn().mockResolvedValue([
            {
                person: { id: "p1", name: "Ada Demo", registrantId: 1 },
                missedAssignments: activities(2),
                missedAssignmentsCount: 2,
                lateAssignments: [],
                lateAssignmentsCount: 0,
                presentButReplacedAssignments: [],
                presentButReplacedAssignmentsCount: 0,
                leftEarlyAssignments: [],
                leftEarlyAssignmentsCount: 0,
                noShowAssignments: activities(1),
                noShowAssignmentsCount: 1,
                comments: [],
                commentsCount: 0,
            },
            {
                person: { id: "p2", name: "Ben Test", registrantId: 2 },
                missedAssignments: [],
                missedAssignmentsCount: 0,
                lateAssignments: activities(1),
                lateAssignmentsCount: 1,
                presentButReplacedAssignments: [],
                presentButReplacedAssignmentsCount: 0,
                leftEarlyAssignments: activities(1),
                leftEarlyAssignmentsCount: 1,
                noShowAssignments: [],
                noShowAssignmentsCount: 0,
                comments: [],
                commentsCount: 0,
            },
        ]),
    },
}));

beforeEach(() => clearQueryCache());

describe("AttendanceStatistics", () => {
    it("summarises attendance and sorts by column", async () => {
        renderWithQueryClient(
            <MemoryRouter>
                <AttendanceStatistics />
            </MemoryRouter>
        );
        expect(
            await screen.findByText(
                "80% staffing attendance · 4 of 5 assignments"
            )
        ).toBeTruthy();
        const names = () =>
            screen
                .getAllByRole("row")
                .slice(1)
                .map((row) => within(row).getAllByRole("cell")[0].textContent);
        // Lowest attendance first by default
        expect(names()).toEqual(["Ben Test", "Ada Demo"]);
        await userEvent.click(
            screen.getByRole("button", { name: /Attendance/ })
        );
        expect(names()).toEqual(["Ada Demo", "Ben Test"]);
    });
});

describe("MostMissedAssignments", () => {
    it("filters people by what they missed and shows count chips", async () => {
        renderWithQueryClient(
            <MemoryRouter>
                <MostMissedAssignments />
            </MemoryRouter>
        );
        expect(await screen.findByText("2 missed")).toBeTruthy();
        expect(screen.getByText("1 late")).toBeTruthy();
        await userEvent.click(screen.getByRole("radio", { name: /Late/ }));
        expect(screen.queryByText("2 missed")).toBeNull();
        expect(screen.getByText("1 late")).toBeTruthy();
    });

    it("filters by who left early and who wasn't coming", async () => {
        renderWithQueryClient(
            <MemoryRouter>
                <MostMissedAssignments />
            </MemoryRouter>
        );
        expect(await screen.findByText("1 not coming")).toBeTruthy();
        expect(screen.getByText("1 left early")).toBeTruthy();
        await userEvent.click(
            screen.getByRole("radio", { name: /Left early/ })
        );
        expect(screen.queryByText("Ada Demo")).toBeNull();
        expect(screen.getByText("Ben Test")).toBeTruthy();
        await userEvent.click(
            screen.getByRole("radio", { name: /Not coming/ })
        );
        expect(screen.getByText("Ada Demo")).toBeTruthy();
        expect(screen.queryByText("Ben Test")).toBeNull();
    });
});
