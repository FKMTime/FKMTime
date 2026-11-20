/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    readonly VITE_PREVIEW_PR_NUMBER?: string;
    readonly VITE_PREVIEW_PR_URL?: string;
    /** "true" puts the station tester in a production build (PR previews) */
    readonly VITE_STATION_TESTER?: string;
}
