import { APIRequestContext, Browser, Page } from "@playwright/test";

import { BACKEND_URL } from "../env";
import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    assignCard,
    getPersonByRegistrantId,
    getResult,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import {
    buildScramblesFile,
    importScrambleSets,
    SCRAMBLES_PASSWORD,
} from "../helpers/scrambles";
import { confirm, expectToast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

const uploadScrambles = async (
    page: Page,
    rounds: { roundId: string; sets: number }[]
) => {
    await page.goto("/scrambles");
    await page.getByRole("tab", { name: "Import" }).click();
    await page.locator('input[type="file"]').setInputFiles({
        name: "scrambles-e2e.json",
        mimeType: "application/json",
        buffer: buildScramblesFile(rounds),
    });
};

const roundButton = (page: Page, name: RegExp) =>
    page.getByRole("navigation", { name: "Rounds" }).getByRole("button", {
        name,
    });

const deleteAllScrambleSets = async (api: APIRequestContext) => {
    const response = await api.delete("scramble-set/all");
    expect(response.ok()).toBeTruthy();
};

/**
 * The delegate adds a scrambling device in a room and reads its one-time code;
 * a fresh browser (the tablet, nobody signed in) logs in with it.
 */
const signInTablet = async (page: Page, browser: Browser, roomName: string) => {
    await page.goto("/scrambles");
    await page.getByRole("tab", { name: "Scrambling devices" }).click();
    await page.getByRole("button", { name: "Add device" }).click();
    const create = page.getByRole("dialog", {
        name: "Create scrambling device",
    });
    const name = `Scrambling tablet ${Date.now()}`;
    await create.getByLabel("Name").fill(name);
    await create.getByRole("combobox").click();
    await page.getByRole("option", { name: roomName }).click();
    await create.getByRole("button", { name: "Save" }).click();
    await page
        .getByRole("main")
        .getByRole("listitem")
        .filter({ hasText: name })
        .getByRole("button", { name: "One-time login code" })
        .click();
    const codeHeading = page
        .getByRole("dialog", { name: "Enter this code to log in" })
        .getByRole("heading", { name: /^\d{6}$/ });
    await expect(codeHeading).toBeVisible();
    const code = (await codeHeading.textContent())!.trim();

    const device = await browser.newContext({
        storageState: { cookies: [], origins: [] },
    });
    const tablet = await device.newPage();
    await tablet.goto("/auth/login");
    await tablet.getByRole("button", { name: "Scrambling device" }).click();
    // The sixth digit sends the code
    await tablet.getByLabel("Device code").fill(code);
    await expect(tablet).toHaveURL(/\/scrambling-device$/);
    await expect(
        tablet.getByRole("heading", { name: "Scramble sets" })
    ).toBeVisible();
    return { device, tablet };
};

test.describe("scramble sets", () => {
    test.beforeEach(async ({ api }) => {
        await deleteAllScrambleSets(api);
    });

    test("imports encrypted scrambles and lists the sets per round", async ({
        page,
    }) => {
        await uploadScrambles(page, [
            { roundId: "333-r1", sets: 2 },
            { roundId: "222-r1", sets: 2 },
        ]);
        // Rounds missing from the file are pointed out, but do not block
        await expect(
            page.getByText("Warnings detected during import")
        ).toBeVisible();
        await page.getByRole("button", { name: "Import", exact: true }).click();
        await expectToast(page, "Scrambles imported");

        await page.getByRole("tab", { name: "Scramble sets" }).click();
        await roundButton(page, /3x3x3 Cube · Round 1/).click();
        const sets = page.getByRole("main").getByRole("listitem");
        await expect(sets).toHaveCount(2);
        await expect(sets.first()).toContainText("Set A");
        await expect(roundButton(page, /3x3x3 Cube · Round 2/)).toContainText(
            "Missing"
        );
    });

    test("refuses scrambles that are not encrypted", async ({ page }) => {
        await page.goto("/scrambles");
        await page.getByRole("tab", { name: "Import" }).click();
        const plain = {
            wcif: {
                events: [
                    {
                        id: "333",
                        rounds: [
                            {
                                id: "333-r1",
                                scrambleSets: [
                                    {
                                        id: 1,
                                        scrambles: ["R U R' U'"],
                                        extraScrambles: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        };
        await page.locator('input[type="file"]').setInputFiles({
            name: "plain.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(plain)),
        });
        await expect(
            page.getByText("Errors detected during import")
        ).toBeVisible();
        await expect(
            page.getByText(/Set A contains unencrypted scrambles/)
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Import", exact: true })
        ).toBeDisabled();
        await page.getByRole("button", { name: "Clear" }).click();
        await expect(
            page.getByText("Errors detected during import")
        ).toHaveCount(0);
    });

    test("adds a set to a round and deletes sets", async ({ page }) => {
        await uploadScrambles(page, [{ roundId: "333-r1", sets: 1 }]);
        await page.getByRole("button", { name: "Import", exact: true }).click();
        await expectToast(page, "Scrambles imported");
        await page.getByRole("tab", { name: "Scramble sets" }).click();
        await roundButton(page, /3x3x3 Cube · Round 1/).click();
        const sets = page.getByRole("main").getByRole("listitem");
        await expect(sets).toHaveCount(1);

        await page.getByRole("button", { name: "Add scramble set" }).click();
        const dialog = page.getByRole("dialog", {
            name: /Add scramble set for 3x3x3 Cube, Round 1/,
        });
        await dialog.getByLabel("Upload scrambles").setInputFiles({
            name: "extra-set.json",
            mimeType: "application/json",
            buffer: buildScramblesFile([{ roundId: "333-r1", sets: 1 }]),
        });
        await dialog.getByRole("button", { name: "Add", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(sets).toHaveCount(2);
        await expect(sets.nth(1)).toContainText("Set B");

        await page
            .getByRole("button", { name: /More actions for .*Set B/ })
            .click();
        await page
            .getByRole("menuitem", { name: "Delete scramble set" })
            .click();
        await confirm(page);
        await expect(sets).toHaveCount(1);

        await page
            .getByRole("button", { name: "More scramble set actions" })
            .click();
        await page
            .getByRole("menuitem", { name: "Delete sets for this round" })
            .click();
        await confirm(page, "Delete");
        await expect(
            page.getByText("No scrambles for this round yet")
        ).toBeVisible();
    });
});

test.describe("scrambling devices", () => {
    test("creates, renames and deletes a scrambling device", async ({
        page,
        api,
    }) => {
        const room = await getRoom(api);
        await page.goto("/scrambles");
        await page.getByRole("tab", { name: "Scrambling devices" }).click();
        await page.getByRole("button", { name: "Add device" }).click();
        const dialog = page.getByRole("dialog", {
            name: "Create scrambling device",
        });
        await dialog.getByLabel("Name").fill("Scrambling tablet 1");
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: room.name }).click();
        await dialog.getByRole("button", { name: "Save" }).click();
        const item = page
            .getByRole("main")
            .getByRole("listitem")
            .filter({ hasText: "Scrambling tablet 1" });
        await expect(item).toContainText(room.name);

        await page
            .getByRole("button", {
                name: "More actions for Scrambling tablet 1",
            })
            .click();
        await page.getByRole("menuitem", { name: "Edit" }).click();
        const edit = page.getByRole("dialog", {
            name: "Edit scrambling device",
        });
        await edit.getByLabel("Name").fill("Scrambling tablet 2");
        await edit.getByRole("button", { name: "Save" }).click();
        await expect(
            page.getByRole("main").getByText("Scrambling tablet 2")
        ).toBeVisible();

        await page
            .getByRole("button", {
                name: "More actions for Scrambling tablet 2",
            })
            .click();
        await page.getByRole("menuitem", { name: "Delete device" }).click();
        await confirm(page);
        await expect(page.getByText("No scrambling devices yet")).toBeVisible();
    });

    test("a device signs in with a one-time code and scrambles for a competitor", async ({
        page,
        browser,
        api,
    }) => {
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["333-r1-g1"] });
        await deleteAllScrambleSets(api);
        await importScrambleSets(api, "333-r1", 1);

        const scrambler = await getPersonByRegistrantId(api, 1);
        const competitor = await getPersonByRegistrantId(api, 2);
        await assignCard(api, scrambler.id, "20001");
        await assignCard(api, competitor.id, "20002");

        const { device, tablet } = await signInTablet(page, browser, room.name);
        await expect(
            tablet.getByText("In progress in this room · Group 1")
        ).toBeVisible();

        await tablet.getByRole("button", { name: "Scramble" }).first().click();
        await expect(tablet).toHaveURL(/\/scrambling-device\/set\/[\w-]+$/);
        await tablet.getByLabel("Password").fill("not-the-password");
        await tablet.getByLabel("Password").press("Enter");
        await expect(tablet.getByText("Invalid password")).toBeVisible();
        await expect(
            tablet.getByLabel("Scan the scrambler's card")
        ).toHaveCount(0);
        await tablet.getByLabel("Password").fill(SCRAMBLES_PASSWORD);
        await tablet.getByLabel("Password").press("Enter");

        const scramblerScan = tablet.getByLabel("Scan the scrambler's card");
        await scramblerScan.fill("20001");
        await scramblerScan.press("Enter");
        await expect(
            tablet.getByText(`Scrambler ${scrambler.name}`)
        ).toBeVisible();

        const competitorScan = tablet.getByLabel("Scan the competitor's card");
        await competitorScan.fill("20001");
        await competitorScan.press("Enter");
        await expect(
            tablet.getByText("Scrambler and competitor cannot be the same")
        ).toBeVisible();
        await competitorScan.fill("20002");
        await competitorScan.press("Enter");
        await tablet.getByRole("button", { name: "Sign" }).click();
        await expect(tablet.getByRole("status")).toContainText(
            `Last signed: ${competitor.name} · Scramble 1`
        );

        const result = await getResult(api, "333-r1", competitor.id);
        expect(result.attempts).toEqual([
            expect.objectContaining({ attemptNumber: 1, status: "SCRAMBLED" }),
        ]);

        // All scrambles of the set, then back home
        await tablet.getByRole("button", { name: "Home" }).click();
        await tablet
            .getByRole("button", { name: "More actions for Set A" })
            .click();
        await tablet.getByRole("menuitem", { name: "All scrambles" }).click();
        await expect(tablet).toHaveURL(/\/scrambles$/);
        await tablet.getByLabel("Password").fill(SCRAMBLES_PASSWORD);
        await tablet.getByLabel("Password").press("Enter");
        // Five scrambles and two extras, decrypted
        await expect(tablet.getByRole("main")).toContainText("E2");
        await device.close();
    });

    test("says the password is invalid for any wrong password", async ({
        page,
        browser,
        api,
    }) => {
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["333-r1-g1"] });
        await deleteAllScrambleSets(api);
        await importScrambleSets(api, "333-r1", 1);
        const { device, tablet } = await signInTablet(page, browser, room.name);
        await tablet.getByRole("button", { name: "Scramble" }).first().click();
        await expect(tablet).toHaveURL(/\/set\/[\w-]+$/);
        const setId = tablet.url().split("/set/")[1];
        const token = await tablet.evaluate(() =>
            localStorage.getItem("fkmtime-scrambling-device-token")
        );
        // A wrong key can decrypt to bytes that are not text; that used to
        // crash with a 500 now and then, so try many, the way the tablet does
        const statuses = new Set<number>();
        for (let attempt = 1; attempt <= 500; attempt++) {
            const response = await tablet.request.post(
                `${BACKEND_URL}/scrambling/sets/${setId}/unlock`,
                {
                    headers: { Authorization: `Token ${token}` },
                    data: { password: `wrong-${attempt}` },
                }
            );
            statuses.add(response.status());
        }
        expect([...statuses]).toEqual([403]);
        await tablet.getByLabel("Password").fill("wrong-password");
        await tablet.getByLabel("Password").press("Enter");
        await expect(tablet.getByText("Invalid password")).toBeVisible();
        await device.close();
    });

    test("rejects a wrong device code", async ({ browser }) => {
        // A fresh tablet: nobody signed in
        const device = await browser.newContext({
            storageState: { cookies: [], origins: [] },
        });
        const tablet = await device.newPage();
        await tablet.goto("/auth/login");
        await tablet.getByRole("button", { name: "Scrambling device" }).click();
        await tablet.getByLabel("Device code").fill("000000");
        await expect(tablet.getByText("Wrong code")).toBeVisible();
        await tablet.getByRole("button", { name: "Back" }).click();
        await expect(
            tablet.getByRole("heading", { name: "Sign in" })
        ).toBeVisible();
        await device.close();
    });
});
