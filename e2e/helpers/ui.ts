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

/** Answer the app-wide confirm dialog */
export const confirm = async (page: Page, label = "Confirm") => {
    const dialog = page.getByRole("dialog").filter({
        has: page.getByRole("button", { name: "Cancel" }),
    });
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).toBeHidden();
};
