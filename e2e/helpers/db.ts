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

/**
 * Generate the Prisma client (the seed script needs it) and push the schema,
 * creating the database if it is missing; safe to run on an existing one
 */
export const pushSchema = () => {
    for (const args of [
        ["prisma", "generate"],
        ["prisma", "db", "push"],
    ]) {
        execFileSync("npx", args, {
            cwd: BACKEND_DIR,
            env: { ...process.env, ...backendEnv },
            stdio: "pipe",
        });
    }
};

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

/** Holds a copy of the seeded tables; resets restore from it */
const SNAPSHOT_SCHEMA = "e2e_seed";

const publicTables = async (db: Client) =>
    (
        await db.query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
        )
    ).rows.map((r) => r.tablename);

const truncatePublic = async (db: Client) => {
    const tables = await publicTables(db);
    if (tables.length > 0) {
        await db.query(
            `TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`
        );
    }
};

const runSeedScript = () => {
    // The seed creates the staff assignments in one transaction with
    // Prisma's 5 s limit, which a slow database can overrun; try again
    for (let attempt = 1; ; attempt++) {
        try {
            execFileSync("npx", ["ts-node", "prisma/seed/seed-test.ts"], {
                cwd: BACKEND_DIR,
                env: { ...process.env, ...backendEnv },
                stdio: "pipe",
            });
            return;
        } catch (error) {
            if (attempt >= 3) throw error;
        }
    }
};

const addRoleUsers = async (db: Client) => {
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
};

/**
 * Wipe every table, load the backend test seed (admin/admin + the seed WCIF),
 * add one account per role with fixed ids (so tokens signed in global setup
 * stay valid) and keep a copy of the result for resetDatabase.
 */
export const seedDatabase = async () => {
    assertTestDatabase();
    await withDb(truncatePublic);
    runSeedScript();
    await withDb(async (db) => {
        await addRoleUsers(db);
        await db.query(`DROP SCHEMA IF EXISTS ${SNAPSHOT_SCHEMA} CASCADE`);
        await db.query(`CREATE SCHEMA ${SNAPSHOT_SCHEMA}`);
        for (const table of await publicTables(db)) {
            await db.query(
                `CREATE TABLE ${SNAPSHOT_SCHEMA}."${table}" AS TABLE public."${table}"`
            );
        }
    });
};

/** Put the database back to the state seedDatabase left it in */
export const resetDatabase = async () => {
    assertTestDatabase();
    const hasSnapshot = await withDb(
        async (db) =>
            (
                await db.query(
                    "SELECT 1 FROM information_schema.schemata WHERE schema_name = $1",
                    [SNAPSHOT_SCHEMA]
                )
            ).rowCount === 1
    );
    if (!hasSnapshot) return seedDatabase();
    await withDb(async (db) => {
        await db.query("BEGIN");
        // Copy tables back in any order, without checking foreign keys
        await db.query("SET LOCAL session_replication_role = replica");
        await truncatePublic(db);
        const { rows } = await db.query<{ table_name: string }>(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
            [SNAPSHOT_SCHEMA]
        );
        for (const { table_name: table } of rows) {
            await db.query(
                `INSERT INTO public."${table}" SELECT * FROM ${SNAPSHOT_SCHEMA}."${table}"`
            );
        }
        await db.query("COMMIT");
    });
};
