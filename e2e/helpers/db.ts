import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import { Client } from "pg";

import { BACKEND_DIR, backendEnv, DATABASE_URL } from "../env";
import { ROLE_USERS, RoleUser } from "./users";

const legacyPasswordHash = (password: string) =>
    createHash("sha512").update(password).digest("hex");

export const withDb = async <T>(fn: (db: Client) => Promise<T>) => {
    const db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    try {
        return await fn(db);
    } finally {
        await db.end();
    }
};

const assertTestDatabase = () => {
    const name = new URL(DATABASE_URL).pathname.slice(1);
    // The reset truncates every table, so refuse anything that is not
    // clearly a throwaway test database
    if (!/(e2e|test)/i.test(name)) {
        throw new Error(
            `Refusing to reset database "${name}": its name must contain "e2e" or "test"`
        );
    }
};

/** Push the Prisma schema; safe to run on an existing database */
export const pushSchema = () => {
    execFileSync("npx", ["prisma", "db", "push"], {
        cwd: BACKEND_DIR,
        env: { ...process.env, ...backendEnv },
        stdio: "pipe",
    });
};

/**
 * Wipe every table, load the backend test seed (admin/admin + the seed WCIF)
 * and add one account per role with fixed ids, so tokens signed in global
 * setup stay valid across resets.
 */
/** Add a username/password account; returns it with its generated id */
export const createUserInDb = async (
    user: Omit<RoleUser, "id">
): Promise<RoleUser> => {
    const id = randomUUID();
    await withDb((db) =>
        db.query(
            `INSERT INTO users (id, username, full_name, roles, password, updated_at)
             VALUES ($1, $2, $3, $4::"Role"[], $5, now())`,
            [
                id,
                user.username,
                user.fullName,
                user.roles,
                legacyPasswordHash(user.password),
            ]
        )
    );
    return { ...user, id };
};

export const resetDatabase = async () => {
    assertTestDatabase();
    await withDb(async (db) => {
        const { rows } = await db.query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
        );
        if (rows.length > 0) {
            await db.query(
                `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`
            );
        }
    });
    execFileSync("npx", ["ts-node", "prisma/seed/seed-test.ts"], {
        cwd: BACKEND_DIR,
        env: { ...process.env, ...backendEnv },
        stdio: "pipe",
    });
    await withDb(async (db) => {
        for (const user of Object.values(ROLE_USERS)) {
            if (user.username === "admin") {
                await db.query("UPDATE users SET id = $1 WHERE username = $2", [
                    user.id,
                    user.username,
                ]);
                continue;
            }
            await db.query(
                `INSERT INTO users (id, username, full_name, roles, password, updated_at)
                 VALUES ($1, $2, $3, $4::"Role"[], $5, now())`,
                [
                    user.id,
                    user.username,
                    user.fullName,
                    user.roles,
                    legacyPasswordHash(user.password),
                ]
            );
        }
    });
};
