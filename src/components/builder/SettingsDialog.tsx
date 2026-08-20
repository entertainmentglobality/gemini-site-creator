import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { discoverModels } from "@/lib/builder/gemini";
import { whoAmI } from "@/lib/builder/github";
import { useBuilder } from "@/lib/builder/store";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    apiKey,
    models,
    githubToken,
    provider,
    setProvider,
    backendUrl,
    setBackendUrl,
    setKey,
    setModels,
    setGithub,
  } = useBuilder();
  const [key, setLocalKey] = useState(apiKey);
  const [token, setToken] = useState(githubToken);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (key && key !== apiKey) {
        try {
          const chain = await discoverModels(key);
          setModels(chain);
          toast.success(`Gemini connected — using ${chain[0]}`);
        } catch {
          toast.error("Gemini rejected that key.");
          return;
        }
      }
      setKey(key);
      if (token) {
        const login = await whoAmI(token).catch(() => "");
        if (!login) {
          toast.error("GitHub rejected that token.");
          return;
        }
        setGithub(token, login);
        toast.success(`GitHub connected as ${login}`);
      } else {
        setGithub("", "");
      }
      toast.success("Settings saved");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Keys are stored in this browser only and never leave your device except to call
            Google and GitHub directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>AI engine</Label>
            <div className="grid gap-2">
              {[
                {
                  id: "atlas" as const,
                  label: "Atlas AI (free, built in — no key needed)",
                },
                { id: "gemini" as const, label: "My own Gemini key (unlimited, your quota)" },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setProvider(option.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    provider === option.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {provider === "atlas" ? (
            <div className="space-y-2">
              <Label htmlFor="backend">Atlas AI backend URL (optional)</Label>
              <Input
                id="backend"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="https://your-atlas.lovable.app"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use this site&apos;s own backend. Set it when Atlas runs on GitHub
                Pages and should call your hosted backend instead.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="gemini">Gemini API key</Label>
            <Input
              id="gemini"
              type="password"
              value={key}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="AIza…"
              className="font-mono"
            />
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Get a free key at Google AI Studio →
            </a>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Automatic. Atlas detects the newest Gemini models your key can use and falls back
              down the list on any error.
              {models.length ? (
                <span className="mt-1 block font-mono text-[11px] text-primary">
                  {models.slice(0, 4).join(" → ")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gh">GitHub token (for publishing)</Label>
            <Input
              id="gh"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Classic token with <code className="text-primary">repo</code> +{" "}
              <code className="text-primary">workflow</code> scope, or a fine-grained token with
              Contents, Pages and Workflows write access.
            </p>
          </div>

          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "Checking…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
