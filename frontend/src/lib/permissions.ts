import { getUserInfo } from "./auth";

const checkRoles = (roles: string[]) => {
    const userInfo = getUserInfo();
    if (userInfo === null) {
        return false;
    }
    return (
        roles.some((role) => userInfo.roles.includes(role)) ||
        userInfo.roles.includes("ADMIN")
    );
};

export const isOrganizerOrDelegate = () => {
    return checkRoles(["ORGANIZER", "DELEGATE"]);
};

export const isAdmin = () => {
    return checkRoles(["ADMIN"]);
};

export const isDelegate = () => {
    return checkRoles(["DELEGATE"]);
};

export const isOrganizer = () => {
    return checkRoles(["ORGANIZER"]);
};

export const isStageLeaderOrOrganizerOrDelegate = () => {
    return checkRoles(["STAGE_LEADER", "ORGANIZER", "DELEGATE"]);
};
