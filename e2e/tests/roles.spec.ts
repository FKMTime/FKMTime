import { expect, freshDatabase, test } from "../fixtures";
import { RoleKey, storageStatePath } from "../helpers/users";

freshDatabase();

const ALL_ITEMS = [
    "Home",
    "Incidents",
    "Persons",
    "Check in",
    "Attendance",
    "Results",
    "Live solving",
    "Setup",
    "Scrambles",
    "Statistics",
] as const;

type NavLabel = (typeof ALL_ITEMS)[number];

interface RoleExpectation {
    visible: NavLabel[];
    /** Where the Results link points: delegates get the full results tool */
    resultsHref: string;
    canEnterAttempts: boolean;
}

const EXPECTATIONS: Record<RoleKey, RoleExpectation> = {
    admin: {
        visible: [...ALL_ITEMS],
        resultsHref: "/results",
        canEnterAttempts: true,
    },
    delegate: {
        visible: [...ALL_ITEMS],
        resultsHref: "/results",
        canEnterAttempts: true,
    },
    organizer: {
        visible: [
            "Home",
            "Persons",
            "Check in",
            "Attendance",
            "Results",
            "Live solving",
            "Setup",
            "Statistics",
        ],
        resultsHref: "/results/public",
        canEnterAttempts: false,
    },
    stageLeader: {
        visible: [
            "Home",
            "Persons",
            "Check in",
            "Attendance",
            "Results",
            "Live solving",
        ],
        resultsHref: "/results/public",
        canEnterAttempts: false,
    },
    staff: {
        visible: ["Home", "Persons", "Check in", "Results", "Live solving"],
        resultsHref: "/results/public",
        canEnterAttempts: false,
    },
};

for (const [role, expectation] of Object.entries(EXPECTATIONS) as [
    RoleKey,
    RoleExpectation,
][]) {
    test.describe(`${role} navigation`, () => {
        test.use({ storageState: storageStatePath(role) });

        test("shows exactly the sections this role may use", async ({
            page,
        }) => {
            await page.goto("/");
            const nav = page.getByRole("complementary").getByRole("navigation");
            await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();

            for (const label of ALL_ITEMS) {
                const link = nav.getByRole("link", {
                    name: label,
                    exact: true,
                });
                if (expectation.visible.includes(label)) {
                    await expect(link, `${label} link`).toBeVisible();
                } else {
                    await expect(link, `${label} link`).toHaveCount(0);
                }
            }
            await expect(
                nav.getByRole("link", { name: "Results", exact: true })
            ).toHaveAttribute("href", expectation.resultsHref);

            const enterAttempt = page
                .getByRole("banner")
                .getByRole("button", { name: "Enter attempt" });
            if (expectation.canEnterAttempts) {
                await expect(enterAttempt).toBeVisible();
            } else {
                await expect(enterAttempt).toHaveCount(0);
            }

            // Username/password accounts always reach their settings
            await page.getByRole("button", { name: "Account" }).click();
            await expect(
                page.getByRole("menuitem", { name: "Settings" })
            ).toBeVisible();
            await page.getByRole("menuitem", { name: "Settings" }).click();
            await expect(page).toHaveURL(/\/settings$/);
            await expect(
                page.getByRole("heading", { name: "Account" })
            ).toBeVisible();
            const quickActions = page.getByRole("heading", {
                name: "Quick actions",
            });
            if (role === "admin" || role === "delegate") {
                await expect(quickActions).toBeVisible();
            } else {
                await expect(quickActions).toHaveCount(0);
            }
        });
    });
}

test.describe("mobile shell", () => {
    test.use({
        storageState: storageStatePath("delegate"),
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });

    test("uses bottom tabs and lists the rest under More", async ({ page }) => {
        await page.goto("/");
        const tabs = page.getByRole("navigation").filter({
            has: page.getByRole("link", { name: "More" }),
        });
        for (const label of [
            "Home",
            "Incidents",
            "Results",
            "Persons",
            "More",
        ]) {
            await expect(
                tabs.getByRole("link", { name: label, exact: true })
            ).toBeVisible();
        }

        await tabs.getByRole("link", { name: "More" }).click();
        await expect(page).toHaveURL(/\/more$/);
        const main = page.getByRole("main");
        for (const label of [
            "Check in",
            "Attendance",
            "Live solving",
            "Setup",
            "Scrambles",
            "Statistics",
            "Settings",
        ]) {
            await expect(main.getByRole("link", { name: label })).toBeVisible();
        }

        await main.getByRole("link", { name: "Check in" }).click();
        await expect(page).toHaveURL(/\/check-in$/);

        await page.goto("/more");
        await page.getByRole("button", { name: "Log out" }).click();
        await expect(page).toHaveURL(/\/auth\/login$/);
    });
});
