import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MostMissedAssignments from "./MostMissedAssignments";

vi.mock("@/lib/attendance", () => ({
    getMostMissedAssignments: vi.fn(() => new Promise(() => {})),
}));

describe("MostMissedAssignments", () => {
    it("keeps the attendance tabs on screen while the list loads", () => {
        render(
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
