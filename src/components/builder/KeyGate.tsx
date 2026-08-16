import { useState } from "react";
import { KeyRound, Sparkles, Github, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateKey } from "@/lib/builder/gemini";
import { useBuilder } from "@/lib/builder/store";

export function KeyGate() {
  const setKey = useBuilder((s) => s.setKey);
  const setProvider = useBuilder((s) => s.setProvider);
  const setOnboarded = useBuilder((s) => s.setOnboarded);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    const ok = await validateKey(value.trim()).catch(() => false);
    setBusy(false);
    if (!ok) {
      setError("Google rejected that key. Check it and try again.");
      return;
    }
    setKey(value.trim());
    setProvider("gemini");
    setOnboarded(true);
  };

  return (
    <main className="hero-glow flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Atlas</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Describe a website. Get a real one — previewed, editable, and published to GitHub
            Pages for free. Bring your own Gemini key, or use the built-in Atlas AI.
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-3 p-5">
          <label htmlFor="key" className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-primary" /> Paste your Gemini API key
          </label>
          <Input
            id="key"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza…"
            className="font-mono"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking key…" : "Start building with my key"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setProvider("atlas");
              setOnboarded(true);
            }}
          >
            <Zap className="size-4" /> Or start free with built-in Atlas AI
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Stored in this browser only.{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Get a free key
            </a>
          </p>
        </form>

        <ul className="mt-8 grid gap-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <Zap className="size-4 text-accent" /> Landing pages, apps, games, dashboards, docs
          </li>
          <li className="flex items-center gap-3">
            <Github className="size-4 text-accent" /> One-click publish to your own GitHub Pages
          </li>
          <li className="flex items-center gap-3">
            <Sparkles className="size-4 text-accent" /> Edit code by hand — the agent keeps your
            changes
          </li>
        </ul>
      </div>
    </main>
  );
}
