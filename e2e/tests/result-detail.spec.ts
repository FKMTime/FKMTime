import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    createAttempts,
    getPersonByRegistrantId,
    getResult,
} from "../helpers/api";
import { confirm, expectToast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

const ROUND = "333-r1";

/** A competitor with the given attempts, and their result page open */
const openResult = async (
    page: Page,
    api: APIRequestContext,
    registrantId: number,
    values: number[]
) => {
    const person = await getPersonByRegistrantId(api, registrantId);
    const result = await createAttempts(api, ROUND, person.id, values);
    await page.goto(`/results/${result.id}`);
    await expect(
        page.getByRole("main").getByRole("heading", { name: person.name })
    ).toBeVisible();
    return { person, result };
};

const attemptsTable = (page: Page) => page.getByRole("main").getByRole("table");
const attemptRow = (page: Page, label: string) =>
    attemptsTable(page)
        .getByRole("row")
        .filter({ has: page.getByRole("cell", { name: label, exact: true }) });

const lastAttemptCard = (page: Page) =>
    page
        .getByRole("main")
        .locator("section")
        .filter({
            has: page.getByRole("button", { name: "Edit last attempt" }),
        });

test.describe("a competitor's result", () => {
    test("summarises the attempts", async ({ page, api }) => {
        await openResult(page, api, 10, [1000, 1100, 1200, 1300, 1400]);
        const summary = page.getByRole("region", { name: "Summary" });
        await expect(summary).toContainText("12.00");
        await expect(summary).toContainText("10.00");
        await expect(summary).toContainText("5 of 5 attempts entered");
        await expect(
            page.getByRole("tab", { name: /Submitted/ })
        ).toContainText("5");
        await expect(attemptsTable(page).getByRole("row")).toHaveCount(6);
    });

    test("enters the next attempt for this competitor", async ({
        page,
        api,
    }) => {
        const { person } = await openResult(page, api, 11, [1000]);
        await page
            .getByRole("main")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });
        // The competitor is fixed and attempt 2 is next
        await expect(dialog.getByText("Select person...")).toHaveCount(0);
        await expect(
            dialog.getByRole("radio", { name: "Attempt 2", exact: true })
        ).toHaveAttribute("aria-checked", "true");
        await dialog.getByLabel("Time").fill("987");
        await dialog.getByRole("button", { name: "Save attempt" }).click();
        await expectToast(page, "Attempt saved");
        await expect(
            page.getByRole("region", { name: "Summary" })
        ).toContainText("2 of 5 attempts entered");
        const result = await getResult(api, ROUND, person.id);
        expect(result.attempts.map((a) => a.value).sort()).toEqual([1000, 987]);
    });

    test("edits an attempt and shows its edit history", async ({
        page,
        api,
    }) => {
        await openResult(page, api, 12, [1500, 1600]);
        await page.getByRole("tab", { name: /Standard/ }).click();
        await attemptRow(page, "2")
            .getByRole("button", { name: "Edit attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Edit attempt" });
        await expect(dialog.getByLabel("Time")).toHaveValue("16.00");
        await dialog.getByLabel("Time").fill("1555");
        await dialog.getByRole("button", { name: "Save attempt" }).click();
        await expectToast(page, "Attempt updated");
        await expect(attemptRow(page, "2")).toContainText("15.55");

        await page
            .getByRole("button", { name: "More actions for Attempt 2" })
            .click();
        await page.getByRole("menuitem", { name: "Edit history" }).click();
        const history = page.getByRole("dialog", { name: "Edit history" });
        await expect(history).toContainText("15.55");
        await expect(history).toContainText("16.00");
    });

    test("swaps two attempts", async ({ page, api }) => {
        const { person } = await openResult(page, api, 13, [2100, 2200]);
        await page.getByRole("tab", { name: /Standard/ }).click();
        await page.getByRole("button", { name: "Swap attempts" }).click();
        const dialog = page.getByRole("dialog", { name: "Swap two attempts" });

        await dialog.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "1", exact: true }).click();
        await dialog.getByRole("combobox").nth(1).click();
        await page.getByRole("option", { name: "1", exact: true }).click();
        await dialog.getByRole("button", { name: "Swap attempts" }).click();
        await expect(
            dialog.getByText("You can't swap an attempt with itself")
        ).toBeVisible();

        await dialog.getByRole("combobox").nth(1).click();
        await page.getByRole("option", { name: "2", exact: true }).click();
        await dialog.getByRole("button", { name: "Swap attempts" }).click();
        await expect(dialog).toBeHidden();
        await expect(attemptRow(page, "1")).toContainText("22.00");
        await expect(attemptRow(page, "2")).toContainText("21.00");

        const result = await getResult(api, ROUND, person.id);
        const byNumber = Object.fromEntries(
            result.attempts.map((a) => [a.attemptNumber, a.value])
        );
        expect(byNumber).toEqual({ 1: 2200, 2: 2100 });
    });

    test("grants an extra attempt with a comment", async ({ page, api }) => {
        const { person } = await openResult(page, api, 14, [1800]);
        await page.getByRole("tab", { name: /Standard/ }).click();
        await page
            .getByRole("button", { name: "More actions for Attempt 1" })
            .click();
        await page
            .getByRole("menuitem", { name: "Give extra attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Give extra attempt" });
        // The comment label is not tied to its input
        await dialog
            .getByPlaceholder("Comment")
            .fill("Timer reset by accident");
        await dialog.getByRole("button", { name: "Submit" }).click();
        await expectToast(page, "Extra granted");
        await expect(attemptRow(page, "1")).toContainText("Extra given");
        await expect(attemptRow(page, "1")).toContainText(
            "Timer reset by accident"
        );
        const result = await getResult(api, ROUND, person.id);
        expect(result.attempts[0].status).toBe("EXTRA_GIVEN");
    });

    test("grants an extra attempt with a quick action", async ({
        page,
        api,
    }) => {
        const { person } = await openResult(page, api, 15, [1900]);
        await lastAttemptCard(page)
            .getByRole("button", { name: "Give extra attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Give extra attempt" });
        await dialog.getByRole("button", { name: "Judge fault" }).click();
        await expect(dialog).toBeHidden();
        await expect
            .poll(
                async () =>
                    (await getResult(api, ROUND, person.id)).attempts[0].status
            )
            .toBe("EXTRA_GIVEN");
    });

    test("toggles +2 and DNF on the last attempt", async ({ page, api }) => {
        const { person } = await openResult(page, api, 16, [1000, 2000]);
        const card = lastAttemptCard(page);
        await expect(card).toContainText("20.00");

        await card.getByRole("button", { name: "+2" }).click();
        await expect(card.getByRole("button", { name: "+2" })).toHaveAttribute(
            "aria-pressed",
            "true"
        );
        await expect(card).toContainText("22.00 (20.00+2)");

        await card.getByRole("button", { name: "DNF" }).click();
        await expect(card).toContainText("DNF (20.00)");
        await card.getByRole("button", { name: "DNF" }).click();
        await expect(card.getByRole("button", { name: "DNF" })).toHaveAttribute(
            "aria-pressed",
            "false"
        );

        const result = await getResult(api, ROUND, person.id);
        expect(
            result.attempts.find((a) => a.attemptNumber === 2)?.penalty
        ).toBe(0);
    });

    test("deletes an attempt", async ({ page, api }) => {
        const { person } = await openResult(page, api, 17, [1000, 1200]);
        await page.getByRole("tab", { name: /Standard/ }).click();
        await page
            .getByRole("button", { name: "More actions for Attempt 2" })
            .click();
        await page.getByRole("menuitem", { name: "Delete attempt" }).click();
        await confirm(page, "Delete attempt");
        await expect(attemptRow(page, "2")).toHaveCount(0);
        expect((await getResult(api, ROUND, person.id)).attempts).toHaveLength(
            1
        );
    });

    test("assigns DNS on the remaining attempts", async ({ page, api }) => {
        const { person } = await openResult(page, api, 18, [1000, 1100]);
        await page
            .getByRole("button", { name: `More actions for ${person.name}` })
            .click();
        await page
            .getByRole("menuitem", { name: "Assign DNS on remaining attempts" })
            .click();
        await confirm(page, "Assign DNS");
        await expectToast(page, "DNS assigned");
        await expect(
            page.getByRole("region", { name: "Summary" })
        ).toContainText("5 of 5 attempts entered");
        const result = await getResult(api, ROUND, person.id);
        expect(result.attempts.filter((a) => a.penalty === -2)).toHaveLength(3);
    });

    test("deletes the whole result", async ({ page, api }) => {
        const { person } = await openResult(page, api, 19, [1000]);
        await page
            .getByRole("button", { name: `More actions for ${person.name}` })
            .click();
        await page.getByRole("menuitem", { name: "Delete result" }).click();
        await confirm(page, "Delete result");
        await expectToast(page, "Successfully deleted result.");
        await expect(page).toHaveURL(new RegExp(`/results/round/${ROUND}$`));
    });

    test("lists extra attempts in their own tab", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 20);
        await createAttempts(api, ROUND, person.id, [1000]);
        const extra = await api.post("attempt", {
            data: {
                roundId: ROUND,
                competitorId: person.id,
                attemptNumber: 1,
                value: 1050,
                penalty: 0,
                status: "STANDARD",
                type: "EXTRA_ATTEMPT",
            },
        });
        expect(extra.ok()).toBeTruthy();
        const result = await getResult(api, ROUND, person.id);
        await page.goto(`/results/${result.id}`);
        await page.getByRole("tab", { name: /Extra attempts/ }).click();
        await expect(attemptRow(page, "Extra 1")).toContainText("10.50");
        await page.getByRole("tab", { name: /Reorder & extras/ }).click();
        await expect(page.getByRole("main")).toContainText("10.50");
    });
});
