import { prettyActivityName } from "./activities";
import { Attendance } from "./interfaces";
import { backendRequest } from "./request";
import { attendanceRoleToWcif } from "./utils";

export const getAttendanceByGroupId = async (groupId: string) => {
    const response = await backendRequest(
        `attendance/group/${groupId}`,
        "GET",
        true
    );
    return await response.json();
};

export const getAttendanceByPersonId = async (id: string) => {
    const response = await backendRequest(
        `attendance/person/${id}`,
        "GET",
        true
    );
    return await response.json();
};

export const markAsPresent = async (
    groupId: string,
    registrantId: number,
    role: string
) => {
    const response = await backendRequest(
        `attendance/mark-as-present`,
        "POST",
        true,
        {
            groupId,
            registrantId,
            role,
        }
    );
    return response.status;
};

export const wasPresent = (
    attendance: Attendance[],
    activityCode: string,
    role: string
) => {
    if (attendance.find((a) => a.groupId === activityCode)) {
        const data = attendance.find((a) => a.groupId === activityCode);
        const wcifRole = attendanceRoleToWcif(data?.role as string);
        if (role === wcifRole) {
            return "Yes";
        } else {
            return `As ${prettyActivityName(wcifRole as string).toLowerCase()}`;
        }
    }
    return "No";
};
