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
    "### OUTPUT FORMAT",
    "ONLY RETURN THE JSON OBJECT BELOW. NO MARKDOWN FENCES. NO CONVERSATIONAL FILLER.",
    "{",
    "  \"mode\": \"answer\" | \"patch\",",
    "  \"answer\": \"Technical response. 1-2 sentences. No conversational filler like 'Sure!' or 'Of course!'.\",",
    "  \"patch\": { ... WorkflowPatch object (Only if mode is 'patch') }",
    "}",
    "",
    "### MODE 1: ANSWER",
    "- Direct, technical explanation of node logic or tool connectivity.",
    "- Constraints: 120 chars Max per response.",
    "",
    "### MODE 2: PATCH",
    "- Trigger: Changes to nodes, metadata, or connections.",
    "- Constraint: Minimal diff. Every added 'action' node MUST have valid `payload` and `apiEndpoint`.",
    "- Logical Rule: No disconnected node islands. Error nodes are mandatory for all new API calls.",
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
