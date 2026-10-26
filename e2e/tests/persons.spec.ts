import { Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    addPerson,
    assignCard,
    createAttempt,
    getAllPersons,
    getPersonByRegistrantId,
} from "../helpers/api";
import { storageStatePath } from "../helpers/users";
import { expectToast } from "../helpers/ui";

freshDatabase();

const personsTable = (page: Page) => page.getByRole("main").getByRole("table");
const rowFor = (page: Page, name: string) =>
    personsTable(page).getByRole("row").filter({ hasText: name });
const searchBox = (page: Page) =>
    page.getByRole("searchbox", { name: "Search persons" });

const openRowMenu = async (page: Page, name: string) => {
    await page
        .getByRole("button", { name: `More actions for ${name}` })
        .click();
};

test.describe("persons list as a delegate", () => {
    signedInAs("delegate");

    test("lists, paginates and resizes pages", async ({ page, api }) => {
        const total = (await getAllPersons(api)).length;
        await page.goto("/persons");
        await expect(page.getByText(`${total} persons`)).toBeVisible();
        await expect(
            page.getByRole("tab", { name: `All persons ${total}` })
        ).toBeVisible();
        // header row + 10 people
        await expect(personsTable(page).getByRole("row")).toHaveCount(11);

        await page.getByRole("button", { name: "Next page" }).click();
        await expect(personsTable(page).getByRole("row")).toHaveCount(11);
        await page.getByRole("button", { name: "Last page" }).click();
        await expect(personsTable(page).getByRole("row")).toHaveCount(
            (total % 10 || 10) + 1
        );

        await page.getByRole("combobox", { name: "Persons per page" }).click();
        await page.getByRole("option", { name: "50 per page" }).click();
        await expect(personsTable(page).getByRole("row")).toHaveCount(
            Math.min(total, 50) + 1
        );
    });

    test("searches by name and WCA ID and filters by registrant ID", async ({
        page,
        api,
    }) => {
        const target = await getPersonByRegistrantId(api, 3);
        await page.goto("/persons");

        await searchBox(page).fill(target.name);
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await expect(rowFor(page, target.name)).toBeVisible();

        await searchBox(page).fill(target.wcaId!);
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await expect(rowFor(page, target.name)).toBeVisible();

        await searchBox(page).fill("");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("3");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await expect(rowFor(page, target.name)).toBeVisible();

        await page.getByRole("textbox", { name: "Registrant ID" }).fill("");
        await searchBox(page).fill("nobody-has-this-name");
        await expect(page.getByText("No persons found.")).toBeVisible();
    });

    test("filters by card, newcomers and check-in state", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 4);
        await assignCard(api, person.id, "e2e-filter-card");
        await page.goto("/persons");

        await page
            .getByRole("textbox", { name: "Card ID" })
            .fill("e2e-filter-card");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await expect(
            rowFor(page, person.name).getByLabel("Card assigned")
        ).toBeVisible();
        await page.getByRole("textbox", { name: "Card ID" }).fill("");

        await page.getByRole("button", { name: "Newcomers" }).click();
        await expect(
            page.getByRole("button", { name: "Newcomers" })
        ).toHaveAttribute("aria-pressed", "true");
        const newcomerRows = personsTable(page).getByRole("row");
        await expect(newcomerRows.nth(1)).toBeVisible();
        // Every listed newcomer has no WCA ID
        for (const cell of await personsTable(page)
            .getByRole("row")
            .filter({ has: page.getByRole("cell") })
            .all()) {
            await expect(cell).toContainText("Newcomer");
        }
        await page.getByRole("button", { name: "Newcomers" }).click();

        await page.getByRole("button", { name: "Not checked in" }).click();
        const total = (await getAllPersons(api)).length;
        await expect(page.getByText(`${total} persons`)).toBeVisible();
    });

    test("adds a staff member", async ({ page }) => {
        await page.goto("/persons");
        await page.getByRole("button", { name: "Add person" }).click();
        const dialog = page.getByRole("dialog", { name: "Add person" });
        await expect(
            dialog.getByRole("tab", { name: "Staff member" })
        ).toHaveAttribute("aria-selected", "true");
        await dialog.getByLabel("Name").fill("Quinn Volunteer");
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: "Female" }).click();
        await dialog.getByLabel("Card").fill("e2e-staff-card-1");
        await dialog.getByRole("button", { name: "Add person" }).click();

        await expectToast(page, "Successfully added new person");
        await expect(dialog).toBeHidden();
        await searchBox(page).fill("Quinn Volunteer");
        const row = rowFor(page, "Quinn Volunteer");
        await expect(row).toBeVisible();
        await expect(row).toContainText("Female");
        await expect(row.getByLabel("Card assigned")).toBeVisible();
        await expect(row.getByLabel("Not can compete")).toBeVisible();
    });

    test("adds an unofficial-events competitor", async ({ page }) => {
        await page.goto("/persons");
        await page.getByRole("button", { name: "Add person" }).click();
        const dialog = page.getByRole("dialog", { name: "Add person" });
        await dialog.getByRole("tab", { name: "Competitor" }).click();
        const panel = dialog.getByRole("tabpanel", { name: "Competitor" });
        await panel.getByLabel("Name").fill("Robin Sideevent");
        await panel.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "Other" }).click();
        await panel.getByRole("combobox").nth(1).click();
        await page.getByRole("option", { name: "Poland", exact: true }).click();
        await panel.getByRole("button", { name: "Add person" }).click();

        await expectToast(page, "Successfully added new person");
        await searchBox(page).fill("Robin Sideevent");
        const row = rowFor(page, "Robin Sideevent");
        await expect(row).toBeVisible();
        await expect(row.getByLabel("Can compete")).toBeVisible();
    });

    test("assigns a card and refuses a card that is taken", async ({
        page,
        api,
    }) => {
        const holder = await getPersonByRegistrantId(api, 5);
        await assignCard(api, holder.id, "e2e-taken-card");
        const person = await getPersonByRegistrantId(api, 6);

        await page.goto("/persons");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("6");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await rowFor(page, person.name)
            .getByRole("button", { name: "Assign card" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Assign card" });
        await dialog.getByPlaceholder("Card").fill("e2e-taken-card");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(
            dialog.getByText("This card is already assigned to another person")
        ).toBeVisible();

        await dialog.getByPlaceholder("Card").fill("e2e-fresh-card");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog).toBeHidden();
        await expect(
            rowFor(page, person.name).getByLabel("Card assigned")
        ).toBeVisible();
    });

    test("shows a person's groups", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 7);
        await page.goto("/persons");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("7");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await openRowMenu(page, person.name);
        await page.getByRole("menuitem", { name: "Groups" }).click();

        const dialog = page.getByRole("dialog", { name: "Groups" });
        await expect(
            dialog.getByRole("columnheader", { name: "Activity" })
        ).toBeVisible();
        await expect(dialog.getByRole("row").nth(1)).toBeVisible();
        await expect(
            dialog.getByRole("cell", { name: "Competitor" }).first()
        ).toBeVisible();
    });

    test("issues a warning and lists it", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 8);
        await page.goto("/persons");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("8");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();

        await openRowMenu(page, person.name);
        await page.getByRole("menuitem", { name: "Warnings" }).click();
        const empty = page.getByRole("dialog", {
            name: `Warnings for ${person.name}`,
        });
        await expect(empty.getByText("No warnings found")).toBeVisible();
        await empty.getByRole("button", { name: "Close" }).click();
        await expect(empty).toBeHidden();

        await openRowMenu(page, person.name);
        await page.getByRole("menuitem", { name: "Issue warning" }).click();
        const issue = page.getByRole("dialog", {
            name: `Issue warning to ${person.name}`,
        });
        await issue.getByLabel("Description").fill("Left the station early");
        await issue.getByRole("button", { name: "Issue warning" }).click();
        await expectToast(page, "Warning issued");
        await expect(issue).toBeHidden();

        await openRowMenu(page, person.name);
        await page.getByRole("menuitem", { name: "Warnings" }).click();
        await expect(
            page
                .getByRole("dialog", { name: `Warnings for ${person.name}` })
                .getByText("Left the station early - issued by Dana Delegate")
        ).toBeVisible();
    });

    test("opens a person's results", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 9);
        await createAttempt(api, {
            roundId: "222-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 512,
        });
        await page.goto("/persons");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("9");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await openRowMenu(page, person.name);
        await page.getByRole("menuitem", { name: "All results" }).click();

        await expect(page).toHaveURL(
            new RegExp(`/persons/${person.id}/results$`)
        );
        await expect(
            page.getByRole("main").getByRole("heading", { name: person.name })
        ).toBeVisible();
        await expect(page.getByRole("main")).toContainText("5.12");
    });

    test("shows an empty results page for a person without results", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 10);
        await page.goto(`/persons/${person.id}/results`);
        await expect(page.getByText("No results yet.")).toBeVisible();
    });
});

test.describe("persons list for other roles", () => {
    test("staff can look up persons but not add or assign cards", async ({
        browser,
        api,
    }) => {
        const person = await addPerson(api, {
            name: "Casey Cardholder",
            cardId: "e2e-staff-view-card",
        });
        const context = await browser.newContext({
            storageState: storageStatePath("staff"),
        });
        const page = await context.newPage();
        await page.goto("/persons");
        await expect(page.getByText(/\d+ persons/)).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Add person" })
        ).toHaveCount(0);

        await searchBox(page).fill(person.name);
        await rowFor(page, person.name)
            .getByRole("button", { name: "Assign card" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Assign card" });
        await expect(dialog.getByPlaceholder("Card")).toHaveAttribute(
            "readonly",
            ""
        );
        await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(
            0
        );
        // No group, results or warning actions for plain staff
        await expect(
            page.getByRole("button", {
                name: `More actions for ${person.name}`,
            })
        ).toHaveCount(0);
        await context.close();
    });

    test("organizers see groups but not warnings", async ({ browser, api }) => {
        const person = await getPersonByRegistrantId(api, 11);
        const context = await browser.newContext({
            storageState: storageStatePath("organizer"),
        });
        const page = await context.newPage();
        await page.goto("/persons");
        await page.getByRole("textbox", { name: "Registrant ID" }).fill("11");
        await expect(page.getByText("1 person", { exact: true })).toBeVisible();
        await openRowMenu(page, person.name);
        await expect(
            page.getByRole("menuitem", { name: "Groups" })
        ).toBeVisible();
        await expect(
            page.getByRole("menuitem", { name: "All results" })
        ).toBeVisible();
        await expect(
            page.getByRole("menuitem", { name: "Warnings" })
        ).toHaveCount(0);
        await expect(
            page.getByRole("menuitem", { name: "Issue warning" })
        ).toHaveCount(0);
        await context.close();
    });
});
