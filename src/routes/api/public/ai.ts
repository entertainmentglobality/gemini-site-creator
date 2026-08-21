import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/ai")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: () =>
        new Response(JSON.stringify({ ok: true, provider: "atlas" }), {
          headers: { "content-type": "application/json", ...CORS },
        }),
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response(JSON.stringify({ error: "Atlas AI is not configured here." }), {
            status: 503,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: {
          system?: string;
          messages?: { role: string; content: string }[];
          model?: string;
          max_tokens?: number;
          temperature?: number;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const messages = Array.isArray(payload.messages) ? payload.messages.slice(-24) : [];
        if (!messages.length) {
          return new Response(JSON.stringify({ error: "messages required" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: payload.model ?? "google/gemini-3.7-flash",
            stream: true,
            temperature: payload.temperature ?? 0.8,
            max_tokens: Math.min(Math.max(Number(payload.max_tokens) || 24000, 1000), 32000),
            messages: [
              ...(payload.system ? [{ role: "system", content: payload.system }] : []),
              ...messages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: String(m.content ?? ""),
              })),
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          console.error(`Atlas AI upstream failed [${upstream.status}]: ${text}`);
          return new Response(JSON.stringify({ error: text || "Upstream error" }), {
            status: upstream.status || 502,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            ...CORS,
          },
        });
      },
    },
  },
});
