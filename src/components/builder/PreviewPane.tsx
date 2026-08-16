import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, RefreshCw, Smartphone, Tablet, Terminal, Wrench, X } from "lucide-react";
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

      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-background p-3">
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
