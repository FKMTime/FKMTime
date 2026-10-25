import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import { confirm } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

const round = (id: string, format = "a") => ({
    id,
    format,
    timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
    cutoff: null,
    results: [],
    linkedRounds: null,
    participationRuleset: null,
    scrambleSetCount: 0,
    scrambleSets: [],
    extensions: [],
});

const createMirrorBlocks = async (api: APIRequestContext, rounds = 2) => {
    const response = await api.post("events", {
        data: {
            eventId: "mirror",
            rounds: Array.from({ length: rounds }, (_, i) =>
                round(`mirror-r${i + 1}`)
            ),
        },
    });
    expect(response.status(), await response.text()).toBe(201);
};

const eventItem = (page: Page) =>
    page.getByRole("main").getByRole("listitem").filter({
        hasText: "Mirror blocks",
    });

test.beforeEach(async ({ api }) => {
    const events = await (await api.get("events/unofficial")).json();
    for (const event of events) {
        await api.delete(`events/${event.id}`);
    }
});

test.describe("unofficial events", () => {
    test("adds an unofficial event with its rounds", async ({ page, api }) => {
        await page.goto("/events");
        await expect(page.getByText("No unofficial events yet")).toBeVisible();

        await page
            .getByRole("button", { name: /Add unofficial event/ })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Add unofficial event",
        });
        await dialog.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "Mirror blocks" }).click();

        await dialog.getByRole("button", { name: "Add", exact: true }).click();
        await dialog.getByRole("button", { name: "Add", exact: true }).click();
        await expect(dialog.getByRole("cell", { name: "R2" })).toBeVisible();
        await dialog.getByRole("button", { name: "Add", exact: true }).click();
        await dialog.getByRole("button", { name: "Delete last round" }).click();
        await expect(dialog.getByRole("cell", { name: "R3" })).toHaveCount(0);

        const timeLimit = dialog.getByPlaceholder("Time limit").first();
        await timeLimit.fill("20000");
        await timeLimit.blur();
        await expect(timeLimit).toHaveValue("2:00.00");
        await dialog.getByRole("combobox").nth(2).click();
        await page.getByRole("option", { name: "Mean of 3" }).click();

        await dialog
            .getByRole("button", { name: "Add unofficial event" })
            .click();
        await expect(dialog).toBeHidden();
        await expect(eventItem(page)).toContainText("2 rounds");

        const [saved] = await (await api.get("events/unofficial")).json();
        expect(saved.eventId).toBe("mirror");
        expect(saved.wcif.rounds).toHaveLength(2);
        expect(saved.wcif.rounds[0].timeLimit.centiseconds).toBe(12000);
        expect(saved.wcif.rounds[1].format).toBe("m");
    });

    test("refuses to add the same event twice", async ({ page, api }) => {
        await createMirrorBlocks(api, 1);
        await page.goto("/events");
        await page
            .getByRole("button", { name: /Add unofficial event/ })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Add unofficial event",
        });
        await dialog.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "Mirror blocks" }).click();
        await dialog.getByRole("button", { name: "Add", exact: true }).click();
        await dialog
            .getByRole("button", { name: "Add unofficial event" })
            .click();
        await expect(dialog.getByText("Event already exists")).toBeVisible();
    });

    test("edits the rounds of an event", async ({ page, api }) => {
        await createMirrorBlocks(api, 2);
        await page.goto("/events");
        await expect(eventItem(page)).toContainText("2 rounds");

        await eventItem(page)
            .getByRole("button", { name: "Edit rounds" })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Edit rounds details",
        });
        await dialog.getByRole("button", { name: "Delete last round" }).click();
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog).toBeHidden();
        await expect(eventItem(page)).toContainText("1 round");
    });

    test("deletes an event", async ({ page, api }) => {
        await createMirrorBlocks(api, 1);
        await page.goto("/events");
        await page
            .getByRole("button", { name: "More actions for Mirror blocks" })
            .click();
        await page.getByRole("menuitem", { name: "Delete event" }).click();
        await confirm(page);
        await expect(page.getByText("No unofficial events yet")).toBeVisible();
    });
});
