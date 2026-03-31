import { WorkflowNode, WorkflowResponse } from "@/types/workflow";
import { WorkflowPatch } from "./workflowPatcher";

/**
 * Strips non-essential descriptive properties from the workflow nodes.
 * Keeps only topological mapping data (ids, type, label) to save LLM tokens.
 */
export function buildStructuralContext(workflow: WorkflowResponse): string {
  const compressedNodes = workflow.nodes.map((node: WorkflowNode) => {
    // 1. Initial essential fields
    const minimalNode: any = {
      id: node.id,
      type: node.type,
      label: node.label,
    };

    // 2. Add topological fields ONLY if they are not empty
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

    // 3. Removed: description, tool, stage, apiEndpoint (Surgical Pruning)

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

/**
 * Validates a generated WorkflowPatch against the current WorkflowResponse graph.
 * Fails if the LLM hallucinates non-existent node edges or targets fabricated nodes.
 */
export function validatePatch(patch: WorkflowPatch, currentWorkflow: WorkflowResponse): ValidationResult {
  if (!patch.feasible) {
      return { isValid: true }; // Feasible=false patches are inherently valid requests for aborts
  }

  // Set of all CURRENT valid node IDs
  const validNodeIds = new Set(currentWorkflow.nodes.map((n: WorkflowNode) => n.id));

  // Determine all NEW node IDs added in this patch
  const newlyGeneratedIds = new Set<string>();
  for (const op of patch.operations) {
    if (op.op === "add_node" && op.node && op.node.id) {
      newlyGeneratedIds.add(op.node.id);
    }
  }

  // Combined set of all acceptable node targets during this patch lifecycle
  const acceptableNodeTargets = new Set([...validNodeIds, ...newlyGeneratedIds]);

  // 1. Verify affected_nodes actually exist
  for (const affectedId of patch.affected_nodes) {
    if (!acceptableNodeTargets.has(affectedId)) {
        return { 
            isValid: false, 
            error: `Target affected_node '${affectedId}' does not exist in the graph.` 
        };
    }
  }

  for (const op of patch.operations) {
    // 2. Verify operations target valid nodes
    if (op.op === "update_node" || op.op === "remove_node") {
      if (!acceptableNodeTargets.has(op.nodeId)) {
        return { 
            isValid: false, 
            error: `Attempted to ${op.op} on node '${op.nodeId}' which does not exist.` 
        };
      }
    }

    // 3. Verify newly requested edges connect to valid nodes
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
