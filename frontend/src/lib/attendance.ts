import { StaffActivityStatus } from "./interfaces";
import { backendRequest } from "./request";

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

export const getAttendanceStatistics = async () => {
    const response = await backendRequest(`attendance/statistics`, "GET", true);
    return await response.json();
};

export const getMostMissedAssignments = async () => {
    const response = await backendRequest(`attendance/missed`, "GET", true);
    return await response.json();
};

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
