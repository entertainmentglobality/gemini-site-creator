import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KeyGate } from "@/components/builder/KeyGate";
import { Launcher } from "@/components/builder/Launcher";
import { SettingsDialog } from "@/components/builder/SettingsDialog";
import { Workbench } from "@/components/builder/Workbench";
import { runAgent } from "@/lib/builder/agent";
import type { BuildMode } from "@/lib/builder/prompt";
import { useActiveProject, useBuilder, useReady } from "@/lib/builder/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atlas — Prompt to website, published free on GitHub Pages" },
      {
        name: "description",
        content:
          "Describe a website and Atlas builds it with your own Gemini key: live preview, editable code, and one-click publishing to GitHub Pages.",
      },
      { property: "og:title", content: "Atlas — Prompt to website" },
      {
        property: "og:description",
        content:
          "An AI website builder that runs in your browser on your Gemini key and publishes to your GitHub Pages for free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ready = useReady();
  const createProject = useBuilder((s) => s.createProject);
  const selectProject = useBuilder((s) => s.selectProject);
  const project = useActiveProject();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="hero-glow grid min-h-screen place-items-center">
        <p className="text-sm text-muted-foreground">Loading Atlas…</p>
      </div>
    );
  }

  if (!ready) return <KeyGate />;

  const start = (prompt: string, mode: BuildMode) => {
    const name = (prompt.split(/[.!?\n]/)[0] ?? "").slice(0, 42) || "New site";
    createProject(name, mode);
    void runAgent({ instruction: prompt });
  };

  return (
    <>
      {project ? (
        <Workbench
          project={project}
          onHome={() => selectProject("")}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <Launcher onStart={start} onSettings={() => setSettingsOpen(true)} />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
