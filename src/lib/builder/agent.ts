import { streamBackend } from "./backend";
import { GeminiError, streamGemini, type GeminiTurn } from "./gemini";
import {
  ENHANCER_PROMPT,
  classifyMode,
  projectContext,
  resolveMode,
  systemPrompt,
  type BuildMode,
} from "./prompt";
import { humanText, isTruncated, parseActions, streamingWrites, streamProgress } from "./protocol";
import { uid, useBuilder } from "./store";

function friendlyError(error: unknown) {
  if (error instanceof GeminiError) {
    if (error.status === 429)
      return "Gemini free-tier rate limit hit. Wait a minute, or switch to a lighter model in Settings.";
    if (error.status === 400 && /API key/i.test(error.message))
      return "That Gemini API key was rejected. Open Settings and paste a valid key.";
    if (error.status === 403) return "This key is not allowed to use that model. Try Flash.";
    return `Gemini error (${error.status}): ${error.message}`;
  }
  if (error instanceof DOMException && error.name === "AbortError") return "Stopped.";
  return error instanceof Error ? error.message : String(error);
}

function history(mode: BuildMode, files: Record<string, string>): GeminiTurn[] {
  const state = useBuilder.getState();
  const project = state.projects.find((p) => p.id === state.activeId);
  const past = (project?.messages ?? [])
    .filter((m) => !m.error && m.text.trim())
    .slice(-8)
    .map<GeminiTurn>((m) => ({
      role: m.role === "user" ? "user" : "model",
      text: m.role === "user" ? m.text : `<lov-message>${m.text}</lov-message>`,
    }));
  void mode;
  return [{ role: "user", text: projectContext(files) }, ...past];
}

interface StreamArgs {
  system: string;
  history: GeminiTurn[];
  signal?: AbortSignal | undefined;
  temperature?: number | undefined;
  onDelta: (chunk: string) => void;
}

/** Routes a completion to the free Atlas backend or the user's own Gemini key. */
async function stream(args: StreamArgs) {
  const state = useBuilder.getState();
  if (state.provider === "atlas") {
    return streamBackend({ base: state.backendUrl, ...args });
  }
  if (!state.apiKey) throw new Error("Add your Gemini API key first, or switch to Atlas AI.");
  return streamGemini({ apiKey: state.apiKey, models: state.models, ...args });
}

export interface RunOptions {
  instruction: string;
  signal?: AbortSignal | undefined;
  silentUser?: boolean | undefined;
}

export async function runAgent({ instruction, signal, silentUser }: RunOptions) {
  const state = useBuilder.getState();
  const project = state.projects.find((p) => p.id === state.activeId);
  if (!project) return;
  if (state.provider === "gemini" && !state.apiKey)
    throw new Error("Add your Gemini API key first, or switch to Atlas AI in Settings.");

  if (!silentUser) {
    state.addMessage({ id: uid(), role: "user", text: instruction });
  }
  const msgId = uid();
  state.addMessage({ id: msgId, role: "assistant", text: "", streaming: true });
  state.snapshot(instruction.slice(0, 60));

  const hasFiles = Object.keys(project.files).length > 0;
  const resolved =
    project.mode === "auto"
      ? hasFiles
        ? resolveMode(project.mode, project.files)
        : classifyMode(instruction)
      : project.mode;

  let raw = "";
  const streamedFiles = new Map<string, string>();
  const applyStream = (delta: string) => {
    raw += delta;
    const progress = streamProgress(raw);
    for (const action of streamingWrites(raw)) {
      const previous = streamedFiles.get(action.path) ?? "";
      const isComplete = raw.includes(`</lov-write>`);
      if (previous === action.content || (!isComplete && action.content.length - previous.length < 400))
        continue;
      streamedFiles.set(action.path, action.content);
      useBuilder.getState().writeFile(action.path, action.content);
    }
    const label = progress.writing ? `Writing ${progress.writing}…` : humanText(raw) || "Thinking…";
    useBuilder.getState().patchMessage(msgId, { text: label, touched: progress.done });
  };

  const base = [
    ...history(project.mode, project.files),
    { role: "user" as const, text: instruction },
  ];

  try {
    await stream({
      system: systemPrompt(project.mode, resolved),
      history: base,
      signal,
      onDelta: applyStream,
    });

    // Long builds get cut off by output limits — ask for a seamless continuation.
    for (let attempt = 0; attempt < 3 && isTruncated(raw) && !signal?.aborted; attempt++) {
      const tail = raw.slice(-4000);
      await stream({
        system: systemPrompt(project.mode, resolved),
        history: [
          ...base,
          { role: "model" as const, text: tail },
          {
            role: "user" as const,
            text: "Your last response was cut off mid-file. Continue EXACTLY where it stopped — output only the remaining raw characters, no preamble, no repetition, no restating the opening tag. Then finish the remaining files and close with <lov-message>.",
          },
        ],
        signal,
        onDelta: applyStream,
      });
    }
  } catch (error) {
    useBuilder
      .getState()
      .patchMessage(msgId, { text: friendlyError(error), streaming: false, error: true });
    return;
  }

  const actions = parseActions(raw);
  const touched = useBuilder.getState().applyActions(actions);
  const plan = actions.find((a) => a.kind === "plan");
  const modeAction = actions.find((a) => a.kind === "mode");
  const nameAction = actions.find((a) => a.kind === "name");
  if (modeAction?.kind === "mode" && ["single", "static", "react"].includes(modeAction.mode)) {
    useBuilder.getState().setMode(modeAction.mode as BuildMode);
  } else if (project.mode === "auto" && touched.length) {
    useBuilder.getState().setMode(resolveMode("auto", useBuilder.getState().projects.find((p) => p.id === project.id)?.files ?? {}));
  }
  if (nameAction?.kind === "name" && nameAction.name) {
    useBuilder.getState().renameProject(project.id, nameAction.name.slice(0, 60));
  }
  const message = actions.find((a) => a.kind === "message");

  useBuilder.getState().patchMessage(msgId, {
    streaming: false,
    touched,
    ...(plan?.kind === "plan" ? { plan: plan.steps } : {}),
    text:
      (message?.kind === "message" ? message.text : humanText(raw)) ||
      (touched.length
        ? `Built ${touched.length} file${touched.length === 1 ? "" : "s"}. The live preview is ready.`
        : "I couldn't extract a complete website from that response. Please retry, or switch AI engine in Settings."),
  });
}

export async function enhancePrompt(idea: string) {
  let out = "";
  await stream({
    system: ENHANCER_PROMPT,
    history: [{ role: "user", text: idea }],
    temperature: 1,
    onDelta: (d) => {
      out += d;
    },
  });
  return out.trim();
}

export async function repairFromErrors(errors: string[]) {
  const instruction = `The live preview reported these runtime errors. Fix the cause in the code, then briefly say what you fixed.\n\n${errors
    .slice(-5)
    .join("\n")}`;
  await runAgent({ instruction, silentUser: false });
}
