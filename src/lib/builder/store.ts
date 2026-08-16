import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BuildMode } from "./prompt";
import type { AgentAction } from "./protocol";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: string[];
  touched?: string[];
  error?: boolean;
  streaming?: boolean;
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
  repo?: string;
  publishedUrl?: string;
}

interface BuilderState {
  apiKey: string;
  model: string;
  githubToken: string;
  githubUser: string;
  projects: Project[];
  activeId: string | null;
  activeFile: string | null;

  setKey: (key: string) => void;
  setModel: (model: string) => void;
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
      apiKey: "",
      model: "gemini-2.5-flash",
      githubToken: "",
      githubUser: "",
      projects: [],
      activeId: null,
      activeFile: null,

      setKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
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
        const active = get().activeFile;
        if (touched.length && (!active || !get().activeProjectFiles()[active])) {
          set({ activeFile: touched[0] });
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
      // helper (not part of the public surface)
      activeProjectFiles: () => {
        const s = get();
        return s.projects.find((p) => p.id === s.activeId)?.files ?? {};
      },
    }) as BuilderState & { activeProjectFiles: () => Record<string, string> },
    {
      name: "atlas-builder",
      partialize: (s) => ({
        apiKey: s.apiKey,
        model: s.model,
        githubToken: s.githubToken,
        githubUser: s.githubUser,
        projects: s.projects,
        activeId: s.activeId,
      }),
    },
  ),
);

export function useActiveProject(): Project | null {
  return useBuilder((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
}
