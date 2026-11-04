import { Activity, Competition as WCIF } from "wcif-helpers";

import { getActivityName } from "./activities";
import { StaffActivity, StaffActivityStatus } from "./interfaces";

export interface PersonScheduleEntry {
    key: string;
    activityCode: string;
    /** "3x3x3 Cube · Round 1 · Group 2", or the name of an other activity */
    name: string;
    /** "Competitor", "Judge", "Scrambler", … */
    role: string;
    isCompetitor: boolean;
    stationNumber: number | null;
    roomName: string;
    timezone: string;
    startTime: string;
    endTime: string;
    /** False for staffing the person was added to on the day */
    isAssigned: boolean;
    /** Staff attendance once it is known; never set for competing */
    attendance?: StaffActivityStatus;
}

interface ScheduledActivity {
    activity: Activity;
    roomName: string;
    timezone: string;
}

const ROLE_LABELS: Record<string, string> = {
    competitor: "Competitor",
    "staff-judge": "Judge",
    "staff-scrambler": "Scrambler",
    "staff-runner": "Runner",
    "staff-delegate": "Delegate",
    "staff-dataentry": "Data entry",
    "staff-announcer": "Announcer",
};

/** Attendance role of a WCIF assignment, as the backend stores it */
const ATTENDANCE_ROLES: Record<string, string> = {
    competitor: "COMPETITOR",
    "staff-judge": "JUDGE",
    "staff-scrambler": "SCRAMBLER",
    "staff-runner": "RUNNER",
    "staff-delegate": "DELEGATE",
};

const ASSIGNMENT_CODES = Object.fromEntries(
    Object.entries(ATTENDANCE_ROLES).map(([code, role]) => [role, code])
);

export const assignmentRoleLabel = (assignmentCode: string) => {
    if (ROLE_LABELS[assignmentCode]) return ROLE_LABELS[assignmentCode];
    const name = assignmentCode.replace(/^staff-/, "").replace(/-/g, " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
};

const attendanceRole = (assignmentCode: string) =>
    ATTENDANCE_ROLES[assignmentCode] ?? "STAFF_OTHER";

/** Every activity in the schedule, groups included, by WCIF id and code */
const indexActivities = (wcif: WCIF) => {
    const byId = new Map<number, ScheduledActivity>();
    const byCode = new Map<string, ScheduledActivity>();
    const visit = (
        activity: Activity,
        roomName: string,
        timezone: string
    ): void => {
        const entry = { activity, roomName, timezone };
        byId.set(activity.id, entry);
        if (!byCode.has(activity.activityCode))
            byCode.set(activity.activityCode, entry);
        activity.childActivities?.forEach((child) =>
            visit(child, roomName, timezone)
        );
    };
    wcif.schedule.venues.forEach((venue) =>
        venue.rooms.forEach((room) =>
            room.activities.forEach((activity) =>
                visit(activity, room.name, venue.timezone)
            )
        )
    );
    return { byId, byCode };
};

/**
 * Status worth showing: a recorded one as soon as it is set, "Absent" only
 * once the group is over, since that is also the status before anyone scans.
 */
const visibleAttendance = (
    staffActivity: StaffActivity | undefined,
    endTime: string,
    now: Date
) => {
    if (!staffActivity) return undefined;
    if (staffActivity.status !== StaffActivityStatus.ABSENT)
        return staffActivity.status;
    return new Date(endTime) <= now ? staffActivity.status : undefined;
};

/**
 * The person's WCIF assignments in time order, with staff attendance from
 * the given staff activities and any staffing they did without assignment.
 */
export const getPersonSchedule = (
    wcif: WCIF,
    registrantId: number | null | undefined,
    staffActivities: StaffActivity[] = [],
    now = new Date()
): PersonScheduleEntry[] => {
    const wcifPerson = registrantId
        ? wcif.persons.find((person) => person.registrantId === registrantId)
        : undefined;
    const { byId, byCode } = indexActivities(wcif);
    const attendanceKey = (groupId: string, role: string) =>
        `${groupId}|${role}`;
    const attendance = new Map(
        staffActivities.map((activity) => [
            attendanceKey(activity.groupId, activity.role),
            activity,
        ])
    );
    const used = new Set<string>();

    const entries: PersonScheduleEntry[] = [];
    (wcifPerson?.assignments ?? []).forEach((assignment, index) => {
        const scheduled = byId.get(assignment.activityId);
        if (!scheduled) return;
        const { activity, roomName, timezone } = scheduled;
        const isCompetitor = assignment.assignmentCode === "competitor";
        const key = attendanceKey(
            activity.activityCode,
            attendanceRole(assignment.assignmentCode)
        );
        used.add(key);
        entries.push({
            key: `${assignment.activityId}-${assignment.assignmentCode}-${index}`,
            activityCode: activity.activityCode,
            name: getActivityName(activity).replace(/, /g, " · "),
            role: assignmentRoleLabel(assignment.assignmentCode),
            isCompetitor,
            stationNumber: assignment.stationNumber,
            roomName,
            timezone,
            startTime: activity.startTime,
            endTime: activity.endTime,
            isAssigned: true,
            attendance: isCompetitor
                ? undefined
                : visibleAttendance(attendance.get(key), activity.endTime, now),
        });
    });

    staffActivities
        .filter(
            (staffActivity) =>
                staffActivity.role !== "COMPETITOR" &&
                !used.has(
                    attendanceKey(staffActivity.groupId, staffActivity.role)
                )
        )
        .forEach((staffActivity) => {
            const scheduled = byCode.get(staffActivity.groupId);
            if (!scheduled) return;
            const { activity, roomName, timezone } = scheduled;
            const code = ASSIGNMENT_CODES[staffActivity.role] ?? "staff-other";
            entries.push({
                key: staffActivity.id,
                activityCode: activity.activityCode,
                name: getActivityName(activity).replace(/, /g, " · "),
                role: assignmentRoleLabel(code),
                isCompetitor: false,
                stationNumber: null,
                roomName,
                timezone,
                startTime: activity.startTime,
                endTime: activity.endTime,
                isAssigned: staffActivity.isAssigned,
                attendance: visibleAttendance(
                    staffActivity,
                    activity.endTime,
                    now
                ),
            });
        });

    return entries.sort(
        (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
            Number(b.isCompetitor) - Number(a.isCompetitor)
    );
};

/** "YYYY-MM-DD" of an instant in the venue's timezone */
export const venueDay = (time: string, timezone: string) =>
    new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
    }).format(new Date(time));

/** Entries split by competition day, days in order */
export const groupScheduleByDay = (entries: PersonScheduleEntry[]) => {
    const days = new Map<string, PersonScheduleEntry[]>();
    entries.forEach((entry) => {
        const day = venueDay(entry.startTime, entry.timezone);
        days.set(day, [...(days.get(day) ?? []), entry]);
    });
    return [...days.entries()].map(([day, dayEntries]) => ({
        day,
        entries: dayEntries,
    }));
};
