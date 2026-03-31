import { WorkflowResponse } from "@/types/workflow";

/**
 * Extracts the largest balanced JSON object from a string.
 * This is resilient to AI "chatter" before and after the JSON block.
 */
function extractBalancedJSON(text: string): string | null {
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  
  if (firstOpen === -1 || lastClose === -1 || lastClose < firstOpen) {
    return null;
  }
  
  return text.substring(firstOpen, lastClose + 1);
}

export function parseResponse(rawText: string): WorkflowResponse {
  try {
    // 1. Recursive cleaning of common Gemini formatters
    let text = rawText.replace(/```json|```/g, "").trim();

    // 2. Identify and fix common AI syntax hallucinations (string concatenation)
    text = text.replace(/"\s*\+\s*(\n\s*)?"/g, "");
    
    // 3. Balanced extraction to isolate the core JSON block
    const cleanText = extractBalancedJSON(text);
    if (!cleanText) {
      throw new Error("Could not locate JSON structural bounds.");
    }
    
    const parsed = JSON.parse(cleanText) as WorkflowResponse;
    
    // Basic validation to ensure required fields exist
    if (!parsed.workflow || !parsed.architecture || !parsed.nodes || !parsed.tools || !parsed.logic || !parsed.impact) {
      throw new Error("Missing required workflow fields in JSON.");
    }

    const ensureString = (val: any) => typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val || '');

    // Force strict nested scalar boundaries over hallucinated objects
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
      description: n.description ? ensureString(n.description) : "",
      tool: n.tool ? ensureString(n.tool) : undefined,
      apiEndpoint: n.apiEndpoint ? ensureString(n.apiEndpoint) : undefined
    }));

    return parsed;
  } catch (error: any) {
    console.error("Failed to parse Gemini response:", rawText);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

/**
 * Specifically parses a Unified Agent result which contains mode, answer, and optional patch.
 */
export function parseUnifiedResponse(rawText: string): { mode: string; answer: string; patch?: any } {
    try {
        const cleanJSON = extractBalancedJSON(rawText.replace(/```json|```/g, ""));
        if (!cleanJSON) throw new Error("No JSON found");
        return JSON.parse(cleanJSON);
    } catch {
        // Fallback for conversational responses that might not be in JSON
        return { mode: "answer", answer: rawText.trim() };
    }
}
