import type { GeminiTurn } from "./gemini";

/** Where the free Atlas AI backend lives. Same-origin when the app is served by Lovable. */
export function backendBase(explicit?: string) {
  const trimmed = (explicit ?? "").trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export async function backendAvailable(base: string) {
  try {
    const res = await fetch(`${backendBase(base)}/api/public/ai`, { method: "GET" });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json?.ok === true;
  } catch {
    return false;
  }
}

export async function streamBackend(args: {
  base: string;
  system: string;
  history: GeminiTurn[];
  signal?: AbortSignal | undefined;
  temperature?: number | undefined;
  onDelta: (chunk: string) => void;
}): Promise<string> {
  const res = await fetch(`${backendBase(args.base)}/api/public/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: args.signal ?? null,
    body: JSON.stringify({
      system: args.system,
      temperature: args.temperature,
      messages: args.history.map((t) => ({
        role: t.role === "model" ? "assistant" : "user",
        content: t.text,
      })),
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let message = body;
    try {
      message = (JSON.parse(body) as { error?: string })?.error ?? body;
    } catch {
      /* raw */
    }
    throw new Error(
      res.status === 429
        ? "Atlas AI is rate limited right now — try again shortly or add your own Gemini key."
        : res.status === 402
          ? "Atlas AI credits are exhausted. Add your own Gemini key in Settings."
          : `Atlas AI error (${res.status}): ${message}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          args.onDelta(delta);
        }
      } catch {
        /* partial */
      }
    }
  }
  return full;
}
