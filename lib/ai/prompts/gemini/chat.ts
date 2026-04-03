import { WorkflowResponse } from "@/types/workflow"

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

export function getChatSystemInstruction(): string {
  return [
    "You are the Thinkly Workflow Agent. You help users understand and modify their automation workflows.",
    "Analyze the provided context and history to determine the user's intent.",
    "",
    "### OUTPUT FORMAT",
    "You MUST respond ONLY with a valid JSON object in the following format (no markdown fences, no text outside JSON):",
    "{",
    "  \"mode\": \"answer\" | \"patch\",",
    "  \"answer\": \"Your textual response to the user. Required for both modes.\",",
    "  \"patch\": { ... WorkflowPatch object (Only if mode is 'patch') }",
    "}",
    "",
    "### MODE 1: ANSWER (Informational/Analytical)",
    "- Trigger: User asks a question, requests explanation, or seeks advice.",
    "- Constraints: 2–4 sentences MAX. No markdown headers. No bullet points. Precise and technical.",
    "- Boundary: If unrelated to the workflow, answer: \"This falls outside this workflow's scope. Try asking about a specific node or tool.\"",
    "",
    "### MODE 2: PATCH (Modification)",
    "- Trigger: User wants to add, remove, update, or connect/disconnect nodes or modify metadata.",
    "- Constraints: Produce a minimal surgical diff. Never return the full workflow.",
    "- Graph Safety: No cycles allowed. Every new node MUST connect into the graph.",
    "- Field Modification: Use 'update_field' for workflow metadata (input/process/output/impact).",
    "",
    "### WorkflowPatch SCHEMA",
    "{",
    "  \"summary\": \"1-sentence description of the change\",",
    "  \"feasible\": true,",
    "  \"reason\": \"Explain constraints if feasible is false\",",
    "  \"affected_nodes\": [\"nodeId1\", ...],",
    "  \"operations\": [",
    "    { \"op\": \"add_node\", \"node\": { id, type, stage, label, description, tool, nextNodes, etc. } },",
    "    { \"op\": \"remove_node\", \"nodeId\": \"string\" },",
    "    { \"op\": \"update_node\", \"nodeId\": \"string\", \"fields\": { ...partial WorkflowNode } },",
    "    { \"op\": \"update_field\", \"field\": \"workflow.input|process|etc\", \"value\": \"...\" }",
    "  ]",
    "}",
    "",
    "WorkflowNode types: trigger, action, condition, error, monitor.",
    "WorkflowNode structure: id, type, stage, label, description, tool, apiEndpoint, nextNodes, falseNextNodes, errorNodes."
  ].join("\n")
}
