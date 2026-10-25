import { Page } from "@playwright/test";

import { RoleUser, signToken, userInfoFor } from "./users";

/**
 * Put a signed token for `user` into the app's storage, the same keys the
 * login form writes, and open `path`.
 */
export const signInAs = async (page: Page, user: RoleUser, path = "/") => {
    await page.goto("/auth/login");
    await page.evaluate(
        ([token, userInfo]) => {
            localStorage.setItem("fkmtime-token", token);
            localStorage.setItem("fkmtime-userInfo", userInfo);
        },
        [signToken(user), JSON.stringify(userInfoFor(user))]
    );
    await page.goto(path);
};
