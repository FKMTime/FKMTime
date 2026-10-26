import { expect, freshDatabase, test } from "../fixtures";
import { createUserInDb } from "../helpers/db";
import { signInAs } from "../helpers/session";
import { expectToast } from "../helpers/ui";
import {
    DUMMY_WCA_COMPETITION_ID,
    signInWithWca,
    useDummyWcaCompetitionId,
} from "../helpers/wca";

freshDatabase();

const signInForm = (page: import("@playwright/test").Page) => ({
    username: page.getByRole("textbox", { name: "Username" }),
    password: page.getByLabel("Password"),
    submit: page.getByRole("button", { name: "Sign in", exact: true }),
});

test.describe("FKMTime account sign in", () => {
    test("redirects a signed-out visitor to the sign-in page", async ({
        page,
    }) => {
        await page.goto("/persons");
        await expect(page).toHaveURL(/\/auth\/login$/);
        await expect(
            page.getByRole("heading", { name: "Sign in" })
        ).toBeVisible();
    });

    test("signs in with username and password and lands on home", async ({
        page,
    }) => {
        await page.goto("/auth/login");
        const form = signInForm(page);
        await form.username.fill("admin");
        await form.password.fill("admin");
        await form.submit.click();

        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Account" })
        ).toBeVisible();
    });

    test("explains a wrong password and keeps the user on the form", async ({
        page,
    }) => {
        await page.goto("/auth/login");
        const form = signInForm(page);
        await form.username.fill("admin");
        await form.password.fill("not-the-password");
        await form.submit.click();

        await expect(
            page.getByText("Wrong username or password")
        ).toBeVisible();
        await expect(page).toHaveURL(/\/auth\/login$/);
    });

    test("shows an error and stays on the form for a wrong password", async ({
        page,
    }) => {
        await page.goto("/auth/login");
        const form = signInForm(page);
        await form.username.fill("admin");
        await form.password.fill("still-not-the-password");
        await form.submit.click();

        await expect(form.username).toHaveAttribute("aria-invalid", "true");
        await expect(page).toHaveURL(/\/auth\/login$/);
    });

    test("links to the public display", async ({ page }) => {
        await page.goto("/auth/login");
        await page.getByRole("link", { name: "Public display" }).click();
        await expect(page).toHaveURL(/\/public$/);
    });
});

test.describe("Signed-in account", () => {
    test("logs out from the account menu", async ({ page }) => {
        const user = await createUserInDb({
            username: "e2e-logout-user",
            password: "logout-pass-1",
            fullName: "Lou Logout",
            roles: ["DELEGATE"],
        });
        await signInAs(page, user);
        await page.getByRole("button", { name: "Account" }).click();
        await expect(page.getByRole("menu")).toContainText("Lou Logout");
        await page.getByRole("menuitem", { name: "Log out" }).click();

        await expect(page).toHaveURL(/\/auth\/login$/);
        await expectToast(page, "You have been logged out.");
        expect(
            await page.evaluate(() => localStorage.getItem("fkmtime-token"))
        ).toBeNull();

        await page.goto("/");
        await expect(page).toHaveURL(/\/auth\/login$/);
    });

    test("changes the password, then signs in with the new one", async ({
        page,
    }) => {
        const user = await createUserInDb({
            username: "e2e-password-user",
            password: "old-pass-1",
            fullName: "Pat Password",
            roles: ["STAFF"],
        });
        await signInAs(page, user, "/settings");

        await page.getByRole("button", { name: "Change password" }).click();
        const dialog = page.getByRole("dialog", { name: "Change password" });
        await dialog.getByLabel("Current password").fill("old-pass-1");
        await dialog
            .getByLabel("New password", { exact: true })
            .fill("new-pass-2");
        await dialog.getByLabel("Confirm new password").fill("new-pass-2");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Password changed");
        await expect(dialog).toBeHidden();

        await page.getByRole("button", { name: "Account" }).click();
        await page.getByRole("menuitem", { name: "Log out" }).click();
        await expect(page).toHaveURL(/\/auth\/login$/);

        // Leaving the shell may still reload the page once; start the form
        // from a settled page so the reload cannot wipe what was typed
        await page.goto("/auth/login");
        const form = signInForm(page);
        await expect(form.username).toBeEnabled();
        await form.username.fill("e2e-password-user");
        await form.password.fill("new-pass-2");
        await form.submit.click();
        await expect(page).toHaveURL(/\/$/);
        await expect(
            page.getByRole("button", { name: "Account" })
        ).toBeVisible();
    });

    test("rejects a password change when the confirmation differs", async ({
        page,
    }) => {
        const user = await createUserInDb({
            username: "e2e-mismatch-user",
            password: "mismatch-pass-1",
            fullName: "Max Mismatch",
            roles: ["STAFF"],
        });
        await signInAs(page, user, "/settings");

        await page.getByRole("button", { name: "Change password" }).click();
        const dialog = page.getByRole("dialog", { name: "Change password" });
        await dialog.getByLabel("Current password").fill("mismatch-pass-1");
        await dialog
            .getByLabel("New password", { exact: true })
            .fill("one-thing");
        await dialog.getByLabel("Confirm new password").fill("another-thing");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog.getByText("Passwords do not match")).toBeVisible();
    });

    test("rejects a password change with a wrong current password", async ({
        page,
    }) => {
        const user = await createUserInDb({
            username: "e2e-wrong-current-user",
            password: "right-pass-1",
            fullName: "Wren Wrongpass",
            roles: ["STAFF"],
        });
        await signInAs(page, user, "/settings");

        await page.getByRole("button", { name: "Change password" }).click();
        const dialog = page.getByRole("dialog", { name: "Change password" });
        await dialog.getByLabel("Current password").fill("wrong-pass-1");
        await dialog
            .getByLabel("New password", { exact: true })
            .fill("next-pass-2");
        await dialog.getByLabel("Confirm new password").fill("next-pass-2");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog.getByText("Something went wrong")).toBeVisible();
    });

    test("changes the username from settings", async ({ page }) => {
        const user = await createUserInDb({
            username: "e2e-rename-user",
            password: "rename-pass-1",
            fullName: "Rene Rename",
            roles: ["STAFF"],
        });
        await signInAs(page, user, "/settings");

        const account = page.getByRole("region", { name: "Account" });
        await account.getByLabel("Username").fill("e2e-renamed-user");
        await account.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Account saved");

        await page.reload();
        await expect(
            page.getByRole("region", { name: "Account" }).getByLabel("Username")
        ).toHaveValue("e2e-renamed-user");
    });
});

test.describe("WCA sign in", () => {
    let restoreCompetitionId: () => Promise<unknown>;

    test.beforeAll(async () => {
        restoreCompetitionId = await useDummyWcaCompetitionId();
    });

    test.afterAll(async () => {
        await restoreCompetitionId();
    });

    test("signs in through the WCA OAuth flow", async ({ page }) => {
        // A dummy WCA account that delegates the seeded competition
        await signInWithWca(page, DUMMY_WCA_COMPETITION_ID);

        await expect(page).toHaveURL(/localhost:\d+\/$/);
        await expect(
            page.getByRole("button", { name: "Account" })
        ).toBeVisible();
        // WCA accounts of delegates see the delegate navigation
        await expect(
            page.getByRole("link", { name: "Incidents" })
        ).toBeVisible();
    });
});
