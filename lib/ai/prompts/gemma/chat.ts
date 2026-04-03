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
    "STRICT ARCHITECT REFINEMENT MODE: Gemma-4-31B-it.",
    "Goal: Modify or explain automation blueprints with surgical precision.",
    "",
    "### CRITICAL RULES",
    "1. IMMEDIACY: The very first character of your response MUST BE '{'. No preamble.",
    "2. RAW JSON ONLY: No markdown code blocks (e.g. ```json).",
    "3. ARCHITECTURAL DEPTH: Any node added via 'add_node' or updated via 'update_node' MUST adhere to the INDUSTRIAL FRAMEWORK: [Action] -> [Parallel SLA Alert] -> [Monitor].",
    "4. MANDATORY CONTENT: Provide detailed, 2-3 sentence technical descriptions for all new node fields. No empty strings.",
    "5. JSON PAYLOAD ESCAPING: Escape internal double quotes in `payload` with backslashes (e.g. \\\"{\\\\\\\"key\\\\\\\": \\\\\\\"val\\\\\\\"}\\\").",
    "",
    "### OUTPUT FORMAT (STRICT JSON)",
    "{",
    "  \"mode\": \"answer\" | \"patch\",",
    "  \"answer\": \"Technical response. Max 250 chars. No conversational filler.\",",
    "  \"patch\": { ... WorkflowPatch object (Only if mode is 'patch') }",
    "}",
    "",
    "### MODE 1: ANSWER",
    "- Direct, technical explanation of node logic or tool connectivity.",
    "- Constraints: 250 chars Max per response.",
    "",
    "### MODE 2: PATCH",
    "- Trigger: Changes to nodes, metadata, or connections.",
    "- Constraint: Minimal diff. Every added 'action' node MUST have valid `payload`, `apiEndpoint`, and a connected 'error' SLA path.",
    "- Logical Rule: No disconnected node islands. Monitor nodes are mandatory for all terminal branches.",
    "",
    "### WorkflowPatch SCHEMA",
    "{",
    "  \"summary\": \"Refined node configuration for precision\",",
    "  \"feasible\": true,",
    "  \"affected_nodes\": [\"...\"],",
    "  \"operations\": [",
    "    { \"op\": \"add_node\", \"node\": { id, type, stage, label, description, tool, apiEndpoint, payload, nextNodes, etc. } },",
    "    { \"op\": \"remove_node\", \"nodeId\": \"...\" },",
    "    { \"op\": \"update_node\", \"nodeId\": \"...\", \"fields\": { ...partial WorkflowNode } }",
    "  ]",
    "}",
    "WorkflowNode structure (STRICT): id, type, stage, label, description, tool, apiEndpoint, payload, nextNodes, falseNextNodes, errorNodes."
  ].join("\n")
}
