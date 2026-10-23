import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    assignCard,
    createAttempts,
    createDevice,
    getPersonByRegistrantId,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import { Station } from "../helpers/station";
import { storageStatePath } from "../helpers/users";

freshDatabase();

test.describe("public display (signed out)", () => {
    test("opens on live solving and links to results", async ({ page }) => {
        await page.goto("/public");
        const nav = page
            .getByRole("navigation", { name: "Public display" })
            .first();
        await expect(
            nav.getByRole("link", { name: "Live solving" })
        ).toBeVisible();
        await nav.getByRole("link", { name: "Results" }).click();
        await expect(page).toHaveURL(/\/public\/results\/[\w-]+-r\d+$/);
    });

    test("shows a round's results and updates when a result comes in", async ({
        page,
        api,
    }) => {
        const first = await getPersonByRegistrantId(api, 1);
        const second = await getPersonByRegistrantId(api, 2);
        await createAttempts(api, "minx-r1", first.id, [6500, 6600]);

        await page.goto("/public/results/minx-r1");
        await expect(page.getByRole("main")).toContainText(first.name);
        await expect(page.getByRole("main")).toContainText("1:05.00");

        await createAttempts(api, "minx-r1", second.id, [6100, 6200]);
        // Pushed over the socket
        await expect(page.getByRole("main")).toContainText(second.name);
    });

    test("runs the TV view", async ({ page, api }) => {
        await setCurrentGroups(api, {});
        await page.goto("/public/tv");
        await expect(page).toHaveTitle(/TV/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
});

test.describe("live solving", () => {
    test("shows a station's running timer to staff and the public", async ({
        page,
        browser,
        api,
    }) => {
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["333-r1-g1"] });
        await createDevice(api, {
            name: "Station Live",
            espId: 0xb101,
            roomId: room.id,
        });
        const person = await getPersonByRegistrantId(api, 3);
        await assignCard(api, person.id, "30001");

        const staff = await browser.newContext({
            storageState: storageStatePath("staff"),
        });
        const staffPage = await staff.newPage();
        await staffPage.goto("/results/live");
        await page.goto("/public/live");

        const station = await Station.connect();
        try {
            await station.currentTime({
                espId: 0xb101,
                timeCs: 1234,
                competitorCardId: "30001",
                groupId: "333-r1-g1",
            });
            for (const view of [staffPage, page]) {
                const card = view.getByLabel(/^Station Live: /);
                await expect(card).toBeVisible();
                await expect(card).toContainText(person.name);
            }
        } finally {
            station.close();
        }
        await staff.close();
    });
});

test.describe("staff pages", () => {
    signedInAs("delegate");

    test("shows competition statistics", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 4);
        await createAttempts(api, "333-r1", person.id, [1000, 1100]);
        await page.goto("/statistics");
        const main = page.getByRole("main");
        for (const tile of [
            "Total solves",
            "Manually entered",
            "Competitors",
        ]) {
            await expect(main.getByText(tile, { exact: true })).toBeVisible();
        }
        await expect(
            main.getByRole("region", { name: "By round" })
        ).toContainText("3x3x3 Cube · Round 1");
    });

    test("opens a round from the bare results routes", async ({ page }) => {
        await page.goto("/results/round");
        await expect(page).toHaveURL(/\/results\/round\/[\w-]+-r\d+$/);
        await expect(
            page.getByRole("main").getByRole("heading", { level: 2 }).first()
        ).toBeVisible();

        await page.goto("/results/public");
        await expect(page).toHaveURL(/\/results\/public\/[\w-]+-r\d+$/);
        await page.getByRole("radio", { name: "2x2x2 Cube" }).click();
        await expect(
            page.getByRole("heading", { name: "2x2x2 Cube · Round 1" })
        ).toBeVisible();
    });

    test("answers unknown pages with a 404", async ({ page }) => {
        await page.goto("/this-page-does-not-exist");
        await expect(page.getByText("Error 404")).toBeVisible();
        await expect(page.getByText("Page not found")).toBeVisible();
    });
});
