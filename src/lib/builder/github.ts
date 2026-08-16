const API = "https://api.github.com";

async function gh<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body;
    try {
      message = JSON.parse(body)?.message ?? body;
    } catch {
      /* raw */
    }
    throw new Error(`GitHub ${res.status}: ${message}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function whoAmI(token: string) {
  const user = await gh<{ login: string }>(token, "/user");
  return user.login;
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "site";

const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

export interface PublishResult {
  url: string;
  repo: string;
  repoUrl: string;
}

const PAGES_WORKFLOW = `name: Deploy site
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
`;

async function ensureRepo(token: string, login: string, repo: string, desc: string) {
  try {
    await gh(token, `/repos/${login}/${repo}`);
    return;
  } catch {
    /* create below */
  }
  await gh(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({ name: repo, description: desc, auto_init: true, private: false }),
  });
  await new Promise((r) => setTimeout(r, 2500));
}

async function commitFiles(
  token: string,
  login: string,
  repo: string,
  payload: Record<string, string>,
  message: string,
) {
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${login}/${repo}/git/ref/heads/main`,
  );
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(
    token,
    `/repos/${login}/${repo}/git/commits/${baseSha}`,
  );
  const blobs = await Promise.all(
    Object.entries(payload).map(async ([path, content]) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: b64(content), encoding: "base64" }),
      });
      return { path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
    }),
  );
  const tree = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
  });
  await gh(token, `/repos/${login}/${repo}/git/refs/heads/main`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
}

async function enablePages(token: string, login: string, repo: string) {
  try {
    await gh(token, `/repos/${login}/${repo}/pages`, {
      method: "POST",
      body: JSON.stringify({ build_type: "workflow", source: { branch: "main", path: "/" } }),
    });
  } catch {
    try {
      await gh(token, `/repos/${login}/${repo}/pages`, {
        method: "PUT",
        body: JSON.stringify({ build_type: "workflow" }),
      });
    } catch {
      /* already configured */
    }
  }
}

async function listHubSites(token: string, login: string, repo: string) {
  try {
    const entries = await gh<{ name: string; type: string }[]>(
      token,
      `/repos/${login}/${repo}/contents/s`,
    );
    return entries.filter((e) => e.type === "dir").map((e) => e.name);
  } catch {
    return [];
  }
}

function hubIndex(login: string, slugs: string[]) {
  const cards = slugs
    .map(
      (slug) =>
        `      <a class="card" href="./s/${slug}/"><span class="dot"></span><strong>${slug}</strong><span class="go">Open →</span></a>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${login} — sites</title>
<meta name="description" content="Websites published with Atlas." />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; font-family: ui-sans-serif, system-ui, sans-serif;
    background:#0e0e11; color:#f4f4f5; padding:64px 24px; }
  .wrap { max-width: 820px; margin: 0 auto; }
  h1 { font-size: 2rem; margin: 0 0 8px; }
  p.sub { color:#a1a1aa; margin:0 0 32px; }
  .grid { display:grid; gap:12px; }
  .card { display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit;
    border:1px solid #27272a; background:#151518; border-radius:12px; padding:16px 18px; }
  .card:hover { border-color:#f59e0b; background:#1b1b1f; }
  .dot { width:8px; height:8px; border-radius:50%; background:#f59e0b; }
  .go { margin-left:auto; color:#a1a1aa; font-size:.85rem; }
  footer { margin-top:40px; color:#52525b; font-size:.8rem; }
</style>
</head>
<body>
  <main class="wrap">
    <h1>${login}'s sites</h1>
    <p class="sub">Published with Atlas. Each site lives at its own address below.</p>
    <div class="grid">
${cards || "      <p style=\"color:#71717a\">No sites published yet.</p>"}
    </div>
    <footer>Built with Atlas</footer>
  </main>
</body>
</html>
`;
}

export interface HubPublishOptions {
  token: string;
  name: string;
  files: Record<string, string>;
  hubDomain?: string | undefined;
  onStep?: ((step: string) => void) | undefined;
}

/**
 * Publishes into a single "hub" repo (<user>.github.io) under /s/<slug>/, so a user can
 * publish unlimited sites for free, each with its own address, plus an index of them all.
 */
export async function publishToHub(opts: HubPublishOptions): Promise<PublishResult> {
  const { token, files, onStep } = opts;
  const login = await whoAmI(token);
  const repo = `${login}.github.io`;
  const slug = slugify(opts.name);

  onStep?.("Preparing your hub…");
  await ensureRepo(token, login, repo, `${login}'s sites — published with Atlas`);

  const existing = await listHubSites(token, login, repo);
  const slugs = [...new Set([...existing, slug])].sort();

  const payload: Record<string, string> = {
    ".nojekyll": "",
    ".github/workflows/deploy.yml": PAGES_WORKFLOW,
    "index.html": hubIndex(login, slugs),
  };
  for (const [path, content] of Object.entries(files)) payload[`s/${slug}/${path}`] = content;
  const entry = files["index.html"];
  if (entry) payload[`s/${slug}/404.html`] = entry;
  if (opts.hubDomain) payload["CNAME"] = opts.hubDomain;

  onStep?.("Uploading site…");
  await commitFiles(token, login, repo, payload, `Publish ${slug} — ${new Date().toISOString()}`);

  onStep?.("Turning on GitHub Pages…");
  await enablePages(token, login, repo);

  const host = opts.hubDomain ? opts.hubDomain : `${login}.github.io`;
  return {
    url: `https://${host}/s/${slug}/`,
    repo,
    repoUrl: `https://github.com/${login}/${repo}`,
  };
}

export async function publishToPages(opts: {
  token: string;
  name: string;
  files: Record<string, string>;
  customDomain?: string | undefined;
  onStep?: ((step: string) => void) | undefined;
}): Promise<PublishResult> {
  const { token, files, onStep } = opts;
  const repo = `site-${slugify(opts.name)}`;
  const login = await whoAmI(token);
  onStep?.("Checking repository…");

  let exists = true;
  try {
    await gh(token, `/repos/${login}/${repo}`);
  } catch {
    exists = false;
  }
  if (!exists) {
    onStep?.("Creating repository…");
    await gh(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repo,
        description: `Built with Atlas — ${opts.name}`,
        auto_init: true,
        private: false,
      }),
    });
    await new Promise((r) => setTimeout(r, 2500));
  }

  const payload: Record<string, string> = {
    ...files,
    ".nojekyll": "",
    ".github/workflows/deploy.yml": PAGES_WORKFLOW,
  };
  if (opts.customDomain) payload["CNAME"] = opts.customDomain;

  onStep?.("Uploading files…");
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${login}/${repo}/git/ref/heads/main`,
  );
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(
    token,
    `/repos/${login}/${repo}/git/commits/${baseSha}`,
  );

  const blobs = await Promise.all(
    Object.entries(payload).map(async ([path, content]) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: b64(content), encoding: "base64" }),
      });
      return { path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
    }),
  );

  const tree = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${login}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `Publish ${new Date().toISOString()}`,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });
  await gh(token, `/repos/${login}/${repo}/git/refs/heads/main`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });

  onStep?.("Turning on GitHub Pages…");
  try {
    await gh(token, `/repos/${login}/${repo}/pages`, {
      method: "POST",
      body: JSON.stringify({ build_type: "workflow", source: { branch: "main", path: "/" } }),
    });
  } catch {
    try {
      await gh(token, `/repos/${login}/${repo}/pages`, {
        method: "PUT",
        body: JSON.stringify({ build_type: "workflow" }),
      });
    } catch {
      /* pages already configured */
    }
  }

  return {
    url: opts.customDomain
      ? `https://${opts.customDomain}/`
      : `https://${login}.github.io/${repo}/`,
    repo,
    repoUrl: `https://github.com/${login}/${repo}`,
  };
}
