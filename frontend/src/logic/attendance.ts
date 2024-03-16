import { backendRequest } from "./request.ts";
import { Attendance } from "./interfaces.ts";
import { prettyActivityName } from "./activities.ts";
import { attendanceRoleToWcif } from "./utils.ts";

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
