import { WorkflowNode, WorkflowEdge, WorkflowResponse } from "@/types/workflow"

/**
 * Returns nodes in an order that satisfies their dependencies (incoming edges).
 */
export function getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const result: WorkflowNode[] = []
  const visited = new Set<string>()

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    // Find all incoming dependencies
    const incomingEdges = edges.filter(e => e.target === nodeId)
    for (const edge of incomingEdges) {
      visit(edge.source)
    }

    const node = nodes.find(n => n.id === nodeId)
    if (node) result.push(node)
  }

  nodes.forEach(n => visit(n.id))
  return result
}

// Helper to safely extract a displayable title from a workflow
export const extractWorkflowTitle = (prompt: string, data: WorkflowResponse): string => {
  const extractFromValue = (val: any): string | null => {
    if (!val) return null;
    
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Drop JSON string leaks entirely (these are technical schemas, not titles)
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractFromValue(parsed);
        } catch { return null; }
      }
      return trimmed.length > 5 ? trimmed : null;
    }

    if (typeof val === 'object') {
      // Strictly prioritize 'objective' for the personalized title
      // This is the core 'Goal' the user specified
      const standardKeys = ['objective', 'title', 'intent', 'name', 'description'];
      for (const key of standardKeys) {
        if (val[key] && typeof val[key] === 'string' && val[key].length > 5) {
          // If it's another JSON string inside, recurse
          if (val[key].startsWith('{')) return extractFromValue(val[key]);
          return val[key];
        }
      }
      
      const values = Object.values(val);
      const firstGoodString = values.find(v => 
        typeof v === 'string' && 
        v.length > 10 && 
        !v.includes('/') && 
        !/^[0-9a-f-]{20,}$/.test(v)
      );
      if (firstGoodString) return firstGoodString as string;
      
      return null;
    }
    return null;
  };

  // 1. Try original prompt context first (the User's Goal is the source of truth)
  let extracted = extractFromValue(prompt);
  if (extracted) {
    return extracted.length > 60 ? extracted.slice(0, 57) + "..." : extracted;
  }

  // 2. Try professional AI summary (the 'process' field)
  extracted = extractFromValue(data?.workflow?.process);
  if (extracted && extracted.length <= 150) {
    return extracted.length > 60 ? extracted.slice(0, 57) + "..." : extracted;
  }

  // 3. Try input data context as a fallback
  extracted = extractFromValue(data?.workflow?.input);
  if (extracted && extracted.length <= 150) {
    return extracted.length > 60 ? extracted.slice(0, 57) + "..." : extracted;
  }
  
  // 4. Last Resort: Use the Workflow Type or generic fallback
  return data?.workflow_type || "Untitled Blueprint";
}

// Helper to extract unique tool components from a workflow
export const extractWorkflowTools = (data: WorkflowResponse) => {
  const tools = new Set<string>()
  
  if (data.tools && Array.isArray(data.tools)) {
    data.tools.forEach(t => {
      if (typeof t === 'string') tools.add(t);
      else if (typeof t === 'object' && t !== null) tools.add((t as any).label || (t as any).type || "Tool");
    })
  }

  if (tools.size === 0 && data.nodes && Array.isArray(data.nodes)) {
    data.nodes.forEach(n => {
      if (n.tool) {
        if (typeof n.tool === 'string') tools.add(n.tool);
        else if (typeof n.tool === 'object' && n.tool !== null) tools.add((n.tool as any).label || "Tool");
      }
    })
  }
  
  return Array.from(tools).slice(0, 5)
}
