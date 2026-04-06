import { useState, useEffect } from "react"
import { WorkflowResponse } from "@/types/workflow"
import { Clock, ExternalLink, Trash2, Layers, Cpu, Box, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export interface SavedWorkflow {
  id: string | number;
  id_temp: string | number;
  prompt: string;
  data?: WorkflowResponse; // Made optional because we only lazy-load this now
  created_at: string;
  name?: string;
  workflow_type?: string;
  node_count?: number;
  tools?: any[];
}

export function MyWorkflowsView({ onSelect }: { onSelect: (workflow: SavedWorkflow) => void }) {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 7

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        fetchWorkflows(user.id, page)
      } else {
        const guestId = localStorage.getItem("thinkly_guest_id")
        if (guestId) fetchGuestWorkflows(guestId, page)
        else setLoading(false)
      }
    }
    checkUser()
  }, [page]) // Refetch on page change

  const fetchWorkflows = async (uid: string, pageNum: number) => {
    setLoading(true)
    try {
      const { data, count, error } = await supabase
        .from('workflows')
        .select('id, id_temp, prompt, created_at, name, workflow_type, node_count, tools', { count: 'exact' })
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * limit, pageNum * limit - 1)

      if (error) throw error
      if (data) setWorkflows(data as any)
      if (count !== null) setTotalPages(Math.max(1, Math.ceil(count / limit)))
    } catch (err) {
      console.error("Fetch workflows error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGuestWorkflows = async (guestId: string, pageNum: number) => {
    setLoading(true)
    try {
      const { data, count, error } = await supabase
        .from('guest_workflows')
        .select('id, id_temp, prompt, created_at, name, workflow_type, node_count, tools', { count: 'exact' })
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * limit, pageNum * limit - 1)

      if (error) throw error
      if (data) setWorkflows(data as any)
      if (count !== null) setTotalPages(Math.max(1, Math.ceil(count / limit)))
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
      
      // If we deleted the last item on the page, and we are not on page 1, go back a page
      if (workflows.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        if (userId) fetchWorkflows(userId, page)
        else fetchGuestWorkflows(idVal, page)
      }
    } catch (err) {
      console.error("Delete workflow error:", err)
    }
  }

  // Generate pagination buttons
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className="flex items-center justify-center gap-2 mt-12 mb-8 select-none">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 rounded-xl border border-white/10 bg-black/40 text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        {pages.map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`w-10 h-10 rounded-xl font-black text-[13px] flex items-center justify-center transition-all ${
              page === p 
                ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-blue-400" 
                : "bg-black/40 border border-white/10 text-white/50 hover:text-white hover:bg-white/5 hover:border-white/20"
            }`}
          >
            {p}
          </button>
        ))}

        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="p-2 rounded-xl border border-white/10 bg-black/40 text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-3">My Workflows</h2>
          <p className="text-white/40 font-medium text-sm">Manage and refine your generated automation blueprints.</p>
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
        <>
          <div className="flex flex-col gap-4">
            {workflows.map(wf => {
              const nodeCount = wf.node_count || 0;
              const tools = wf.tools || [];
              const dateStr = new Date(wf.created_at).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
              });
              const displayName = wf.name || "Untitled Blueprint";

              return (
                <div 
                  key={wf.id} 
                  onClick={() => onSelect(wf)}
                  className="group relative flex flex-col md:flex-row md:items-center gap-4 md:gap-8 p-4 md:p-8 bg-black/40 hover:bg-black/60 backdrop-blur-3xl border border-white/5 hover:border-white/15 rounded-2xl cursor-pointer transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
                >
                  {/* Left Elevation Glow */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  
                  {/* Bottom Interactive Glow */}
                  <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-white/15 transition-all duration-500" />

                  {/* Date & Info (Desktop only Column) */}
                  <div className="hidden md:flex flex-none flex-col items-center justify-center md:w-24 md:border-r md:border-white/10 md:pr-8">
                    <span className="text-white/20 text-[9px] uppercase font-black tracking-[0.2em] mb-1.5 grayscale group-hover:grayscale-0 group-hover:text-blue-400/60 transition-all">Created</span>
                    <span className="text-white font-bold text-sm whitespace-nowrap tracking-tight">{dateStr}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 uppercase tracking-widest shadow-sm">
                        {wf.workflow_type || "General Automation"}
                      </span>
                      <span className="md:hidden text-[9px] font-black text-white/40 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-widest">
                        {dateStr}
                      </span>
                      <span className="text-[9px] font-black text-white/30 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-widest">
                        ID: {wf.id.toString().slice(-4)}
                      </span>
                    </div>
                    <h4 className="text-white font-bold text-lg md:text-xl truncate pr-6 group-hover:text-blue-50 transition-colors tracking-tight">
                      {displayName}
                    </h4>
                  </div>

                    {/* Stats (Mobile Unified Row) */}
                    <div className="flex-none flex flex-row items-center justify-between md:justify-end gap-3 md:gap-10 md:px-8 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                      <div className="flex items-center gap-4">
                        {/* Architecture */}
                        <div className="flex flex-col items-start md:items-end">
                          <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] mb-1.5">Architecture</span>
                          <span className="text-white font-bold text-sm flex items-center gap-2 grayscale group-hover:grayscale-0 transition-all drop-shadow-md">
                            <Layers className="w-4 h-4 text-blue-400/80" />
                            {nodeCount} <span className="hidden sm:inline">Nodes</span>
                          </span>
                        </div>

                        {/* Mobile Integrations (Hidden on LG since desktop view is below) */}
                        {tools.length > 0 && (
                          <div className="flex lg:hidden flex-col items-start">
                            <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] mb-1.5">Tools</span>
                            <div className="flex items-center -space-x-1.5">
                              {tools.slice(0, 2).map((tool, idx) => (
                                <div 
                                  key={idx}
                                  className="w-7 h-7 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[8px] font-black text-white/60 backdrop-blur-md ring-1 ring-black shadow-lg"
                                  title={typeof tool === 'string' ? tool : 'Tool'}
                                >
                                  {(typeof tool === 'string' ? tool.slice(0, 2) : '??').toUpperCase()}
                                </div>
                              ))}
                              {tools.length > 2 && (
                                <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[8px] font-black text-blue-400 backdrop-blur-md ring-1 ring-black shadow-lg">
                                  +{tools.length - 2}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Desktop Integrations (Hidden on Mobile) */}
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

                    {/* Unified Actions Bar for Mobile/Tablet */}
                    <div className="flex items-center gap-3 md:border-l md:border-white/10 md:pl-8">
                      <button 
                        onClick={(e) => handleDelete(wf.id, e)} 
                        className="p-2.5 rounded-xl bg-white/0 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all active:scale-90 border border-transparent hover:border-red-500/20"
                        title="Delete Blueprint"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-400 transition-all shadow-xl active:scale-95">
                        <ExternalLink className="w-4.5 h-4.5 md:w-5 md:h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {renderPagination()}
        </>
      )}
    </div>
  )
}
