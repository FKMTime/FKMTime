import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    addPerson,
    createDevice,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import { Station } from "../helpers/station";
import { confirm, socketEventSent, toast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

interface Activity {
    id: string;
    personId: string;
    role: string;
    status: string;
    comment: string | null;
    person: { id: string; name: string };
}

const groupAttendance = async (api: APIRequestContext, groupId: string) =>
    (await (await api.get(`attendance/group/${groupId}`)).json()) as Activity[];

const roleCard = (page: Page, title: string) =>
    page.getByRole("region", { name: title, exact: true });
const personRow = (page: Page, title: string, name: string) =>
    roleCard(page, title).getByRole("listitem").filter({ hasText: name });

const undoToast = async (page: Page, title: string) => {
    const notification = toast(page, title).locator("xpath=ancestor::li[1]");
    await expect(notification).toBeVisible();
    return notification;
};

test.describe("attendance for a group", () => {
    test("shows the group's assignments by role", async ({ page, api }) => {
        const assigned = (await groupAttendance(api, "333-r1-g1")).length;
        await page.goto("/attendance");
        await expect(
            page.getByText("Pick a group to take attendance.")
        ).toBeVisible();

        await page.goto("/attendance/333-r1-g1");
        await expect(
            page.getByRole("heading", {
                name: "3x3x3 Cube · Round 1 · Group 1",
            })
        ).toBeVisible();
        await expect(
            page.getByText(`0 present · ${assigned} absent`)
        ).toBeVisible();
        for (const title of ["Competitors", "Scramblers", "Judges"]) {
            await expect(roleCard(page, title)).toBeVisible();
        }

        // Role chips hide and show sections
        await page
            .getByRole("group", { name: "Roles shown" })
            .getByRole("button", { name: "Judges" })
            .click();
        await expect(roleCard(page, "Judges")).toHaveCount(0);
        await page
            .getByRole("group", { name: "Roles shown" })
            .getByRole("button", { name: "Judges" })
            .click();
        await expect(roleCard(page, "Judges")).toBeVisible();

        await page.getByRole("button", { name: "Next group" }).click();
        await expect(page).toHaveURL(/\/attendance\/333-r1-g2$/);
    });

    test("marks a judge present and undoes it", async ({ page, api }) => {
        const judge = (await groupAttendance(api, "333-r1-g1")).find(
            (a) => a.role === "JUDGE"
        )!;
        await page.goto("/attendance/333-r1-g1");
        await personRow(page, "Judges", judge.person.name)
            .getByRole("button", { name: "Mark present" })
            .click();
        const notification = await undoToast(
            page,
            `${judge.person.name} marked present`
        );
        await expect(
            roleCard(page, "Judges").getByText("Present", { exact: true })
        ).toBeVisible();

        await notification.getByRole("button", { name: "Undo" }).click();
        await expect
            .poll(
                async () =>
                    (await groupAttendance(api, "333-r1-g1")).find(
                        (a) => a.id === judge.id
                    )?.status
            )
            .toBe("ABSENT");
    });

    test("marks all judges present, then one late, replaced and absent", async ({
        page,
        api,
    }) => {
        const judges = (await groupAttendance(api, "333-r1-g3")).filter(
            (a) => a.role === "JUDGE"
        );
        await page.goto("/attendance/333-r1-g3");
        await roleCard(page, "Judges")
            .getByRole("button", { name: "Mark all present" })
            .click();
        await undoToast(page, `${judges.length} marked present`);
        await expect(roleCard(page, "Judges")).toContainText(
            `${judges.length}/${judges.length}`
        );

        const [first] = judges;
        await personRow(page, "Judges", first.person.name)
            .getByRole("button", {
                name: `More actions for ${first.person.name}`,
            })
            .click();
        await page.getByRole("menuitem", { name: "Mark absent" }).click();
        await undoToast(page, `${first.person.name} marked absent`);

        await personRow(page, "Judges", first.person.name)
            .getByRole("button", {
                name: `More actions for ${first.person.name}`,
            })
            .click();
        await page.getByRole("menuitem", { name: "Mark late" }).click();
        await expect(
            personRow(page, "Judges", first.person.name).getByText("Late")
        ).toBeVisible();

        const second = judges[1];
        await personRow(page, "Judges", second.person.name)
            .getByRole("button", {
                name: `More actions for ${second.person.name}`,
            })
            .click();
        await page.getByRole("menuitem", { name: "Mark absent" }).click();
        // The row moves to the absent section when the update lands, which
        // closes a menu opened before that
        await undoToast(page, `${second.person.name} marked absent`);
        await personRow(page, "Judges", second.person.name)
            .getByRole("button", {
                name: `More actions for ${second.person.name}`,
            })
            .click();
        await page
            .getByRole("menuitem", { name: "Present but replaced" })
            .click();
        await expect(
            personRow(page, "Judges", second.person.name).getByText("Replaced")
        ).toBeVisible();

        const statuses = Object.fromEntries(
            (await groupAttendance(api, "333-r1-g3")).map((a) => [
                a.id,
                a.status,
            ])
        );
        expect(statuses[first.id]).toBe("LATE");
        expect(statuses[second.id]).toBe("REPLACED");
    });

    test("adds an unassigned scrambler and removes them again", async ({
        page,
        api,
    }) => {
        const helper = await addPerson(api, { name: "Sasha Spare" });
        await page.goto("/attendance/222-r1-g1");
        await roleCard(page, "Scramblers")
            .getByRole("button", {
                name: "Add a scrambler who is not assigned",
            })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Add unassigned person",
        });
        await dialog.getByRole("combobox").click();
        await page.getByPlaceholder("Search for a person...").fill(helper.name);
        await page.getByRole("option", { name: helper.name }).click();
        await dialog
            .getByRole("button", { name: "Add and mark as present" })
            .click();
        await expect(dialog).toBeHidden();
        const row = personRow(page, "Scramblers", helper.name);
        await expect(row.getByText("Unassigned")).toBeVisible();

        await row
            .getByRole("button", { name: `More actions for ${helper.name}` })
            .click();
        await page.getByRole("menuitem", { name: "Mark absent" }).click();
        await confirm(page, "Mark absent");
        await expect(row).toHaveCount(0);
    });

    test("saves a comment on an assignment", async ({ page, api }) => {
        const runner = (await groupAttendance(api, "222-r1-g3")).find(
            (a) => a.role === "RUNNER"
        )!;
        await page.goto("/attendance/222-r1-g3");
        await roleCard(page, "Runners")
            .getByRole("button", {
                name: `More actions for ${runner.person.name}`,
            })
            .click();
        await page.getByRole("menuitem", { name: "Comment" }).click();
        const dialog = page.getByRole("dialog", { name: runner.person.name });
        await dialog.getByPlaceholder("Comment").fill("Swapped with a friend");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(toast(page, "Comment saved")).toBeVisible();
        expect(
            (await groupAttendance(api, "222-r1-g3")).find(
                (a) => a.id === runner.id
            )?.comment
        ).toBe("Swapped with a friend");
    });

    /** A scrambler of minx-r1-g1 scanned on an attendance device */
    const scanScrambler = async (api: APIRequestContext, espId: number) => {
        const room = await getRoom(api);
        await setCurrentGroups(api, { [room.name]: ["minx-r1-g1"] });
        await createDevice(api, {
            name: `Scrambler desk ${espId}`,
            espId,
            roomId: room.id,
            type: "ATTENDANCE_SCRAMBLER",
        });
        const scramblers = (await groupAttendance(api, "minx-r1-g1")).filter(
            (a) => a.role === "SCRAMBLER" && a.status === "ABSENT"
        );
        const scrambler = scramblers[0];
        const cardId = String(espId);
        await api.put(`person/${scrambler.personId}`, { data: { cardId } });
        return {
            scrambler,
            scan: async () => {
                const station = await Station.connect();
                try {
                    await station.createAttendance(espId, cardId);
                } finally {
                    station.close();
                }
            },
        };
    };

    test("records people scanned on an attendance device", async ({
        page,
        api,
    }) => {
        const { scrambler, scan } = await scanScrambler(api, 0xa101);
        await scan();
        await expect
            .poll(
                async () =>
                    (await groupAttendance(api, "minx-r1-g1")).find(
                        (a) => a.id === scrambler.id
                    )?.status
            )
            .toBe("PRESENT");

        await page.goto("/attendance/minx-r1-g1");
        const row = personRow(page, "Scramblers", scrambler.person.name);
        await expect(
            row.getByRole("button", { name: "Mark present" })
        ).toHaveCount(0);
    });

    test("shows a scan on an attendance device without reloading", async ({
        page,
        api,
    }) => {
        const { scrambler, scan } = await scanScrambler(api, 0xa102);
        const joined = socketEventSent(page, "joinAttendance");
        await page.goto("/attendance/minx-r1-g1");
        await joined;
        const markPresent = personRow(
            page,
            "Scramblers",
            scrambler.person.name
        ).getByRole("button", { name: "Mark present" });
        await expect(markPresent).toBeVisible();
        await scan();
        await expect(markPresent).toHaveCount(0);
    });

    test("moving a competitor to another group needs a WCA account", async ({
        page,
        api,
    }) => {
        const competitor = (await groupAttendance(api, "clock-r1-g1")).find(
            (a) => a.role === "COMPETITOR"
        )!;
        await page.goto("/attendance/clock-r1-g1");
        await personRow(page, "Competitors", competitor.person.name)
            .getByRole("button", { name: "Change group" })
            .click();
        const dialog = page.getByRole("dialog", {
            name: "Move the competitor to another group",
        });
        await dialog.getByRole("combobox").click();
        await page.getByRole("option").first().click();
        await dialog.getByRole("button", { name: "Submit" }).click();
        await confirm(page);
        await expect(
            dialog.getByText(/The WCIF update failed\. You are not allowed/)
        ).toBeVisible();
    });
});

test.describe("attendance overviews", () => {
    test("lists the most missed assignments and statistics", async ({
        page,
        api,
    }) => {
        const judge = (await groupAttendance(api, "666-r1-g1")).find(
            (a) => a.role === "JUDGE"
        )!;
        // A late judge counts as a missed assignment
        await api.post(`attendance/late/${judge.id}`);

        await page.goto("/attendance");
        await page.getByRole("tab", { name: /Most missed/ }).click();
        await expect(page).toHaveURL(/\/attendance\/missed$/);
        await expect(page.getByRole("main")).toContainText(judge.person.name);

        await page.getByRole("tab", { name: "Statistics" }).click();
        await expect(page).toHaveURL(/\/attendance\/statistics$/);
        await expect(
            page.getByRole("columnheader", { name: /Attendance/ })
        ).toBeVisible();
        await page
            .getByRole("searchbox", { name: "Search staff" })
            .fill(judge.person.name);
        await expect(
            page.getByRole("main").getByRole("row").filter({
                hasText: judge.person.name,
            })
        ).toBeVisible();
    });
});
