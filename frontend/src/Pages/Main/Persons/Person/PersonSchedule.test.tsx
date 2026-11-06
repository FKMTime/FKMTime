import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { StaffActivityStatus } from "@/lib/interfaces";
import { PersonScheduleEntry } from "@/lib/personSchedule";

import PersonSchedule from "./PersonSchedule";

const entry = (
    key: string,
    startTime: string,
    extra: Partial<PersonScheduleEntry> = {}
): PersonScheduleEntry => ({
    key,
    activityCode: `333-r1-g${key}`,
    name: `Group ${key}`,
    role: "Judge",
    isCompetitor: false,
    stationNumber: null,
    roomName: "Main Hall",
    timezone: "UTC",
    startTime,
    endTime: startTime.replace("T08", "T09"),
    isAssigned: true,
    ...extra,
});

const now = new Date("2026-04-18T12:00:00Z");

describe("PersonSchedule", () => {
    it("offers Not coming only for days with staffing still to come", async () => {
        const onSetNoShow = vi.fn();
        render(
            <MemoryRouter>
                <PersonSchedule
                    entries={[
                        entry("1", "2026-04-18T08:00:00Z"),
                        entry("2", "2026-04-19T08:00:00Z"),
                    ]}
                    canOpenAttendance={false}
                    onSetNoShow={onSetNoShow}
                    now={now}
                />
            </MemoryRouter>
        );
        const buttons = screen.getAllByRole("button", { name: "Not coming" });
        expect(buttons).toHaveLength(1);
        await userEvent.click(buttons[0]);
        expect(onSetNoShow).toHaveBeenCalledWith("2026-04-19", true);
    });

    it("shows a day off and lets them come after all", async () => {
        const onSetNoShow = vi.fn();
        render(
            <MemoryRouter>
                <PersonSchedule
                    entries={[
                        entry("2", "2026-04-19T08:00:00Z", {
                            attendance: StaffActivityStatus.ABSENT,
                            noShow: true,
                            replacedByName: "Ann Cover",
                        }),
                    ]}
                    canOpenAttendance={false}
                    onSetNoShow={onSetNoShow}
                    now={now}
                />
            </MemoryRouter>
        );
        expect(screen.getByText("Not coming")).toBeTruthy();
        expect(screen.getByText("Covered by Ann Cover")).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Coming after all" })
        );
        expect(onSetNoShow).toHaveBeenCalledWith("2026-04-19", false);
    });
});
