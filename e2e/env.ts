import * as path from "node:path";

/**
 * Everything the suite needs to know about where things run. Every value can
 * be overridden from the environment so CI (and parallel local checkouts)
 * can pick their own database and ports.
 */
const envOr = (name: string, fallback: string) =>
    process.env[name] && process.env[name] !== ""
        ? (process.env[name] as string)
        : fallback;

export const ROOT_DIR = path.resolve(__dirname, "..");
export const BACKEND_DIR = path.join(ROOT_DIR, "backend");
export const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
export const AUTH_DIR = path.join(__dirname, ".auth");

export const BACKEND_PORT = Number(envOr("E2E_BACKEND_PORT", "5150"));
export const FRONTEND_PORT = Number(envOr("E2E_FRONTEND_PORT", "5174"));

export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export const DATABASE_URL = envOr(
    "E2E_DATABASE_URL",
    "postgres://root:postgres@localhost:5440/fkm_e2e_pw"
);
export const WCA_ORIGIN = envOr("E2E_WCA_ORIGIN", "http://localhost:3010");
export const WCA_LIVE_API_ORIGIN = envOr(
    "E2E_WCA_LIVE_API_ORIGIN",
    "http://localhost:4010/api"
);
export const SECRET = envOr(
    "E2E_SECRET",
    "dev-only-secret-not-for-production-change-me"
);
export const SOCKET_PATH = envOr("E2E_SOCKET_PATH", "/tmp/fkm-e2e-pw.sock");

/** Environment the backend process (and the seed script) runs with */
export const backendEnv: Record<string, string> = {
    DATABASE_URL,
    WCA_ORIGIN,
    WCA_LIVE_API_ORIGIN,
    WCA_CLIENT_ID: "example-application-id",
    WCA_CLIENT_SECRET: "example-secret",
    SECRET,
    SOCKET_PATH,
    PORT: String(BACKEND_PORT),
};

/** Environment the Vite dev server runs with */
export const frontendEnv: Record<string, string> = {
    VITE_BACKEND_ORIGIN: BACKEND_URL,
    VITE_WCA_ORIGIN: WCA_ORIGIN,
};
