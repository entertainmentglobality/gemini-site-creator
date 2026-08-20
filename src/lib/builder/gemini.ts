/**
 * Gemini transport with automatic model discovery + fallback.
 *
 * The user never picks a model. On key entry we ask the API which models the key can
 * actually use (ListModels), rank them newest-first, and stream through that chain,
 * falling back on ANY failure so a request practically never dies on a bad model id.
 */

export type GeminiRole = "user" | "model";
export interface GeminiTurn {
  role: GeminiRole;
  text: string;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Newest-first preference (verified against ai.google.dev/gemini-api/docs/models). */
export const PREFERRED_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

/** Chain used before/if discovery is unavailable. */
export const DEFAULT_CHAIN: string[] = [...PREFERRED_MODELS];

const EXCLUDE = /(embedding|aqa|tts|image|audio|live|robotics|computer-use|veo|imagen|lyria)/i;

function score(id: string): number {
  const index = (PREFERRED_MODELS as readonly string[]).indexOf(id);
  if (index >= 0) return 1000 - index;
  const version = Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
  let bonus = 0;
  if (/flash/.test(id)) bonus += 3;
  if (/pro/.test(id)) bonus += 2;
  if (/lite/.test(id)) bonus -= 1;
  if (/preview|exp/.test(id)) bonus -= 1;
  return version * 10 + bonus;
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
}

/** Asks the key which models it can use, returns a ranked fallback chain. */
export async function discoverModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${ENDPOINT}?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GeminiError(
      (() => {
        try {
          return JSON.parse(body)?.error?.message ?? body;
        } catch {
          return body || `Request failed (${res.status})`;
        }
      })(),
      res.status,
    );
  }
  const json = (await res.json()) as { models?: ModelEntry[] };
  const ids = (json.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini-") && !EXCLUDE.test(id));

  const ranked = [...new Set(ids)].sort((a, b) => score(b) - score(a));
  // Keep a healthy chain: best discovered models first, then known-good defaults.
  const chain = [...ranked.slice(0, 6), ...DEFAULT_CHAIN.filter((m) => ids.includes(m))];
  const unique = [...new Set(chain)];
  return unique.length ? unique : DEFAULT_CHAIN;
}

export async function validateKey(apiKey: string): Promise<boolean> {
  try {
    await discoverModels(apiKey);
    return true;
  } catch {
    return false;
  }
}

interface StreamArgs {
  apiKey: string;
  model: string;
  system: string;
  history: GeminiTurn[];
  signal?: AbortSignal | undefined;
  onDelta: (chunk: string) => void;
  temperature?: number | undefined;
  maxOutputTokens?: number | undefined;
}

async function streamOnce({
  apiKey,
  model,
  system,
  history,
  signal,
  onDelta,
  temperature = 0.85,
  maxOutputTokens = 32000,
}: StreamArgs): Promise<string> {
  const res = await fetch(
    `${ENDPOINT}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal ?? null,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { temperature, topP: 0.95, maxOutputTokens },
        safetySettings: [
          "HARM_CATEGORY_HARASSMENT",
          "HARM_CATEGORY_HATE_SPEECH",
          "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "HARM_CATEGORY_DANGEROUS_CONTENT",
        ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
      }),
    },
  );

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      msg = JSON.parse(body)?.error?.message ?? body;
    } catch {
      /* keep raw */
    }
    throw new GeminiError(msg || `Request failed (${res.status})`, res.status);
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
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (typeof part?.text === "string" && part.text) {
            full += part.text;
            onDelta(part.text);
          }
        }
      } catch {
        /* partial json, ignore */
      }
    }
  }

  return full;
}

export interface StreamChainArgs extends Omit<StreamArgs, "model"> {
  models?: string[] | undefined;
  onModel?: ((model: string) => void) | undefined;
}

/**
 * Streams a completion across the whole model chain. Any failure (bad/retired model id,
 * quota, overload) moves to the next model, so the user never sees "model not found".
 */
export async function streamGemini(args: StreamChainArgs): Promise<string> {
  const chain = [...new Set([...(args.models ?? []), ...DEFAULT_CHAIN])];
  let lastError: unknown;
  for (const model of chain) {
    if (args.signal?.aborted) break;
    try {
      args.onModel?.(model);
      const out = await streamOnce({ ...args, model });
      if (out.trim()) return out;
      lastError = new GeminiError("Empty response", 500);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error;
      const status = error instanceof GeminiError ? error.status : 0;
      // A bad API key is the only unrecoverable case — everything else falls back.
      if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(String((error as Error).message)))
        throw error;
      if (status === 401) throw error;
    }
  }
  throw lastError ?? new GeminiError("No Gemini model available", 500);
}
