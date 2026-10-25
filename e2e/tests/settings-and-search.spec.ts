import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    createAttempt,
    getPersonByRegistrantId,
    getResult,
} from "../helpers/api";
import { expectToast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

test.describe("quick actions", () => {
    test("creates, shares, edits and uses a quick action", async ({
        page,
        api,
    }) => {
        await page.goto("/settings");
        const section = page.getByRole("region", { name: "Quick actions" });
        await expect(section.getByText("No quick actions yet")).toBeVisible();

        await section.getByRole("button", { name: "Add quick action" }).click();
        const create = page.getByRole("dialog", {
            name: "Create quick action",
        });
        await create.getByLabel("Name").fill("Cube popped");
        await create.getByLabel("Comment").fill("Popped during the solve");
        await create
            .getByRole("checkbox", { name: "Give extra attempt" })
            .check();
        await create.getByRole("button", { name: "Save" }).click();
        await expect(create).toBeHidden();

        const row = section.getByRole("row").filter({ hasText: "Cube popped" });
        await expect(row).toContainText("Gives extra");
        await expect(row).toContainText("Only me");

        await row
            .getByRole("button", { name: "More actions for Cube popped" })
            .click();
        await page
            .getByRole("menuitem", { name: "Share with other delegates" })
            .click();
        await expectToast(page, "Quick action shared with other delegates");
        await expect(row).toContainText("Shared");

        await row.getByRole("button", { name: "Edit quick action" }).click();
        const edit = page.getByRole("dialog", { name: "Update quick action" });
        await edit.getByLabel("Name").fill("Puzzle popped");
        await edit.getByRole("button", { name: "Save" }).click();
        await expect(
            section.getByRole("row").filter({ hasText: "Puzzle popped" })
        ).toBeVisible();

        // It is offered when granting an extra attempt
        const person = await getPersonByRegistrantId(api, 1);
        await createAttempt(api, {
            roundId: "333-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 1500,
        });
        const result = await getResult(api, "333-r1", person.id);
        await page.goto(`/results/${result.id}`);
        await page.getByRole("button", { name: "Give extra attempt" }).click();
        await page
            .getByRole("dialog", { name: "Give extra attempt" })
            .getByRole("button", { name: "Puzzle popped" })
            .click();
        await expect
            .poll(async () => {
                const attempt = (await getResult(api, "333-r1", person.id))
                    .attempts[0];
                return [attempt.status, attempt.comment];
            })
            .toEqual(["EXTRA_GIVEN", "Popped during the solve"]);

        await page.goto("/settings");
        await page
            .getByRole("button", { name: "More actions for Puzzle popped" })
            .click();
        await page
            .getByRole("menuitem", { name: "Delete quick action" })
            .click();
        await expect(
            page
                .getByRole("region", { name: "Quick actions" })
                .getByText("No quick actions yet")
        ).toBeVisible({ timeout: 15_000 });
    });

    test("toggles scan sounds for this device", async ({ page }) => {
        await page.goto("/settings");
        const sounds = page.getByRole("switch", { name: /Scan sounds/ });
        const before = await sounds.getAttribute("aria-checked");
        await sounds.click();
        await expect(sounds).not.toHaveAttribute("aria-checked", before!);
        await page.reload();
        await expect(
            page.getByRole("switch", { name: /Scan sounds/ })
        ).not.toHaveAttribute("aria-checked", before!);
    });
});

test.describe("global search", () => {
    test("finds pages and competitors", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 2);
        await page.goto("/");
        const search = page.getByRole("combobox", { name: "Search" });

        await search.fill("Most missed");
        await page
            .getByRole("listbox", { name: "Search results" })
            .getByRole("option", { name: /Most missed/ })
            .click();
        await expect(page).toHaveURL(/\/attendance\/missed$/);

        await search.fill(person.name);
        await page
            .getByRole("listbox", { name: "Search results" })
            .getByRole("option", { name: new RegExp(person.name) })
            .first()
            .click();
        await expect(page).toHaveURL(
            new RegExp(`/persons/${person.id}/results$`)
        );
    });
});

test.describe("theme", () => {
    test("switches between light and dark", async ({ page }) => {
        await page.goto("/");
        const html = page.locator("html");
        await page.getByRole("button", { name: "Theme" }).click();
        await page.getByRole("menuitem", { name: "Light" }).click();
        await expect(html).toHaveClass(/light/);
        await page.getByRole("button", { name: "Theme" }).click();
        await page.getByRole("menuitem", { name: "Dark" }).click();
        await expect(html).toHaveClass(/dark/);
    });
});
