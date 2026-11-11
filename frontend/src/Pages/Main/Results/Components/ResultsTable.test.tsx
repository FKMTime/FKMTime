import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Result } from "@/lib/interfaces";
import { RankedResult } from "@/lib/ranking";
import { ConfirmProvider } from "@/providers/ConfirmProvider";

import ResultsTable from "./ResultsTable";

const row = {
    result: {
        id: "res1",
        roundId: "333-r1",
        person: { name: "Anna Example", registrantId: 7 },
        attempts: [],
    } as unknown as Result,
    position: 1,
    submitted: [],
    average: 1000,
} as RankedResult;

describe("ResultsTable", () => {
    it("opens the result as the primary action and deletes from the menu", async () => {
        render(
            <ConfirmProvider>
                <MemoryRouter initialEntries={["/results/round/333-r1"]}>
                    <Routes>
                        <Route
                            path="/results/round/:id"
                            element={
                                <ResultsTable
                                    rows={[row]}
                                    maxAttempts={5}
                                    onDeleted={vi.fn()}
                                />
                            }
                        />
                        <Route
                            path="/results/:id"
                            element={<p>Result page</p>}
                        />
                    </Routes>
                </MemoryRouter>
            </ConfirmProvider>
        );
        const desktopRow = screen.getAllByRole("row")[1];
        expect(desktopRow.textContent).toContain("Anna Example (7)");
        expect(desktopRow.textContent).toContain("10.00");

        await userEvent.click(
            within(desktopRow).getByRole("button", {
                name: "More actions for Anna Example",
            })
        );
        const items = await screen.findAllByRole("menuitem");
        expect(items.map((i) => i.textContent)).toEqual(["Delete result"]);
        await userEvent.keyboard("{Escape}");

        await userEvent.click(
            within(desktopRow).getByRole("button", { name: "View attempts" })
        );
        expect(await screen.findByText("Result page")).toBeTruthy();
    });
});
