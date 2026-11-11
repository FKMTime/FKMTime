import { UserInfo } from "@/lib/interfaces";
import { prettyUserRoleName } from "@/lib/utils";

const ROLE_PRIORITY = [
    "ADMIN",
    "DELEGATE",
    "ORGANIZER",
    "STAGE_LEADER",
    "STAFF",
];

/** "Delegate · WCA account" */
export const getAccountDescription = (userInfo: UserInfo) => {
    const role = ROLE_PRIORITY.find((r) =>
        userInfo.roles.map(String).includes(r)
    );
    const account = userInfo.wcaAccessToken ? "WCA account" : "FKMTime account";
    return role ? `${prettyUserRoleName(role)} · ${account}` : account;
};
