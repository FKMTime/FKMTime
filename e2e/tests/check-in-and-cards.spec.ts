import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    addPerson,
    assignCard,
    checkIn,
    getPersonByRegistrantId,
} from "../helpers/api";
import { toast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

test.describe("check-in desk", () => {
    test("checks in a competitor by scanning their card", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 1);
        await assignCard(api, person.id, "e2e-checkin-scan");
        await page.goto("/check-in");
        await expect(page.getByText("25 to go")).toBeVisible();

        await page
            .getByRole("textbox", { name: "Scan the competitor's card" })
            .fill("e2e-checkin-scan");
        await page.keyboard.press("Enter");
        const panel = page.getByRole("form", {
            name: `Check in ${person.name}`,
        });
        await expect(panel).toBeVisible();
        await panel
            .getByRole("button", { name: "Check in", exact: true })
            .click();

        await expect(toast(page, `${person.name} checked in`)).toBeVisible();
        await expect(page.getByText("24 to go")).toBeVisible();
        await expect(page.getByText("Just checked in")).toBeVisible();

        // Scanning the same card again explains they are already here
        await page
            .getByRole("textbox", { name: "Scan the competitor's card" })
            .fill("e2e-checkin-scan");
        await page.keyboard.press("Enter");
        await expect(
            page.getByText(`${person.name} is already checked in.`)
        ).toBeVisible();
    });

    test("explains an unknown card", async ({ page }) => {
        await page.goto("/check-in");
        await page
            .getByRole("textbox", { name: "Scan the competitor's card" })
            .fill("e2e-card-nobody-has");
        await page.keyboard.press("Enter");
        await expect(
            page.getByText("This card is not assigned to anyone.")
        ).toBeVisible();
    });

    test("finds a competitor by name, assigns a card on check-in and undoes it", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 2);
        await page.goto("/check-in");
        await page
            .getByRole("searchbox", { name: "Find a competitor by name" })
            .fill(person.name);
        const result = page.getByRole("button", {
            name: new RegExp(person.name),
        });
        await expect(result).toContainText("No card");
        await result.click();

        const panel = page.getByRole("form", {
            name: `Check in ${person.name}`,
        });
        await expect(
            panel.getByRole("button", { name: "Check in and assign card" })
        ).toBeDisabled();
        await panel
            .getByLabel("Scan a card to assign it to this competitor")
            .fill("e2e-checkin-new-card");
        await panel
            .getByRole("button", { name: "Check in and assign card" })
            .click();

        const undoToast = toast(
            page,
            `${person.name} checked in and card assigned`
        );
        await expect(undoToast).toBeVisible();
        await page
            .getByRole("region", { name: /Notifications/ })
            .getByRole("button", { name: "Undo" })
            .click();

        await expect
            .poll(
                async () => (await getPersonByRegistrantId(api, 2)).checkedInAt
            )
            .toBeNull();
        expect((await getPersonByRegistrantId(api, 2)).cardId).toBeNull();
    });

    test("requires the newcomer checks before checking a newcomer in", async ({
        page,
        api,
    }) => {
        const person = await addPerson(api, {
            name: "Nova Newcomer",
            countryIso2: "PL",
            canCompete: true,
            cardId: "e2e-newcomer-card",
        });
        await page.goto("/check-in");
        await page
            .getByRole("searchbox", { name: "Find a competitor by name" })
            .fill("Nova Newcomer");
        await page.getByRole("button", { name: /Nova Newcomer/ }).click();

        const panel = page.getByRole("form", {
            name: `Check in ${person.name}`,
        });
        const submit = panel.getByRole("button", {
            name: "Check in",
            exact: true,
        });
        await expect(submit).toBeDisabled();
        await expect(panel.getByText("Newcomer checks")).toBeVisible();
        for (const box of await panel.getByRole("checkbox").all()) {
            await box.check();
        }
        await submit.click();
        await expect(toast(page, "Nova Newcomer checked in")).toBeVisible();
    });

    test("refuses a card that already belongs to someone else", async ({
        page,
        api,
    }) => {
        const holder = await getPersonByRegistrantId(api, 12);
        await assignCard(api, holder.id, "e2e-checkin-taken");
        const person = await getPersonByRegistrantId(api, 13);
        await page.goto("/check-in");
        await page
            .getByRole("searchbox", { name: "Find a competitor by name" })
            .fill(person.name);
        await page
            .getByRole("button", { name: new RegExp(person.name) })
            .click();
        const panel = page.getByRole("form", {
            name: `Check in ${person.name}`,
        });
        await panel
            .getByLabel("Scan a card to assign it to this competitor")
            .fill("e2e-checkin-taken");
        await panel
            .getByRole("button", { name: "Check in and assign card" })
            .click();
        await expect(
            page.getByText("This card is already assigned to someone else.")
        ).toBeVisible();
    });

    test("counts check-ins made at another desk", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 14);
        await assignCard(api, person.id, "e2e-checkin-api");
        await page.goto("/check-in");
        const before = await page.getByText(/\d+ to go/).textContent();
        await checkIn(api, person.id, "e2e-checkin-api");
        await page.reload();
        const after = await page.getByText(/\d+ to go/).textContent();
        expect(parseInt(after!)).toBe(parseInt(before!) - 1);
    });
});

test.describe("assign cards", () => {
    test("assigns cards one after another from the search list", async ({
        page,
        api,
    }) => {
        const first = await getPersonByRegistrantId(api, 15);
        const second = await getPersonByRegistrantId(api, 16);
        await page.goto("/cards");
        await expect(
            page.getByRole("tab", { name: /Assign cards/ })
        ).toHaveAttribute("aria-selected", "true");

        const search = page.getByRole("combobox", {
            name: "Search persons without a card",
        });
        await search.fill(first.name);
        await page
            .getByRole("listbox", { name: "Persons without a card" })
            .getByRole("option", { name: new RegExp(first.name) })
            .click();
        await expect(
            page.getByRole("heading", { name: first.name })
        ).toBeVisible();
        await page
            .getByRole("textbox", { name: "Card ID" })
            .fill("e2e-cards-1");
        await page.getByRole("button", { name: "Assign" }).click();
        await expect(
            toast(page, `Card assigned to ${first.name}`)
        ).toBeVisible();

        await search.fill(second.name);
        await page
            .getByRole("listbox", { name: "Persons without a card" })
            .getByRole("option", { name: new RegExp(second.name) })
            .click();
        await page
            .getByRole("textbox", { name: "Card ID" })
            .fill("e2e-cards-1");
        await page.getByRole("button", { name: "Assign" }).click();
        await expect(
            page.getByText("This card is already assigned to someone else.")
        ).toBeVisible();
        await page
            .getByRole("textbox", { name: "Card ID" })
            .fill("e2e-cards-2");
        await page.getByRole("button", { name: "Assign" }).click();
        await expect(
            toast(page, `Card assigned to ${second.name}`)
        ).toBeVisible();

        expect((await getPersonByRegistrantId(api, 15)).cardId).toBe(
            "e2e-cards-1"
        );
        expect((await getPersonByRegistrantId(api, 16)).cardId).toBe(
            "e2e-cards-2"
        );

        await search.fill(first.name);
        await expect(
            page.getByText(`Nobody matches “${first.name}”.`)
        ).toBeVisible();
    });
});
