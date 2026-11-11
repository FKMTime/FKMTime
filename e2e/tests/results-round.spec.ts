import { Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    assignCard,
    createAttempts,
    createDevice,
    getPersonByRegistrantId,
    getResult,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import { Station } from "../helpers/station";
import { confirm, expectToast } from "../helpers/ui";
import { storageStatePath } from "../helpers/users";

freshDatabase();
signedInAs("delegate");

const resultsTable = (page: Page) => page.getByRole("main").getByRole("table");
const resultRow = (page: Page, name: string) =>
    resultsTable(page).getByRole("row").filter({ hasText: name });

/** Pick a competitor in the "Select person..." autocomplete of a dialog */
const pickPerson = async (page: Page, name: string) => {
    await page
        .getByRole("dialog")
        .getByRole("combobox")
        .filter({ hasText: "Select person..." })
        .click();
    await page.getByPlaceholder("Search for a person...").fill(name);
    await page.getByRole("option", { name }).click();
};

test.describe("round results", () => {
    test("opens a round and switches rounds from the round picker", async ({
        page,
    }) => {
        await page.goto("/results");
        await expect(page).toHaveURL(/\/results\/round\/[\w-]+-r\d+$/);
        await expect(page.getByRole("tab", { name: "Rounds" })).toHaveAttribute(
            "aria-selected",
            "true"
        );

        await page.getByRole("button", { name: /^All rounds/ }).click();
        await page.getByRole("textbox", { name: "Search rounds" }).fill("2x2");
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /Round 1/ })
            .click();
        await expect(page).toHaveURL(/\/results\/round\/222-r1$/);
        await expect(
            page.getByRole("heading", { name: "2x2x2 Cube · Round 1" })
        ).toBeVisible();
        await expect(page.getByText("No results yet.")).toBeVisible();
    });

    test("enters an attempt from the round page", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 1);
        await page.goto("/results/round/333-r1");
        await page
            .getByRole("main")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });

        // Nothing chosen yet
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog.getByText("Choose a competitor.")).toBeVisible();

        await pickPerson(page, person.name);
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(
            dialog.getByText("Enter the time, or choose DNF or DNS.")
        ).toBeVisible();

        await expect(
            dialog.getByRole("radio", { name: "Attempt 1", exact: true })
        ).toHaveAttribute("aria-checked", "true");
        await dialog.getByLabel("Time").fill("1234");
        await dialog.getByRole("radio", { name: "+2" }).click();
        await dialog.getByRole("button", { name: "Save" }).click();

        await expectToast(page, "Attempt saved");
        await expect(dialog).toBeHidden();
        const row = resultRow(page, person.name);
        await expect(row).toContainText("14.34");
        await expect(page.getByText("1 result", { exact: true })).toBeVisible();
    });

    test("saves a time over the limit as DNF", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 2);
        await page.goto("/results/round/333-r1");
        await page
            .getByRole("main")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });
        await pickPerson(page, person.name);
        // 11:00.00 is over the 10 minute limit of the seeded round
        await dialog.getByLabel("Time").fill("110000");
        await dialog.getByRole("button", { name: "Save" }).click();
        // The "saved as DNF" notice is replaced at once by "Attempt saved"
        await expect(dialog).toBeHidden();
        await expect(resultRow(page, person.name)).toContainText("DNF");
        const result = await getResult(api, "333-r1", person.id);
        expect(result.attempts[0]).toMatchObject({ value: 66000, penalty: -1 });
    });

    test("enters DNS without a time", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 3);
        await page.goto("/results/round/333-r1");
        await page
            .getByRole("main")
            .getByRole("button", { name: "Enter attempt" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Enter attempt" });
        await pickPerson(page, person.name);
        await dialog.getByRole("radio", { name: "DNS" }).click();
        await expect(dialog.getByLabel(/Time/)).toBeDisabled();
        await dialog.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Attempt saved");
        await expect(resultRow(page, person.name)).toContainText("DNS");
    });

    test("ranks, searches and orders results", async ({ page, api }) => {
        const fast = await getPersonByRegistrantId(api, 4);
        const slow = await getPersonByRegistrantId(api, 5);
        await createAttempts(api, "222-r1", fast.id, [300, 310, 320, 330, 340]);
        await createAttempts(api, "222-r1", slow.id, [900, 910, 920, 930, 940]);

        await page.goto("/results/round/222-r1");
        const rows = resultsTable(page).getByRole("row");
        await expect(rows.nth(1)).toContainText(fast.name);
        await expect(rows.nth(1)).toContainText("3.20");
        await expect(rows.nth(2)).toContainText(slow.name);

        await page.getByRole("radio", { name: "Latest" }).click();
        await expect(rows.nth(1)).toContainText(slow.name);

        await page
            .getByRole("searchbox", { name: "Search results" })
            .fill(slow.name);
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(1)).toContainText(slow.name);

        await page
            .getByRole("searchbox", { name: "Search results" })
            .fill("nobody-matches-this");
        await expect(page.getByText("No results match.")).toBeVisible();
    });

    test("deletes a result from the list", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 6);
        await createAttempts(api, "333-r1", person.id, [1500]);
        await page.goto("/results/round/333-r1");
        await page
            .getByRole("button", { name: `More actions for ${person.name}` })
            .click();
        await page.getByRole("menuitem", { name: "Delete result" }).click();
        await confirm(page, "Delete result");
        await expect(resultRow(page, person.name)).toHaveCount(0);
    });

    test("opens the public view of the round", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 7);
        await createAttempts(api, "666-r1", person.id, [6000]);
        await page.goto("/results/round/666-r1");
        await page
            .getByRole("button", {
                name: "More actions for 6x6x6 Cube, Round 1",
            })
            .click();
        await page.getByRole("menuitem", { name: "Public view" }).click();
        await expect(page).toHaveURL(/\/results\/public\/666-r1$/);
        await expect(page.getByRole("main")).toContainText(person.name);
        await expect(page.getByRole("main")).toContainText("1:00.00");
    });

    test("resubmits a round to WCA Live", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 8);
        await createAttempts(api, "333-r1", person.id, [1111]);
        await page.goto("/results/round/333-r1");
        await page
            .getByRole("button", {
                name: "More actions for 3x3x3 Cube, Round 1",
            })
            .click();
        await page
            .getByRole("menuitem", { name: "Resubmit to WCA Live" })
            .click();
        await confirm(page, "Resubmit");
        // Accepted by the dummy WCA Live service
        await expectToast(page, "Results resubmitted to WCA Live");
    });

    test("restarts a group, deleting the results of those who competed", async ({
        page,
        api,
    }) => {
        // A station in the room running group 1 records a solve, which also
        // marks the competitor present in that group
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["clock-r1-g1"] });
        await createDevice(api, {
            name: "Station Restart",
            espId: 0x7a01,
            roomId: room.id,
        });
        const assignments = await (
            await api.get("attendance/group/clock-r1-g1")
        ).json();
        const competitorActivity = assignments.find(
            (a: { role: string }) => a.role === "COMPETITOR"
        );
        const judgeActivity = assignments.find(
            (a: { role: string; personId: string }) =>
                a.role === "JUDGE" && a.personId !== competitorActivity.personId
        );
        await assignCard(api, competitorActivity.personId, "7101");
        await assignCard(api, judgeActivity.personId, "7102");
        const station = await Station.connect();
        try {
            const response = await station.enterAttempt({
                espId: 0x7a01,
                competitorCardId: "7101",
                judgeCardId: "7102",
                valueCs: 1000,
            });
            expect(response.data.status, response.data.message).toBe(200);
        } finally {
            station.close();
        }
        const competitorName = competitorActivity.person.name;

        await page.goto("/results/round/clock-r1");
        await expect(resultRow(page, competitorName)).toBeVisible();
        await page
            .getByRole("button", { name: "More actions for Clock, Round 1" })
            .click();
        await page.getByRole("menuitem", { name: "Restart group" }).click();
        const dialog = page.getByRole("dialog", {
            name: "Select group to restart",
        });
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: "Group 1" }).click();
        const restart = page.getByRole("dialog", {
            name: "Restart Clock, Round 1, Group 1",
        });
        await expect(restart.getByRole("listitem")).toContainText([
            competitorName,
        ]);
        await restart.getByRole("button", { name: "Restart group" }).click();
        await confirm(page);
        await expectToast(page, "Group restarted");
        await expect(resultRow(page, competitorName)).toHaveCount(0);

        const result = await getResult(
            api,
            "clock-r1",
            competitorActivity.personId
        );
        expect(result.attempts).toHaveLength(0);
    });
});

test.describe("results for non-delegates", () => {
    test("stage leaders get the public view instead", async ({
        browser,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 9);
        await createAttempts(api, "minx-r1", person.id, [7000, 7100]);
        const context = await browser.newContext({
            storageState: storageStatePath("stageLeader"),
        });
        const page = await context.newPage();
        await page.goto("/results/round/minx-r1");
        await expect(page).toHaveURL(/\/results\/public\/minx-r1$/);
        await expect(page.getByRole("main")).toContainText(person.name);
        await expect(
            page.getByRole("button", { name: "Enter attempt" })
        ).toHaveCount(0);
        await context.close();
    });
});
