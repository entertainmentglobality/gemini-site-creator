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

export async function publishToPages(opts: {
  token: string;
  name: string;
  files: Record<string, string>;
  customDomain?: string;
  onStep?: (step: string) => void;
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
