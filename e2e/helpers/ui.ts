import { expect, Page } from "@playwright/test";

/** A toast in the notifications region, matched by its exact title or text */
export const toast = (page: Page, text: string | RegExp) =>
    page
        .getByRole("region", { name: /Notifications/ })
        .getByText(text, { exact: typeof text === "string" })
        .first();

export const expectToast = async (page: Page, text: string | RegExp) => {
    await expect(toast(page, text)).toBeVisible();
};

/**
 * Resolves once the page has sent the given socket.io event (e.g.
 * "joinIncidents"). Call before navigating, await after: live updates only
 * reach a page once it has joined the matching room.
 */
export const socketEventSent = (page: Page, event: string) =>
    new Promise<void>((resolve) => {
        page.on("websocket", (socket) => {
            socket.on("framesent", (frame) => {
                if (String(frame.payload).includes(`"${event}"`)) resolve();
            });
        });
    });

/**
 * Like socketEventSent, but for rooms the app shell leaves and re-joins on
 * re-renders (the incidents room): resolves once the latest frame for the
 * room is a join and nothing has changed for a moment. Call before
 * navigating; await the returned function after.
 */
export const socketRoomSettled = (page: Page, room: string) => {
    const join = `"join${room}"`;
    const leave = `"leave${room}"`;
    let lastIsJoin = false;
    let lastChange = 0;
    page.on("websocket", (socket) => {
        socket.on("framesent", (frame) => {
            const payload = String(frame.payload);
            if (payload.includes(join) || payload.includes(leave)) {
                lastIsJoin = payload.includes(join);
                lastChange = Date.now();
            }
        });
    });
    return () =>
        expect
            .poll(() => lastIsJoin && Date.now() - lastChange > 500, {
                intervals: [100],
            })
            .toBe(true);
};

/** Answer the app-wide confirm dialog */
export const confirm = async (page: Page, label = "Confirm") => {
    const dialog = page.getByRole("dialog").filter({
        has: page.getByRole("button", { name: "Cancel" }),
    });
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).toBeHidden();
};
