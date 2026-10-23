import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    assignCard,
    createAttempt,
    createDevice,
    getPersonByRegistrantId,
    getResult,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import { Station } from "../helpers/station";
import { confirm, expectToast, toast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

/**
 * A solve whose station called the delegate: the station stays linked to the
 * attempt, as with real hardware.
 */
const openIncident = async (
    api: APIRequestContext,
    registrantId: number,
    roundId = "333-r1"
) => {
    const person = await getPersonByRegistrantId(api, registrantId);
    const room = await getRoom(api);
    await setCurrentGroups(api, { [room.name]: [`${roundId}-g1`] });
    const espId = 0x9000 + registrantId;
    const device = await createDevice(api, {
        name: `Station ${registrantId}`,
        espId,
        roomId: room.id,
    });
    const cardId = String(9000 + registrantId);
    await assignCard(api, person.id, cardId);
    const station = await Station.connect();
    try {
        const response = await station.enterAttempt({
            espId,
            competitorCardId: cardId,
            valueCs: 1234,
            isDelegate: true,
        });
        expect(response.data.error, response.data.message).toBeFalsy();
    } finally {
        station.close();
    }
    return { person, device };
};

const incidentLink = (page: Page, name: string) =>
    page.getByRole("main").getByRole("link").filter({ hasText: name });
const incidentPanel = (page: Page, name: string) =>
    page.getByRole("region", { name: `Incident: ${name}` });

test.describe("open incidents", () => {
    test("a solve that calls the delegate shows up live and gets resolved", async ({
        page,
        api,
    }) => {
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["clock-r1-g1"] });
        await createDevice(api, {
            name: "Station Delegate Call",
            espId: 0x8b01,
            roomId: room.id,
        });
        const assignments = await (
            await api.get("attendance/group/clock-r1-g1")
        ).json();
        const competitor = assignments.find(
            (a: { role: string }) => a.role === "COMPETITOR"
        );
        await assignCard(api, competitor.personId, "8101");

        await page.goto("/incidents");
        await expect(page.getByText("No open incidents.")).toBeVisible();

        const station = await Station.connect();
        try {
            const response = await station.enterAttempt({
                espId: 0x8b01,
                competitorCardId: "8101",
                valueCs: 1500,
                isDelegate: true,
            });
            expect(response.data.error, response.data.message).toBeFalsy();
        } finally {
            station.close();
        }

        const name = competitor.person.name;
        // Pushed over the socket, no reload needed
        await expect(incidentLink(page, name)).toBeVisible();
        await expect(
            page
                .getByRole("complementary")
                .getByRole("link", { name: /Incidents/ })
        ).toContainText("1");
        await expect(page.getByRole("tab", { name: /Open/ })).toContainText(
            "1"
        );

        await incidentLink(page, name).click();
        await expect(page).toHaveURL(/\/incidents\/[\w-]+$/);
        const panel = incidentPanel(page, name);
        await expect(panel).toContainText("Station Delegate Call");
        await panel.getByPlaceholder("Comment").fill("Checked the timer");
        await panel.getByRole("button", { name: "Mark as resolved" }).click();
        await expectToast(page, "Incident saved");
        await expect(page.getByText("No open incidents.")).toBeVisible();

        await page.getByRole("tab", { name: /Resolved/ }).click();
        const resolved = page.getByRole("main").getByRole("table");
        await expect(resolved).toContainText(name);
        await expect(resolved).toContainText("Checked the timer");

        const result = await getResult(api, "clock-r1", competitor.personId);
        expect(result.attempts[0].status).toBe("RESOLVED");
    });

    test("gives an extra attempt from an incident", async ({ page, api }) => {
        const { person } = await openIncident(api, 2);
        await page.goto("/incidents");
        await incidentLink(page, person.name).click();
        await incidentPanel(page, person.name)
            .getByRole("button", { name: "Save and give extra" })
            .click();
        await expectToast(page, "Incident saved");
        await expect(incidentLink(page, person.name)).toHaveCount(0);
        const result = await getResult(api, "333-r1", person.id);
        expect(result.attempts[0].status).toBe("EXTRA_GIVEN");
    });

    test("resolves with a quick action", async ({ page, api }) => {
        const { person } = await openIncident(api, 3);
        await page.goto("/incidents");
        await incidentLink(page, person.name).click();
        await incidentPanel(page, person.name)
            .getByRole("button", { name: "Judge fault" })
            .click();
        await expect(incidentLink(page, person.name)).toHaveCount(0);
        const result = await getResult(api, "333-r1", person.id);
        expect(result.attempts[0].status).toBe("EXTRA_GIVEN");
    });

    test("deletes the attempt behind an incident", async ({ page, api }) => {
        const { person } = await openIncident(api, 4);
        await page.goto("/incidents");
        await incidentLink(page, person.name).click();
        await incidentPanel(page, person.name)
            .getByRole("button", { name: "Delete attempt" })
            .click();
        await confirm(page, "Delete attempt");
        await expect(incidentLink(page, person.name)).toHaveCount(0);
        const result = await getResult(api, "333-r1", person.id);
        expect(result.attempts).toHaveLength(0);
    });

    test("resolving as noteworthy lists it under noteworthy", async ({
        page,
        api,
    }) => {
        const { person } = await openIncident(api, 5);
        await page.goto("/incidents");
        await incidentLink(page, person.name).click();
        const panel = incidentPanel(page, person.name);
        await panel.getByPlaceholder("Comment").fill("Puzzle popped");
        await panel
            .getByRole("checkbox", { name: "Mark as noteworthy incident" })
            .check();
        await panel.getByRole("button", { name: "Mark as resolved" }).click();
        await expectToast(page, "Incident saved");

        await page.goto("/incidents/noteworthy");
        await expect(page.getByRole("main")).toContainText("Puzzle popped");
    });
});

test.describe("incidents of a removed station", () => {
    // BUG: resolving (or deleting) an open incident whose station was deleted answers 500 — AttemptService reads attempt.device.espId without a null check
    test.fixme("still resolves after its station was deleted", async ({
        page,
        api,
    }) => {
        const { person, device } = await openIncident(api, 9);
        const removed = await api.delete(`device/${device.id}`);
        expect(removed.status()).toBe(204);

        await page.goto("/incidents");
        await incidentLink(page, person.name).click();
        await incidentPanel(page, person.name)
            .getByRole("button", { name: "Mark as resolved" })
            .click();
        await expectToast(page, "Incident saved");
        await expect(incidentLink(page, person.name)).toHaveCount(0);
    });
});

test.describe("resolved incidents", () => {
    test("summarises them and saves one as noteworthy", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 6);
        await createAttempt(api, {
            roundId: "222-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 800,
            status: "RESOLVED",
            comment: "Scramble checked again",
        });
        await page.goto("/incidents/resolved");
        const table = page.getByRole("main").getByRole("table");
        await expect(table).toContainText(person.name);

        await page.getByRole("button", { name: "Summary" }).click();
        const summary = page.getByRole("dialog", { name: "Incidents summary" });
        await expect(summary).toContainText(person.name);
        await summary.getByRole("button", { name: "Close" }).click();

        await page
            .getByRole("searchbox", { name: "Search resolved incidents" })
            .fill(person.name);
        await table
            .getByRole("row")
            .filter({ hasText: person.name })
            .getByRole("button", { name: /More actions/ })
            .click();
        await page
            .getByRole("menuitem", { name: "Save as noteworthy" })
            .click();
        await expectToast(page, "Saved as noteworthy");
    });
});

test.describe("noteworthy incidents", () => {
    test("adds, edits, and deletes with undo", async ({ page }) => {
        await page.goto("/incidents/noteworthy");
        await page
            .getByRole("button", { name: "Add noteworthy incident" })
            .click();
        const add = page.getByRole("dialog", {
            name: "Add noteworthy incident",
        });
        await add.getByLabel("Title").fill("Power cut in hall B");
        await add.getByLabel("Description").fill("Lights out for two minutes");
        await add.getByRole("button", { name: "Add", exact: true }).click();
        await expectToast(page, "Successfully created new incident.");
        const main = page.getByRole("main");
        await expect(main).toContainText("Power cut in hall B");

        await page.getByRole("button", { name: "Edit" }).first().click();
        const edit = page.getByRole("dialog", {
            name: "Edit noteworthy incident",
        });
        await edit.getByLabel("Title").fill("Power cut in hall C");
        await edit.getByRole("button", { name: "Edit", exact: true }).click();
        await expectToast(page, "Successfully updated incident.");
        await expect(main).toContainText("Power cut in hall C");

        await page
            .getByRole("button", {
                name: "More actions for Power cut in hall C",
            })
            .click();
        await page.getByRole("menuitem", { name: "Delete" }).click();
        await expect(main).not.toContainText("Power cut in hall C");
        await toast(page, '"Power cut in hall C" deleted')
            .locator("xpath=ancestor::li[1]")
            .getByRole("button", { name: "Undo" })
            .click();
        await expect(main).toContainText("Power cut in hall C");
    });
});

test.describe("warnings", () => {
    test("adds a warning and deletes it", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 7);
        await page.goto("/incidents/warnings");
        await expect(page.getByText("No warnings issued.")).toBeVisible();
        await page.getByRole("button", { name: "Add warning" }).click();
        const dialog = page.getByRole("dialog", { name: "Add warning" });
        await dialog.getByRole("combobox").click();
        await page.getByPlaceholder("Search for a person...").fill(person.name);
        await page.getByRole("option", { name: person.name }).click();
        await dialog.getByLabel("Description").fill("Talked during inspection");
        await dialog.getByRole("button", { name: "Add warning" }).click();
        await expect(dialog).toBeHidden();
        const item = page
            .getByRole("main")
            .getByRole("listitem")
            .filter({ hasText: person.name });
        await expect(item).toContainText("Talked during inspection");
        await expect(page.getByRole("tab", { name: /Warnings/ })).toContainText(
            "1"
        );

        await item.getByRole("button", { name: "Delete warning" }).click();
        await expect(item).toHaveCount(0);
        await expect(
            toast(page, `Warning for ${person.name} deleted`)
        ).toBeVisible();
        // Deleted on the server once the undo window has passed
        await expect
            .poll(
                async () =>
                    (
                        await (
                            await api.get(
                                `incident/warnings/person/${person.id}`
                            )
                        ).json()
                    ).length,
                { timeout: 15_000 }
            )
            .toBe(0);
    });
});

test.describe("manual incidents", () => {
    test("adds, edits and deletes a manual incident", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 8);
        // The create route opens the form straight away
        await page.goto("/incidents/manual/create");
        const dialog = page.getByRole("dialog", {
            name: "Add manual incident",
        });
        await dialog
            .getByRole("combobox")
            .filter({ hasText: "Select person..." })
            .click();
        await page.getByPlaceholder("Search for a person...").fill(person.name);
        await page.getByRole("option", { name: person.name }).click();
        await dialog
            .getByRole("combobox")
            .filter({ hasText: "Select event" })
            .click();
        await page.getByRole("option", { name: "2x2", exact: true }).click();
        await dialog
            .getByRole("combobox")
            .filter({ hasText: "Select round" })
            .click();
        await page.getByRole("option", { name: "Round 1" }).click();
        await dialog.getByLabel("Attempt").fill("3");
        await dialog
            .getByLabel("Description")
            .fill("Scrambler used wrong scramble");
        await dialog.getByRole("button", { name: "Add incident" }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(/\/incidents\/manual$/);

        const item = page
            .getByRole("main")
            .getByRole("listitem")
            .filter({ hasText: person.name });
        await expect(item).toContainText("Scrambler used wrong scramble");
        await expect(item).toContainText("Attempt 3");

        await item.getByRole("button", { name: "Edit" }).click();
        const edit = page.getByRole("dialog", { name: "Edit incident" });
        await edit
            .getByLabel("Description")
            .fill("Wrong scramble on attempt 3");
        await edit.getByRole("button", { name: "Edit", exact: true }).click();
        await expectToast(page, "Successfully updated incident.");
        await expect(item).toContainText("Wrong scramble on attempt 3");

        await page
            .getByRole("button", { name: `More actions for ${person.name}` })
            .click();
        await page.getByRole("menuitem", { name: "Delete" }).click();
        await confirm(page, "Delete");
        await expect(page.getByText("No manual incidents.")).toBeVisible();
    });
});
