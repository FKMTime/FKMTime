import { expect, test } from "../fixtures";
import { resetDatabase, withDb } from "../helpers/db";
import { expectToast } from "../helpers/ui";
import {
    getGeneratedCompetitionId,
    getWcaCompetition,
    signInWithWca,
} from "../helpers/wca";

// The competition the dummy WCA generates; one of its accounts delegates it
let COMPETITION_ID: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
    COMPETITION_ID = await getGeneratedCompetitionId();
    // A fresh install: no competition imported yet
    await resetDatabase();
    await withDb(async (db) => {
        await db.query("TRUNCATE competition, room, person CASCADE");
    });
});

test.afterAll(async () => {
    await resetDatabase();
});

test("imports a competition from the WCA and syncs it", async ({ page }) => {
    const { name } = await getWcaCompetition(COMPETITION_ID);
    await signInWithWca(page, COMPETITION_ID);

    await expect(page).toHaveURL(/\/competition\/import$/);
    await expect(
        page.getByRole("heading", { name: "Import competition" })
    ).toBeVisible();
    const item = page.getByRole("listitem").filter({ hasText: name });
    await item.getByRole("button", { name: "Import" }).click();

    await expect(page).toHaveURL(/\/competition\/?$/);
    await expect(
        page.getByRole("main").getByRole("heading", { name })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Competition" })).toBeVisible();

    await page.getByRole("button", { name: "Sync with WCA" }).click();
    await expectToast(page, "Synced with the WCA website");

    // The imported rooms and persons are there
    await page.getByRole("link", { name: "Persons" }).click();
    await expect(page.getByText(/^\d+ persons$/)).toBeVisible();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(
        page.getByRole("main").getByRole("region").first()
    ).toBeVisible();
});

test("lets the user log out from the import page", async ({ page }) => {
    await withDb((db) => db.query("TRUNCATE competition, room CASCADE"));
    await signInWithWca(page, COMPETITION_ID);
    await expect(page).toHaveURL(/\/competition\/import$/);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
});
