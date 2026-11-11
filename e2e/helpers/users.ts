import { createHmac } from "node:crypto";
import * as path from "node:path";

import { AUTH_DIR, SECRET } from "../env";

export type RoleKey =
    "admin" | "organizer" | "delegate" | "stageLeader" | "staff";

export interface RoleUser {
    id: string;
    username: string;
    password: string;
    fullName: string;
    roles: string[];
}

/** Invented accounts, one per role. Ids are fixed so tokens survive reseeds. */
export const ROLE_USERS: Record<RoleKey, RoleUser> = {
    admin: {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        password: "admin",
        fullName: "Admin",
        roles: ["ADMIN"],
    },
    organizer: {
        id: "00000000-0000-4000-8000-000000000002",
        username: "e2e-organizer",
        password: "organizer-pass-1",
        fullName: "Olive Organizer",
        roles: ["ORGANIZER"],
    },
    delegate: {
        id: "00000000-0000-4000-8000-000000000003",
        username: "e2e-delegate",
        password: "delegate-pass-1",
        fullName: "Dana Delegate",
        roles: ["DELEGATE"],
    },
    stageLeader: {
        id: "00000000-0000-4000-8000-000000000004",
        username: "e2e-stage-leader",
        password: "stage-leader-pass-1",
        fullName: "Sam Stageleader",
        roles: ["STAGE_LEADER"],
    },
    staff: {
        id: "00000000-0000-4000-8000-000000000005",
        username: "e2e-staff",
        password: "staff-pass-1",
        fullName: "Stef Staff",
        roles: ["STAFF"],
    },
};

const base64url = (input: string | Buffer) =>
    Buffer.from(input).toString("base64url");

/**
 * Sign a token the way the backend's JwtModule does (HS256, 8h). The login
 * endpoint is throttled to five calls a minute, so the suite only uses it
 * where logging in is the thing under test.
 */
export const signToken = (user: RoleUser) => {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(
        JSON.stringify({
            userId: user.id,
            roles: user.roles,
            iat: now,
            exp: now + 8 * 3600,
        })
    );
    const signature = createHmac("sha256", SECRET)
        .update(`${header}.${payload}`)
        .digest("base64url");
    return `${header}.${payload}.${signature}`;
};

export const storageStatePath = (role: RoleKey) =>
    path.join(AUTH_DIR, `${role}.json`);

export const userInfoFor = (user: RoleUser) => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
});
