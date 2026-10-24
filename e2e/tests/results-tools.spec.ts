import { Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    createAttempt,
    createAttempts,
    getPersonByRegistrantId,
    getResult,
    setCurrentGroups,
    STAGE_ONE,
} from "../helpers/api";
import { confirm, expectToast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

/** Type a registrant ID into the scorecard desk's ID field */
const scorecardId = (page: Page) =>
    page.getByRole("main").getByPlaceholder("ID", { exact: true });

test.describe("quick attempt entry", () => {
    test("enters an attempt for a round in progress from the header", async ({
        page,
        api,
    }) => {
        await setCurrentGroups(api, { [STAGE_ONE]: ["222-r1-g1"] });
        const person = await getPersonByRegistrantId(api, 1);
        await page.goto("/");
        await page
            .getByRole("banner")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });
        await expect(
            dialog.getByRole("button", { name: /2x2 · R1|2x2 R1|2x2/ })
        ).toHaveAttribute("aria-pressed", "true");

        // Enter with nothing typed asks for a competitor
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog.getByText("Choose a competitor.")).toBeVisible();

        await dialog.getByRole("combobox").fill(String(person.registrantId));
        await dialog
            .getByRole("listbox")
            .getByRole("button", { name: new RegExp(person.name) })
            .click();
        await expect(dialog.getByText(person.name)).toBeVisible();
        await dialog.getByLabel("Time").fill("456");
        await page.keyboard.press("Enter");

        await expectToast(page, new RegExp(`^Saved ${person.name} · `));
        await expect(dialog).toBeHidden();
        const result = await getResult(api, "222-r1", person.id);
        expect(result.attempts[0]).toMatchObject({
            attemptNumber: 1,
            value: 456,
        });
    });

    test("explains when no round is in progress", async ({ page, api }) => {
        await setCurrentGroups(api, {});
        await page.goto("/results");
        await page
            .getByRole("banner")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        // On a round page the round is fixed to that round instead
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });
        await expect(dialog).toBeVisible();
        await page.goto("/");
        await page
            .getByRole("banner")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        await expect(
            page
                .getByRole("dialog", { name: "Enter attempt" })
                .getByText("No round is in progress.")
        ).toBeVisible();
    });
});

test.describe("enter scorecard", () => {
    test("saves a whole paper scorecard", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 2);
        await page.goto("/results/round/333-r1/enter-scorecard");
        await expect(
            page.getByText("Enter the ID from the next scorecard.")
        ).toBeVisible();
        await scorecardId(page).fill(String(person.registrantId));
        await expect(
            page.getByRole("heading", { name: new RegExp(person.name) })
        ).toBeVisible();

        const times = ["1011", "1112", "1213", "1314"];
        for (const [index, time] of times.entries()) {
            const input = page.getByLabel(`Attempt ${index + 1} time`);
            await input.fill(time);
            await input.blur();
        }
        // D on the last attempt marks it DNF
        await page.getByLabel("Attempt 5 time").press("d");
        await page.getByRole("button", { name: "Save scorecard" }).click();

        await expect(page.getByRole("status")).toContainText(
            `Saved ${person.name}'s scorecard`
        );
        const result = await getResult(api, "333-r1", person.id);
        const byNumber = Object.fromEntries(
            result.attempts.map((a) => [
                a.attemptNumber,
                a.penalty === -1 ? "DNF" : a.value,
            ])
        );
        expect(byNumber).toEqual({
            1: 1011,
            2: 1112,
            3: 1213,
            4: 1314,
            5: "DNF",
        });

        await page.getByRole("link", { name: "Open result" }).click();
        await expect(page).toHaveURL(new RegExp(`/results/${result.id}$`));
    });
});

test.describe("double check", () => {
    test("confirms scorecards one by one until the round is done", async ({
        page,
        api,
    }) => {
        // Clock R1 has a cutoff: two attempts over it complete the result
        const first = await getPersonByRegistrantId(api, 3);
        const second = await getPersonByRegistrantId(api, 4);
        await createAttempts(api, "clock-r1", first.id, [1500, 1600]);
        await createAttempts(api, "clock-r1", second.id, [1700, 1800]);

        await page.goto("/results/round/clock-r1");
        await page.getByRole("link", { name: "Double check" }).click();
        await expect(page).toHaveURL(
            /\/results\/round\/clock-r1\/double-check$/
        );
        await expect(page.getByText("/ 2 double-checked")).toBeVisible();

        await page.getByRole("button", { name: "Missing competitors" }).click();
        const missing = page.getByRole("dialog", {
            name: /Missing competitors/,
        });
        await expect(missing).toBeVisible();
        await missing.getByRole("button", { name: "Close" }).click();

        await scorecardId(page).fill(String(first.registrantId));
        await expect(
            page.getByRole("heading", { name: new RegExp(first.name) })
        ).toBeVisible();
        await page.getByRole("button", { name: "Confirm" }).click();
        await expect(page.getByText("/ 2 double-checked")).toContainText("1");

        // Changing a time asks before resubmitting
        await scorecardId(page).fill(String(second.registrantId));
        const firstTime = page
            .getByRole("main")
            .locator("input[inputmode=numeric]")
            .nth(1);
        await firstTime.fill("1650");
        await firstTime.blur();
        await page.getByRole("button", { name: "Confirm" }).click();
        await confirm(page);

        await expect(
            page.getByRole("heading", { name: "All 2 results double-checked" })
        ).toBeVisible();
        const checked = await getResult(api, "clock-r1", second.id);
        expect(checked.isDoubleChecked).toBe(true);
        expect(checked.attempts.map((a) => a.value)).toContain(1650);

        // Undo the whole round
        await page
            .getByRole("button", { name: "Mark results as not double checked" })
            .click();
        await confirm(page);
        await expect(page.getByText("/ 2 double-checked")).toContainText("0");
        expect(
            (await getResult(api, "clock-r1", first.id)).isDoubleChecked
        ).toBe(false);
    });

    test("offers a scorecard where an extra replaced an attempt", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 9);
        // Attempt 1 got an extra, which replaced it; attempt 2 is normal
        await createAttempt(api, {
            roundId: "clock-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 1900,
            status: "EXTRA_GIVEN",
            replacedBy: 1,
        });
        await createAttempt(api, {
            roundId: "clock-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 1950,
            type: "EXTRA_ATTEMPT",
        });
        await createAttempt(api, {
            roundId: "clock-r1",
            competitorId: person.id,
            attemptNumber: 2,
            value: 2000,
        });

        await page.goto("/results/round/clock-r1/double-check");
        await scorecardId(page).fill(String(person.registrantId));
        await expect(
            page.getByRole("heading", { name: new RegExp(person.name) })
        ).toBeVisible();
        await page.getByRole("button", { name: "Confirm" }).click();
        await expect
            .poll(
                async () =>
                    (await getResult(api, "clock-r1", person.id))
                        .isDoubleChecked
            )
            .toBe(true);
    });
});

test.describe("results checks", () => {
    test("lists suspicious attempts and filters them by type", async ({
        page,
        api,
    }) => {
        const penalised = await getPersonByRegistrantId(api, 5);
        const absent = await getPersonByRegistrantId(api, 6);
        await createAttempt(api, {
            roundId: "666-r1",
            competitorId: penalised.id,
            attemptNumber: 1,
            value: 9000,
            penalty: 4,
        });
        await createAttempt(api, {
            roundId: "666-r1",
            competitorId: absent.id,
            attemptNumber: 1,
            value: 0,
            penalty: -2,
        });

        await page.goto("/results/round/666-r1");
        await page.getByRole("tab", { name: "Checks" }).click();
        await expect(page).toHaveURL(/\/results\/checks\/666-r1$/);
        await expect(page.getByText("Checks for 6x6 R1")).toBeVisible();
        const table = page.getByRole("main").getByRole("table");
        await expect(table).toContainText(penalised.name);
        await expect(table).toContainText(absent.name);

        await page.getByRole("radio", { name: /^DNS/ }).click();
        await expect(table).toContainText(absent.name);
        await expect(table).not.toContainText(penalised.name);

        await page.getByRole("radio", { name: /^Penalty/ }).click();
        await expect(table).toContainText(penalised.name);
        await expect(table).not.toContainText(absent.name);

        await page.getByRole("button", { name: "Show every round" }).click();
        await expect(page).toHaveURL(/\/results\/checks$/);
        await expect(page.getByText("Checks across every round")).toBeVisible();
    });

    test("says so when nothing is suspicious", async ({ page }) => {
        await page.goto("/results/checks/minx-r3");
        await expect(
            page.getByText("No suspicious results found.")
        ).toBeVisible();
    });
});
