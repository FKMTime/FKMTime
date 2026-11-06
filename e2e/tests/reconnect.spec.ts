import { Page, WebSocketRoute } from "@playwright/test";

import { expect, freshDatabase, signedInAs, test } from "../fixtures";
import {
    createAttempt,
    getPersonByRegistrantId,
    MAIN_HALL,
    setCurrentGroups,
} from "../helpers/api";

freshDatabase();
signedInAs("delegate");

/**
 * Lets a test drop the panel's socket and keep it down: while `isDown`,
 * every reconnect attempt is closed straight away.
 */
const controlSocket = async (page: Page) => {
    const state = {
        isDown: false,
        current: null as WebSocketRoute | null,
    };
    await page.routeWebSocket(/socket\.io/, (ws) => {
        if (state.isDown) {
            void ws.close();
            return;
        }
        state.current = ws;
        ws.connectToServer();
    });
    return {
        connected: () => expect.poll(() => state.current).not.toBeNull(),
        drop: async () => {
            state.isDown = true;
            await state.current?.close();
            state.current = null;
        },
        restore: () => {
            state.isDown = false;
        },
    };
};

// SPEC-003: a page that was on screen through a disconnect catches up with
// what it missed, without a reload
test.describe("after the socket reconnects", () => {
    test("Results shows a result entered while it was down", async ({
        page,
        api,
    }) => {
        const socket = await controlSocket(page);
        const person = await getPersonByRegistrantId(api, 1);
        await page.goto("/results/round/333-r1");
        await expect(page.getByText("No results yet.")).toBeVisible();
        await socket.connected();

        await socket.drop();
        // Sent while the panel is disconnected, so its live event is lost
        await createAttempt(api, {
            roundId: "333-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 1234,
        });
        await expect(page.getByText(person.name)).toHaveCount(0);

        socket.restore();
        await expect(
            page.getByRole("main").getByRole("table").getByText(person.name)
        ).toBeVisible({ timeout: 15_000 });
    });

    test("Home shows an attempt entered while it was down", async ({
        page,
        api,
    }) => {
        await setCurrentGroups(api, { [MAIN_HALL]: ["333-r1-g1"] });
        const socket = await controlSocket(page);
        const person = await getPersonByRegistrantId(api, 2);
        await page.goto("/");
        await expect(page.getByRole("main")).toBeVisible();
        await socket.connected();

        await socket.drop();
        await createAttempt(api, {
            roundId: "333-r1",
            competitorId: person.id,
            attemptNumber: 1,
            value: 2345,
        });
        await expect(page.getByText(person.name)).toHaveCount(0);

        socket.restore();
        await expect(page.getByRole("main").getByText(person.name)).toBeVisible(
            { timeout: 15_000 }
        );
    });
});
