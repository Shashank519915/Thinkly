import { useState, useEffect } from "react"
import { WorkflowResponse } from "@/types/workflow"
import { Clock, ExternalLink, Trash2, Layers, Cpu, Box } from "lucide-react"

export interface SavedWorkflow {
  id: number;
  prompt: string;
  data: WorkflowResponse;
  date: string;
}

export function MyWorkflowsView({ onSelect }: { onSelect: (workflow: SavedWorkflow) => void }) {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([])

  useEffect(() => {
    const saved = localStorage.getItem("thinkly_history")
    if (saved) {
      const parsed = JSON.parse(saved) as SavedWorkflow[]
      // Sort by ID (timestamp) descending
      setWorkflows(parsed.sort((a, b) => b.id - a.id))
    }
  }, [])

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = workflows.filter(w => w.id !== id)
    setWorkflows(updated)
    localStorage.setItem("thinkly_history", JSON.stringify(updated))
  }

  // Helper to safely extract a displayable title from a workflow
  const getWorkflowTitle = (wf: SavedWorkflow): string => {
    const input = wf.data.workflow?.input;
    if (input && typeof input === 'string') return input;
    if (input && typeof input === 'object') return (input as any).objective || JSON.stringify(input).slice(0, 50);
    
    if (typeof wf.prompt === 'string') {
      try {
        const parsed = JSON.parse(wf.prompt);
        return (typeof parsed === 'object' && parsed !== null) 
          ? (parsed.objective || parsed.input || wf.prompt) 
          : wf.prompt;
      } catch {
        return wf.prompt;
      }
    }
    return "Untitled Workflow";
  }

  // Helper to extract unique tool components from a workflow
  const getToolIcons = (data: WorkflowResponse) => {
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

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight mb-2">My Workflows</h2>
          <p className="text-white/40 font-medium">Manage and refine your automation blueprints.</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-white/20 uppercase tracking-widest text-[10px] font-bold">Total Blueprints</span>
            <span className="text-2xl font-black text-white">{workflows.length}</span>
          </div>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="glass-panel p-20 text-center flex flex-col items-center justify-center bg-black/20 backdrop-blur-xl border border-white/5 rounded-3xl">
          <Box className="w-16 h-16 text-white/10 mb-6" />
          <p className="text-white/40 font-medium text-lg">No workflows saved yet.</p>
          <p className="text-white/20 text-sm mt-2">Generate your first blueprint from the Dashboard.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {workflows.map(wf => {
            const nodeCount = wf.data.nodes?.length || 0;
            const tools = getToolIcons(wf.data);
            const dateStr = new Date(wf.date).toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric' 
            });

            return (
              <div 
                key={wf.id} 
                onClick={() => onSelect(wf)}
                className="group relative flex flex-col md:flex-row md:items-center gap-4 p-5 md:p-6 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-2xl border border-white/5 hover:border-white/20 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl overflow-hidden"
              >
                {/* Left Accent Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/0 via-blue-500/40 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Date & Info */}
                <div className="flex-none flex flex-col items-start md:items-center justify-center md:w-20 md:border-r md:border-white/5 md:pr-6">
                  <span className="text-white/30 text-[10px] uppercase font-bold tracking-tighter mb-1">Created</span>
                  <span className="text-white font-bold text-sm whitespace-nowrap">{dateStr}</span>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest">
                      {wf.data.workflow_type || "General"}
                    </span>
                    <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded uppercase tracking-widest">
                      ID: {wf.id.toString().slice(-4)}
                    </span>
                  </div>
                  <h4 className="text-white font-semibold text-lg truncate pr-4">
                    {getWorkflowTitle(wf)}
                  </h4>
                </div>

                {/* Stats & Tools */}
                <div className="flex-none flex items-center gap-8 md:px-6">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest">Architecture</span>
                      <span className="text-white font-bold flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        {nodeCount} Nodes
                      </span>
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-col items-end min-w-[100px]">
                    <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-1.5">Integrations</span>
                    <div className="flex -space-x-2">
                      {tools.length > 0 ? tools.map((tool, idx) => (
                        <div 
                          key={idx}
                          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 backdrop-blur-md shadow-inner"
                          title={typeof tool === 'string' ? tool : 'Tool'}
                        >
                          {(typeof tool === 'string' ? tool.charAt(0) : '?').toUpperCase()}
                        </div>
                      )) : (
                        <div className="text-white/10 text-[10px] font-medium italic">None</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-none flex items-center justify-end gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                  <button 
                    onClick={(e) => handleDelete(wf.id, e)} 
                    className="p-2.5 rounded-xl bg-white/0 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all active:scale-95"
                    title="Delete Blueprint"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
