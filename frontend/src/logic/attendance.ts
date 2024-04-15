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

export const markAsPresent = async (
    groupId: string,
    personId: string,
    role: string
) => {
    const response = await backendRequest(
        `attendance/mark-as-present`,
        "POST",
        true,
        {
            groupId,
            personId,
            role,
        }
    );
    return response.status;
};
