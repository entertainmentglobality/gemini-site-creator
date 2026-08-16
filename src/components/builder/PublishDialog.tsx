import { useState } from "react";
import { ExternalLink, Github, Globe, Rocket } from "lucide-react";
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
import { publishToHub, publishToPages, slugify } from "@/lib/builder/github";
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
  const {
    githubToken,
    githubUser,
    publishTarget,
    setPublishTarget,
    hubDomain,
    setHubDomain,
    setPublished,
  } = useBuilder();
  const [domain, setDomain] = useState("");
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);

  const slug = slugify(project.name);
  const hubHost = hubDomain.trim() || `${githubUser}.github.io`;
  const target =
    publishTarget === "hub"
      ? `https://${hubHost}/s/${slug}/`
      : domain.trim()
        ? `https://${domain.trim()}/`
        : `https://${githubUser}.github.io/site-${slug}/`;

  const publish = async () => {
    setBusy(true);
    try {
      const files =
        project.mode === "react"
          ? { ...project.files, "index.html": buildPreview(project.files, "react") }
          : project.files;
      const result =
        publishTarget === "hub"
          ? await publishToHub({
              token: githubToken,
              name: project.name,
              files,
              ...(hubDomain.trim() ? { hubDomain: hubDomain.trim() } : {}),
              onStep: setStep,
            })
          : await publishToPages({
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
          <DialogTitle>Publish</DialogTitle>
          <DialogDescription>
            Deployed to GitHub Pages from your own account with GitHub Actions. Free, forever, and
            fully yours — the repo works without Atlas.
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
            <div className="grid gap-2">
              {(
                [
                  {
                    id: "hub" as const,
                    title: "Site hub (unlimited)",
                    body: "Every site gets its own address under one free hub repo, with an index page listing them all.",
                  },
                  {
                    id: "repo" as const,
                    title: "Its own repository",
                    body: "One dedicated repo per site — best when you want to hand the project to someone else.",
                  },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  onClick={() => setPublishTarget(option.id)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    publishTarget === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">{option.title}</p>
                  <p className="text-xs text-muted-foreground">{option.body}</p>
                </button>
              ))}
            </div>

            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <p className="text-muted-foreground">Will publish to</p>
              <p className="mt-1 break-all font-mono text-xs text-primary">{target}</p>
            </div>

            {publishTarget === "hub" ? (
              <div className="space-y-2">
                <Label htmlFor="hubdomain">
                  <Globe className="mr-1 inline size-3.5" /> Your domain (optional)
                </Label>
                <Input
                  id="hubdomain"
                  value={hubDomain}
                  onChange={(e) => setHubDomain(e.target.value)}
                  placeholder="hubup.online"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Point it at {githubUser || "you"}.github.io and every site becomes{" "}
                  <span className="font-mono">{hubHost}/s/name/</span>.
                </p>
              </div>
            ) : (
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
            )}

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
