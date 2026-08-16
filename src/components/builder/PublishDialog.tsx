import { useState } from "react";
import { ExternalLink, Github, Rocket } from "lucide-react";
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
import { publishToPages } from "@/lib/builder/github";
import { buildPreview } from "@/lib/builder/preview";
import { useBuilder, type Project } from "@/lib/builder/store";

export function PublishDialog({
  project,
  open,
  onOpenChange,
  onNeedSettings,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNeedSettings: () => void;
}) {
  const { githubToken, githubUser, setPublished } = useBuilder();
  const [domain, setDomain] = useState("");
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      const files =
        project.mode === "react"
          ? { ...project.files, "index.html": buildPreview(project.files, "react") }
          : project.files;
      const result = await publishToPages({
        token: githubToken,
        name: project.name,
        files,
        ...(domain.trim() ? { customDomain: domain.trim() } : {}),
        onStep: setStep,
      });
      setPublished(result.repo, result.url);
      toast.success("Published! GitHub Pages usually goes live in about a minute.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to GitHub Pages</DialogTitle>
          <DialogDescription>
            Creates (or updates) a repo in your account and deploys it with GitHub Actions. Free,
            forever.
          </DialogDescription>
        </DialogHeader>

        {!githubToken ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect a GitHub token first so Atlas can create the repository.
            </p>
            <Button className="w-full" onClick={onNeedSettings}>
              <Github className="size-4" /> Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <p className="text-muted-foreground">Will publish to</p>
              <p className="mt-1 break-all font-mono text-xs text-primary">
                {domain.trim()
                  ? `https://${domain.trim()}/`
                  : `https://${githubUser}.github.io/site-${project.name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}/`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Custom subdomain (optional)</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="shop.yourdomain.com"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Point a CNAME at {githubUser || "you"}.github.io first, then publish.
              </p>
            </div>

            <Button className="w-full" disabled={busy} onClick={publish}>
              <Rocket className="size-4" />
              {busy ? step || "Publishing…" : project.publishedUrl ? "Update site" : "Publish"}
            </Button>

            {project.publishedUrl && (
              <a
                href={project.publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm text-accent hover:underline"
              >
                <ExternalLink className="size-3.5" /> {project.publishedUrl}
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
