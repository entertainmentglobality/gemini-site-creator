# Atlas

Atlas is a prompt-to-website builder hosted on GitHub Pages. It generates complete sites, renders them in a live device preview, exposes the source editor, exports ZIP files, and publishes sites to GitHub Pages.

## Live app

https://entertainmentglobality.github.io/gemini-site-creator/

## Features

- Free built-in Atlas AI with optional personal Gemini API key
- Single-file HTML, multi-page HTML/CSS/JavaScript, and React modes
- Live desktop, tablet, and mobile preview with an in-app error console
- Editable source files, version snapshots, automatic repair, and ZIP export
- GitHub Pages publishing to a dedicated repository or an unlimited `/s/site-name/` hub
- Optional custom domain support for a future `hubup.online` setup

## Run locally

```sh
bun install
bun run dev
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, builds the static application, and deploys it through GitHub Actions. GitHub Pages must use **GitHub Actions** as its source.
