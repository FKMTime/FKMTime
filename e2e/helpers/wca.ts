import { expect, Page, request } from "@playwright/test";

import { WCA_ORIGIN } from "../env";

interface WcaCompetition {
    id: string;
    name: string;
    delegates: { wca_id: string | null }[];
}

export const getWcaCompetition = async (competitionId: string) => {
    const wca = await request.newContext();
    try {
        const response = await wca.get(
            `${WCA_ORIGIN}/api/v0/competitions/${competitionId}`
        );
        expect(response.ok()).toBeTruthy();
        return (await response.json()) as WcaCompetition;
    } finally {
        await wca.dispose();
    }
};

/**
 * On the dummy WCA consent page, pick an account that delegates the given
 * competition. Account ids come from the dummy service at run time, so the
 * suite does not depend on (or copy) who those accounts are.
 */
export const chooseDelegateAccount = async (
    page: Page,
    competitionId: string
) => {
    const competition = await getWcaCompetition(competitionId);
    const ids = competition.delegates
        .map((delegate) => delegate.wca_id)
        .filter((id): id is string => !!id);
    await expect(page).toHaveTitle("Dummy WCA - authorize");
    await page
        .getByRole("button", { name: new RegExp(ids.join("|")) })
        .first()
        .click();
};

/** Sign in through the WCA OAuth flow of the dummy WCA service */
export const signInWithWca = async (page: Page, competitionId: string) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Sign in with WCA" }).click();
    await chooseDelegateAccount(page, competitionId);
};
