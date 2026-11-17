import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import { MAIN_HALL } from "../helpers/api";
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

/** The seed schedule runs groups 1, 3, 5, ... of each round in the Main Hall */
const stageOne = async (api: APIRequestContext) =>
    (await getRooms(api)).find((room) => room.name === MAIN_HALL)!;

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
                name: "When to send results",
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
                name: "When to send results",
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
        await expect(nav.getByRole("link", { name: "Devices" })).toHaveCount(0);

        await devices.click();
        await page
            .getByRole("region", { name: "Unsaved changes" })
            .getByRole("button", { name: "Save" })
            .click();
        await expectToast(page, "Settings saved");
        await expect(nav.getByRole("link", { name: "Results" })).toBeVisible();
        await expect(
            nav.getByRole("link", { name: "Devices" })
        ).toHaveAttribute("href", "/devices");
        const settings = await (await api.get("competition/settings")).json();
        expect(settings.useFkmTimeDevices).toBe(true);
    });

    test("moves between setup tabs", async ({ page }) => {
        await page.goto("/competition");
        for (const [tab, path] of [
            ["Current groups", "/competition/groups"],
            ["Unofficial events", "/events"],
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

    const roomMenu = async (page: Page, roomName: string, item: string) => {
        await roomSection(page, roomName)
            .getByRole("button", { name: `More for ${roomName}` })
            .click();
        await page.getByRole("menuitem", { name: item }).click();
    };

    /** The picker is a dialog at Playwright's desktop size */
    const pickGroup = async (
        page: Page,
        roomName: string,
        chips: (string | RegExp)[]
    ) => {
        await roomMenu(page, roomName, "Change group…");
        const picker = page.getByRole("dialog", {
            name: `Change group in ${roomName}`,
        });
        for (const chip of chips)
            await picker
                .getByRole("button", { name: chip, exact: true })
                .click();
        return picker;
    };

    const closeRoundsToOpen = async (page: Page, roundName: string) => {
        const dialog = page.getByRole("dialog", {
            name: "Open these rounds in WCA Live",
        });
        await expect(dialog).toContainText(roundName);
        await dialog.getByRole("button", { name: "Done" }).click();
        await expect(dialog).toBeHidden();
    };

    test("starts, adds, stops and switches the groups in a room", async ({
        page,
        api,
    }) => {
        const [room] = await getRooms(api);
        const savedGroups = async () =>
            (await getRooms(api)).find((r) => r.id === room.id)!
                .currentGroupIds;
        await page.goto("/competition/groups");
        const section = roomSection(page, room.name);
        await expect(section.getByText("Nothing running")).toBeVisible();

        // An empty room starts the picked group once confirmed
        await pickGroup(page, room.name, ["3x3x3 Cube", /^Round 1/, "Group 1"]);
        await confirm(page, "Start 3x3 R1 G1");
        // A round that starts has to be opened in WCA Live. The dialog
        // hides the rest of the page, the toast too, until it closes
        await closeRoundsToOpen(page, "3x3x3 Cube · Round 1");
        await expectToast(page, `${room.name} updated`);
        await expect.poll(savedGroups).toEqual(["333-r1-g1"]);

        // A running room can take a second group of another event
        const picker = await pickGroup(page, room.name, [
            "2x2x2 Cube",
            /^Round 1/,
            "Group 1",
        ]);
        await expect(
            picker.getByText(
                "Stations in this room will accept results for both groups."
            )
        ).toBeVisible();
        await picker.getByRole("button", { name: "Run both" }).click();
        await expect(picker).toBeHidden();
        await closeRoundsToOpen(page, "2x2x2 Cube · Round 1");
        await expect.poll(savedGroups).toEqual(["333-r1-g1", "222-r1-g1"]);

        // Each group of a room running several can stop on its own
        await section.getByRole("button", { name: "Stop 2x2 R1 G1" }).click();
        await confirm(page, "Stop 2x2 R1 G1");
        await expect.poll(savedGroups).toEqual(["333-r1-g1"]);

        // Another group of a running event can only replace it
        const again = await pickGroup(page, room.name, [
            "3x3x3 Cube",
            /^Round 1/,
            "Group 2",
        ]);
        // The group running here can't be picked again
        await expect(
            again.getByRole("button", { name: "Group 1, running here" })
        ).toBeDisabled();
        await expect(
            again.getByRole("button", { name: "Run both" })
        ).toBeDisabled();
        await again
            .getByRole("button", { name: "Switch to 3x3 R1 G2" })
            .click();
        await expect.poll(savedGroups).toEqual(["333-r1-g2"]);
    });

    test("starts the next group, steps back and stops the room", async ({
        page,
        api,
    }) => {
        const room = await stageOne(api);
        await setGroups(api, { [room.id]: ["333-r1-g1"] });
        await page.goto("/competition/groups");
        const section = roomSection(page, room.name);
        await expect(
            section.getByText(/^Group 1 · 1 of \d+ here/)
        ).toBeVisible();

        await section.getByRole("button", { name: "Start group 3" }).click();
        await confirm(page, "Start group 3");
        await expect
            .poll(async () => (await stageOne(api)).currentGroupIds)
            .toEqual(["333-r1-g3"]);
        await expect(
            section.getByText(/^Group 3 · 2 of \d+ here/)
        ).toBeVisible();

        await roomMenu(page, room.name, "Back to the previous group");
        await confirm(page, "Start 3x3 R1 G1");
        await expect
            .poll(async () => (await stageOne(api)).currentGroupIds)
            .toEqual(["333-r1-g1"]);

        await roomMenu(page, room.name, "Stop the room");
        await confirm(page, "Stop the room");
        await expect
            .poll(async () => (await stageOne(api)).currentGroupIds)
            .toEqual([]);
        await expect(section.getByText("Nothing running")).toBeVisible();
    });

    test("saves only the changed room, keeping newer groups elsewhere", async ({
        page,
        api,
    }) => {
        const rooms = await getRooms(api);
        const main = rooms.find((room) => room.name === MAIN_HALL)!;
        const other = rooms.find((room) => room.name !== MAIN_HALL)!;
        await setGroups(api, {
            [main.id]: ["333-r1-g1"],
            [other.id]: ["333-r1-g2"],
        });
        await page.goto("/competition/groups");
        await expect(
            roomSection(page, main.name).getByRole("button", {
                name: "Start group 3",
            })
        ).toBeVisible();

        // The other room moves on while the page still shows its old group,
        // as an automatic group change would
        await setGroups(api, {
            [main.id]: ["333-r1-g1"],
            [other.id]: ["333-r1-g4"],
        });
        await roomSection(page, main.name)
            .getByRole("button", { name: "Start group 3" })
            .click();
        await confirm(page, "Start group 3");
        await expect
            .poll(async () =>
                Object.fromEntries(
                    (await getRooms(api)).map((room) => [
                        room.id,
                        room.currentGroupIds,
                    ])
                )
            )
            .toEqual({
                [main.id]: ["333-r1-g3"],
                [other.id]: ["333-r1-g4"],
            });
    });

    test("starts the scheduled group in a room with none running", async ({
        page,
        api,
    }) => {
        const room = await stageOne(api);
        await page.goto("/competition/groups");
        const section = roomSection(page, room.name);
        await expect(section.getByText("Nothing running")).toBeVisible();

        await section.getByRole("button", { name: /^Start / }).click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /^Start / })
            .click();
        await expect
            .poll(async () => (await stageOne(api)).currentGroupIds)
            .toHaveLength(1);
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
                    [room.name === MAIN_HALL ? "333-r1-g1" : "333-r1-g2"],
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
