import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BuildMode, Speed } from "./prompt";
import type { AgentAction } from "./protocol";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: string[] | undefined;
  touched?: string[] | undefined;
  error?: boolean | undefined;
  streaming?: boolean | undefined;
}

export interface Version {
  id: string;
  label: string;
  at: number;
  files: Record<string, string>;
}

export interface Project {
  id: string;
  name: string;
  mode: BuildMode;
  files: Record<string, string>;
  messages: ChatMessage[];
  versions: Version[];
  createdAt: number;
  repo?: string | undefined;
  publishedUrl?: string | undefined;
}

export type Provider = "atlas" | "gemini";
export type PublishTarget = "hub" | "repo";

interface BuilderState {
  onboarded: boolean;
  provider: Provider;
  speed: Speed;
  backendUrl: string;
  publishTarget: PublishTarget;
  hubDomain: string;
  apiKey: string;
  model: string;
  models: string[];
  githubToken: string;
  githubUser: string;
  projects: Project[];
  activeId: string | null;
  activeFile: string | null;

  setOnboarded: (v: boolean) => void;
  setProvider: (provider: Provider) => void;
  setSpeed: (speed: Speed) => void;
  setBackendUrl: (url: string) => void;
  setPublishTarget: (target: PublishTarget) => void;
  setHubDomain: (domain: string) => void;
  setKey: (key: string) => void;
  setModel: (model: string) => void;
  setModels: (models: string[]) => void;
  setGithub: (token: string, user: string) => void;

  createProject: (name: string, mode: BuildMode, files?: Record<string, string>) => string;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setMode: (mode: BuildMode) => void;
  setActiveFile: (path: string | null) => void;

  writeFile: (path: string, content: string) => void;
  removeFile: (path: string) => void;
  applyActions: (actions: AgentAction[]) => string[];

  addMessage: (msg: ChatMessage) => void;
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;

  snapshot: (label: string) => void;
  restore: (versionId: string) => void;
  setPublished: (repo: string, url: string) => void;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

function updateActive(state: BuilderState, fn: (p: Project) => Project): Partial<BuilderState> {
  return {
    projects: state.projects.map((p) => (p.id === state.activeId ? fn(p) : p)),
  };
}

export const useBuilder = create<BuilderState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      provider: "atlas",
      speed: "pro",
      backendUrl: "",
      publishTarget: "hub",
      hubDomain: "",
      apiKey: "",
      model: "auto",
      models: [],
      githubToken: "",
      githubUser: "",
      projects: [],
      activeId: null,
      activeFile: null,

      setOnboarded: (onboarded) => set({ onboarded }),
      setProvider: (provider) => set({ provider }),
      setSpeed: (speed) => set({ speed }),
      setBackendUrl: (backendUrl) => set({ backendUrl }),
      setPublishTarget: (publishTarget) => set({ publishTarget }),
      setHubDomain: (hubDomain) => set({ hubDomain }),
      setKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setModels: (models) => set({ models }),
      setGithub: (githubToken, githubUser) => set({ githubToken, githubUser }),

      createProject: (name, mode, files = {}) => {
        const id = uid();
        const project: Project = {
          id,
          name,
          mode,
          files,
          messages: [],
          versions: [],
          createdAt: Date.now(),
        };
        set((s) => ({
          projects: [project, ...s.projects],
          activeId: id,
          activeFile: Object.keys(files)[0] ?? null,
        }));
        return id;
      },
      deleteProject: (id) =>
        set((s) => {
          const projects = s.projects.filter((p) => p.id !== id);
          return {
            projects,
            activeId: s.activeId === id ? (projects[0]?.id ?? null) : s.activeId,
          };
        }),
      selectProject: (id) =>
        set((s) => ({
          activeId: id,
          activeFile: Object.keys(s.projects.find((p) => p.id === id)?.files ?? {})[0] ?? null,
        })),
      renameProject: (id, name) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) })),
      setMode: (mode) => set((s) => updateActive(s, (p) => ({ ...p, mode }))),
      setActiveFile: (activeFile) => set({ activeFile }),

      writeFile: (path, content) =>
        set((s) => updateActive(s, (p) => ({ ...p, files: { ...p.files, [path]: content } }))),
      removeFile: (path) =>
        set((s) =>
          updateActive(s, (p) => {
            const files = { ...p.files };
            delete files[path];
            return { ...p, files };
          }),
        ),

      applyActions: (actions) => {
        const touched: string[] = [];
        set((s) =>
          updateActive(s, (p) => {
            const files = { ...p.files };
            for (const action of actions) {
              if (action.kind === "write") {
                files[action.path] = action.content;
                touched.push(action.path);
              } else if (action.kind === "delete") {
                delete files[action.path];
                touched.push(action.path);
              } else if (action.kind === "edit") {
                const current = files[action.path];
                if (current !== undefined && current.includes(action.find)) {
                  files[action.path] = current.replace(action.find, action.replace);
                  touched.push(action.path);
                }
              }
            }
            return { ...p, files };
          }),
        );
        const state = get();
        const files = state.projects.find((p) => p.id === state.activeId)?.files ?? {};
        const active = state.activeFile;
        if (touched.length && (!active || files[active] === undefined)) {
          set({ activeFile: touched[0] ?? null });
        }
        return [...new Set(touched)];
      },

      addMessage: (msg) =>
        set((s) => updateActive(s, (p) => ({ ...p, messages: [...p.messages, msg] }))),
      patchMessage: (id, patch) =>
        set((s) =>
          updateActive(s, (p) => ({
            ...p,
            messages: p.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          })),
        ),
      clearChat: () => set((s) => updateActive(s, (p) => ({ ...p, messages: [] }))),

      snapshot: (label) =>
        set((s) =>
          updateActive(s, (p) => ({
            ...p,
            versions: [
              { id: uid(), label, at: Date.now(), files: { ...p.files } },
              ...p.versions,
            ].slice(0, 25),
          })),
        ),
      restore: (versionId) =>
        set((s) =>
          updateActive(s, (p) => {
            const version = p.versions.find((v) => v.id === versionId);
            return version ? { ...p, files: { ...version.files } } : p;
          }),
        ),
      setPublished: (repo, url) =>
        set((s) => updateActive(s, (p) => ({ ...p, repo, publishedUrl: url }))),
    }),
    {
      name: "atlas-builder",
      partialize: (s) => ({
        onboarded: s.onboarded,
        provider: s.provider,
        speed: s.speed,
        backendUrl: s.backendUrl,
        publishTarget: s.publishTarget,
        hubDomain: s.hubDomain,
        apiKey: s.apiKey,
        model: s.model,
        models: s.models,
        githubToken: s.githubToken,
        githubUser: s.githubUser,
        projects: s.projects,
        activeId: s.activeId,
      }),
    },
  ),
);

export function useReady(): boolean {
  return useBuilder((s) => s.onboarded || Boolean(s.apiKey));
}

export function useActiveProject(): Project | null {
  return useBuilder((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
}
