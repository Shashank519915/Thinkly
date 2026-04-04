import { useState, useEffect } from "react"
import { WorkflowResponse } from "@/types/workflow"
import { Clock, ExternalLink, Trash2, Layers, Cpu, Box, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export interface SavedWorkflow {
  id: string | number;
  id_temp: string | number;
  prompt: string;
  data: WorkflowResponse;
  created_at: string;
  name?: string;
  workflow_type?: string;
}

export function MyWorkflowsView({ onSelect }: { onSelect: (workflow: SavedWorkflow) => void }) {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        fetchWorkflows(user.id)
      } else {
        const guestId = localStorage.getItem("thinkly_guest_id")
        if (guestId) fetchGuestWorkflows(guestId)
        else setLoading(false)
      }
    }
    checkUser()
  }, [])

  const fetchWorkflows = async (uid: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setWorkflows(data as any)
    } catch (err) {
      console.error("Fetch workflows error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGuestWorkflows = async (guestId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('guest_workflows')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setWorkflows(data as any)
    } catch (err) {
      console.error("Fetch guest workflows error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const table = userId ? 'workflows' : 'guest_workflows'
      const idKey = userId ? 'user_id' : 'guest_id'
      const idVal = userId || localStorage.getItem("thinkly_guest_id")

      if (!idVal) return

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq(idKey, idVal)

      if (error) throw error
      setWorkflows(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      console.error("Delete workflow error:", err)
    }
  }


  // Helper to safely extract a displayable title from a workflow
  const getWorkflowTitle = (wf: SavedWorkflow): string => {
    if (wf.name) return wf.name;
    
    const extractFromValue = (val: any): string | null => {
      if (!val) return null;
      
      if (typeof val === 'object') {
        // 1. Try standard keys
        const standardKeys = ['objective', 'title', 'name', 'prompt', 'intent', 'message', 'description', 'task'];
        for (const key of standardKeys) {
          if (val[key] && typeof val[key] === 'string' && val[key].length > 4) return val[key];
        }

        // 2. Try to find the first "long-ish" string value that isn't a technical ID or type
        const values = Object.values(val);
        const firstGoodString = values.find(v => 
          typeof v === 'string' && 
          v.length > 5 && 
          !v.includes('/') && 
          !/^[0-9a-f-]{20,}$/.test(v)
        );
        if (firstGoodString) return firstGoodString as string;

        // 3. Last resort for objects
        return JSON.stringify(val).slice(0, 50);
      }

      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            return extractFromValue(parsed);
          } catch { return trimmed.slice(0, 60); }
        }
        return val;
      }
      return String(val);
    };

    // 1. Try prompt first (original intent)
    const promptTitle = extractFromValue(wf.prompt);
    if (promptTitle && promptTitle.length > 3) return promptTitle;

    // 2. Try input data
    const inputTitle = extractFromValue(wf.data?.workflow?.input);
    if (inputTitle && inputTitle.length > 3) return inputTitle;
    
    // 3. Fallback to workflow type
    return wf.workflow_type || wf.data?.workflow_type || "Untitled Workflow";
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
    <div className="w-full max-w-5xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-3">My Workflows</h2>
          <p className="text-white/40 font-medium text-sm">Manage and refine your generated automation blueprints.</p>
        </div>
        <div className="flex items-center gap-8 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-white/20 uppercase tracking-[0.2em] text-[9px] font-black mb-1">Total Blueprints</span>
            <span className="text-3xl font-black text-white drop-shadow-lg">{workflows.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-white/20">
          <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500/50" />
          <span className="text-xs font-bold uppercase tracking-widest">Accessing Secure Vault...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="glass-panel p-24 text-center flex flex-col items-center justify-center bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl">
          <Box className="w-16 h-16 text-white/5 mb-8" />
          <p className="text-white/40 font-bold text-xl tracking-tight">No workflows archived yet.</p>
          <p className="text-white/20 text-sm mt-3 font-medium">Generate your first elite blueprint to see it here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {workflows.map(wf => {
            const nodeCount = wf.data.nodes?.length || 0;
            const tools = getToolIcons(wf.data);
            const dateStr = new Date(wf.created_at).toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric' 
            });

            return (
              <div 
                key={wf.id} 
                onClick={() => onSelect(wf)}
                className="group relative flex flex-col md:flex-row md:items-center gap-5 p-6 md:p-8 bg-black/40 hover:bg-black/60 backdrop-blur-3xl border border-white/5 hover:border-white/15 rounded-2xl cursor-pointer transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
              >
                {/* Left Elevation Glow */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                
                {/* Bottom Interactive Glow */}
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-white/15 transition-all duration-500" />

                {/* Date & Info */}
                <div className="flex-none flex flex-col items-start md:items-center justify-center md:w-24 md:border-r md:border-white/10 md:pr-8">
                  <span className="text-white/20 text-[9px] uppercase font-black tracking-[0.2em] mb-1.5 grayscale group-hover:grayscale-0 group-hover:text-blue-400/60 transition-all">Created</span>
                  <span className="text-white font-bold text-sm whitespace-nowrap tracking-tight">{dateStr}</span>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 uppercase tracking-widest shadow-sm">
                      {wf.data.workflow_type || "General"}
                    </span>
                    <span className="text-[9px] font-black text-white/30 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-widest">
                      ID: {wf.id.toString().slice(-4)}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-xl truncate pr-6 group-hover:text-blue-50 transition-colors tracking-tight">
                    {getWorkflowTitle(wf)}
                  </h4>
                </div>

                {/* Stats & Tools */}
                <div className="flex-none flex items-center gap-10 md:px-8">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] mb-1.5">Architecture</span>
                      <span className="text-white font-bold text-sm flex items-center gap-2 grayscale group-hover:grayscale-0 transition-all drop-shadow-md">
                        <Layers className="w-4 h-4 text-blue-400/80" />
                        {nodeCount} Nodes
                      </span>
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-col items-end min-w-[120px]">
                    <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] mb-2">Integrations</span>
                    <div className="flex -space-x-2.5">
                      {tools.length > 0 ? tools.map((tool, idx) => (
                        <div 
                          key={idx}
                          className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[9px] font-black text-white/60 backdrop-blur-md shadow-2xl ring-2 ring-black group-hover:ring-zinc-800 transition-all"
                          title={typeof tool === 'string' ? tool : 'Tool'}
                        >
                          {(typeof tool === 'string' ? tool.slice(0, 2) : '??').toUpperCase()}
                        </div>
                      )) : (
                        <div className="text-white/10 text-[10px] font-bold italic uppercase tracking-widest">Pure Logic</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-none flex items-center justify-end gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-5 md:pt-0 md:pl-8">
                  <button 
                    onClick={(e) => handleDelete(wf.id, e)} 
                    className="p-3 rounded-2xl bg-white/0 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all active:scale-90 border border-transparent hover:border-red-500/20"
                    title="Delete Blueprint"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-400 transition-all shadow-xl active:scale-95">
                    <ExternalLink className="w-5 h-5" />
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
