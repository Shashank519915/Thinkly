import { WorkflowNode, WorkflowEdge } from "@/types/workflow"

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
