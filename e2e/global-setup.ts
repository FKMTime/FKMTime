import { mkdirSync, writeFileSync } from "node:fs";

import { AUTH_DIR, FRONTEND_URL } from "./env";
import { resetDatabase } from "./helpers/db";
import {
    ROLE_USERS,
    RoleKey,
    signToken,
    storageStatePath,
    userInfoFor,
} from "./helpers/users";

/**
 * Runs before the web servers start: a clean, seeded database and a signed-in
 * browser state per role.
 */
const globalSetup = async () => {
    await resetDatabase();
    mkdirSync(AUTH_DIR, { recursive: true });
    for (const role of Object.keys(ROLE_USERS) as RoleKey[]) {
        const user = ROLE_USERS[role];
        writeFileSync(
            storageStatePath(role),
            JSON.stringify({
                cookies: [],
                origins: [
                    {
                        origin: FRONTEND_URL,
                        localStorage: [
                            { name: "fkmtime-token", value: signToken(user) },
                            {
                                name: "fkmtime-userInfo",
                                value: JSON.stringify(userInfoFor(user)),
                            },
                        ],
                    },
                ],
            })
        );
    }
};

export default globalSetup;
