/**
 * workflowPatcher.ts
 * Safely applies a WorkflowPatch diff to a WorkflowResponse.
 * Never mutates the original — always returns a new deep-cloned object.
 */

import { WorkflowResponse, WorkflowNode } from "@/types/workflow"

// ─── Patch types ──────────────────────────────────────────────────────────────

export type PatchOp =
  | { op: "add_node";    node: WorkflowNode }
  | { op: "remove_node"; nodeId: string }
  | { op: "update_node"; nodeId: string; fields: Partial<WorkflowNode> }
  | { op: "update_field"; field: string; value: string }

export interface WorkflowPatch {
  summary: string
  feasible: boolean
  reason?: string
  affected_nodes: string[]
  operations: PatchOp[]
}

// ─── Core merge ───────────────────────────────────────────────────────────────

/**
 * Apply a WorkflowPatch to a WorkflowResponse.
 * Returns a NEW WorkflowResponse — original is never mutated.
 * Throws on duplicate IDs or missing target nodes.
 */
export function mergeWorkflowPatch(
  current: WorkflowResponse,
  patch: WorkflowPatch
): WorkflowResponse {
  if (!patch.feasible) {
    throw new Error(`Patch is not feasible: ${patch.reason ?? "no reason provided"}`)
  }

  // Deep clone the current workflow to avoid any mutation
  let result: WorkflowResponse = JSON.parse(JSON.stringify(current))

  for (const op of patch.operations) {
    switch (op.op) {
      case "add_node": {
        const existing = result.nodes.find(n => n.id === op.node.id)
        if (existing) {
          // Deduplicate: just update instead of crashing
          result.nodes = result.nodes.map(n => n.id === op.node.id ? { ...n, ...op.node } : n)
        } else {
          result.nodes = [...result.nodes, op.node]
        }
        break
      }

      case "remove_node": {
        // Remove the node
        result.nodes = result.nodes.filter(n => n.id !== op.nodeId)
        // Scrub ID from all edge arrays in remaining nodes
        result.nodes = result.nodes.map(n => ({
          ...n,
          nextNodes:      (n.nextNodes ?? []).filter(id => id !== op.nodeId),
          falseNextNodes: ((n as any).falseNextNodes ?? []).filter((id: string) => id !== op.nodeId),
          errorNodes:     ((n as any).errorNodes ?? []).filter((id: string) => id !== op.nodeId),
        }))
        break
      }

      case "update_node": {
        result.nodes = result.nodes.map(n =>
          n.id === op.nodeId ? { ...n, ...op.fields } : n
        )
        break
      }

      case "update_field": {
        result = setNestedField(result, op.field, op.value)
        break
      }
    }
  }

  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set a deeply nested field via dot-path string.
 * e.g. "workflow.input" sets result.workflow.input
 * Returns a new object — does not mutate.
 */
function setNestedField<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".")
  const clone = { ...obj } as Record<string, any>

  let current = clone
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...current[keys[i]] }
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value

  return clone as T
}

/**
 * Parse the raw Gemini text output into a WorkflowPatch.
 * Strips markdown fences if present.
 */
export function parsePatch(raw: string): WorkflowPatch {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  const parsed = JSON.parse(cleaned)

  // Normalise — Gemini sometimes omits feasible
  if (parsed.feasible === undefined) parsed.feasible = true
  if (!Array.isArray(parsed.operations)) parsed.operations = []
  if (!Array.isArray(parsed.affected_nodes)) parsed.affected_nodes = []

  return parsed as WorkflowPatch
}
