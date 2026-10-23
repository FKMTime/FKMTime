import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Person } from "@/lib/interfaces";
import { enterScorecard, getResultByRoundIdAndPersonId } from "@/lib/results";

import EnterScorecard from "./EnterScorecard";

const persons = [
    { id: "p3", registrantId: 3, name: "Casey Tester" },
] as Person[];

vi.mock("@/lib/persons", () => ({
    getAllPersons: vi.fn(() => Promise.resolve(persons)),
}));
vi.mock("@/lib/results", () => ({
    getResultByRoundIdAndPersonId: vi.fn(),
    enterScorecard: vi.fn(),
    checkTimeLimit: vi.fn(() => true),
}));

const competition = {
    wcif: {
        events: [
            {
                id: "333",
                rounds: [
                    {
                        id: "333-r1",
                        format: "a",
                        timeLimit: {
                            centiseconds: 60000,
                            cumulativeRoundIds: [],
                        },
                        cutoff: null,
                        results: [],
                    },
                ],
            },
        ],
        schedule: { venues: [] },
    },
} as unknown as Competition;

// Persons load asynchronously; keep typing the ID until it is matched
const typeId = async (value: string) => {
    const idInput = screen.getByPlaceholderText("ID");
    await waitFor(() => {
        fireEvent.change(idInput, { target: { value: "" } });
        fireEvent.change(idInput, { target: { value } });
        expect(getResultByRoundIdAndPersonId).toHaveBeenCalled();
    });
    return idInput;
};

const renderPage = () => {
    const store = createStore();
    store.set(competitionAtom, competition);
    render(
        <Provider store={store}>
            <MemoryRouter
                initialEntries={["/results/round/333-r1/enter-scorecard"]}
            >
                <Routes>
                    <Route
                        path="/results/round/:id/enter-scorecard"
                        element={<EnterScorecard />}
                    />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

describe("EnterScorecard", () => {
    beforeEach(() => {
        vi.mocked(getResultByRoundIdAndPersonId).mockReset();
        vi.mocked(getResultByRoundIdAndPersonId).mockResolvedValue({
            status: 200,
            data: {
                id: "res3",
                roundId: "333-r1",
                person: persons[0],
                attempts: [],
            },
        } as never);
        vi.mocked(enterScorecard).mockResolvedValue({
            status: 200,
            data: {},
        } as never);
    });

    it("stays on the page, ready for the next scorecard", async () => {
        renderPage();
        const idInput = await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });

        fireEvent.click(screen.getByRole("button", { name: "Save scorecard" }));

        expect((await screen.findByRole("status")).textContent).toContain(
            "Saved Casey Tester's scorecard"
        );
        expect(
            screen
                .getByRole("link", { name: "Open result" })
                .getAttribute("href")
        ).toBe("/results/res3");
        expect((idInput as HTMLInputElement).value).toBe("");
        expect(
            screen.queryByRole("heading", { name: /Casey Tester/ })
        ).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(idInput));
    });

    it("keeps the scorecard and shows the error when saving fails", async () => {
        vi.mocked(enterScorecard).mockResolvedValue({
            status: 400,
            data: { message: "Time limit exceeded" },
        } as never);
        renderPage();
        await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });
        fireEvent.click(screen.getByRole("button", { name: "Save scorecard" }));
        expect((await screen.findByRole("alert")).textContent).toBe(
            "Time limit exceeded"
        );
        expect(
            screen.getByRole("heading", { name: /Casey Tester/ })
        ).toBeTruthy();
    });

    it("sets DNF with D and DNS with S in a time field", async () => {
        renderPage();
        await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });
        const [first, second] = [
            screen.getByLabelText("Attempt 1 time"),
            screen.getByLabelText("Attempt 2 time"),
        ];

        await userEvent.type(first, "d");
        await userEvent.type(second, "S");

        const rows = screen.getAllByRole("row");
        expect(rows[1].textContent).toContain("DNF");
        expect(rows[2].textContent).toContain("DNS");
        expect((first as HTMLInputElement).value).not.toContain("d");
    });
});
