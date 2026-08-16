# Free "prompt → website" agent, hosted entirely on GitHub

A Lovable-style builder that runs 100% in the browser from GitHub Pages, powered by a Gemini API key you paste on first open, and able to preview, export, and publish generated sites to GitHub Pages.

## How it works

```text
[GitHub Pages app]  →  paste Gemini key (saved in browser)
        ↓
   chat prompt  →  Gemini streams a file plan + file contents
        ↓
 virtual file system in browser  →  live iframe preview
        ↓
 Publish → GitHub API commits files to a new repo → GitHub Actions turns on Pages
        ↓
 site live at  https://<you>.github.io/<site-name>/
```

With Server and  Lovable backend if needed , no paid service. Everything runs client-side if needed lovable used; GitHub Actions only builds/deploys the sites you publish.

## Core pieces

**1. Key setup screen**

- First open shows a one-field screen: paste Gemini API key.
- Stored in browser localStorage only, never sent anywhere except Google's API.
- Model: `gemini-2.5-flash` by default (best free-tier quota), with a switch to `gemini-2.5-pro` for hard builds. Auto-fallback when the free rate limit hits.

**2. The agent loop (this is what makes it feel like Lovable)**

- System prompt defining a builder agent with strict output format.
- Agent replies with tool calls, not raw text:
  - `write_file(path, content)`
  - `edit_file(path, find, replace)` — cheap partial edits so long chats don't burn tokens
  - `delete_file(path)`
  - `read_file(path)`
  - `plan(steps)` / `respond(message)`
- Multi-turn: after each tool batch, the runner feeds results back so the model can continue or fix itself.
- Streaming output so files appear as they're written.
- Auto-repair pass: preview console/runtime errors get fed back to the model for one automatic fix attempt.

**3. Three output modes, chosen by the agent**

- Single-file HTML + Tailwind CDN + vanilla JS → landing pages, games, tools, instant preview.
- Multi-file static HTML/CSS/JS → multi-page sites with real routing.
- Multi-file React → bundled in-browser with esbuild-wasm, for app-like projects.
The agent picks the mode from the prompt; you can override it.

**4. Editor UI**

- Left: chat with the agent, with streaming and edit history.
- Middle: file tree + code editor (CodeMirror), editable by hand — your manual edits are kept and shown to the agent on the next turn.
- Right: live iframe preview with device sizes (mobile/tablet/desktop), console panel, refresh.
- Version history: every agent turn is a snapshot you can restore, like Lovable's rollback.
- Templates gallery to start from: SaaS landing, portfolio, blog, dashboard, e-commerce, restaurant, game, docs, form/tool.

**5. Publishing (free hosting for every generated site)**

- Preview: instant, in-browser, no publish needed.
- Download: ZIP of the project.
- Publish: you connect a GitHub personal access token once (stored in browser). Publish then:
  - creates a repo `site-<name>` in your account,
  - commits the generated files,
  - adds a GitHub Actions workflow that deploys to GitHub Pages,
  - returns the live URL `https://<you>.github.io/site-<name>/`.
- Re-publish updates the same repo.

## Honest note on "subdomains"

GitHub Pages free gives one subdomain per account (`you.github.io`); every extra site lands on a path under it, not its own subdomain. To get true per-site subdomains (`shop.yourdomain.com`) you need one domain you own — after that the app can auto-configure the CNAME per site and it stays free. I'll build the path-based publishing now and leave a "custom domain" field ready for when/if you add a domain.

## Also included

- Rate-limit and quota handling with clear messages (free Gemini tier limits).
- Token/context management: only relevant files are sent to the model, not the whole project.
- Prompt enhancer: rewrites a short prompt into a detailed brief before building.
- Image handling: generated sites use free sources (Unsplash/Picsum URLs) or CSS/SVG art, since free Gemini keys have no image generation.
- Export to GitHub also for the builder itself — the whole app is a static site in your repo, deployed by GitHub Actions on push.

## Technical details

- Stack: React + Vite + Tailwind, built to static output, deployed by a GitHub Actions workflow to GitHub Pages.
- Everything client-side; no environment variables, no secrets in the repo. Gemini key and GitHub token live in the browser only.
- Gemini access via the REST `streamGenerateContent` endpoint with function-calling tools, called directly from the browser.
- React preview mode uses `esbuild-wasm` in a web worker; static modes render via a Blob/srcdoc iframe.
- ZIP export via `fflate`; GitHub publishing via the GitHub REST contents/git-tree API.

## Build order

1. App shell, Pages + Actions deploy workflow, key setup screen.
2. Virtual file system, editor, iframe preview (single-file + static multi-file).
3. Gemini agent runtime with tools, streaming, self-repair.
4. React mode with esbuild-wasm bundling.
5. Templates, version history, ZIP export.
6. GitHub publish flow with token + Pages automation.