import { defineConfig, devices } from "@playwright/test";

import {
    BACKEND_DIR,
    BACKEND_URL,
    backendEnv,
    FRONTEND_DIR,
    FRONTEND_PORT,
    FRONTEND_URL,
    frontendEnv,
} from "./env";

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: "./tests",
    // One backend and one database: tests run one at a time, and spec files
    // reseed the database before they start
    fullyParallel: false,
    workers: 1,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: isCI
        ? [["list"], ["html", { open: "never" }], ["github"]]
        : [["list"], ["html", { open: "never" }]],
    globalSetup: "./global-setup.ts",
    use: {
        baseURL: FRONTEND_URL,
        headless: true,
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        locale: "en-GB",
        timezoneId: "Europe/Warsaw",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
    webServer: [
        {
            name: "backend",
            command:
                "npx prisma generate && npx prisma db push && npm run build && node dist/src/main.js",
            cwd: BACKEND_DIR,
            env: backendEnv,
            url: `${BACKEND_URL}/health`,
            reuseExistingServer: !isCI,
            timeout: 180_000,
            stdout: "ignore",
            stderr: "pipe",
        },
        {
            name: "frontend",
            command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
            cwd: FRONTEND_DIR,
            env: frontendEnv,
            url: FRONTEND_URL,
            reuseExistingServer: !isCI,
            timeout: 120_000,
            stdout: "ignore",
            stderr: "pipe",
        },
    ],
});
