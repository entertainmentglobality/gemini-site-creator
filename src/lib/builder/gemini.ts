export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, best free quota)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (smartest, low free quota)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fallback)" },
] as const;

export type GeminiRole = "user" | "model";
export interface GeminiTurn {
  role: GeminiRole;
  text: string;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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
}

async function streamOnce({
  apiKey,
  model,
  system,
  history,
  signal,
  onDelta,
  temperature = 0.85,
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
        generationConfig: { temperature, topP: 0.95, maxOutputTokens: 65536 },
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

/** Streams a completion, automatically falling back to a lighter model on quota errors. */
export async function streamGemini(args: StreamArgs & { fallbacks?: string[] | undefined }): Promise<string> {
  const chain = [args.model, ...(args.fallbacks ?? [])];
  let lastError: unknown;
  for (const model of chain) {
    try {
      return await streamOnce({ ...args, model });
    } catch (error) {
      lastError = error;
      const status = error instanceof GeminiError ? error.status : 0;
      const retryable = status === 429 || status === 503 || status === 500;
      if (!retryable) throw error;
    }
  }
  throw lastError;
}

export async function validateKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`);
  return res.ok;
}
