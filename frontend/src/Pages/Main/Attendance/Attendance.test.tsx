import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueryCache } from "@/lib/queryCache";
import { renderWithQueryClient } from "@/test/queryClient";

import AttendanceStatistics from "./AttendanceStatistics/AttendanceStatistics";
import MostMissedAssignments from "./MostMissedAssignments/MostMissedAssignments";

const { activities, statistics } = vi.hoisted(() => {
    const person = (
        personId: string,
        personName: string,
        roles: string[],
        counts: Record<string, number | null>
    ) => ({
        personId,
        personName,
        roles,
        assigned: 0,
        present: 0,
        late: 0,
        absent: 0,
        replaced: 0,
        leftEarly: 0,
        noShow: 0,
        extraHelp: 0,
        attendancePct: null,
        ...counts,
    });
    const summary = (counts: Record<string, number | null>) => ({
        attendancePct: null,
        covered: 0,
        expected: 0,
        late: 0,
        replaced: 0,
        absent: 0,
        leftEarly: 0,
        noShows: 0,
        extraHelp: 0,
        ...counts,
    });
    const ben = person("p2", "Ben Test", ["JUDGE"], {
        assigned: 2,
        present: 1,
        absent: 1,
        attendancePct: 50,
    });
    const ada = person("p1", "Ada Demo", ["JUDGE", "RUNNER"], {
        assigned: 3,
        present: 3,
        late: 1,
        attendancePct: 100,
    });
    const cy = person("p3", "Cy Helper", ["RUNNER"], { extraHelp: 2 });
    return {
        activities: (n: number) =>
            Array.from({ length: n }, (_, i) => ({
                id: `x${i}`,
                groupId: "333-r1-g1",
                role: "JUDGE",
            })),
        statistics: {
            summary: summary({
                attendancePct: 80,
                covered: 4,
                expected: 5,
                late: 1,
                absent: 1,
                noShows: 1,
                extraHelp: 2,
            }),
            persons: [ada, ben, cy],
            rounds: [
                {
                    roundId: "222-r1",
                    roundName: "2x2 - R1",
                    expected: 2,
                    covered: 2,
                    attendancePct: 100,
                },
                {
                    roundId: "333-r1",
                    roundName: "3x3 - R1",
                    expected: 3,
                    covered: 2,
                    attendancePct: 66.7,
                },
            ],
            byRole: {
                JUDGE: {
                    summary: summary({
                        attendancePct: 75,
                        covered: 3,
                        expected: 4,
                        absent: 1,
                    }),
                    persons: [
                        { ...ada, roles: ["JUDGE"], assigned: 2, present: 2 },
                        ben,
                    ],
                    rounds: [],
                },
                RUNNER: {
                    summary: summary({
                        attendancePct: 100,
                        covered: 1,
                        expected: 1,
                        late: 1,
                        extraHelp: 2,
                    }),
                    persons: [
                        {
                            ...ada,
                            roles: ["RUNNER"],
                            assigned: 1,
                            present: 1,
                        },
                        cy,
                    ],
                    rounds: [],
                },
            },
        },
    };
});
vi.mock("@/lib/attendance", () => ({
    attendanceStatisticsQuery: {
        key: "attendance/statistics",
        fetch: vi.fn().mockResolvedValue(statistics),
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
    const renderPage = () =>
        renderWithQueryClient(
            <MemoryRouter>
                <AttendanceStatistics />
            </MemoryRouter>
        );
    const tile = (label: string) =>
        screen.getByText(label, { selector: "dt" }).parentElement!;
    const names = () =>
        screen
            .getAllByRole("row")
            .slice(1)
            .map(
                (row) =>
                    within(row).getAllByRole("cell")[0].firstChild?.textContent
            );

    it("shows summary tiles and the per-round breakdown", async () => {
        renderPage();
        expect(
            await screen.findByText("4 of 5 assignments covered")
        ).toBeTruthy();
        expect(within(tile("Attendance")).getByText("80%")).toBeTruthy();
        expect(within(tile("Extra help")).getByText("2")).toBeTruthy();
        expect(screen.getByText("1 not coming for the day")).toBeTruthy();
        const rounds = within(
            screen.getByRole("region", { name: "By round" })
        ).getAllByRole("listitem");
        expect(rounds.map((round) => round.getAttribute("aria-label"))).toEqual(
            ["2x2 - R1: 100%, 2 of 2 covered", "3x3 - R1: 67%, 2 of 3 covered"]
        );
    });

    it("sorts by column, keeps extra-help-only people last, and searches", async () => {
        renderPage();
        await screen.findByText("4 of 5 assignments covered");
        // Lowest attendance first; no percentage goes last
        expect(names()).toEqual(["Ben Test", "Ada Demo", "Cy Helper"]);
        await userEvent.click(
            screen.getByRole("button", { name: /Attendance/ })
        );
        expect(names()).toEqual(["Ada Demo", "Ben Test", "Cy Helper"]);
        await userEvent.click(
            screen.getByRole("button", { name: /Extra help/ })
        );
        expect(names()[2]).toBe("Cy Helper");
        await userEvent.type(screen.getByLabelText("Search staff"), "ben");
        expect(names()).toEqual(["Ben Test"]);
    });

    it("filters everything by role", async () => {
        renderPage();
        await screen.findByText("4 of 5 assignments covered");
        await userEvent.click(screen.getByRole("radio", { name: "Runner" }));
        expect(screen.getByText("1 of 1 assignments covered")).toBeTruthy();
        expect(names()).toEqual(["Ada Demo", "Cy Helper"]);
        // The per-round breakdown has nothing for this role
        expect(screen.queryByRole("region", { name: "By round" })).toBeNull();
        await userEvent.click(screen.getByRole("radio", { name: "All roles" }));
        expect(names()).toHaveLength(3);
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
