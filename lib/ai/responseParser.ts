import { WorkflowResponse } from "@/types/workflow";

export function parseResponse(rawText: string): WorkflowResponse {
  try {
    // 1. Strip markdown code fences first if present
    let text = rawText.replace(/```json|```/g, "").trim();

    // 2. Identify and fix common AI syntax hallucinations (Javascript-style string concatenation in JSON)
    // This finds patterns like "part 1" + "part 2" (even with newlines) and merges them.
    text = text.replace(/"\s*\+\s*(\n\s*)?"/g, "");
    
    // 3. Statically extract the core JSON object bounded by brackets
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not locate JSON structural bounds.");
    const cleanText = match[0].trim();
    
    const parsed = JSON.parse(cleanText) as WorkflowResponse;
    
    // Basic validation to ensure fields exist
    if (!parsed.workflow || !parsed.architecture || !parsed.nodes || !parsed.tools || !parsed.logic || !parsed.impact) {
      throw new Error("Missing required workflow fields in JSON.");
    }

    const ensureString = (val: any) => typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val || '');

    // Force strict nested scalar boundaries over hallucinated objects so React doesn't crash during rendering
    parsed.workflow.input = ensureString(parsed.workflow.input);
    parsed.workflow.process = ensureString(parsed.workflow.process);
    parsed.workflow.output = ensureString(parsed.workflow.output);
    parsed.logic = ensureString(parsed.logic);
    
    parsed.architecture.state_management = ensureString(parsed.architecture.state_management);
    parsed.architecture.idempotency_strategy = ensureString(parsed.architecture.idempotency_strategy);
    parsed.architecture.scaling_mechanisms = ensureString(parsed.architecture.scaling_mechanisms);
    parsed.architecture.fault_tolerance = ensureString(parsed.architecture.fault_tolerance);

    if (Array.isArray(parsed.architecture.ai_injectors)) {
      parsed.architecture.ai_injectors = parsed.architecture.ai_injectors.map(ensureString);
    }
    if (Array.isArray(parsed.tools)) {
      parsed.tools = parsed.tools.map(ensureString);
    }
    if (Array.isArray(parsed.patterns_detected)) {
      parsed.patterns_detected = parsed.patterns_detected.map(ensureString);
    }

    parsed.impact.time_saved = ensureString(parsed.impact.time_saved);
    parsed.impact.automation = ensureString(parsed.impact.automation);
    parsed.impact.confidence = ensureString(parsed.impact.confidence);
    parsed.impact.current_cost_estimate = ensureString(parsed.impact.current_cost_estimate);
    parsed.impact.automated_cost_estimate = ensureString(parsed.impact.automated_cost_estimate);

    if (parsed.workflow_type) parsed.workflow_type = ensureString(parsed.workflow_type);
    
    parsed.nodes = parsed.nodes.map(n => ({
      ...n,
      label: ensureString(n.label),
      stage: n.stage ? ensureString(n.stage) : undefined,
      description: ensureString(n.description),
      tool: n.tool ? ensureString(n.tool) : undefined,
      apiEndpoint: n.apiEndpoint ? ensureString(n.apiEndpoint) : undefined
    }));

    return parsed;
  } catch (error) {
    console.error("Failed to parse Gemini response:", rawText);
    throw new Error("Failed to parse AI response into valid workflow structure.");
  }
}
