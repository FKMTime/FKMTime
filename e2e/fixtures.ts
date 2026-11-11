import {
    APIRequestContext,
    expect,
    request as playwrightRequest,
    test as base,
} from "@playwright/test";

import { BACKEND_URL } from "./env";
import { resetDatabase } from "./helpers/db";
import {
    ROLE_USERS,
    RoleKey,
    signToken,
    storageStatePath,
} from "./helpers/users";

export const apiAs = (role: RoleKey) =>
    playwrightRequest.newContext({
        baseURL: `${BACKEND_URL}/`,
        extraHTTPHeaders: {
            Authorization: `Bearer ${signToken(ROLE_USERS[role])}`,
        },
    });

interface Fixtures {
    /** Backend client authenticated as the seeded admin */
    api: APIRequestContext;
}

export const test = base.extend<Fixtures>({
    api: async ({}, use) => {
        const context = await apiAs("admin");
        await use(context);
        await context.dispose();
    },
});

export { expect };

/** Sign the browser in as the given role for every test in the file/describe */
export const signedInAs = (role: RoleKey) =>
    test.use({ storageState: storageStatePath(role) });

/** Start the file (or describe block) from a freshly seeded database */
export const freshDatabase = () =>
    test.beforeAll(async () => {
        await resetDatabase();
    });
