import { APIRequestContext } from "@playwright/test";

import { expect, freshDatabase, test } from "../fixtures";
import { createAttempt } from "../helpers/api";
import { importScrambleSets } from "../helpers/scrambles";
import { socketEventSent } from "../helpers/ui";

freshDatabase();

interface StaffSide {
    entrantId: string | null;
}

interface StaffView {
    bracket: {
        entrants: {
            id: string;
            seed: number;
            person: { id: string; name: string };
        }[];
        matches: {
            id: string;
            matchNumber: number;
            label: string;
            sideA: StaffSide;
            sideB: StaffSide;
        }[];
    };
}

/** The head-to-head round of the seeded competition, from its WCIF */
const h2hRoundId = async (api: APIRequestContext) => {
    const response = await api.get("competition");
    expect(response.ok()).toBeTruthy();
    const { wcif } = (await response.json()) as {
        wcif: { events: { rounds: { id: string; format: string }[] }[] };
    };
    const round = wcif.events
        .flatMap((event) => event.rounds)
        .find((r) => r.format === "h");
    expect(round, "a head-to-head round in the seed").toBeTruthy();
    return round!.id;
};

/** Match 1 of the seeded bracket, with the people on each side */
const firstMatch = async (api: APIRequestContext, roundId: string) => {
    const response = await api.get(`h2h/${roundId}`);
    expect(response.ok()).toBeTruthy();
    const { bracket } = (await response.json()) as StaffView;
    const match = bracket.matches.find((m) => m.matchNumber === 1)!;
    const person = (side: StaffSide) =>
        bracket.entrants.find((e) => e.id === side.entrantId)!.person;
    return { match, a: person(match.sideA), b: person(match.sideB) };
};

test.describe("head-to-head for spectators (signed out)", () => {
    test("the bracket and the match scoreboard follow the match live", async ({
        page,
        context,
        api,
    }) => {
        const roundId = await h2hRoundId(api);
        await importScrambleSets(api, roundId, 2);
        const { match, a, b } = await firstMatch(api, roundId);

        const bracketJoined = socketEventSent(page, "joinH2h");
        await page.goto(`/public/h2h/${roundId}`);
        await bracketJoined;
        const card = page.getByRole("article", { name: match.label });
        await expect(card).toContainText(a.name);
        await expect(card).toContainText(b.name);
        await expect(card).not.toContainText("Playing");
        // The quarterfinal waits for this match's winner; the phone layout
        // is on the page too, hidden
        const waitingSlot = page
            .getByText(`Winner of ${match.label}`, { exact: true })
            .filter({ visible: true });
        await expect(waitingSlot).toHaveCount(1);

        const scoreboard = await context.newPage();
        const scoreboardJoined = socketEventSent(scoreboard, "joinH2h");
        await scoreboard.goto(`/public/h2h/${roundId}/match/1`);
        await scoreboardJoined;
        await expect(scoreboard.getByText("Starts soon")).toBeVisible();

        // Started from the staff side: both pages follow without a reload
        const started = await api.post(`h2h/match/${match.id}/start`);
        expect(started.ok(), await started.text()).toBeTruthy();
        await expect(card).toContainText("Playing");
        await expect(card).toHaveAttribute("aria-current", "true");
        await expect(scoreboard.getByText("Starts soon")).toBeHidden();

        // First to 3 points in a single set: A wins every point
        const sideA = scoreboard.getByRole("region", { name: a.name });
        for (let i = 0; i < 3; i++) {
            await createAttempt(api, {
                roundId,
                competitorId: a.id,
                attemptNumber: 99,
                value: 1000 + i,
            });
            await createAttempt(api, {
                roundId,
                competitorId: b.id,
                attemptNumber: 99,
                value: 1200,
            });
            await expect(
                sideA.getByLabel(`Point ${i + 1}: won`, { exact: true })
            ).toBeVisible();
        }

        await expect(scoreboard.getByRole("status")).toContainText(
            `${a.name} wins ${match.label}`
        );
        await expect(scoreboard.getByRole("status")).toContainText(
            "Next: Quarterfinal"
        );
        await expect(sideA.getByLabel("Sets won")).toHaveText("1");

        await expect(card).not.toContainText("Playing");
        await expect(card).toContainText("3–0");
        await expect(waitingSlot).toHaveCount(0);

        // The card opens on every point's times
        await card.getByRole("button").click();
        const dialog = page.getByRole("dialog", { name: match.label });
        await expect(dialog).toContainText("10.02");
        await expect(dialog).toContainText("12.00");
    });
});
