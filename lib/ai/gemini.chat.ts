import { getGeminiClient, GEMINI_MODEL } from "./gemini.client";
import {
  buildWorkflowContext,
  getChatSystemInstruction,
} from "./chatPromptBuilder";
import { parseUnifiedResponse } from "./responseParser";
import { WorkflowPatch } from "./workflowPatcher";
import { WorkflowResponse } from "@/types/workflow";
import { buildStructuralContext, validatePatch } from "./compressedChatPromptBuilder";

export type ChatResult =
  | { mode: "answer"; answer: string; stage?: number }
  | { mode: "patch"; answer: string; patch: WorkflowPatch; stage?: number }

export async function askWorkflowChat(
  question: string,
  workflow: WorkflowResponse,
  originalPrompt: string,
  history: { role: string; content: string; patch?: WorkflowPatch }[] = [],
  useLessTokens: boolean = false
): Promise<ChatResult> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: getChatSystemInstruction(),
  });

  // ── History Preparation (Sliding Window: Last 10) ──────────────────────────
  const recentHistory = history.slice(-10);
  const historyContextStr = recentHistory.map(m => {
    if (m.role === "user") return `User: ${m.content}`;
    if (m.role === "patch") return `Assistant (Action): [Workflow Change Proposed] Summary: ${m.patch?.summary || m.content}`;
    return `Assistant: ${m.content}`;
  }).join("\n");

  const baseWorkflowContext = buildWorkflowContext(workflow, originalPrompt);

  /**
   * Helper function to execute a specific model call and parse/validate the patch.
   */
  async function attemptSelection(contextType: "compressed" | "full", feedback?: string): Promise<{ result: any; isValid: boolean; error?: string; prompt: string }> {
    const contextContent = contextType === "compressed"
      ? `Structural Nodes JSON (Compressed):\n${buildStructuralContext(workflow)}`
      : `Full Workflow JSON (High Precision):\n${JSON.stringify(workflow.nodes, null, 2)}`;

    const prompt = [
      baseWorkflowContext,
      "",
      "--- RECENT CHAT HISTORY (Last 10 turns) ---",
      historyContextStr || "No previous history.",
      "--- END HISTORY ---",
      "",
      contextContent,
      feedback ? `\nCRITICAL ERROR in previous attempt: ${feedback}\nPlease fix the node IDs or connections and output ONLY the corrected JSON.` : "",
      "",
      `User Request: "${question}"`,
      "",
      "Generate the required JSON response.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const unified = parseUnifiedResponse(result.response.text());

    if (unified.mode !== "patch" || !unified.patch) {
      return { result: unified, isValid: true, prompt }; // answers are inherently valid
    }

    const validation = validatePatch(unified.patch as WorkflowPatch, workflow);
    return { result: unified, isValid: validation.isValid, error: validation.error, prompt };
  }

  // ── FLOW SELECTION ────────────────────────────────────────────────────────

  if (useLessTokens) {
    // ── ECONOMICAL FLOW (Compressed -> Compressed+Error -> Full) ─────────────

    // Attempt 1: Compressed
    console.log("[AI Agent] Stage 1: Compressed (useLessTokens=true)");
    const stage1 = await attemptSelection("compressed");
    if (stage1.isValid) return { ...stage1.result, stage: 1 };

    // Attempt 2: Compressed + Feedback
    console.log("[AI Agent] Stage 2: Compressed + Feedback");
    const stage2 = await attemptSelection("compressed", stage1.error);
    if (stage2.isValid) return { ...stage2.result, stage: 2 };

    // Attempt 3: Full Context Fallback
    console.log("[AI Agent] Stage 3: Full Context Escalation");
    const stage3 = await attemptSelection("full", "Your previous compressed attempts failed. Use this full schema to fix it.");
    if (stage3.isValid) return { ...stage3.result, stage: 3 };

  } else {
    // ── PREMIUM FLOW (Full -> Full+Error) ───────────────────────────────────

    // Attempt 1: Full
    console.log("[AI Agent] Stage 1: Full (useLessTokens=false)");
    const stage1 = await attemptSelection("full");
    if (stage1.isValid) return { ...stage1.result, stage: 1 };

    // Attempt 2: Full + Feedback
    console.log("[AI Agent] Stage 2: Full + Feedback");
    const stage2 = await attemptSelection("full", stage1.error);
    if (stage2.isValid) return { ...stage2.result, stage: 2 };
  }

  // ── FINAL FALLBACK ────────────────────────────────────────────────────────
  console.error("[AI Agent] All escalation steps failed validation.");
  return {
    mode: "answer",
    answer: "⚠️ I'm having trouble applying these structural changes precisely. Our system detected a logic hallucination. Please try a simpler phrasing or wait a moment while we improve our graph repair engine.",
    stage: 4
  };
}
