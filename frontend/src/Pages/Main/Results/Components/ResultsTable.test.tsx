import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Result } from "@/lib/interfaces";
import { RankedResult } from "@/lib/ranking";
import { ConfirmProvider } from "@/providers/ConfirmProvider";

import ResultsTable, { ResultsTableLive } from "./ResultsTable";

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

    it("shows WCA live results flags, badges and results only the WCA has", async () => {
        const onClearOnlyInWca = vi.fn();
        const live: ResultsTableLive = {
            byResultId: new Map([
                [
                    "res1",
                    {
                        resultId: "res1",
                        personId: "p1",
                        registrationId: 301,
                        status: "REJECTED",
                        error: "Not registered for 333 on the WCA website",
                        sentAt: null,
                        advancing: "mayAdvance",
                        wcaAttempts: null,
                        differs: false,
                    },
                ],
            ]),
            onlyInWca: [
                {
                    registrationId: 305,
                    name: "Typed In Example",
                    wcaId: null,
                    attempts: [1500, -1],
                },
            ],
            itemsFor: () => [],
            onClearOnlyInWca,
        };
        render(
            <ConfirmProvider>
                <MemoryRouter>
                    <ResultsTable
                        rows={[row]}
                        maxAttempts={5}
                        onDeleted={vi.fn()}
                        live={live}
                    />
                </MemoryRouter>
            </ConfirmProvider>
        );
        const [, desktopRow, onlyRow] = screen.getAllByRole("row");
        expect(desktopRow.textContent).toContain("May advance");
        expect(
            within(desktopRow).getByTitle(
                "Not registered for 333 on the WCA website"
            ).textContent
        ).toBe("Not accepted");

        expect(onlyRow.textContent).toContain("Typed In Example");
        expect(onlyRow.textContent).toContain("Only in WCA live results");
        expect(onlyRow.textContent).toContain("15.00");
        expect(onlyRow.textContent).toContain("DNF");
        await userEvent.click(
            within(onlyRow).getByRole("button", {
                name: "More actions for Typed In Example",
            })
        );
        await userEvent.click(
            await screen.findByRole("menuitem", {
                name: "Clear in WCA live results",
            })
        );
        expect(onClearOnlyInWca).toHaveBeenCalledWith(live.onlyInWca[0]);
    });
});
