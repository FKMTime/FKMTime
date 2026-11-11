import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import MostMissedAssignments from "./MostMissedAssignments";

vi.mock("@/lib/attendance", () => ({
    attendanceStatisticsQuery: {
        key: "attendance/statistics",
        fetch: () => new Promise(() => {}),
    },
    mostMissedAssignmentsQuery: {
        key: "attendance/missed",
        fetch: () => new Promise(() => {}),
    },
}));

beforeEach(() => clearQueryCache());

describe("MostMissedAssignments", () => {
    it("keeps the attendance tabs on screen while the list loads", () => {
        renderWithQueryClient(
            <MemoryRouter>
                <MostMissedAssignments />
            </MemoryRouter>
        );
        expect(screen.getByRole("tab", { name: /Groups/ })).toBeTruthy();
        expect(screen.getByRole("tab", { name: /Most missed/ })).toBeTruthy();
        expect(
            screen.getByLabelText("Loading missed assignments")
        ).toBeTruthy();
    });
});
