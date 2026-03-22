import { WorkflowResponse, WorkflowNode, WorkflowEdge } from "@/types/workflow"
import { decrypt } from "@/lib/crypto"
import { supabase } from "@/lib/supabase/client"

export interface RunStepLog {
  nodeId: string
  nodeLabel: string
  status: 'pending' | 'running' | 'success' | 'failed'
  input: any
  output: any
  error?: string
  startedAt: string
  completedAt?: string
}

export interface RunContext {
  [nodeId: string]: any
}

/**
 * The core engine that executes a workflow graph sequentially.
 */
export class WorkflowExecutor {
  private workflow: WorkflowResponse
  private userId: string
  private context: RunContext = {}
  private logs: RunStepLog[] = []

  constructor(workflow: WorkflowResponse, userId: string) {
    this.workflow = workflow
    this.userId = userId
  }

  /**
   * Main execution loop
   */
  async execute(onStepProgress?: (log: RunStepLog) => void): Promise<{ success: boolean; logs: RunStepLog[] }> {
    // 1. Initialise logs for all nodes
    this.logs = this.workflow.nodes.map(n => ({
      nodeId: n.id,
      nodeLabel: n.label,
      status: 'pending',
      input: {},
      output: {},
      startedAt: new Date().toISOString()
    }))

    try {
      // 2. Identify and run the entry points (Nodes with no incoming edges)
      // For simplicity in MVP, we process in the order they appear or by specific 'trigger' tool
      const executionOrder = this.getExecutionOrder()

      for (const node of executionOrder) {
        const log = this.logs.find(l => l.nodeId === node.id)!
        log.status = 'running'
        log.startedAt = new Date().toISOString()
        onStepProgress?.(log)

        try {
          const result = await this.runNode(node)
          log.status = 'success'
          log.output = result
          log.completedAt = new Date().toISOString()
          this.context[node.id] = result
        } catch (err: any) {
          log.status = 'failed'
          log.error = err.message
          log.completedAt = new Date().toISOString()
          throw err // Stop execution on any node failure
        }

        onStepProgress?.(log)
      }

      return { success: true, logs: this.logs }

    } catch (err) {
      console.error("Workflow Execution Failed:", err)
      return { success: false, logs: this.logs }
    }
  }

  /**
   * Simple Topological Sort to determine node order
   */
  private getExecutionOrder(): WorkflowNode[] {
    const nodes = [...this.workflow.nodes]
    const edges = this.workflow.edges
    const order: WorkflowNode[] = []
    const visited = new Set<string>()

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      // Find all incoming dependencies (simplified for MVP)
      const incomingEdges = edges.filter(e => e.target === nodeId)
      for (const edge of incomingEdges) {
        visit(edge.source)
      }

      const node = nodes.find(n => n.id === nodeId)
      if (node) order.push(node)
    }

    nodes.forEach(n => visit(n.id))
    return order
  }

  /**
   * Routes the node to the correct Service Adapter
   */
  private async runNode(node: WorkflowNode): Promise<any> {
    // Resolve any {{nodeId.property}} templates in the description or data
    const hydratedPrompt = this.resolveTemplates(node.description)

    switch (node.tool?.toLowerCase()) {
      case "openai":
      case "gemini":
      case "ai":
        return await this.runAINode(node, hydratedPrompt)
      case "gmail":
        // Phase 5.3
        throw new Error("Gmail integration coming soon!")
      case "sheets":
        // Phase 5.3
        throw new Error("Google Sheets integration coming soon!")
      default:
        // Mock processing for unknown tools
        return { message: `Simulated result for ${node.label}`, timestamp: new Date().toISOString() }
    }
  }

  /**
   * Resolves Handlebars-style templates like {{trigger.text}} from the context
   */
  private resolveTemplates(text: string): string {
    return text.replace(/\{\{(.+?)\}\}/g, (match, path) => {
      const parts = path.trim().split('.')
      let val: any = this.context
      for (const part of parts) {
        val = val?.[part]
      }
      return val !== undefined ? String(val) : match
    })
  }

  /**
   * Executes an AI node using the user's stored OpenAI API key
   */
  private async runAINode(node: WorkflowNode, prompt: string): Promise<any> {
    // 1. Fetch encrypted key from Supabase
    const { data: integ, error } = await supabase
      .from("user_integrations")
      .select("encrypted_secret")
      .eq("user_id", this.userId)
      .eq("service_name", "openai")
      .maybeSingle()

    if (error || !integ) {
      throw new Error(`OpenAI not connected. Please go to the Integrations tab.`)
    }

    // 2. Decrypt key (Note: In a real production app, this happens on the server only)
    const apiKey = decrypt(integ.encrypted_secret)

    // 3. Hit OpenAI API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(`OpenAI Error: ${errData.error?.message || "Unknown error"}`)
    }

    const result = await res.json()
    return result.choices[0].message.content
  }
}
