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

/** Answer the app-wide confirm dialog */
export const confirm = async (page: Page, label = "Confirm") => {
    const dialog = page.getByRole("dialog").filter({
        has: page.getByRole("button", { name: "Cancel" }),
    });
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).toBeHidden();
};
