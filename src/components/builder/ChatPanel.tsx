import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileCode2, Loader2, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { enhancePrompt } from "@/lib/builder/agent";
import type { ChatMessage } from "@/lib/builder/store";

export function ChatPanel({
  messages,
  busy,
  onSend,
  onStop,
}: {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!value.trim() || busy) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="atlas-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-secondary px-3 py-2">
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%] space-y-2">
              {m.plan && m.plan.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                  {m.plan.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              )}
              <p
                className={`whitespace-pre-wrap text-sm ${
                  m.error ? "text-destructive" : "text-foreground"
                }`}
              >
                {m.streaming && <Loader2 className="mr-2 inline size-3.5 animate-spin" />}
                {m.text || "Thinking…"}
              </p>
              {m.touched && m.touched.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.touched.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      <FileCode2 className="size-3 text-primary" />
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="rounded-lg border border-border bg-card p-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask for a change…"
            className="min-h-16 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!value.trim() || enhancing || busy}
              onClick={async () => {
                setEnhancing(true);
                try {
                  setValue(await enhancePrompt(value));
                } finally {
                  setEnhancing(false);
                }
              }}
            >
              <Wand2 className="size-4" />
            </Button>
            {busy ? (
              <Button size="sm" variant="secondary" onClick={onStop}>
                <Square className="size-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" disabled={!value.trim()} onClick={send}>
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
