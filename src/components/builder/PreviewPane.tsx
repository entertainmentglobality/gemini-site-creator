import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Monitor, RefreshCw, Smartphone, Tablet, Terminal, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPreview, htmlPages } from "@/lib/builder/preview";
import type { BuildMode } from "@/lib/builder/prompt";

type Device = "mobile" | "tablet" | "desktop";
const WIDTHS: Record<Device, string> = {
  mobile: "390px",
  tablet: "820px",
  desktop: "100%",
};

export interface LogEntry {
  level: string;
  message: string;
}

export function PreviewPane({
  files,
  mode,
  onFix,
  busy,
}: {
  files: Record<string, string>;
  mode: BuildMode;
  onFix: (errors: string[]) => void;
  busy: boolean;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState("index.html");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const pages = htmlPages(files);
  const srcDoc = useMemo(
    () => buildPreview(files, mode, page),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, mode, page, nonce],
  );

  useEffect(() => {
    setLogs([]);
  }, [srcDoc]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object" || !data.__atlas) return;
      if (data.navigate) {
        const target = String(data.navigate).replace(/^\.?\//, "");
        if (files[target] !== undefined) setPage(target);
        return;
      }
      setLogs((prev) => [...prev.slice(-99), { level: data.level, message: data.message }]);
      if (data.level === "error") setShowConsole(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [files]);

  const written = Object.keys(files);
  const showOverlay = busy && written.length < 2;
  const steps = [
    { label: "Understanding your idea", done: true },
    { label: "Choosing the right stack", done: elapsed > 2 },
    { label: "Designing the interface", done: elapsed > 6 || written.length > 0 },
    { label: "Writing the code", done: written.length > 0 },
  ];

  const errors = logs.filter((l) => l.level === "error").map((l) => l.message);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex rounded-md border border-border">
          {(["mobile", "tablet", "desktop"] as Device[]).map((d) => {
            const Icon = d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Monitor;
            return (
              <button
                key={d}
                onClick={() => setDevice(d)}
                aria-label={d}
                className={`px-2 py-1.5 transition-colors ${
                  device === d ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>

        {mode !== "react" && pages.length > 1 && (
          <select
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs"
          >
            {pages.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1">
          {errors.length > 0 && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onFix(errors)}>
              <Wrench className="size-3.5" /> Fix {errors.length} error
              {errors.length > 1 ? "s" : ""}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Console"
            onClick={() => setShowConsole((v) => !v)}
          >
            <Terminal className={`size-4 ${errors.length ? "text-destructive" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Reload preview"
            onClick={() => setNonce((n) => n + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 justify-center overflow-auto bg-background p-3">
        {showOverlay && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/95 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Your website is being created…</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {elapsed}s elapsed · usually 20–60s for a full build
              </p>
              <ul className="mt-5 space-y-2 text-left text-sm">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    {s.done ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    <span className={s.done ? "text-foreground" : "text-muted-foreground"}>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(95, 8 + elapsed * 4)}%` }}
                />
              </div>
            </div>
          </div>
        )}
        <iframe
          ref={frameRef}
          title="Preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className="h-full rounded-md border border-border bg-white"
          style={{ width: WIDTHS[device], maxWidth: "100%" }}
        />
      </div>

      {showConsole && (
        <div className="atlas-scroll h-40 shrink-0 overflow-y-auto border-t border-border bg-card">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            Console
            <button onClick={() => setShowConsole(false)} aria-label="Close console">
              <X className="size-3.5" />
            </button>
          </div>
          <ul className="p-2 font-mono text-[11px]">
            {logs.length === 0 && <li className="text-muted-foreground">No output</li>}
            {logs.map((l, i) => (
              <li
                key={i}
                className={
                  l.level === "error"
                    ? "text-destructive"
                    : l.level === "warn"
                      ? "text-primary"
                      : "text-muted-foreground"
                }
              >
                {l.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
