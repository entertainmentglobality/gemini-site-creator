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
import { GEMINI_MODELS, validateKey } from "@/lib/builder/gemini";
import { whoAmI } from "@/lib/builder/github";
import { useBuilder } from "@/lib/builder/store";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { apiKey, model, githubToken, setKey, setModel, setGithub } = useBuilder();
  const [key, setLocalKey] = useState(apiKey);
  const [token, setToken] = useState(githubToken);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (key && key !== apiKey) {
        const ok = await validateKey(key);
        if (!ok) {
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
            <div className="grid gap-2">
              {GEMINI_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    model === m.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
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
