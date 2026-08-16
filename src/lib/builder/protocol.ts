export type AgentAction =
  | { kind: "plan"; steps: string[] }
  | { kind: "write"; path: string; content: string }
  | { kind: "edit"; path: string; find: string; replace: string }
  | { kind: "delete"; path: string }
  | { kind: "message"; text: string };

const FILE_RE = /<lov-write\s+path="([^"]+)">\n?([\s\S]*?)<\/lov-write>/g;
const EDIT_RE =
  /<lov-edit\s+path="([^"]+)">\s*<find>\n?([\s\S]*?)<\/find>\s*<replace>\n?([\s\S]*?)<\/replace>\s*<\/lov-edit>/g;
const DELETE_RE = /<lov-delete\s+path="([^"]+)"\s*\/>/g;
const PLAN_RE = /<lov-plan>([\s\S]*?)<\/lov-plan>/g;
const MSG_RE = /<lov-message>([\s\S]*?)<\/lov-message>/g;

function stripFence(text: string) {
  const trimmed = text.replace(/^\s*```[a-zA-Z0-9]*\n/, "").replace(/\n?```\s*$/, "");
  return trimmed;
}

/** Parses a complete agent response into ordered actions. */
export function parseActions(raw: string): AgentAction[] {
  const found: { index: number; action: AgentAction }[] = [];

  for (const m of raw.matchAll(PLAN_RE)) {
    const steps = (m[1] ?? "")
      .split("\n")
      .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
    found.push({ index: m.index ?? 0, action: { kind: "plan", steps } });
  }
  for (const m of raw.matchAll(FILE_RE)) {
    found.push({
      index: m.index ?? 0,
      action: { kind: "write", path: (m[1] ?? "").trim(), content: stripFence(m[2] ?? "") },
    });
  }
  for (const m of raw.matchAll(EDIT_RE)) {
    found.push({
      index: m.index ?? 0,
      action: {
        kind: "edit",
        path: (m[1] ?? "").trim(),
        find: m[2] ?? "",
        replace: m[3] ?? "",
      },
    });
  }
  for (const m of raw.matchAll(DELETE_RE)) {
    found.push({ index: m.index ?? 0, action: { kind: "delete", path: (m[1] ?? "").trim() } });
  }
  for (const m of raw.matchAll(MSG_RE)) {
    found.push({ index: m.index ?? 0, action: { kind: "message", text: (m[1] ?? "").trim() } });
  }

  if (found.length === 0) {
    const text = raw.trim();
    if (text) return [{ kind: "message", text }];
  }

  return found.sort((a, b) => a.index - b.index).map((f) => f.action);
}

/** Live progress info for a partially streamed response. */
export function streamProgress(raw: string): { writing: string | null; done: string[] } {
  const done: string[] = [];
  for (const m of raw.matchAll(FILE_RE)) done.push((m[1] ?? "").trim());
  const open = raw.lastIndexOf("<lov-write");
  const close = raw.lastIndexOf("</lov-write>");
  let writing: string | null = null;
  if (open > close) {
    const match = /<lov-write\s+path="([^"]*)"/.exec(raw.slice(open));
    writing = match?.[1] ?? null;
  }
  return { writing, done };
}

/** Text with all protocol blocks removed — what a human should read. */
export function humanText(raw: string): string {
  return raw
    .replace(FILE_RE, "")
    .replace(EDIT_RE, "")
    .replace(DELETE_RE, "")
    .replace(PLAN_RE, "")
    .replace(/<\/?lov-message>/g, "")
    .replace(/<lov-write[\s\S]*$/, "")
    .trim();
}
