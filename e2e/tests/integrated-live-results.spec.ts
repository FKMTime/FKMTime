import { APIRequestContext, Page, request } from "@playwright/test";

import { WCA_ORIGIN } from "../env";
import { apiAs, expect, signedInAs, test } from "../fixtures";
import {
    createAttempts,
    getAllPersons,
    setCurrentGroups,
} from "../helpers/api";
import { resetDatabase, withDb } from "../helpers/db";
import { confirm, expectToast } from "../helpers/ui";
import { getWcaCompetition } from "../helpers/wca";

/**
 * A competition day with results going to WCA Integrated Live Results
 * (SPEC-006), run from FKMTime against the dummy WCA without its live admin
 * pages: rounds open, results arrive, no-shows are removed, a withdrawal
 * brings in the next in line, and the Results page shows the WCA's copy.
 *
 * The suite's generated competition follows WCA Live, so this file makes its
 * own on the dummy WCA, set to the WCA's integrated live results, and imports
 * it. Importing keeps only the importing account, so it runs as the admin.
 */

const NAME = "Live Results Test Open";
const MAIN_HALL = "Main Hall";
const FIRST_ROUND_GROUPS = ["333-r1-g1", "333-r1-g2", "333-r1-g3", "333-r1-g4"];

let competitionId: string;
let delegateWcaId: string;

// Results arrive asynchronously: sent within seconds, read back about 10 s later
test.describe.configure({ mode: "serial", timeout: 180_000 });
signedInAs("admin");

const today = () => new Date().toISOString().slice(0, 10);

const dummyWca = async <T>(
    fn: (wca: APIRequestContext) => Promise<T>
): Promise<T> => {
    const wca = await request.newContext();
    try {
        return await fn(wca);
    } finally {
        await wca.dispose();
    }
};

const removeDummyCompetition = (id: string) =>
    dummyWca((wca) =>
        wca.post(`${WCA_ORIGIN}/dummy/competitions/${id}/delete`, {
            maxRedirects: 0,
        })
    );

/** Writes a result straight into the WCA, as someone on the WCA website would */
const typeIntoWca = (registrationId: number, values: number[]) =>
    dummyWca(async (wca) => {
        const response = await wca.post(
            `${WCA_ORIGIN}/api/v1/competitions/${competitionId}/live/rounds/333-r2`,
            {
                headers: { Authorization: `Bearer token-${delegateWcaId}` },
                data: {
                    registration_id: registrationId,
                    attempts: values.map((value, i) => ({
                        value,
                        attempt_number: i + 1,
                    })),
                },
            }
        );
        expect(response.status()).toBeLessThan(300);
    });

interface LiveRound {
    roundId: string;
    state: string;
}

const roundState = async (api: APIRequestContext, roundId: string) => {
    const response = await api.get("competition/integrated-live/rounds");
    const rounds = (await response.json()) as LiveRound[];
    return rounds.find((r) => r.roundId === roundId)?.state;
};

interface Details {
    onTheWay: number;
    results: { registrationId: number; status: string; differs: boolean }[];
}

const details = async (api: APIRequestContext, roundId: string) =>
    (await (
        await api.get(`competition/integrated-live/rounds/${roundId}/details`)
    ).json()) as Details;

/**
 * Every FKMTime result of the round is confirmed by the WCA's read-back.
 * Read from the database: the dummy WCA allows 60 requests a minute, and
 * the backend needs them to send and read back.
 */
const allConfirmed = (roundId: string) =>
    expect
        .poll(
            () =>
                withDb(async (db) => {
                    const { rows } = await db.query<{
                        total: string;
                        confirmed: string;
                    }>(
                        `SELECT count(*) AS total,
                                count(*) FILTER (WHERE s.status = 'CONFIRMED') AS confirmed
                         FROM result r LEFT JOIN live_sync s ON s.result_id = r.id
                         WHERE r.round_id = $1`,
                        [roundId]
                    );
                    const { total, confirmed } = rows[0];
                    return Number(total) > 0 && total === confirmed;
                }),
            { timeout: 90_000, intervals: [3_000] }
        )
        .toBe(true);

/** A round's state in the WCA, polled gently for the same reason */
const expectRoundState = (
    api: APIRequestContext,
    roundId: string,
    state: string
) =>
    expect
        .poll(() => roundState(api, roundId), {
            timeout: 90_000,
            intervals: [5_000],
        })
        .toBe(state);

const resultRow = (page: Page, name: string) =>
    page.getByRole("row").filter({ hasText: name });

test.beforeAll(async () => {
    const generated = await dummyWca(async (wca) => {
        const year = today().slice(0, 4);
        const id = `${NAME.replace(/ /g, "")}${year}`;
        await removeDummyCompetition(id);
        const response = await wca.post(`${WCA_ORIGIN}/dummy/competitions`, {
            form: {
                name: NAME,
                start_date: today(),
                competitors: "24",
                rooms: "1",
                days: "1",
                scoretaking_software: "internal",
                event_333: "2",
            },
            maxRedirects: 0,
        });
        expect(response.status()).toBeLessThan(400);
        return id;
    });
    competitionId = generated;
    const competition = await getWcaCompetition(competitionId);
    delegateWcaId = competition.delegates.find((d) => d.wca_id)!.wca_id!;

    // A fresh install that imports this competition
    await resetDatabase();
    await withDb((db) =>
        db.query("TRUNCATE competition, room, person CASCADE")
    );
    const api = await apiAs("admin");
    try {
        const imported = await api.get(`competition/import/${competitionId}`);
        expect(imported.ok(), await imported.text()).toBeTruthy();
        // Connect as the competition's Delegate (the dummy WCA's code for them)
        const connected = await api.post(
            "competition/integrated-live/connection",
            {
                data: {
                    code: `code-${delegateWcaId}`,
                    redirectUri:
                        "http://localhost/competition/wca-live-connect",
                },
            }
        );
        expect(connected.ok(), await connected.text()).toBeTruthy();
    } finally {
        await api.dispose();
    }
});

test.afterAll(async () => {
    await resetDatabase();
    if (competitionId) await removeDummyCompetition(competitionId);
});

test("opens round 1 when its first group starts and confirms its results", async ({
    page,
    api,
}) => {
    await setCurrentGroups(api, { [MAIN_HALL]: [FIRST_ROUND_GROUPS[0]] });
    await expectRoundState(api, "333-r1", "open");

    // Everyone competes but two, who never come
    const persons = (await getAllPersons(api))
        .filter((p) => p.registrantId)
        .sort((a, b) => a.registrantId! - b.registrantId!);
    for (const [index, person] of persons.slice(2).entries()) {
        const base = 800 + index * 37;
        await createAttempts(api, "333-r1", person.id, [
            base,
            base + 11,
            base + 22,
            base + 33,
            base + 44,
        ]);
    }
    await allConfirmed("333-r1");

    await page.goto("/results/round/333-r1");
    await expect(
        page.getByText(
            `WCA live results: open, ${persons.length - 2} of ${persons.length} done, all sent`
        )
    ).toBeVisible({ timeout: 30_000 });
    // The fastest are sure to advance once everyone is in
    await expect(resultRow(page, persons[2].name)).toContainText(
        /Advances|May advance/
    );
});

test("removes the no-shows from Home once every group has run", async ({
    page,
    api,
}) => {
    for (const groupId of FIRST_ROUND_GROUPS) {
        await setCurrentGroups(api, { [MAIN_HALL]: [groupId] });
    }
    await setCurrentGroups(api, {});

    await page.goto("/");
    const card = page
        .getByRole("alert")
        .filter({ hasText: "didn't come to 3x3x3 Cube, Round 1" });
    await expect(card).toContainText(
        "2 competitors didn't come to 3x3x3 Cube, Round 1"
    );
    await card
        .getByRole("button", {
            name: "Remove from 3x3x3 Cube, Round 1 in WCA Integrated Live Results",
        })
        .click();
    await expectToast(page, /2 removed from 333-r1/);
    await expectRoundState(api, "333-r2", "ready");
});

test("opens round 2 from Home when its first group starts", async ({
    page,
    api,
}) => {
    await setCurrentGroups(api, { [MAIN_HALL]: ["333-r2-g1"] });
    await page.goto("/");
    const card = page
        .getByRole("alert")
        .filter({ hasText: "isn't open in WCA Integrated Live Results" });
    await card.getByRole("button", { name: /^Open/ }).click();
    await expectToast(page, "3x3x3 Cube, Round 2 opened");
    await expectRoundState(api, "333-r2", "open");
});

test("withdraws a competitor from round 2 and lets the next in line advance", async ({
    page,
    api,
}) => {
    // The fastest competitor of round 1, put in a round 2 group, didn't come
    const persons = (await getAllPersons(api))
        .filter((p) => p.registrantId)
        .sort((a, b) => a.registrantId! - b.registrantId!);
    const withdrawing = persons[2];
    await withDb((db) =>
        db.query(
            `INSERT INTO staff_activity (id, person_id, group_id, role, status, is_assigned, updated_at)
             VALUES (gen_random_uuid(), $1, '333-r2-g1', 'COMPETITOR', 'ABSENT', true, now())`,
            [withdrawing.id]
        )
    );

    await page.goto("/attendance/333-r2-g1");
    const row = page
        .getByRole("region", { name: "Competitors", exact: true })
        .getByRole("listitem")
        .filter({ hasText: withdrawing.name });
    await row
        .getByRole("button", { name: `More actions for ${withdrawing.name}` })
        .click();
    await page.getByRole("menuitem", { name: "Remove from round" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${withdrawing.name} withdraws`);
    await expect(dialog).toContainText("Next in line:");
    await dialog
        .getByRole("button", { name: /^Withdraw, (?!nobody).* advances?$/ })
        .click();
    await expect(dialog).toContainText(
        `${withdrawing.name} withdrew from 333-r2`
    );
});

test("shows the WCA's copy on the Results page and clears what doesn't match", async ({
    page,
    api,
}) => {
    const persons = (await getAllPersons(api))
        .filter((p) => p.registrantId)
        .sort((a, b) => a.registrantId! - b.registrantId!);
    // Two round 2 results in FKMTime, confirmed by the WCA
    const [first, second] = [persons[3], persons[4]];
    await createAttempts(api, "333-r2", first.id, [700, 710, 720, 730, 740]);
    await createAttempts(api, "333-r2", second.id, [750, 760, 770, 780, 790]);
    await allConfirmed("333-r2");
    const registrationIds = await withDb(async (db) => {
        const { rows } = await db.query<{
            id: string;
            wca_registration_id: number;
        }>("SELECT id, wca_registration_id FROM person WHERE id = ANY($1)", [
            [first.id, second.id, persons[5].id],
        ]);
        return Object.fromEntries(
            rows.map((r) => [r.id, r.wca_registration_id])
        );
    });

    // Someone types other times into the WCA website, and a result for a
    // competitor FKMTime has none for
    await typeIntoWca(registrationIds[first.id], [999, -1]);
    await typeIntoWca(registrationIds[persons[5].id], [1500, 1600]);

    await page.goto("/results/round/333-r2");
    const differing = resultRow(page, first.name);
    await expect(differing).toContainText("Differs", { timeout: 30_000 });
    const onlyInWca = resultRow(page, "Only in WCA live results");
    await expect(onlyInWca).toContainText(persons[5].name);

    // Clearing the differing one sends FKMTime's result again
    await differing
        .getByRole("button", { name: `More actions for ${first.name}` })
        .click();
    await page
        .getByRole("menuitem", { name: "Clear in WCA live results" })
        .click();
    await confirm(page, "Clear");
    await expectToast(page, "Cleared, and sending it again");
    await expect(differing).not.toContainText("Differs", { timeout: 60_000 });

    // A result only the WCA had is emptied, and its row goes
    await onlyInWca
        .getByRole("button", { name: `More actions for ${persons[5].name}` })
        .click();
    await page
        .getByRole("menuitem", { name: "Clear in WCA live results" })
        .click();
    await confirm(page, "Clear");
    await expectToast(page, "Cleared");
    await expect(onlyInWca).toHaveCount(0, { timeout: 30_000 });
});

test("clears the whole round and sends it again", async ({ page, api }) => {
    await page.goto("/results/round/333-r2");
    await page
        .getByRole("button", { name: "More actions for 3x3x3 Cube, Round 2" })
        .click();
    await page
        .getByRole("menuitem", {
            name: "Clear in WCA Integrated Live Results",
        })
        .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("333-r2");
    await dialog.getByRole("button", { name: "Clear round" }).click();
    await expectToast(
        page,
        "3x3x3 Cube, Round 2 cleared; FKMTime is sending its results again"
    );

    // FKMTime sends the round again, so the WCA ends up matching it
    await allConfirmed("333-r2");
    const { results } = await details(api, "333-r2");
    expect(results.every((r) => !r.differs)).toBe(true);
    await expect(
        page.getByText(/WCA live results: open, .*all sent/)
    ).toBeVisible({ timeout: 30_000 });
});
