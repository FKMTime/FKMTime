import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import { Competition, Person } from "@/lib/interfaces";
import { clearQueryCache } from "@/lib/queryCache";
import { enterScorecard, getResultByRoundIdAndPersonId } from "@/lib/results";
import { renderWithQueryClient } from "@/test/queryClient";

import EnterScorecard from "./EnterScorecard";

const persons = [
    { id: "p3", registrantId: 3, name: "Casey Tester" },
] as Person[];

vi.mock("@/lib/persons", () => {
    const mocks = {
        getAllPersons: vi.fn(() => Promise.resolve(persons)),
    };
    return {
        ...mocks,
        allPersonsQuery: {
            key: "person/all?",
            fetch: () => mocks.getAllPersons(),
        },
    };
});
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

// A time is committed when its field loses focus
const enterFirstTime = () => {
    const firstTime = screen.getByLabelText("Attempt 1 time");
    fireEvent.change(firstTime, { target: { value: "1234" } });
    fireEvent.blur(firstTime);
};

const renderPage = () => {
    const store = createStore();
    store.set(competitionAtom, competition);
    renderWithQueryClient(
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

beforeEach(() => clearQueryCache());

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
        vi.mocked(enterScorecard).mockReset();
        vi.mocked(enterScorecard).mockResolvedValue({
            status: 200,
            data: { resultId: "res3" },
        } as never);
    });

    it("jumps from the ID to the first time, and tabs time to time", async () => {
        renderPage();
        const idInput = await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });

        fireEvent.keyDown(idInput, { key: "Enter" });

        const firstTime = screen.getByLabelText("Attempt 1 time");
        await waitFor(() => expect(document.activeElement).toBe(firstTime));
        // Penalties are left out of the Tab order
        for (const penalty of within(screen.getByRole("table")).getAllByRole(
            "combobox"
        )) {
            expect(penalty.getAttribute("tabindex")).toBe("-1");
        }
        expect(enterScorecard).not.toHaveBeenCalled();
    });

    it("saves with Enter on the last time, then goes back to the ID", async () => {
        renderPage();
        const idInput = await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });

        // Average of 5: the fifth time is the last
        const lastTime = screen.getByLabelText("Attempt 5 time");
        fireEvent.change(lastTime, { target: { value: "1234" } });
        fireEvent.keyDown(lastTime, { key: "Enter" });

        expect((await screen.findByRole("status")).textContent).toContain(
            "Saved Casey Tester's scorecard"
        );
        expect(vi.mocked(enterScorecard).mock.calls[0][0].newAttempts).toEqual([
            expect.objectContaining({ value: 1234 }),
        ]);
        await waitFor(() => expect(document.activeElement).toBe(idInput));
    });

    it("stays on the page, ready for the next scorecard", async () => {
        renderPage();
        const idInput = await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });
        enterFirstTime();

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
        enterFirstTime();
        fireEvent.click(screen.getByRole("button", { name: "Save scorecard" }));
        expect((await screen.findByRole("alert")).textContent).toBe(
            "Time limit exceeded"
        );
        expect(
            screen.getByRole("heading", { name: /Casey Tester/ })
        ).toBeTruthy();
    });

    // Saving is what creates the result, so a blank one must not reach it (#779)
    it("saves nothing from a blank scorecard", async () => {
        vi.mocked(getResultByRoundIdAndPersonId).mockResolvedValue({
            status: 200,
            data: {
                id: null,
                roundId: "333-r1",
                person: persons[0],
                attempts: [],
            },
        } as never);
        renderPage();
        await typeId("3");
        await screen.findByRole("heading", { name: /Casey Tester/ });
        expect(screen.queryByRole("link", { name: "Details" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Save scorecard" }));

        expect((await screen.findByRole("alert")).textContent).toBe(
            "Enter at least one time to save."
        );
        expect(enterScorecard).not.toHaveBeenCalled();
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
