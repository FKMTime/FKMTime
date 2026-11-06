import {
    AttendanceStatistics,
    MissedAssignments,
    StaffActivity,
    StaffActivityStatus,
} from "./interfaces";
import { queryFamily } from "./queryCache";
import { backendQuery, backendRequest } from "./request";

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

export const markAsPresentButReplaced = async (id: string) => {
    const response = await backendRequest(
        `attendance/present-replaced/${id}`,
        "POST",
        true
    );
    return response.status;
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
