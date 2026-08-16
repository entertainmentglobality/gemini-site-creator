import { GeminiError, streamGemini, type GeminiTurn } from "./gemini";
import { ENHANCER_PROMPT, projectContext, systemPrompt, type BuildMode } from "./prompt";
import { humanText, parseActions, streamProgress } from "./protocol";
import { uid, useBuilder } from "./store";

const FALLBACKS: Record<string, string[]> = {
  "gemini-2.5-pro": ["gemini-2.5-flash", "gemini-2.0-flash"],
  "gemini-2.5-flash": ["gemini-2.0-flash"],
  "gemini-2.0-flash": [],
};

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

export interface RunOptions {
  instruction: string;
  signal?: AbortSignal;
  silentUser?: boolean;
}

export async function runAgent({ instruction, signal, silentUser }: RunOptions) {
  const state = useBuilder.getState();
  const project = state.projects.find((p) => p.id === state.activeId);
  if (!project) return;
  if (!state.apiKey) throw new Error("Add your Gemini API key first.");

  if (!silentUser) {
    state.addMessage({ id: uid(), role: "user", text: instruction });
  }
  const msgId = uid();
  state.addMessage({ id: msgId, role: "assistant", text: "", streaming: true });
  state.snapshot(instruction.slice(0, 60));

  let raw = "";
  try {
    await streamGemini({
      apiKey: state.apiKey,
      model: state.model,
      fallbacks: FALLBACKS[state.model] ?? [],
      system: systemPrompt(project.mode),
      history: [...history(project.mode, project.files), { role: "user", text: instruction }],
      signal,
      onDelta: (delta) => {
        raw += delta;
        const progress = streamProgress(raw);
        const label = progress.writing
          ? `Writing ${progress.writing}…`
          : humanText(raw) || "Thinking…";
        useBuilder.getState().patchMessage(msgId, { text: label, touched: progress.done });
      },
    });
  } catch (error) {
    useBuilder
      .getState()
      .patchMessage(msgId, { text: friendlyError(error), streaming: false, error: true });
    return;
  }

  const actions = parseActions(raw);
  const touched = useBuilder.getState().applyActions(actions);
  const plan = actions.find((a) => a.kind === "plan");
  const message = actions.find((a) => a.kind === "message");

  useBuilder.getState().patchMessage(msgId, {
    streaming: false,
    touched,
    plan: plan?.kind === "plan" ? plan.steps : undefined,
    text:
      (message?.kind === "message" ? message.text : humanText(raw)) ||
      (touched.length ? `Updated ${touched.length} file(s).` : "Done."),
  });
}

export async function enhancePrompt(idea: string) {
  const { apiKey, model } = useBuilder.getState();
  let out = "";
  await streamGemini({
    apiKey,
    model,
    fallbacks: FALLBACKS[model] ?? [],
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
