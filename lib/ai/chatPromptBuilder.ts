/**
 * chatPromptBuilder.ts
 * System instructions for the two chat modes:
 *   1. Q&A — scoped, concise answers about the workflow
 *   2. Modify — surgical JSON diff patch generation
 */

import { WorkflowResponse } from "@/types/workflow"

/**
 * Build the full context block injected into every chat message.
 * This gives Gemini the workflow, original prompt, and tool list as grounding facts.
 */
export function buildWorkflowContext(
  workflow: WorkflowResponse,
  originalPrompt: string
): string {
  const nodeList = workflow.nodes
    .map(n => `  - [${n.type.toUpperCase()}] "${n.label}" (id: ${n.id}, tool: ${n.tool ?? "none"}, stage: ${n.stage ?? "?"})`)
    .join("\n")

  return [
    "=== WORKFLOW CONTEXT ===",
    `Original user request: "${originalPrompt}"`,
    `Workflow type: ${workflow.workflow_type}`,
    `Patterns: ${workflow.patterns_detected?.join(", ") ?? "none"}`,
    "",
    "Workflow summary:",
    `  Input:   ${workflow.workflow.input}`,
    `  Process: ${workflow.workflow.process}`,
    `  Output:  ${workflow.workflow.output}`,
    "",
    `Nodes (${workflow.nodes.length} total):`,
    nodeList,
    "",
    `Tools used: ${workflow.tools.join(", ")}`,
    "=== END CONTEXT ===",
  ].join("\n")
}

/**
 * System instruction for Q&A mode — answer questions about *this* workflow only.
 */
export function getChatQASystemInstruction(): string {
  return [
    "You are a workflow intelligence assistant built into Thinkly, an AI automation platform.",
    "You ONLY answer questions about the specific workflow provided in context above.",
    "",
    "STRICT RULES:",
    "1. Keep answers to 2–4 sentences MAX. Be precise and technical.",
    "2. ONLY reference nodes, tools, stages, and patterns actually present in the workflow context.",
    "3. If a question is outside the workflow scope, reply exactly: \"This falls outside this workflow's scope. Try asking about a specific node, tool, or step.\"",
    "4. Never suggest regenerating or replacing the entire workflow.",
    "5. Do not use markdown headers or bullet points. Write in clean conversational prose.",
    "6. If the user asks what the workflow does or asks for a summary, give a crisp 3-sentence executive answer.",
    "7. For questions about specific nodes, mention the node label, its type, and its tool.",
    "8. Never fabricate nodes, tools, or capabilities not present in the workflow.",
  ].join("\n")
}

/**
 * System instruction for Modify mode — produce a minimal JSON patch diff only.
 */
export function getChatModifySystemInstruction(): string {
  return [
    "You are a surgical workflow patch engine built into Thinkly.",
    "You ONLY produce a minimal JSON WorkflowPatch diff — NEVER return the full workflow.",
    "",
    "STRICT RULES:",
    "1. Output ONLY a raw JSON object starting with {. No explanations, no markdown.",
    "2. Produce the smallest possible set of operations to implement the requested change.",
    "3. Never modify nodes not mentioned in the request.",
    "4. Every new node you add MUST connect into the existing graph via nextNodes/falseNextNodes/errorNodes.",
    "5. If removing a node that other nodes point to, add an update_node op to re-route those edges.",
    "6. If the change is impossible without breaking DAG integrity, set 'feasible': false and explain in 'reason'.",
    "7. Never create cycles in the graph.",
    "",
    "WorkflowPatch JSON SCHEMA — output EXACTLY this shape:",
    "{",
    "  \"summary\": \"Short description of what this patch does (1 sentence)\",",
    "  \"feasible\": true,",
    "  \"reason\": \"Optional: explain constraints or trade-offs\",",
    "  \"affected_nodes\": [\"nodeId1\", \"nodeId2\"],",
    "  \"operations\": [",
    "    { \"op\": \"add_node\", \"node\": { ...full WorkflowNode object } },",
    "    { \"op\": \"remove_node\", \"nodeId\": \"string\" },",
    "    { \"op\": \"update_node\", \"nodeId\": \"string\", \"fields\": { ...partial WorkflowNode } },",
    "    { \"op\": \"update_field\", \"field\": \"workflow.input\", \"value\": \"...\" }",
    "  ]",
    "}",
    "",
    "WorkflowNode fields: id (string), type (trigger|action|condition|error|monitor), stage (string), label (string),",
    "description (string), tool (string, optional), apiEndpoint (string, optional),",
    "nextNodes (string[]), falseNextNodes (string[]), errorNodes (string[])",
    "",
    "update_field valid paths: workflow.input, workflow.process, workflow.output,",
    "architecture.state_management, architecture.idempotency_strategy, architecture.scaling_mechanisms,",
    "architecture.fault_tolerance, impact.time_saved, impact.automation, impact.current_cost_estimate, impact.automated_cost_estimate",
  ].join("\n")
}

/**
 * Detect if a user message intends to modify the workflow vs just asking a question.
 * Simple keyword heuristic — Gemini will still validate.
 */
export function detectIntent(message: string): "question" | "modify" {
  const modifyKeywords = [
    "add", "remove", "delete", "change", "replace", "update", "rename",
    "insert", "modify", "move", "swap", "connect", "disconnect", "edit",
    "include", "exclude", "integrate", "drop", "attach", "link", "set",
  ]
  const lower = message.toLowerCase()
  return modifyKeywords.some(k => lower.includes(k)) ? "modify" : "question"
}
