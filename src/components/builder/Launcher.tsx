import { useState } from "react";
import { ArrowUp, Settings, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { enhancePrompt } from "@/lib/builder/agent";
import { MODE_LABELS, type BuildMode } from "@/lib/builder/prompt";
import { useBuilder } from "@/lib/builder/store";
import { TEMPLATES } from "@/lib/builder/templates";

const MODES: BuildMode[] = ["single", "static", "react"];

export function Launcher({
  onStart,
  onSettings,
}: {
  onStart: (prompt: string, mode: BuildMode) => void;
  onSettings: () => void;
}) {
  const { projects, selectProject, deleteProject } = useBuilder();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<BuildMode>("static");
  const [enhancing, setEnhancing] = useState(false);

  const enhance = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      setPrompt(await enhancePrompt(prompt));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enhance prompt");
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <main className="hero-glow min-h-screen px-5 pb-24 pt-10 sm:pt-20">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-display text-lg font-bold">Atlas</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </header>

        <h1 className="text-balance text-center text-4xl font-bold sm:text-6xl">
          Build a website by describing it
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-center text-sm text-muted-foreground sm:text-base">
          Build with free Atlas AI or your own Gemini key. Preview every site here, edit its
          code, then publish free to GitHub Pages.
        </p>

        <div className="panel mt-10 p-3 shadow-[var(--shadow-panel)]">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim())
                onStart(prompt, mode);
            }}
            placeholder="A neon-lit arcade site for a retro game bar in Lisbon, with events, a menu and a booking form…"
            className="min-h-28 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
            <div className="flex flex-wrap gap-1">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    mode === m
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={enhance} disabled={enhancing}>
                <Wand2 className="size-4" />
                {enhancing ? "Enhancing…" : "Enhance"}
              </Button>
              <Button size="sm" disabled={!prompt.trim()} onClick={() => onStart(prompt, mode)}>
                Build <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Start from a template
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onStart(t.prompt, t.mode)}
                className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
              >
                <p className="font-display font-semibold group-hover:text-primary">{t.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        {projects.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Your projects
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 bg-card px-4 py-3">
                  <button
                    onClick={() => selectProject(p.id)}
                    className="flex-1 text-left text-sm hover:text-primary"
                  >
                    {p.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {Object.keys(p.files).length} files · {MODE_LABELS[p.mode]}
                    </span>
                  </button>
                  {p.publishedUrl && (
                    <a
                      href={p.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      live
                    </a>
                  )}
                  <button
                    onClick={() => deleteProject(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
