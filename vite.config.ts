// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// STATIC=1 produces a plain prerendered static bundle (dist/client) for GitHub Pages.
const STATIC = process.env["STATIC"] === "1";

export default defineConfig({
  ...(STATIC ? { nitro: false as const } : {}),
  tanstackStart: {
    // Prerender "/" so the app can also be served as pure static files (GitHub Pages).
    prerender: { enabled: true, crawlLinks: false },
    pages: [{ path: "/" }],
  },
});
