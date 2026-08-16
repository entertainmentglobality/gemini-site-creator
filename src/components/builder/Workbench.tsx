import { useRef, useState } from "react";
import {
  ChevronLeft,
  Code2,
  Download,
  History,
  MessageSquare,
  Rocket,
  Settings,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { runAgent, repairFromErrors } from "@/lib/builder/agent";
import { downloadZip } from "@/lib/builder/exporter";
import { MODE_LABELS } from "@/lib/builder/prompt";
import { useBuilder, type Project } from "@/lib/builder/store";
import { ChatPanel } from "./ChatPanel";
import { CodePane } from "./CodePane";
import { PreviewPane } from "./PreviewPane";
import { PublishDialog } from "./PublishDialog";

type View = "chat" | "code" | "preview";

export function Workbench({
  project,
  onHome,
  onSettings,
}: {
  project: Project;
  onHome: () => void;
  onSettings: () => void;
}) {
  const { activeFile, renameProject, restore } = useBuilder();
  const [view, setView] = useState<View>("preview");
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = async (text: string) => {
    setBusy(true);
    abortRef.current = new AbortController();
    setView("preview");
    try {
      await runAgent({ instruction: text, signal: abortRef.current.signal });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const fix = async (errors: string[]) => {
    setBusy(true);
    try {
      await repairFromErrors(errors);
    } finally {
      setBusy(false);
    }
  };

  const panelClass = (v: View) =>
    `${view === v ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onHome} aria-label="Back to projects">
          <ChevronLeft className="size-4" />
        </Button>
        <input
          value={project.name}
          onChange={(e) => renameProject(project.id, e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:text-primary"
        />
        <span className="hidden rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground sm:block">
          {MODE_LABELS[project.mode]}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Version history">
              <History className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            {project.versions.length === 0 && (
              <DropdownMenuItem disabled>No snapshots yet</DropdownMenuItem>
            )}
            {project.versions.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => {
                  restore(v.id);
                  toast.success("Restored earlier version");
                }}
              >
                <span className="truncate">{v.label || "Snapshot"}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {new Date(v.at).toLocaleTimeString()}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Download ZIP"
          onClick={() => downloadZip(project.name, project.files)}
        >
          <Download className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Settings">
          <Settings className="size-4" />
        </Button>
        <Button size="sm" onClick={() => setPublishOpen(true)}>
          <Rocket className="size-4" /> <span className="hidden sm:inline">Publish</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[340px_1fr_1fr]">
        <div className={`${panelClass("chat")} lg:border-r lg:border-border`}>
          <ChatPanel
            messages={project.messages}
            busy={busy}
            onSend={send}
            onStop={() => abortRef.current?.abort()}
          />
        </div>
        <div className={`${panelClass("code")} lg:border-r lg:border-border`}>
          <CodePane files={project.files} activeFile={activeFile} />
        </div>
        <div className={panelClass("preview")}>
          <PreviewPane files={project.files} mode={project.mode} onFix={fix} busy={busy} />
        </div>
      </div>

      <nav className="flex shrink-0 border-t border-border bg-sidebar lg:hidden">
        {(
          [
            ["chat", MessageSquare, "Chat"],
            ["code", Code2, "Code"],
            ["preview", Eye, "Preview"],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
              view === key ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <PublishDialog
        project={project}
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onNeedSettings={() => {
          setPublishOpen(false);
          onSettings();
        }}
      />
    </div>
  );
}
