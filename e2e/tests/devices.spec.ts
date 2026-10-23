import { Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import { createDevice, getDevices, getRoom, getRooms } from "../helpers/api";
import { Station } from "../helpers/station";
import { confirm, expectToast } from "../helpers/ui";
import { storageStatePath } from "../helpers/users";

freshDatabase();
signedInAs("delegate");

const devicesTable = (page: Page) => page.getByRole("main").getByRole("table");
const deviceRow = (page: Page, name: string) =>
    devicesTable(page).getByRole("row").filter({ hasText: name });

const pickOption = async (page: Page, label: string, option: string) => {
    const dialog = page.getByRole("dialog");
    // The room select's label is not tied to its trigger; it is the first one
    const select =
        label === "Room"
            ? dialog.getByRole("combobox").first()
            : dialog.getByRole("combobox", { name: label });
    await select.click();
    await page.getByRole("option", { name: option, exact: true }).click();
};

/** The banner a device's connection request shows, by its hex ESP ID */
const connectionRequest = (page: Page, espIdHex: string) =>
    page
        .getByRole("main")
        .locator("div")
        .filter({ hasText: "New device wants to connect" })
        .filter({ hasText: `ESP ID ${espIdHex}` })
        .filter({ has: page.getByRole("button", { name: "Dismiss" }) })
        .last();

test.describe("devices", () => {
    test("adds a station through the form", async ({ page, api }) => {
        const room = await getRoom(api);
        await page.goto("/devices");
        await expect(page.getByText("0 devices")).toBeVisible();
        await expect(page.getByText("No devices yet")).toBeVisible();

        await page.getByRole("button", { name: "Add device" }).click();
        const dialog = page.getByRole("dialog", { name: "Create device" });
        await dialog.getByLabel("Name").fill("Station Alpha");
        await dialog.getByLabel("ESP ID").fill("1A2B");
        await pickOption(page, "Room", room.name);
        await pickOption(page, "Device type", "Station");
        await pickOption(page, "Hardware version", "V4");
        await dialog.getByRole("button", { name: "Add" }).click();
        await expect(dialog).toBeHidden();

        const row = deviceRow(page, "Station Alpha");
        await expect(row).toContainText("1A2B");
        await expect(row).toContainText("Station");
        await expect(row).toContainText("(V4)");
        await expect(page.getByText("1 device", { exact: true })).toBeVisible();
    });

    test("refuses a second device with the same ESP ID", async ({
        page,
        api,
    }) => {
        const room = await getRoom(api);
        await createDevice(api, {
            name: "Station Taken",
            espId: 0x2b2b,
            roomId: room.id,
        });
        await page.goto("/devices");
        await page.getByRole("button", { name: "Add device" }).click();
        const dialog = page.getByRole("dialog", { name: "Create device" });
        await dialog.getByLabel("Name").fill("Station Copy");
        await dialog.getByLabel("ESP ID").fill("2B2B");
        await pickOption(page, "Room", room.name);
        await dialog.getByRole("button", { name: "Add" }).click();
        await expect(
            dialog.getByText(
                "Device with this name or ESP ID already exists in database"
            )
        ).toBeVisible();
    });

    test("edits and deletes a device", async ({ page, api }) => {
        const room = await getRoom(api);
        await createDevice(api, {
            name: "Station Rename Me",
            espId: 0x3c3c,
            roomId: room.id,
        });
        await page.goto("/devices");
        await deviceRow(page, "Station Rename Me")
            .getByRole("button", { name: "Edit device" })
            .click();
        const dialog = page.getByRole("dialog", { name: "Edit device" });
        await expect(dialog.getByLabel("ESP ID")).toHaveValue("3C3C");
        await dialog.getByLabel("Name").fill("Station Renamed");
        await dialog.getByRole("button", { name: /Save|Edit|Update/ }).click();
        await expect(dialog).toBeHidden();
        await expect(deviceRow(page, "Station Renamed")).toBeVisible();

        await page
            .getByRole("button", { name: "More actions for Station Renamed" })
            .click();
        await page.getByRole("menuitem", { name: "Delete device" }).click();
        await confirm(page, "Delete device");
        await expect(deviceRow(page, "Station Renamed")).toHaveCount(0);
        expect(
            (await getDevices(api)).some((d) => d.name === "Station Renamed")
        ).toBe(false);
    });

    test("filters by room and switches to the cards view", async ({
        page,
        api,
    }) => {
        const rooms = await getRooms(api);
        await createDevice(api, {
            name: "Station First Room",
            espId: 0x4d01,
            roomId: rooms[0].id,
        });
        await createDevice(api, {
            name: "Station Second Room",
            espId: 0x4d02,
            roomId: rooms[1].id,
        });
        await page.goto("/devices");
        await expect(deviceRow(page, "Station First Room")).toBeVisible();
        await expect(deviceRow(page, "Station Second Room")).toBeVisible();

        await page.getByRole("combobox", { name: "Room" }).click();
        await page.getByRole("option", { name: rooms[1].name }).click();
        await expect(deviceRow(page, "Station Second Room")).toBeVisible();
        await expect(deviceRow(page, "Station First Room")).toHaveCount(0);

        await page.getByRole("radio", { name: "Cards" }).click();
        await expect(
            page.getByRole("article", { name: "Station Second Room" })
        ).toContainText("Station");
    });

    test("adds a device that asks to connect", async ({ page, api }) => {
        const room = await getRoom(api);
        await page.goto("/devices");
        await expect(page.getByText(/\d+ devices?/)).toBeVisible();

        const station = await Station.connect();
        try {
            const response = await station.requestToConnect(0x5e5e, "STATION");
            expect(response.data.status).toBe(200);
            await connectionRequest(page, "5E5E")
                .getByRole("button", { name: "Add" })
                .click();

            const dialog = page.getByRole("dialog", { name: "Create device" });
            await expect(dialog.getByLabel("ESP ID")).toHaveValue("5E5E");
            await dialog.getByLabel("Name").fill("Station From Request");
            await pickOption(page, "Room", room.name);
            await dialog.getByRole("button", { name: "Add" }).click();
            await expect(dialog).toBeHidden();
            await expect(deviceRow(page, "Station From Request")).toContainText(
                "5E5E"
            );
            await expect(page.getByText("ESP ID 5E5E")).toHaveCount(0);

            // A device already in the database is told so
            const again = await station.requestToConnect(0x5e5e, "STATION");
            expect(again.data.status).toBe(409);
        } finally {
            station.close();
        }
    });

    test("dismisses a connection request", async ({ page }) => {
        await page.goto("/devices");
        await expect(page.getByText(/\d+ devices?/)).toBeVisible();
        const station = await Station.connect();
        try {
            await station.requestToConnect(0x6f6f, "STAFF_ATTENDANCE");
            await connectionRequest(page, "6F6F")
                .getByRole("button", { name: "Dismiss" })
                .click();
            await expect(page.getByText("ESP ID 6F6F")).toHaveCount(0);
        } finally {
            station.close();
        }
    });

    test("runs and stops the auto setup mode", async ({ page }) => {
        await page.goto("/devices");
        await page.getByRole("button", { name: "Auto setup devices" }).click();
        const dialog = page.getByRole("dialog", { name: "Auto Setup Devices" });
        await expect(
            dialog.getByText("The system is now in auto setup mode.")
        ).toBeVisible();
        await dialog.getByRole("button", { name: "Stop" }).click();
        await expect(dialog).toBeHidden();
    });

    test("saves the device settings", async ({ page, api }) => {
        await page.goto("/devices");
        await page.getByRole("radio", { name: "Settings" }).click();
        await expect(page).toHaveURL(/tab=settings/);

        const secureRfid = page.getByRole("switch", { name: /Secure RFID/ });
        const wasOn = await secureRfid.isChecked();
        await secureRfid.click();
        await page.getByLabel("WiFi SSID").fill("e2e-venue-wifi");
        await page.getByRole("button", { name: "Save" }).click();
        await expectToast(page, "Device settings saved");

        const competition = await (
            await api.get("competition/settings")
        ).json();
        const settings = await (
            await api.get(`competition/settings/${competition.id}/devices`)
        ).json();
        expect(settings.wifiSsid).toBe("e2e-venue-wifi");

        await page.reload();
        await expect(page.getByLabel("WiFi SSID")).toHaveValue(
            "e2e-venue-wifi"
        );
        await expect(
            page.getByRole("switch", { name: /Secure RFID/ })
        ).toHaveAttribute("aria-checked", String(!wasOn));
    });

    test("only admins can upload firmware", async ({ page, browser }) => {
        await page.goto("/devices");
        await expect(
            page.getByRole("radio", { name: "Upload firmware" })
        ).toHaveCount(0);

        const context = await browser.newContext({
            storageState: storageStatePath("admin"),
        });
        const adminPage = await context.newPage();
        await adminPage.goto("/devices?tab=uploadFirmware");
        const upload = adminPage.getByRole("button", {
            name: "Upload firmware",
        });
        await expect(upload).toBeDisabled();
        await adminPage.locator('input[type="file"]').setInputFiles({
            name: "station-e2e.bin",
            mimeType: "application/octet-stream",
            buffer: Buffer.from([0xe9, 0x01, 0x02, 0x03]),
        });
        await expect(upload).toBeEnabled();
        await upload.click();
        await expectToast(adminPage, "Firmware uploaded");
        await context.close();
    });
});
