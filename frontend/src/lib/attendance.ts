import { Competition as WCIF } from "wcif-helpers";

import {
    AttendanceStatistics,
    MissedAssignments,
    StaffActivity,
    StaffActivityStatus,
} from "./interfaces";
import { venueDay } from "./personSchedule";
import { queryFamily } from "./queryCache";
import { backendQuery, backendRequest } from "./request";
import { findGroupSchedule } from "./schedule";

export const getRoundStaffing = async (
    roundId: string
): Promise<{ hasAssignedRunners: boolean }> => {
    const response = await backendRequest(
        `attendance/round/${roundId}/staffing`,
        "GET",
        true
    );
    return await response.json();
};

/** Whether a round has runners assigned, so the runner card shows */
export const roundStaffingQuery = queryFamily((roundId) =>
    backendQuery<{ hasAssignedRunners: boolean }>(
        `attendance/round/${roundId}/staffing`
    )
);

/** Everyone assigned to a group, with their attendance */
export const groupAttendanceQuery = queryFamily((groupId) =>
    backendQuery<StaffActivity[]>(`attendance/group/${groupId}`)
);

export const getAttendanceByGroupId = async (groupId: string) => {
    const response = await backendRequest(
        `attendance/group/${groupId}`,
        "GET",
        true
    );
    return await response.json();
};

export const getStaffActivitiesByPersonId = async (id: string) => {
    const response = await backendRequest(
        `attendance/person/${id}`,
        "GET",
        true
    );
    return await response.json();
};

export const markAsPresent = async (id: string) => {
    const response = await backendRequest(
        `attendance/present/${id}`,
        "POST",
        true
    );
    return response.status;
};

export const markAsAbsent = async (id: string) => {
    const response = await backendRequest(
        `attendance/absent/${id}`,
        "POST",
        true
    );
    return response.status;
};

export const markAsLate = async (id: string) => {
    const response = await backendRequest(
        `attendance/late/${id}`,
        "POST",
        true
    );
    return response.status;
};

/** Someone else did the job, whether or not the person was here */
export const markAsReplaced = async (
    id: string,
    wasPresent: boolean,
    replacedById?: string
) => {
    const response = await backendRequest(
        `attendance/replaced/${id}`,
        "POST",
        true,
        { wasPresent, replacedById }
    );
    return response.status;
};

export const setLeftEarly = async (id: string, leftEarly: boolean) => {
    const response = await backendRequest(
        `attendance/left-early/${id}`,
        "PUT",
        true,
        { leftEarly }
    );
    return response.status;
};

/** Tags the person's absent staffing in these groups as not coming */
export const setNoShow = async (
    personId: string,
    groupIds: string[],
    noShow: boolean
) => {
    const response = await backendRequest("attendance/no-show", "POST", true, {
        personId,
        groupIds,
        noShow,
    });
    return response.status;
};

export type AttendanceState = Pick<
    StaffActivity,
    "status" | "leftEarly" | "noShow" | "replacedById"
>;

export const attendanceState = (activity: StaffActivity): AttendanceState => ({
    status: activity.status,
    leftEarly: activity.leftEarly,
    noShow: activity.noShow,
    replacedById: activity.replacedById ?? null,
});

/** Puts a row back as it was, for undo */
export const restoreAttendance = async (id: string, state: AttendanceState) => {
    const response = await backendRequest(
        `attendance/restore/${id}`,
        "PUT",
        true,
        state
    );
    return response.status;
};

/**
 * Groups a person is not coming to if they are out for the rest of `day`:
 * their staffing that day in groups that haven't ended. Only absent rows get
 * tagged, so groups they were at can be included.
 */
export const noShowGroupIds = (
    wcif: WCIF,
    staffActivities: StaffActivity[],
    day: string,
    now = new Date()
) => {
    const groupIds = staffActivities
        .filter((activity) => activity.role !== "COMPETITOR")
        .filter((activity) => {
            const schedule = findGroupSchedule(wcif, activity.groupId);
            return (
                schedule &&
                venueDay(schedule.startTime, schedule.timezone) === day &&
                new Date(schedule.endTime) > now
            );
        })
        .map((activity) => activity.groupId);
    return [...new Set(groupIds)];
};

/** Venue day a group is scheduled on, or undefined if it isn't */
export const groupDay = (wcif: WCIF, groupId: string) => {
    const schedule = findGroupSchedule(wcif, groupId);
    return schedule && venueDay(schedule.startTime, schedule.timezone);
};

export const attendanceStatisticsQuery = backendQuery<AttendanceStatistics[]>(
    "attendance/statistics"
);

export const mostMissedAssignmentsQuery =
    backendQuery<MissedAssignments[]>("attendance/missed");

export const prettyStaffActivityStatus = (status: StaffActivityStatus) => {
    switch (status) {
        case StaffActivityStatus.PRESENT:
            return "Present";
        case StaffActivityStatus.ABSENT:
            return "Absent";
        case StaffActivityStatus.LATE:
            return "Late";
        case StaffActivityStatus.REPLACED:
            return "Replaced";
        default:
            return "Unknown";
    }
};

export const updateComment = async (id: string, comment: string) => {
    const response = await backendRequest(
        `attendance/comment/${id}`,
        "PUT",
        true,
        { comment }
    );
    return response.status;
};

export const addUnassignedPerson = async (
    groupId: string,
    personId: string,
    role: string
) => {
    const response = await backendRequest(
        `attendance/unassigned/${groupId}`,
        "POST",
        true,
        { personId, role }
    );
    return response.status;
};
