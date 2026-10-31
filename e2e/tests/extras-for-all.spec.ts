import { APIRequestContext, Page } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    ApiAttempt,
    assignCard,
    createAttempt,
    createAttempts,
    createDevice,
    getPersonByRegistrantId,
    getResult,
    getRoom,
    setCurrentGroups,
} from "../helpers/api";
import {
    importScrambleSets,
    SCRAMBLES_PASSWORD,
    signInTablet,
} from "../helpers/scrambles";
import { Station } from "../helpers/station";
import { confirm, expectToast } from "../helpers/ui";

freshDatabase();
signedInAs("delegate");

const ROUND = "333-r1";
const GIVE_EXTRAS = "Give extras for several attempts";

const openResult = async (
    page: Page,
    api: APIRequestContext,
    registrantId: number,
    values: number[],
    roundId = ROUND
) => {
    const person = await getPersonByRegistrantId(api, registrantId);
    const result = await createAttempts(api, roundId, person.id, values);
    await page.goto(`/results/${result.id}`);
    await expect(
        page.getByRole("main").getByRole("heading", { name: person.name })
    ).toBeVisible();
    return { person, result };
};

const extrasDialog = (page: Page) =>
    page.getByRole("dialog", { name: GIVE_EXTRAS });

const openExtrasDialog = async (page: Page) => {
    await page
        .getByRole("main")
        .getByRole("button", { name: GIVE_EXTRAS })
        .click();
    await expect(extrasDialog(page)).toBeVisible();
    return extrasDialog(page);
};

const submitExtras = async (page: Page) => {
    await extrasDialog(page)
        .getByRole("button", { name: "Give extras", exact: true })
        .click();
    await expectToast(page, "Extras granted");
    await expect(extrasDialog(page)).toBeHidden();
};

const submittedTab = (page: Page) =>
    page.getByRole("tab", { name: /Submitted/ });

const useOriginals = async (page: Page) => {
    await page
        .getByRole("main")
        .getByRole("button", { name: "Use original attempts" })
        .click();
    await confirm(page, "Use original attempts");
    await expectToast(page, "Original attempts restored");
};

/** A station in the room, and competitor and judge cards to use it with */
const setUpStation = async (
    api: APIRequestContext,
    espId: number,
    competitorId: string,
    judgeRegistrantId: number,
    roundId = ROUND
) => {
    const room = await getRoom(api);
    await setCurrentGroups(api, { [room.name]: [`${roundId}-g1`] });
    await createDevice(api, {
        name: `Station ${espId}`,
        espId,
        roomId: room.id,
    });
    const competitorCardId = String(espId);
    const judgeCardId = String(espId + 1);
    const judge = await getPersonByRegistrantId(api, judgeRegistrantId);
    await assignCard(api, competitorId, competitorCardId);
    await assignCard(api, judge.id, judgeCardId);
    return { espId, competitorCardId, judgeCardId };
};

const solveAtStation = async (
    card: { espId: number; competitorCardId: string; judgeCardId: string },
    times: number[]
) => {
    const station = await Station.connect();
    try {
        for (const valueCs of times) {
            const response = await station.enterAttempt({ ...card, valueCs });
            expect(response.data.error, response.data.message).toBeFalsy();
        }
    } finally {
        station.close();
    }
};

const byType = (attempts: ApiAttempt[], type: ApiAttempt["type"]) =>
    attempts
        .filter((attempt) => attempt.type === type)
        .sort((a, b) => a.attemptNumber - b.attemptNumber);

test.describe("extras for several attempts", () => {
    test("replaces the attempts, then goes back to the originals", async ({
        page,
        api,
    }) => {
        const { person } = await openResult(page, api, 30, [1000, 1100, 1200]);
        const dialog = await openExtrasDialog(page);

        await expect(dialog).toContainText(
            `Attempts 1, 2 and 3 will no longer count. ${person.name} redoes them, then continues from attempt 4.`
        );
        await dialog.getByRole("textbox", { name: "Comment" }).fill("Illegal");
        await submitExtras(page);

        await expect(submittedTab(page)).toContainText("0");
        const replaced = await getResult(api, ROUND, person.id);
        expect(replaced.attempts.map((a) => a.status)).toEqual([
            "EXTRA_GIVEN",
            "EXTRA_GIVEN",
            "EXTRA_GIVEN",
        ]);
        expect(replaced.attempts[0].comment).toBe("Illegal");

        await useOriginals(page);

        await expect(submittedTab(page)).toContainText("3");
        const restored = await getResult(api, ROUND, person.id);
        expect(restored.attempts.map((a) => a.status)).toEqual([
            "STANDARD",
            "STANDARD",
            "STANDARD",
        ]);
    });

    test("keeps attempts the delegate unticks", async ({ page, api }) => {
        const { person } = await openResult(page, api, 31, [1000, 1100, 1200]);
        const dialog = await openExtrasDialog(page);

        await dialog.getByRole("checkbox", { name: /Attempt 1/ }).click();
        await expect(dialog).toContainText(
            "Attempts 2 and 3 will no longer count."
        );
        await expect(dialog).toContainText("This needs 2 extra scrambles.");
        await submitExtras(page);

        await expect(submittedTab(page)).toContainText("1");
        const result = await getResult(api, ROUND, person.id);
        const statusOf = (number: number) =>
            result.attempts.find((a) => a.attemptNumber === number)?.status;
        expect(statusOf(1)).toBe("STANDARD");
        expect(statusOf(2)).toBe("EXTRA_GIVEN");
    });

    test("a redo at a station replaces each attempt in order", async ({
        page,
        api,
    }) => {
        const { person } = await openResult(page, api, 32, [1000, 1100, 1200]);
        const card = await setUpStation(api, 40032, person.id, 33);

        await openExtrasDialog(page);
        await submitExtras(page);
        await solveAtStation(card, [2000, 2100, 2200, 2300]);

        const { attempts } = await getResult(api, ROUND, person.id);
        const standard = byType(attempts, "STANDARD_ATTEMPT");
        expect(standard.map((a) => [a.attemptNumber, a.replacedBy])).toEqual([
            [1, 1],
            [2, 2],
            [3, 3],
            [4, null],
        ]);
        expect(standard[3].value).toBe(2300);
        expect(
            byType(attempts, "EXTRA_ATTEMPT").map((a) => [
                a.attemptNumber,
                a.value,
            ])
        ).toEqual([
            [1, 2000],
            [2, 2100],
            [3, 2200],
        ]);

        await page.reload();
        await expect(submittedTab(page)).toContainText("4");
        const summary = page.getByRole("region", { name: "Summary" });
        await expect(summary).toContainText("20.00");

        await useOriginals(page);
        await expect(summary).toContainText("10.00");
    });

    test("gives extras from an open incident", async ({ page, api }) => {
        const person = await getPersonByRegistrantId(api, 34);
        await createAttempts(api, ROUND, person.id, [1000, 1100]);
        const card = await setUpStation(api, 40034, person.id, 35);
        const station = await Station.connect();
        try {
            const response = await station.enterAttempt({
                ...card,
                valueCs: 1200,
                isDelegate: true,
            });
            expect(response.data.error, response.data.message).toBeFalsy();
        } finally {
            station.close();
        }
        const incident = (await getResult(api, ROUND, person.id)).attempts.find(
            (a) => a.status === "UNRESOLVED"
        );

        await page.goto(`/incidents/${incident?.id}`);
        const panel = page.getByRole("region", {
            name: `Incident: ${person.name}`,
        });
        const giveExtras = panel.getByRole("button", { name: GIVE_EXTRAS });
        await expect(giveExtras).toBeVisible();
        // The buttons all stay inside the panel
        const overflow = await panel.evaluate(
            (element) => element.scrollWidth - element.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await giveExtras.click();
        const dialog = extrasDialog(page);
        await expect(dialog).toContainText(
            "Attempts 1, 2 and 3 will no longer count."
        );
        await expect(
            dialog.getByRole("checkbox", { name: /this incident/ })
        ).toBeDisabled();
        await submitExtras(page);

        const { attempts } = await getResult(api, ROUND, person.id);
        expect(attempts.map((a) => a.status)).toEqual([
            "EXTRA_GIVEN",
            "EXTRA_GIVEN",
            "EXTRA_GIVEN",
        ]);
    });

    test("a missed cutoff closes attempts that no longer need a redo", async ({
        page,
        api,
    }) => {
        // clock-r1: 60 s limit, cutoff of 20 s in 2 attempts
        const roundId = "clock-r1";
        const assignments = await (
            await api.get("attendance/group/clock-r1-g1")
        ).json();
        const { personId } = assignments.find(
            (a: { role: string; person: { cardId: string | null } }) =>
                a.role === "COMPETITOR" && !a.person.cardId
        );
        const result = await createAttempts(
            api,
            roundId,
            personId,
            [1000, 1100, 1200]
        );
        const card = await setUpStation(api, 40039, personId, 39, roundId);
        await page.goto(`/results/${result.id}`);

        await openExtrasDialog(page);
        await submitExtras(page);
        await solveAtStation(card, [2500, 2600]);

        const { attempts } = await getResult(api, roundId, personId);
        const standard = byType(attempts, "STANDARD_ATTEMPT");
        expect(standard.map((a) => [a.attemptNumber, a.status])).toEqual([
            [1, "EXTRA_GIVEN"],
            [2, "EXTRA_GIVEN"],
            [3, "VOIDED"],
        ]);

        await page.reload();
        await expect(submittedTab(page)).toContainText("2");
        await page.getByRole("tab", { name: /Standard/ }).click();
        await expect(page.getByRole("main").getByRole("table")).toBeVisible();

        const station = await Station.connect();
        try {
            const response = await station.enterAttempt({
                ...card,
                valueCs: 2700,
            });
            expect(response.data.error).toBeTruthy();
        } finally {
            station.close();
        }

        await useOriginals(page);
        await expect(submittedTab(page)).toContainText("3");
    });

    test("a redo on a fresh set shows that set's normal scrambles", async ({
        page,
        browser,
        api,
    }) => {
        const room = await getRoom(api);
        await importScrambleSets(api, ROUND, 1);
        const { person } = await openResult(page, api, 40, [1000, 1100, 1100]);
        const card = await setUpStation(api, 40050, person.id, 41);
        const scrambler = await getPersonByRegistrantId(api, 42);
        await assignCard(api, scrambler.id, "40052");

        await openExtrasDialog(page);
        await expect(
            extrasDialog(page).getByText("This needs", { exact: false })
        ).toHaveCount(0);
        await submitExtras(page);

        const { device, tablet } = await signInTablet(page, browser, room.name);
        await tablet.getByRole("button", { name: "Scramble" }).first().click();
        await tablet.getByLabel("Password").fill(SCRAMBLES_PASSWORD);
        await tablet.getByLabel("Password").press("Enter");
        const scramblerScan = tablet.getByLabel("Scan the scrambler's card");
        await scramblerScan.fill("40052");
        await scramblerScan.press("Enter");

        const scan = async () => {
            const competitorScan = tablet.getByLabel(
                "Scan the competitor's card"
            );
            await competitorScan.fill(card.competitorCardId);
            await competitorScan.press("Enter");
            await tablet.getByRole("button", { name: "Sign" }).click();
        };

        await scan();
        await expect(tablet.getByRole("status")).toContainText(
            `Last signed: ${person.name} · Scramble 1`
        );
        await solveAtStation(card, [2000]);

        await scan();
        await expect(tablet.getByRole("status")).toContainText(
            `Last signed: ${person.name} · Scramble 2`
        );
        await solveAtStation(card, [2100]);

        const { attempts } = await getResult(api, ROUND, person.id);
        expect(
            byType(attempts, "EXTRA_ATTEMPT").map((a) => [
                a.attemptNumber,
                a.status,
                a.value,
            ])
        ).toEqual([
            [1, "STANDARD", 2000],
            [2, "STANDARD", 2100],
        ]);
        await device.close();
    });

    test("the modal fits on a phone", async ({ page, api }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openResult(page, api, 43, [1000, 1100, 1200]);

        const dialog = await openExtrasDialog(page);

        const overflow = await dialog.evaluate(
            (element) => element.scrollWidth - element.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test("a redo can be entered by hand", async ({ page, api }) => {
        const { person } = await openResult(
            page,
            api,
            44,
            [1000, 1100, 1200, 1300, 1400]
        );
        await openExtrasDialog(page);
        await submitExtras(page);

        const enterByHand = async (attempt: string, time: string) => {
            await page.reload();
            await page
                .getByRole("main")
                .getByRole("button", { name: "Enter attempt" })
                .click();
            const dialog = page.getByRole("dialog", { name: "Enter attempt" });
            await expect(
                dialog.getByRole("radio", { name: `Extra attempt ${attempt}` })
            ).toBeChecked();
            await dialog.getByLabel("Time").fill(time);
            await dialog.getByRole("button", { name: "Save attempt" }).click();
            await expect(dialog).toBeHidden();
        };
        for (const [attempt, time] of [
            ["1", "2000"],
            ["2", "2100"],
            ["3", "2200"],
            ["4", "2300"],
            ["5", "2400"],
        ]) {
            await enterByHand(attempt, time);
        }

        await page.reload();
        await expect(submittedTab(page)).toContainText("5");
        const { attempts } = await getResult(api, ROUND, person.id);
        expect(
            byType(attempts, "STANDARD_ATTEMPT").map((a) => a.replacedBy)
        ).toEqual([1, 2, 3, 4, 5]);
    });

    test("editing a later extra keeps it that extra", async ({ page, api }) => {
        const { person } = await openResult(page, api, 45, [1000, 1100, 1200]);
        const card = await setUpStation(api, 40060, person.id, 46);
        await openExtrasDialog(page);
        await submitExtras(page);
        await solveAtStation(card, [2000, 2100, 2200]);

        await page.reload();
        await page.getByRole("tab", { name: /Extra attempts/ }).click();
        const row = page
            .getByRole("main")
            .getByRole("table")
            .getByRole("row")
            .filter({ hasText: "Extra 3" });
        await row.getByRole("button", { name: "Edit attempt" }).click();
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("radio", { name: "Extra attempt 3" })
        ).toBeChecked();
    });

    test("warns once the next round has started", async ({ page, api }) => {
        const other = await getPersonByRegistrantId(api, 36);
        await createAttempt(api, {
            roundId: "333-r2",
            competitorId: other.id,
            attemptNumber: 1,
            value: 1000,
        });
        await openResult(page, api, 37, [1000]);

        const dialog = await openExtrasDialog(page);

        await expect(dialog).toContainText("The next round has started.");
    });

    test("takes an open incident along from the result page", async ({
        page,
        api,
    }) => {
        const person = await getPersonByRegistrantId(api, 38);
        await createAttempt(api, {
            roundId: ROUND,
            competitorId: person.id,
            attemptNumber: 1,
            value: 1000,
        });
        await createAttempt(api, {
            roundId: ROUND,
            competitorId: person.id,
            attemptNumber: 2,
            value: 1100,
            status: "UNRESOLVED",
        });
        const result = await getResult(api, ROUND, person.id);
        await page.goto(`/results/${result.id}`);

        const dialog = await openExtrasDialog(page);

        await expect(dialog).toContainText(
            "Attempts 1 and 2 will no longer count."
        );
        await expect(
            dialog.getByRole("checkbox", { name: /this incident/ })
        ).toBeDisabled();
        await submitExtras(page);

        const { attempts } = await getResult(api, ROUND, person.id);
        expect(attempts.map((a) => a.status)).toEqual([
            "EXTRA_GIVEN",
            "EXTRA_GIVEN",
        ]);
    });
});
