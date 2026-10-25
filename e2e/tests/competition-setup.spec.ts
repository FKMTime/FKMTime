import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import { confirm, expectToast } from "../helpers/ui";
import { storageStatePath } from "../helpers/users";

freshDatabase();
signedInAs("delegate");

interface ApiRoom {
    id: string;
    name: string;
    currentGroupIds: string[];
}

const getRooms = async (api: APIRequestContext) =>
    (await (await api.get("competition/rooms")).json()) as ApiRoom[];

const setGroups = async (
    api: APIRequestContext,
    groupsByRoom: Record<string, string[]>
) => {
    const rooms = await getRooms(api);
    const response = await api.put("competition/rooms", {
        data: {
            rooms: rooms.map((room) => ({
                ...room,
                currentGroupIds: groupsByRoom[room.id] ?? [],
            })),
        },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
};

/** The seed schedule runs groups 1 and 3 of each first round in "Stage 1" */
const stageOne = async (api: APIRequestContext) =>
    (await getRooms(api)).find((room) => room.name === "Stage 1")!;

const roomSection = (page: Page, name: string) =>
    page.getByRole("main").getByRole("region", { name });

test.describe("competition settings", () => {
    test("edits, discards and saves the competition settings", async ({
        page,
        api,
    }) => {
        await page.goto("/competition");
        await expect(
            page.getByRole("tab", { name: "Competition" })
        ).toHaveAttribute("aria-selected", "true");
        const token = page.getByLabel("Scoretaking token");
        await expect(token).toHaveValue("wca-live-token");

        // Discard puts the saved values back
        await token.fill("throwaway-token");
        const unsaved = page.getByRole("region", { name: "Unsaved changes" });
        await expect(unsaved).toBeVisible();
        await unsaved.getByRole("button", { name: "Discard" }).click();
        await expect(unsaved).toBeHidden();
        await expect(token).toHaveValue("wca-live-token");

        await token.fill("e2e-scoretaking-token");
        await page.getByLabel("CubingContests token").fill("e2e-cc-token");
        await page
            .getByRole("combobox", {
                name: "Send results to WCA Live/CubingContests",
            })
            .click();
        await page.getByRole("option", { name: "Do not send" }).click();
        await page
            .getByRole("switch", { name: /Change groups automatically/ })
            .click();
        await unsaved.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Settings saved");
        await expect(unsaved).toBeHidden();

        const settings = await (await api.get("competition/settings")).json();
        expect(settings).toMatchObject({
            scoretakingToken: "e2e-scoretaking-token",
            cubingContestsToken: "e2e-cc-token",
            sendingResultsFrequency: "NEVER",
            shouldChangeGroupsAutomatically: true,
        });

        await page.reload();
        await expect(page.getByLabel("Scoretaking token")).toHaveValue(
            "e2e-scoretaking-token"
        );
        await expect(
            page.getByRole("combobox", {
                name: "Send results to WCA Live/CubingContests",
            })
        ).toHaveText("Do not send");
    });

    test("turning FKMTime devices off hides the device-only features", async ({
        page,
        api,
    }) => {
        await page.goto("/competition");
        const devices = page.getByRole("switch", {
            name: /Use FKMTime devices/,
        });
        await expect(devices).toBeChecked();
        await devices.click();
        // Device-only settings disappear while editing
        await expect(page.getByLabel("Scoretaking token")).toBeHidden();
        await page
            .getByRole("region", { name: "Unsaved changes" })
            .getByRole("button", { name: "Save" })
            .click();
        await expectToast(page, "Settings saved");

        const nav = page.getByRole("complementary").getByRole("navigation");
        await expect(nav.getByRole("link", { name: "Results" })).toHaveCount(0);
        await expect(nav.getByRole("link", { name: "Scrambles" })).toHaveCount(
            0
        );
        await expect(
            nav.getByRole("link", { name: "Incidents" })
        ).toHaveAttribute("href", "/incidents/manual");
        await expect(page.getByRole("tab", { name: "Devices" })).toHaveCount(0);

        await devices.click();
        await page
            .getByRole("region", { name: "Unsaved changes" })
            .getByRole("button", { name: "Save" })
            .click();
        await expectToast(page, "Settings saved");
        await expect(nav.getByRole("link", { name: "Results" })).toBeVisible();
        const settings = await (await api.get("competition/settings")).json();
        expect(settings.useFkmTimeDevices).toBe(true);
    });

    test("moves between setup tabs", async ({ page }) => {
        await page.goto("/competition");
        for (const [tab, path] of [
            ["Current groups", "/competition/groups"],
            ["Unofficial events", "/events"],
            ["Devices", "/devices"],
            ["Users", "/users"],
            ["Competition", "/competition"],
        ]) {
            await page.getByRole("tab", { name: tab }).click();
            await expect(page).toHaveURL(new RegExp(`${path}$`));
            await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
                "aria-selected",
                "true"
            );
        }
    });
});

test.describe("current groups", () => {
    test.beforeEach(async ({ api }) => {
        await setGroups(api, {});
    });

    test("adds, removes and saves the groups running in a room", async ({
        page,
        api,
    }) => {
        const [room] = await getRooms(api);
        await page.goto("/competition/groups");
        const section = roomSection(page, room.name);
        await expect(section.getByText("No groups in progress")).toBeVisible();
        await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

        await section.getByRole("combobox", { name: "Add group" }).click();
        await page
            .getByRole("option", { name: "3x3x3 Cube · Round 1 · Group 1" })
            .click();
        await section.getByRole("combobox", { name: "Add group" }).click();
        // Another group of the same event cannot run in the same room
        await expect(
            page.getByRole("option", { name: "3x3x3 Cube · Round 1 · Group 2" })
        ).toHaveAttribute("aria-disabled", "true");
        await page
            .getByRole("option", { name: "2x2x2 Cube · Round 1 · Group 1" })
            .click();
        await expect(section.getByText("2 groups")).toBeVisible();

        const changes = page.getByRole("region", { name: "Changes to save" });
        await expect(changes).toContainText(`${room.name}: no group →`);
        await expect(
            page.getByText(/Remember to open the following rounds in WCA Live/)
        ).toBeVisible();

        await section
            .getByRole("button", {
                name: "Remove 2x2x2 Cube · Round 1 · Group 1",
            })
            .click();
        await expect(
            section.getByText("1 group", { exact: true })
        ).toBeVisible();

        await page.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Groups saved");
        await expect(changes).toBeHidden();

        const saved = (await getRooms(api)).find((r) => r.id === room.id)!;
        expect(saved.currentGroupIds).toEqual(["333-r1-g1"]);
    });

    test("steps through the schedule, clears and discards", async ({
        page,
        api,
    }) => {
        const room = await stageOne(api);
        // Schedule stepping starts from the saved group
        await setGroups(api, { [room.id]: ["333-r1-g1"] });
        await page.goto("/competition/groups");
        const section = roomSection(page, room.name);
        await expect(
            section.getByText("3x3x3 Cube · Round 1 · Group 1")
        ).toBeVisible();

        await section
            .getByRole("button", { name: "Next from schedule" })
            .click();
        await expect(
            section.getByText("3x3x3 Cube · Round 1 · Group 3")
        ).toBeVisible();
        await page.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Groups saved");
        expect((await stageOne(api)).currentGroupIds).toEqual(["333-r1-g3"]);

        await section
            .getByRole("button", { name: "Previous from schedule" })
            .click();
        await expect(
            section.getByText("3x3x3 Cube · Round 1 · Group 1")
        ).toBeVisible();
        await section.getByRole("button", { name: "Clear" }).click();
        await expect(section.getByText("No groups in progress")).toBeVisible();
        await page.getByRole("button", { name: "Discard changes" }).click();
        await expect(
            section.getByText("3x3x3 Cube · Round 1 · Group 3")
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    });
});

test.describe("home", () => {
    test.beforeEach(async ({ api }) => {
        await setGroups(api, {});
    });

    test("starts the next group in a room", async ({ page, api }) => {
        const room = await stageOne(api);
        await setGroups(api, { [room.id]: ["333-r1-g1"] });
        await page.goto("/");
        const card = roomSection(page, room.name);
        await expect(
            card.getByRole("heading", { name: "3x3x3 Cube · Round 1" })
        ).toBeVisible();
        await expect(
            card.getByRole("link", { name: "Attendance" })
        ).toHaveAttribute("href", "/attendance/333-r1-g1");
        await expect(
            card.getByRole("button", { name: "Enter attempt" })
        ).toBeVisible();

        await card.getByRole("button", { name: "Start group 3" }).click();
        await confirm(page, "Start group 3");
        await expectToast(page, `${room.name}: group started`);
        await expect(
            card.getByRole("link", { name: "Attendance" })
        ).toHaveAttribute("href", "/attendance/333-r1-g3");
        expect((await stageOne(api)).currentGroupIds).toEqual(["333-r1-g3"]);
    });

    test("starts the next group in all rooms at once", async ({
        page,
        api,
    }) => {
        const rooms = await getRooms(api);
        await setGroups(
            api,
            Object.fromEntries(
                rooms.map((room) => [
                    room.id,
                    [room.name === "Stage 1" ? "333-r1-g1" : "333-r1-g2"],
                ])
            )
        );
        await page.goto("/");
        await page
            .getByRole("button", { name: "Next group in all rooms" })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Next group in all rooms",
        });
        await expect(dialog.getByRole("listitem")).toHaveCount(rooms.length);
        await dialog.getByRole("button", { name: "Switch all rooms" }).click();
        await expectToast(page, "Next group started in all rooms");
        await expect(dialog).toBeHidden();
        const after = await getRooms(api);
        expect(after.map((room) => room.currentGroupIds).sort()).toEqual([
            ["333-r1-g3"],
            ["333-r1-g4"],
        ]);
    });

    test("staff see the rooms without start controls", async ({
        browser,
        api,
    }) => {
        const [room] = await getRooms(api);
        await setGroups(api, { [room.id]: ["333-r1-g1"] });
        const context = await browser.newContext({
            storageState: storageStatePath("staff"),
        });
        const page = await context.newPage();
        await page.goto("/");
        const card = roomSection(page, room.name);
        await expect(
            card.getByRole("heading", { name: "3x3x3 Cube · Round 1" })
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Next group in all rooms" })
        ).toHaveCount(0);
        await expect(card.getByRole("button", { name: /^Start / })).toHaveCount(
            0
        );
        await expect(
            card.getByRole("link", { name: "Attendance" })
        ).toHaveCount(0);
        await context.close();
    });
});
