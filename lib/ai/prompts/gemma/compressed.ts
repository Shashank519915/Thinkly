import { WorkflowNode, WorkflowResponse } from "@/types/workflow";
import { WorkflowPatch } from "../../workflowPatcher";

export function buildStructuralContext(workflow: WorkflowResponse): string {
  const compressedNodes = workflow.nodes.map((node: WorkflowNode) => {
    const minimalNode: any = {
      id: node.id,
      type: node.type,
      label: node.label,
    };

    if (node.tool) minimalNode.tool = node.tool;
    if (node.nextNodes && node.nextNodes.length > 0) minimalNode.nextNodes = node.nextNodes;
    if (node.type === "condition") {
        const falseNext = (node as any).falseNextNodes;
        if (falseNext && falseNext.length > 0) minimalNode.falseNextNodes = falseNext;
    }
    const errorNodes = (node as any).errorNodes;
    if (errorNodes && errorNodes.length > 0) minimalNode.errorNodes = errorNodes;

    return minimalNode;
  });

  const structuralContext = {
    workflow_type: workflow.workflow_type,
    nodes: compressedNodes
  };

  return JSON.stringify(structuralContext);
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePatch(patch: WorkflowPatch, currentWorkflow: WorkflowResponse): ValidationResult {
  if (!patch.feasible) return { isValid: true };

  const validNodeIds = new Set(currentWorkflow.nodes.map((n: WorkflowNode) => n.id));
  const newlyGeneratedIds = new Set<string>();
  for (const op of patch.operations) {
    if (op.op === "add_node" && op.node && op.node.id) newlyGeneratedIds.add(op.node.id);
  }

  const acceptableNodeTargets = new Set([...validNodeIds, ...newlyGeneratedIds]);

  for (const affectedId of patch.affected_nodes) {
    if (!acceptableNodeTargets.has(affectedId)) return { isValid: false, error: `Context: Target ID '${affectedId}' not found.` };
  }

  const checkEdges = (edges: string[] | undefined, origin: string) => {
      if (!edges) return null;
      for (const tId of edges) if (!acceptableNodeTargets.has(tId)) return `Graph: Broken edge to '${tId}' from ${origin}.`;
      return null;
  };

  for (const op of patch.operations) {
    if (op.op === "update_node" || op.op === "remove_node") {
      if (!acceptableNodeTargets.has(op.nodeId)) return { isValid: false, error: `Patch: Node '${op.nodeId}' does not exist.` };
    }

    if (op.op === "add_node") {
        if (validNodeIds.has(op.node.id)) return { isValid: false, error: `Patch: Node ID '${op.node.id}' already in graph.` };
        const err = checkEdges(op.node.nextNodes, op.node.id) ||
                    checkEdges((op.node as any).falseNextNodes, op.node.id) ||
                    checkEdges((op.node as any).errorNodes, op.node.id);
        if (err) return { isValid: false, error: err };
    }

    if (op.op === "update_node" && op.fields) {
        const f = op.fields as any;
        const err = checkEdges(f.nextNodes, op.nodeId) ||
                    checkEdges(f.falseNextNodes, op.nodeId) ||
                    checkEdges(f.errorNodes, op.nodeId);
        if (err) return { isValid: false, error: err };
    }
  }

  return { isValid: true };
}
