import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { competitionAtom } from "@/lib/atoms";
import {
    AttemptStatus,
    Competition,
    Person as PersonData,
} from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";

import Person from "./Person";

const person = {
    id: "p1",
    registrantId: 7,
    name: "Anna Example",
    wcaId: "2019EXAM01",
} as PersonData;

vi.mock("@/lib/persons", () => ({
    getPersonById: vi.fn(() => Promise.resolve(person)),
}));
vi.mock("@/lib/results", () => ({
    getAllResultsByPersonId: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/attendance", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getStaffActivitiesByPersonId: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/warnings", () => ({
    getWarningsForPerson: vi.fn(() =>
        Promise.resolve([
            {
                id: "w1",
                description: "Left the station early",
                createdAt: "2026-04-18T10:00:00Z",
                createdBy: { fullName: "Dana Delegate" },
            },
        ])
    ),
    deleteWarning: vi.fn(),
}));
vi.mock("@/lib/incidents", () => ({
    getIncidentsForPerson: vi.fn(() =>
        Promise.resolve({
            attempts: [
                {
                    id: "a1",
                    attemptNumber: 2,
                    value: 1234,
                    penalty: 0,
                    status: AttemptStatus.EXTRA_GIVEN,
                    solvedAt: "2026-04-18T08:10:00Z",
                    result: {
                        id: "r1",
                        roundId: "333-r1",
                        eventId: "333",
                        person: { id: "p2", name: "Ben Example" },
                    },
                },
            ],
            manual: [
                {
                    id: "m1",
                    roundId: "333-r1",
                    description: "Misscramble reported late",
                },
            ],
            noteworthy: [],
        })
    ),
}));
vi.mock("@/lib/permissions", () => ({
    isDelegate: vi.fn(() => true),
    isOrganizerOrDelegate: vi.fn(() => true),
    isStageLeaderOrOrganizerOrDelegate: vi.fn(() => true),
}));

const competition = {
    useFkmTimeDevices: true,
    wcif: {
        events: [],
        schedule: {
            venues: [
                {
                    timezone: "UTC",
                    rooms: [
                        {
                            name: "Main Hall",
                            activities: [
                                {
                                    id: 1,
                                    activityCode: "333-r1",
                                    name: "3x3x3 Cube, Round 1",
                                    startTime: "2026-04-18T08:00:00Z",
                                    endTime: "2026-04-18T09:00:00Z",
                                    childActivities: [
                                        {
                                            id: 11,
                                            activityCode: "333-r1-g1",
                                            name: "",
                                            startTime: "2026-04-18T08:00:00Z",
                                            endTime: "2026-04-18T09:00:00Z",
                                            childActivities: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        persons: [
            {
                registrantId: 7,
                assignments: [
                    {
                        activityId: 11,
                        assignmentCode: "staff-judge",
                        stationNumber: 3,
                    },
                ],
            },
        ],
    },
} as unknown as Competition;

const renderAt = (path: string) => {
    const store = createStore();
    store.set(competitionAtom, competition);
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/persons/:id/:tab?" element={<Person />} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

describe("Person", () => {
    beforeEach(() => vi.mocked(isDelegate).mockReturnValue(true));

    it("opens on the schedule built from the assignments", async () => {
        renderAt("/persons/p1");
        expect(
            await screen.findByRole("tab", { name: /Schedule/, selected: true })
        ).toBeTruthy();
        expect(screen.getByText("Judge")).toBeTruthy();
        expect(screen.getByText("Main Hall · Station 3")).toBeTruthy();
    });

    it("lists incidents as competitor and as judge", async () => {
        renderAt("/persons/p1/incidents");
        expect(await screen.findByText("Judged Ben Example")).toBeTruthy();
        expect(screen.getByText("Extra granted")).toBeTruthy();
        expect(screen.getByText("As judge")).toBeTruthy();
        expect(screen.getByText("Misscramble reported late")).toBeTruthy();
        expect(
            await screen.findByRole("tab", { name: /Incidents\s*2/ })
        ).toBeTruthy();
    });

    it("lists warnings with who issued them", async () => {
        renderAt("/persons/p1/warnings");
        expect(await screen.findByText("Left the station early")).toBeTruthy();
        expect(screen.getByText(/by Dana Delegate/)).toBeTruthy();
    });

    it("hides incidents and warnings from non-delegates", async () => {
        vi.mocked(isDelegate).mockReturnValue(false);
        renderAt("/persons/p1/warnings");
        expect(
            await screen.findByRole("tab", { name: /Schedule/, selected: true })
        ).toBeTruthy();
        expect(screen.queryByRole("tab", { name: /Warnings/ })).toBeNull();
        expect(screen.queryByRole("tab", { name: /Incidents/ })).toBeNull();
    });
});
