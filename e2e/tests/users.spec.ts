import { Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import { createUserInDb } from "../helpers/db";
import { confirm, expectToast } from "../helpers/ui";
import { storageStatePath } from "../helpers/users";

freshDatabase();
signedInAs("delegate");

const usersTable = (page: Page) => page.getByRole("main").getByRole("table");
const userRow = (page: Page, name: string) =>
    usersTable(page).getByRole("row").filter({ hasText: name });

const pickRoles = async (
    page: Page,
    roles: string[],
    trigger = /Select roles/
) => {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: trigger }).first().click();
    for (const role of roles) {
        await page.getByRole("option", { name: role, exact: true }).click();
    }
    await page.getByRole("option", { name: "Close" }).click();
};

test.describe("users", () => {
    test("lists the accounts with their type and roles", async ({ page }) => {
        await page.goto("/users");
        await expect(page.getByRole("tab", { name: "Users" })).toHaveAttribute(
            "aria-selected",
            "true"
        );
        const row = userRow(page, "Olive Organizer");
        await expect(row).toContainText("FKMTime");
        await expect(row).toContainText("Organizer");
        await expect(userRow(page, "Admin")).toContainText("Admin");
    });

    test("creates an FKMTime account", async ({ page }) => {
        await page.goto("/users");
        await page.getByRole("button", { name: "Create user" }).click();
        const dialog = page.getByRole("dialog", { name: "Create user" });
        await expect(
            dialog.getByRole("tab", { name: "FKMTime Account" })
        ).toHaveAttribute("aria-selected", "true");
        await dialog.getByLabel("Username").fill("e2e-new-runner");
        await dialog.getByLabel("Full name").fill("Rory Runner");
        await dialog.getByLabel("Password").fill("runner-pass-1");
        await pickRoles(page, ["Staff", "Stage leader"]);
        await dialog.getByRole("button", { name: "Create" }).click();

        await expect(dialog).toBeHidden();
        const row = userRow(page, "Rory Runner");
        await expect(row).toContainText("FKMTime");
        await expect(row).toContainText("Staff");
        await expect(row).toContainText("Stage leader");
    });

    test("refuses a username that is taken", async ({ page }) => {
        await page.goto("/users");
        await page.getByRole("button", { name: "Create user" }).click();
        const dialog = page.getByRole("dialog", { name: "Create user" });
        await dialog.getByLabel("Username").fill("e2e-staff");
        await dialog.getByLabel("Full name").fill("Duplicate Staff");
        await dialog.getByLabel("Password").fill("duplicate-pass-1");
        await pickRoles(page, ["Staff"]);
        await dialog.getByRole("button", { name: "Create" }).click();
        await expect(dialog.getByText("Username already taken!")).toBeVisible();
    });

    test("creates an account for a WCA user", async ({ page }) => {
        await page.goto("/users");
        const wcaRowsBefore = await usersTable(page)
            .getByRole("row")
            .filter({ hasText: "WCA" })
            .count();
        await page.getByRole("button", { name: "Create user" }).click();
        const dialog = page.getByRole("dialog", { name: "Create user" });
        await dialog.getByRole("tab", { name: "WCA Login" }).click();
        await dialog.getByRole("combobox").first().click();
        // The dummy WCA search matches lower-case WCA IDs; every one has "20"
        await page.getByPlaceholder("Search for a person...").fill("20");
        await page.getByRole("option").first().click();
        await pickRoles(page, ["Delegate"]);
        await dialog.getByRole("button", { name: "Create" }).click();
        await expect(dialog).toBeHidden();
        await expect(
            usersTable(page).getByRole("row").filter({ hasText: "WCA" })
        ).toHaveCount(wcaRowsBefore + 1);
    });

    test("edits a user's name and roles", async ({ page }) => {
        await createUserInDb({
            username: "e2e-edit-me",
            password: "edit-pass-1",
            fullName: "Eddie Editable",
            roles: ["STAFF"],
        });
        await page.goto("/users");
        await userRow(page, "Eddie Editable")
            .getByRole("button", { name: "Edit user" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Edit user" });
        await expect(dialog.getByLabel("Username")).toHaveValue("e2e-edit-me");
        await dialog.getByLabel("Full name").fill("Eddie Edited");
        // The trigger shows the roles already chosen
        await pickRoles(page, ["Organizer"], /Staff/);
        await dialog.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(dialog).toBeHidden();
        const row = userRow(page, "Eddie Edited");
        await expect(row).toContainText("Organizer");
        await expect(row).toContainText("Staff");
    });

    test("sets a new password for another user", async ({ page }) => {
        await createUserInDb({
            username: "e2e-forgot-password",
            password: "forgotten-pass-1",
            fullName: "Fran Forgetful",
            roles: ["STAFF"],
        });
        await page.goto("/users");
        await page
            .getByRole("button", { name: "More actions for Fran Forgetful" })
            .click();
        await page.getByRole("menuitem", { name: "Change password" }).click();
        const dialog = page.getByRole("dialog", { name: "Change password" });
        await dialog.getByLabel("Password").fill("brand-new-pass-1");
        await dialog.getByRole("button", { name: "Edit", exact: true }).click();
        await expectToast(page, "Password changed");
    });

    test("deletes a user", async ({ page }) => {
        await createUserInDb({
            username: "e2e-delete-me",
            password: "delete-pass-1",
            fullName: "Dale Deletable",
            roles: ["STAFF"],
        });
        await page.goto("/users");
        await page
            .getByRole("button", { name: "More actions for Dale Deletable" })
            .click();
        await page.getByRole("menuitem", { name: "Delete user" }).click();
        await confirm(page);
        await expectToast(page, "Successfully deleted user.");
        await expect(userRow(page, "Dale Deletable")).toHaveCount(0);
    });

    test("organizers cannot hand out delegate or admin roles", async ({
        browser,
    }) => {
        const context = await browser.newContext({
            storageState: storageStatePath("organizer"),
        });
        const page = await context.newPage();
        await page.goto("/users");
        await page.getByRole("button", { name: "Create user" }).click();
        await page
            .getByRole("dialog", { name: "Create user" })
            .getByRole("button", { name: /Select roles/ })
            .click();
        await expect(
            page.getByRole("option", { name: "Organizer", exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole("option", { name: "Delegate", exact: true })
        ).toHaveCount(0);
        await expect(
            page.getByRole("option", { name: "Admin", exact: true })
        ).toHaveCount(0);
        await context.close();
    });
});
