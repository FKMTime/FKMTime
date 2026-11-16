/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    readonly VITE_PREVIEW_PR_NUMBER?: string;
    readonly VITE_PREVIEW_PR_URL?: string;
}
