import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { FileCode2, Trash2 } from "lucide-react";
import { useBuilder } from "@/lib/builder/store";

function langFor(path: string) {
  if (path.endsWith(".css")) return [css()];
  if (/\.(jsx|tsx|js|ts)$/.test(path)) return [javascript({ jsx: true, typescript: true })];
  return [html()];
}

export function CodePane({
  files,
  activeFile,
}: {
  files: Record<string, string>;
  activeFile: string | null;
}) {
  const { setActiveFile, writeFile, removeFile } = useBuilder();
  const paths = Object.keys(files).sort();
  const current = activeFile && files[activeFile] !== undefined ? activeFile : (paths[0] ?? null);

  return (
    <div className="flex h-full min-h-0">
      <aside className="atlas-scroll w-48 shrink-0 overflow-y-auto border-r border-border bg-sidebar p-2">
        {paths.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">No files yet</p>
        )}
        {paths.map((p) => (
          <div key={p} className="group flex items-center">
            <button
              onClick={() => setActiveFile(p)}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-left font-mono text-[11px] transition-colors ${
                current === p
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FileCode2 className="size-3 shrink-0" />
              <span className="truncate">{p}</span>
            </button>
            <button
              onClick={() => removeFile(p)}
              aria-label={`Delete ${p}`}
              className="hidden px-1 text-muted-foreground hover:text-destructive group-hover:block"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-hidden">
        {current ? (
          <CodeMirror
            value={files[current] ?? ""}
            height="100%"
            theme={vscodeDark}
            extensions={langFor(current)}
            onChange={(v) => writeFile(current, v)}
            style={{ height: "100%", fontSize: 13 }}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Files will appear here
          </div>
        )}
      </div>
    </div>
  );
}
