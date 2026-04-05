import { WorkflowResponse } from "@/types/workflow";

/**
 * Structural, depth-tracking crawler that isolates all brace-balanced JSON objects.
 * Resilient to AI "chatter" and multiple JSON blocks in a single response.
 */
export function normalizeAIJSON(text: string): string {
  // 1. Handle unquoted negative template tags: : -{{...}} -> : "-{{...}}"
  // 2. Handle unquoted positive template tags: : {{...}} -> : "{{...}}"
  // This is a safety net for LLMs (like Gemini Flash) that hallucinate template values without quotes.
  let clean = text;
  
  // Negative/Unquoted Template Tag Fix
  // Only targets colons preceded by a non-escaped quote (root-level JSON keys)
  // This prevents mangling tags already inside of escaped JSON strings.
  clean = clean.replace(/(?<=[^\\]"):\s*(-?\{\{.*?\}\})(?=[ \t\n\r]*(?:[,}]|$))/g, (match, tag) => {
    return `: "${tag}"`;
  });

  return clean;
}

export function extractAllJSONBlocks(text: string): string[] {
  // 1. Markdown code blocks are still the most explicit signal - check them first
  const jsonMarkdownMatches = Array.from(text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g));
  if (jsonMarkdownMatches.length > 0) return jsonMarkdownMatches.map(m => m[1]);

  // 2. Structural Crawl: Find all discrete, brace-balanced objects by tracking depth
  const candidates: string[] = [];
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      let depth = 1;
      let j = i + 1;
      let inString = false;
      let escape = false;

      while (j < text.length && depth > 0) {
        const char = text[j];
        
        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
        j++;
      }

      if (depth === 0) {
        candidates.push(text.substring(i, j));
      }
    }
  }

  return candidates;
}

/**
 * Extracts the largest balanced JSON object from a string.
 */
export function extractBalancedJSON(text: string): string | null {
  const candidates = extractAllJSONBlocks(text);

  // Rank candidates by content: prioritize those with mandatory keys
  const validCandidates = candidates.filter(c => 
    c.includes('"workflow_type"') || 
    c.includes('"nodes"') || 
    c.includes('"mode"') ||
    c.includes('"answer"') ||
    c.includes('"architecture"')
  );

  if (validCandidates.length > 0) {
    return validCandidates.sort((a, b) => b.length - a.length)[0];
  }

  if (candidates.length > 0) {
      return candidates.sort((a, b) => b.length - a.length)[0];
  }

  // Fallback: If no structured blocks found, try the largest bounds as a last resort
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    return text.substring(firstOpen, lastClose + 1);
  }

  return null;
}

export function parseResponse(rawText: string): WorkflowResponse {
  try {
    const cleanText = extractBalancedJSON(rawText);
    if (!cleanText) {
      throw new Error("Could not locate JSON structural bounds.");
    }
    
    const normalized = normalizeAIJSON(cleanText);
    const parsed = JSON.parse(normalized) as WorkflowResponse;
    
    const ensureString = (val: any) => typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val || '');
    const ensureArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(v => String(v));
      if (typeof val === 'object') {
        const values = Object.values(val).flatMap(v => Array.isArray(v) ? v.map(i => String(i)) : [String(v)]);
        return Array.from(new Set(values));
      }
      return [String(val)];
    };

    parsed.workflow.input = ensureString(parsed.workflow.input);
    parsed.workflow.process = ensureString(parsed.workflow.process);
    parsed.workflow.output = ensureString(parsed.workflow.output);
    parsed.logic = ensureString(parsed.logic);
    
    parsed.architecture.state_management = ensureString(parsed.architecture.state_management);
    parsed.architecture.idempotency_strategy = ensureString(parsed.architecture.idempotency_strategy);
    parsed.architecture.scaling_mechanisms = ensureString(parsed.architecture.scaling_mechanisms);
    parsed.architecture.fault_tolerance = ensureString(parsed.architecture.fault_tolerance);

    if (Array.isArray(parsed.architecture.ai_injectors)) parsed.architecture.ai_injectors = parsed.architecture.ai_injectors.map(ensureString);
    if (Array.isArray(parsed.tools)) parsed.tools = parsed.tools.map(ensureString);
    if (Array.isArray(parsed.patterns_detected)) parsed.patterns_detected = parsed.patterns_detected.map(ensureString);

    parsed.impact.time_saved = ensureString(parsed.impact.time_saved);
    parsed.impact.automation = ensureString(parsed.impact.automation);
    parsed.impact.confidence = ensureString(parsed.impact.confidence);
    parsed.impact.current_cost_estimate = ensureString(parsed.impact.current_cost_estimate);
    parsed.impact.automated_cost_estimate = ensureString(parsed.impact.automated_cost_estimate);

    if (parsed.workflow_type) parsed.workflow_type = ensureString(parsed.workflow_type);
    
    parsed.nodes = parsed.nodes.map(n => {
      let nextNodes = n.nextNodes;
      let falseNextNodes = (n as any).falseNextNodes;

      if (n.type === 'condition' && typeof n.nextNodes === 'object' && !Array.isArray(n.nextNodes)) {
        const obj = n.nextNodes as any;
        const keys = Object.keys(obj);
        nextNodes = obj[keys[0]] || [];
        falseNextNodes = obj[keys[1]] || [];
      }

      return {
        ...n,
        label: ensureString(n.label),
        stage: n.stage ? ensureString(n.stage) : undefined,
        description: n.description ? ensureString(n.description) : "",
        tool: n.tool ? ensureString(n.tool) : undefined,
        apiEndpoint: n.apiEndpoint ? ensureString(n.apiEndpoint) : undefined,
        nextNodes: ensureArray(nextNodes),
        falseNextNodes: ensureArray(falseNextNodes),
        errorNodes: ensureArray((n as any).errorNodes)
      };
    });

    return parsed;
  } catch (error: any) {
    console.error("Failed to parse Gemini response:", rawText);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

export function parseUnifiedResponse(rawText: string): { mode: string; answer: string; patch?: any } {
    try {
        const cleanJSON = extractBalancedJSON(rawText);
        if (!cleanJSON) {
            return { mode: "answer", answer: rawText.trim() };
        }

        const parsed = JSON.parse(normalizeAIJSON(cleanJSON));

        // Validation & Fallback: If AI returned a JSON object but not our chat envelope
        // (common when models hallucinate that they should output the node directly)
        if (!parsed.mode || (!parsed.answer && !parsed.patch)) {
            return { 
                mode: "answer", 
                answer: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : rawText.trim() 
            };
        }

        return {
            mode: parsed.mode || "answer",
            answer: parsed.answer || (parsed.patch ? "I have prepared the following workflow adjustments for you." : ""),
            patch: parsed.patch
        };
    } catch {
        return { mode: "answer", answer: rawText.trim() };
    }
}
