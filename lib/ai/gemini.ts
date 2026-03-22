import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemInstruction } from "./promptBuilder";
import {
  buildWorkflowContext,
  getChatQASystemInstruction,
  getChatModifySystemInstruction,
  detectIntent,
} from "./chatPromptBuilder";
import { parseResponse } from "./responseParser";
import { parsePatch, WorkflowPatch } from "./workflowPatcher";
import { WorkflowResponse, WorkflowNode } from "@/types/workflow";
import { getSimulationSystemInstruction, buildBatchSimulationPrompt } from "./simulationPromptBuilder";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Workflow Generation ───────────────────────────────────────────────────────

export async function generateWorkflowPlan(
  userInput: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<WorkflowResponse> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: getSystemInstruction(),
  });

  let responseText = "";

  if (history.length > 0) {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(
      `User Update: "${userInput}"\n\nGenerate the completely updated JSON workflow blueprint respecting all previous constraints.`
    );
    responseText = result.response.text();
  } else {
    const result = await model.generateContent(
      `User Request: "${userInput}"\n\nGenerate the complete JSON workflow representation.`
    );
    responseText = result.response.text();
  }

  return parseResponse(responseText);
}

// ─── Workflow Chat (Q&A + Modify) ─────────────────────────────────────────────

export type ChatResult =
  | { mode: "answer"; answer: string }
  | { mode: "patch"; answer: string; patch: WorkflowPatch }

export async function askWorkflowChat(
  question: string,
  workflow: WorkflowResponse,
  originalPrompt: string,
  history: { role: string; content: string }[] = []
): Promise<ChatResult> {
  const genAI = getClient();
  const intent = detectIntent(question);
  const context = buildWorkflowContext(workflow, originalPrompt);

  if (intent === "question") {
    // ── Q&A mode ─────────────────────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: getChatQASystemInstruction(),
    });

    // Build chat history in Gemini format
    const geminiHistory = history
      .filter(m => m.role !== "patch") // exclude patch cards from history
      .map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

    const contextMessage = `${context}\n\nQuestion: ${question}`;

    let responseText = "";
    if (geminiHistory.length > 0) {
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(contextMessage);
      responseText = result.response.text();
    } else {
      const result = await model.generateContent(contextMessage);
      responseText = result.response.text();
    }

    return { mode: "answer", answer: responseText.trim() };
  } else {
    // ── Modify mode ───────────────────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: getChatModifySystemInstruction(),
    });

    const prompt = [
      context,
      "",
      "Current nodes JSON (for reference when building the patch):",
      JSON.stringify(workflow.nodes, null, 2),
      "",
      `Modification request: "${question}"`,
      "",
      "Output ONLY the WorkflowPatch JSON object. No explanations, no markdown fences.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const patch = parsePatch(raw);
    const summary = patch.feasible
      ? patch.summary
      : `⚠️ This change is not feasible: ${patch.reason}`;

    return { mode: "patch", answer: summary, patch };
  }
}

// ─── Workflow Simulation ─────────────────────────────────────────────────────

export async function simulateBatchNodes(nodes: WorkflowNode[]) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: getSimulationSystemInstruction(),
  });

  const prompt = buildBatchSimulationPrompt(nodes);
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Parse the batch response
  let batchData: Record<string, any> = {};
  try {
    const cleaned = responseText.replace(/```json|```/g, "").trim();
    batchData = JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse batch simulation JSON:", responseText);
  }

  // Map back to steps
  return nodes.map((node: WorkflowNode) => {
    const mock = batchData[node.id] || { message: "Node executed successfully", payload_preview: "{}" };
    return {
      nodeId: node.id,
      message: mock.message,
      payloadPreview: typeof mock.payload_preview === 'string' ? mock.payload_preview : JSON.stringify(mock.payload_preview),
      actionType: node.type === "trigger" ? "fetch" : node.type === "condition" ? "process" : "send" as "fetch" | "process" | "send" | "error"
    };
  });
}
