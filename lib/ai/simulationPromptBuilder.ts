import { WorkflowNode } from "@/types/workflow";

export function getSimulationSystemInstruction(): string {
  return [
    "You are a mock data engine for Thinkly, a workflow automation platform.",
    "Your goal is to generate extremely realistic, brief, and punchy 'execution status' messages for a sequence of workflow nodes.",
    "",
    "STRICT RULES:",
    "1. Respond ONLY with valid JSON. Do not include markdown (no ```json).",
    "2. Response must be an object where keys are nodeIds and values contain 'message' and 'payload_preview'.",
    "3. Be brand-specific: If the tool is 'Salesforce', mention 'leads' or 'accounts'. If 'Slack', mention 'channels' or 'messages'.",
    "4. Concise: Messages should be 5-8 words max.",
    "",
    "JSON OUTPUT FORMAT:",
    "{",
    "  \"node_id_1\": { \"message\": \"...\", \"payload_preview\": \"{...}\" },",
    "  \"node_id_2\": { ... }",
    "}"
  ].join("\n");
}

export function buildBatchSimulationPrompt(nodes: WorkflowNode[]): string {
  const nodeContext = nodes.map(n => ({
    id: n.id,
    label: n.label,
    tool: n.tool || "None",
    description: n.description.length > 50
      ? n.description.substring(0, 50) + "..."
      : n.description
  }));

  return [
    "Workflow Nodes:",
    JSON.stringify(nodeContext, null, 2),
    "",
    "Generate realistic execution data for EVERY node provided above in the specified JSON format."
  ].join("\n");
}
