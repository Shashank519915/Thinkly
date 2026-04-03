import { WorkflowNode, WorkflowResponse } from "@/types/workflow";
import { WorkflowPatch } from "../../workflowPatcher";

export function buildStructuralContext(workflow: WorkflowResponse): string {
  const compressedNodes = workflow.nodes.map((node: WorkflowNode) => {
    const minimalNode: any = {
      id: node.id,
      type: node.type,
      label: node.label,
    };

    if (node.tool) {
      minimalNode.tool = node.tool;
    }

    if (node.nextNodes && node.nextNodes.length > 0) {
      minimalNode.nextNodes = node.nextNodes;
    }

    if (node.type === "condition") {
      const falseNext = (node as any).falseNextNodes;
      if (falseNext && falseNext.length > 0) {
        minimalNode.falseNextNodes = falseNext;
      }
    }

    const errorNodes = (node as any).errorNodes;
    if (errorNodes && errorNodes.length > 0) {
      minimalNode.errorNodes = errorNodes;
    }

    return minimalNode;
  });

  const structuralContext = {
    workflow_type: workflow.workflow_type,
    nodes: compressedNodes
  };

  return JSON.stringify(structuralContext, null, 2);
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePatch(patch: WorkflowPatch, currentWorkflow: WorkflowResponse): ValidationResult {
  if (!patch.feasible) {
      return { isValid: true };
  }

  const validNodeIds = new Set(currentWorkflow.nodes.map((n: WorkflowNode) => n.id));
  const newlyGeneratedIds = new Set<string>();
  for (const op of patch.operations) {
    if (op.op === "add_node" && op.node && op.node.id) {
      newlyGeneratedIds.add(op.node.id);
    }
  }

  const acceptableNodeTargets = new Set([...validNodeIds, ...newlyGeneratedIds]);

  for (const affectedId of patch.affected_nodes) {
    if (!acceptableNodeTargets.has(affectedId)) {
        return { 
            isValid: false, 
            error: `Target affected_node '${affectedId}' does not exist in the graph.` 
        };
    }
  }

  for (const op of patch.operations) {
    if (op.op === "update_node" || op.op === "remove_node") {
      if (!acceptableNodeTargets.has(op.nodeId)) {
        return { 
            isValid: false, 
            error: `Attempted to ${op.op} on node '${op.nodeId}' which does not exist.` 
        };
      }
    }

    const checkEdges = (edges: string[] | undefined, originNodeInfo: string) => {
        if (!edges) return null;
        for (const targetId of edges) {
            if (!acceptableNodeTargets.has(targetId)) {
                return `Edge connects to non-existent node ID '${targetId}' from ${originNodeInfo}.`;
            }
        }
        return null;
    };

    if (op.op === "add_node") {
        if (validNodeIds.has(op.node.id)) {
            return { 
                isValid: false, 
                error: `Attempted to 'add_node' with ID '${op.node.id}', but this ID already exists in the graph. Please use a unique ID or use 'update_node'.` 
            };
        }
        const err = checkEdges(op.node.nextNodes, `new node '${op.node.id}'`) ||
                    checkEdges((op.node as any).falseNextNodes, `new node '${op.node.id}'`) ||
                    checkEdges((op.node as any).errorNodes, `new node '${op.node.id}'`);
        if (err) return { isValid: false, error: err };
    }

    if (op.op === "update_node" && op.fields) {
        const fields = op.fields as any;
        const err = checkEdges(fields.nextNodes, `updated node '${op.nodeId}'`) ||
                    checkEdges(fields.falseNextNodes, `updated node '${op.nodeId}'`) ||
                    checkEdges(fields.errorNodes, `updated node '${op.nodeId}'`);
        if (err) return { isValid: false, error: err };
    }
  }

  return { isValid: true };
}
