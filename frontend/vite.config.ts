/// <reference types="vitest" />
import * as path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { VitePWA } from "vite-plugin-pwa";
import svgrPlugin from "vite-plugin-svgr";
import viteTsconfigPaths from "vite-tsconfig-paths";

const manifestForPlugIn = {
    registerType: "prompt",
    workbox: {
        globPatterns: [],
    },
    includeAssets: ["favicon.ico", "apple-touch-icon.png"],
    manifest: {
        name: "FKMTime",
        short_name: "FKMTime",
        description: "FKMTime app",
        theme_color: "#2D3748",
        background_color: "#2D3748",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait",
        icons: [
            {
                src: "logo192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "logo512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
    },
};

export default defineConfig({
    plugins: [
        react(),
        // checker({
        //     overlay: { initialIsOpen: false },
        //     typescript: true,
        //     eslint: {
        //         lintCommand: "eslint --ext .js,.jsx,.ts,.tsx src",
        //     },
        // }),
        viteTsconfigPaths(),
        svgrPlugin(),
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        VitePWA(manifestForPlugIn),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
    },
});
