import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  GitBranch, Settings2, Wrench, TerminalSquare, TrendingUp, Clock, CheckCircle2, Copy, Download, Zap, Network, TrendingDown, ShieldCheck, Layers, Brain, Activity, Route, ChevronLeft, CalendarDays, Play, Loader2, Share2, Settings, Workflow, Check, ExternalLink, Plus
} from "lucide-react"
import { WorkflowResponse } from "@/types/workflow"
import type { WorkflowMeta } from "@/app/page"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { WorkflowGraph } from "./WorkflowGraph"
import { generateN8nSchema } from "@/lib/export/n8n"
import { supabase } from "@/lib/supabase/client"

export function OutputCards({
  data,
  meta,
  onBack,
  onDuplicate,
  mode = 'design'
}: {
  data: WorkflowResponse,
  meta: WorkflowMeta,
  onBack?: () => void,
  onDuplicate?: (data: WorkflowResponse, prompt: string) => void,
  mode?: 'design' | 'execution'
}) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [isRunningLive, setIsRunningLive] = useState(false)
  const [runLogs, setRunLogs] = useState<Record<string, any>>({})

  const workflowId = (() => {
    try {
      const id = new Date(meta.generatedAt).getTime()
      return id.toString().slice(-4)
    } catch { return "????" }
  })()

  const formattedDate = (() => {
    try {
      const d = new Date(meta.generatedAt)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return "Just now"
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    } catch { return "" }
  })()

  const cleanPrompt = (() => {
    const p = meta.prompt
    try {
      const parsed = JSON.parse(p)
      if (typeof parsed === 'object' && parsed !== null) {
        const first = Object.values(parsed).find(v => typeof v === 'string')
        return (first as string) ?? p
      }
    } catch { /* not JSON */ }
    return p
  })()

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    const n8nSchema = generateN8nSchema(data.nodes);
    const blob = new Blob([JSON.stringify(n8nSchema, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "thinkly_n8n_blueprint.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }



  const handleRunLive = async () => {
    if (!data || isRunningLive) {
      if (isRunningLive) setIsRunningLive(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert("Please login to run live automations.")
      return
    }

    setIsRunningLive(true)
    setRunLogs({})

    try {
      const resp = await fetch('/api/run/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ nodes: data.nodes, edges: data.edges || [] })
      })

      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || `Workflow execution failed`)

      // Convert backend logs into the frontend format runLogs expects
      const newLogs: Record<string, any> = {}
      if (result.logs) {
        result.logs.forEach((log: any) => {
          newLogs[log.nodeId] = {
            status: log.status,
            output: log.output,
            error: log.error
          }
        })
      }
      setRunLogs(newLogs)

      if (result.status === 'failed') {
        throw new Error("Workflow failed. Check logs for details.")
      }
    } catch (err: any) {
      console.error("Live run failed:", err)
      alert(err.message)
    } finally {
      setIsRunningLive(false)
    }
  }

  const handleSaveToHistory = async () => {
    setSaveLoading(true)
    try {
      if (onDuplicate) {
        await onDuplicate(data, meta.prompt)
      }
    } finally {
      setSaveLoading(false)
    }
  }

  const handleShare = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert("Please login to share your blueprints on the cloud!")
      return
    }

    try {
      const { error } = await supabase.from('workflows').upsert({
        user_id: user.id,
        prompt: meta.prompt,
        data: data,
        id_temp: new Date(meta.generatedAt).getTime(),
        is_public: true,
        created_at: meta.generatedAt
      }, { onConflict: 'user_id,id_temp' })

      if (error) throw error

      const shareUrl = `${window.location.origin}?s=${new Date(meta.generatedAt).getTime()}`
      await navigator.clipboard.writeText(shareUrl)

      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 3000)
    } catch (err: any) {
      console.error("Share failed:", err)
      alert("Failed to generate share link. Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto px-4 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-4">
        <div className="flex flex-col gap-2 sm:gap-1.5 min-w-0 order-2 sm:order-1">
          {meta.source === "saved" && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/40 hover:text-[var(--color-accent-blue)] transition-colors mb-1 sm:mb-0.5 w-fit"
            >
              <ChevronLeft className="w-3" />
              My Workflows
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Settings2 className="w-4 h-4 text-[var(--color-accent-blue)] flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{meta.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-medium text-white/35 flex-shrink-0 bg-white/5 px-2 py-0.5 rounded-full">
                <CalendarDays className="w-3 h-3" />
                {formattedDate}
              </span>
              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-white/40 tracking-wider">
                ID: {workflowId}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
            className="text-left group/prompt relative w-full sm:w-fit max-w-xl mt-1"
          >
            <p className={cn(
              "text-[11px] sm:text-[10px] text-white/35 font-medium leading-relaxed transition-all duration-300 pr-6",
              isPromptExpanded
                ? "line-clamp-none opacity-100 bg-white/5 p-3 sm:p-2.5 rounded-xl border border-white/10 shadow-inner"
                : "line-clamp-1 opacity-60 hover:opacity-100"
            )}>
              "{cleanPrompt}"
            </p>
            {!isPromptExpanded && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/prompt:opacity-100 transition-opacity">
                <Plus className="w-3 h-3 text-white/30" />
              </div>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap order-1 sm:order-2">
          {!meta.isOwner && onDuplicate && (
            <button
              onClick={handleSaveToHistory}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-blue)]/20 border border-[var(--color-accent-blue)]/30 text-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/30 transition-all text-[9.5px] font-bold uppercase tracking-wider active:scale-95 disabled:opacity-50"
            >
              {saveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save to My History
            </button>
          )}
          <button
            onClick={handleShare}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[9.5px] font-bold uppercase tracking-wider active:scale-95",
              shareCopied
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
            )}
          >
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {shareCopied ? "Link Copied" : "Share"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[9.5px] font-bold uppercase tracking-wider active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[9.5px] font-bold uppercase tracking-wider active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>


      {/* Card 1: Breakdown */}
      <Card title="Workflow Breakdown" icon={<GitBranch className="w-4 h-4 text-[var(--color-accent-purple)]" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Input */}
          <div className="flex flex-col gap-2 p-4.5 rounded-2xl bg-black/20 border border-white/8 hover:bg-black/30 transition-all duration-300 group/item shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent-purple)] opacity-30" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-purple)] shadow-[0_0_8px_var(--color-accent-purple)]" />
              <span className="text-[var(--color-accent-purple)] font-black text-[9px] uppercase tracking-widest opacity-80 group-hover/item:opacity-100 transition-opacity">Input Data</span>
            </div>
            <div className="pl-3.5 border-l border-white/10">
              <p className="text-[11px] text-white/50 leading-relaxed font-medium italic">
                {data.nodes?.[0]?.description || (typeof data.workflow.input === 'string' && !data.workflow.input.startsWith('{') ? data.workflow.input : "Input definition for this lifecycle.")}
              </p>
            </div>
          </div>

          {/* Process */}
          <div className="flex flex-col gap-2 p-4.5 rounded-2xl bg-black/20 border border-white/8 hover:bg-black/30 transition-all duration-300 group/item shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent-blue)] opacity-30" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-blue)] shadow-[0_0_8px_var(--color-accent-blue)]" />
              <span className="text-[var(--color-accent-blue)] font-black text-[9px] uppercase tracking-widest opacity-80 group-hover/item:opacity-100 transition-opacity">Core Process</span>
            </div>
            <div className="pl-3.5 border-l border-white/10">
              <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                {data.workflow.process}
              </p>
            </div>
          </div>

          {/* Output */}
          <div className="flex flex-col gap-2 p-4.5 rounded-2xl bg-black/20 border border-white/8 hover:bg-black/30 transition-all duration-300 group/item shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent-teal)] opacity-30" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-teal)] shadow-[0_0_8px_var(--color-accent-teal)]" />
              <span className="text-[var(--color-accent-teal)] font-black text-[9px] uppercase tracking-widest opacity-80 group-hover/item:opacity-100 transition-opacity">Result / Output</span>
            </div>
            <div className="pl-3.5 border-l border-white/10">
              <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                {(() => {
                   const lastAction = [...(data.nodes || [])].reverse().find(n => n.type === 'action' || n.type === 'monitor');
                   return lastAction?.description || "Final resulting state of the automated process.";
                })()}
              </p>
            </div>
          </div>
        </div>
      </Card>


      {/* Graph Section */}
      <div
        className="relative mt-12 mb-16 flex flex-col bg-transparent h-[560px] sm:h-[480px]"
        style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}
      >
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 px-4 max-w-5xl mx-auto w-full gap-4 sm:gap-0">
          <div className="flex flex-row items-center justify-between sm:justify-start w-full sm:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 shadow-lg shadow-purple-500/5">
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-sm font-black text-white/90 tracking-tight whitespace-nowrap uppercase tracking-[0.05em]">Automation Graph Engine</h4>
            </div>

            <div className="flex items-center gap-2">
              {mode === 'execution' && (
                <button
                  onClick={handleRunLive}
                  disabled={isRunningLive}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${isRunningLive
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                    }`}
                >
                  {isRunningLive ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Executing…
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 fill-current" />
                      Run Live Automation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="hidden sm:block text-[10px] text-white/20 font-black uppercase tracking-widest opacity-40">Drag to pan • Scroll to zoom • Click nodes for logic</p>
        </div>

        <div className="flex-1 w-full relative">
          <WorkflowGraph
            nodes={data.nodes}
            isRunningLive={isRunningLive}
            runLogs={runLogs}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Tools */}
        <Card title="Tools & Integrations" icon={<Wrench className="w-4 h-4 text-[var(--color-accent-teal)]" />}>
          <div className="flex flex-wrap gap-2.5">
            {data.tools.map(t => (
              <span key={JSON.stringify(t)} className="flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[11px] font-bold tracking-wide bg-black/60 text-white/60 border-white/10 hover:border-white/25 hover:text-white hover:bg-black/80 transition-all duration-300 shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-teal)] shadow-[0_0_6px_var(--color-accent-teal)]" />
                {typeof t === 'object' ? JSON.stringify(t) : t}
              </span>
            ))}
          </div>
        </Card>


        {/* ROI */}
        <Card title="Return on Investment" icon={<TrendingUp className="w-4 h-4 text-green-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCell icon={<Clock className="w-4 h-4" />} value={data.impact.time_saved} label="Estimated Time Saved" color="text-green-400" accent="bg-green-500" />
            <StatCell icon={<Zap className="w-4 h-4" />} value={data.impact.automation} label="Automation Coverage" color="text-[var(--color-accent-purple)]" accent="bg-[var(--color-accent-purple)]" />
          </div>
        </Card>

        {/* System Design */}
        <Card title="System Design & Reliability" icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ArchMetric icon={<Route className="w-4 h-4 text-[var(--color-accent-blue)]" />} title="State Management" description={data.architecture.state_management} accent="bg-[var(--color-accent-blue)]" />
            <ArchMetric icon={<ShieldCheck className="w-4 h-4 text-green-400" />} title="Idempotency Strategy" description={data.architecture.idempotency_strategy} accent="bg-green-500" />
          </div>
        </Card>
      </div>

      {/* Code Blueprint */}
      <Card title="Logic & Code Blueprint" icon={<TerminalSquare className="w-4 h-4 text-pink-400" />}>
        <CodeBlock code={data.logic} />
      </Card>
    </div>
  )
}

function SafeJsonView({ value, className }: { value: any, className?: string }) {
  if (typeof value === 'string') {
    try {
      const trimmed = value.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        return (
          <div className={cn("mt-2 font-mono text-[10px] leading-snug text-white/40 bg-black/40 p-3 rounded-xl border border-white/5 break-all whitespace-pre-wrap shadow-inner", className)}>
            {JSON.stringify(parsed, null, 2)}
          </div>
        );
      }
    } catch { /* Fallback to standard text */ }
  }
  
  if (typeof value === 'object' && value !== null) {
    return (
      <div className={cn("mt-2 font-mono text-[10px] leading-snug text-white/40 bg-black/40 p-3 rounded-xl border border-white/5 break-all whitespace-pre-wrap shadow-inner", className)}>
        {JSON.stringify(value, null, 2)}
      </div>
    );
  }

  return <span className={cn("text-white/70 leading-relaxed", className)}>{String(value)}</span>;
}

function Card({ title, icon, children, className }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <div className={`glass-panel p-4 sm:p-5 bg-black/20 backdrop-blur-3xl border border-white/8 shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-all duration-500 flex flex-col group/card ${className}`}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/card:bg-white/10 transition-colors shadow-lg">
          {icon}
        </div>
        <h4 className="text-sm font-black text-white/80 tracking-tight uppercase tracking-[0.05em]">{title}</h4>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function StatCell({ icon, value, label, color, accent }: { icon: React.ReactNode, value: string, label: string, color: string, accent?: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = (typeof value === 'string' && value.length > 80) || typeof value === 'object'

  return (
    <div 
      onClick={() => isLong && setExpanded(!expanded)}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl bg-black/15 border border-white/5 hover:bg-black/25 hover:border-white/15 transition-all duration-300 relative overflow-hidden group",
        isLong && "cursor-pointer"
      )}
    >
      <div className={`absolute top-0 left-0 w-0.5 h-full opacity-40 ${accent}`} />
      
      {/* Icon Side */}
      <div className="flex flex-col items-center justify-center w-10 shrink-0">
        <div className={cn("p-2 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/50 group-hover:text-white transition-all shadow-lg mb-0.5", color)}>
          {icon}
        </div>
        <span className="text-[6px] font-black uppercase tracking-tighter text-white/10 group-hover:text-white/20 transition-colors">metric</span>
      </div>

      {/* Separator */}
      <div className="w-[1px] h-8 bg-white/5 shrink-0" />

      {/* Content Side */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/30 group-hover:text-white/50 transition-colors">{label}</span>
        <div className={cn(
          "text-[12px] font-bold text-white tracking-tight leading-relaxed transition-all duration-300",
          !expanded && isLong && "line-clamp-2"
        )}>
          {typeof value === 'object' ? JSON.stringify(value) : value}
        </div>
        {!expanded && isLong && (
          <span className="text-[7px] font-black text-purple-400/60 uppercase mt-0.5 animate-pulse">Click to expand</span>
        )}
      </div>
    </div>
  )
}

function ArchMetric({ icon, title, description, accent }: { icon: React.ReactNode, title: string, description: string, accent?: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = (typeof description === 'string' && description.length > 80) || typeof description === 'object'

  return (
    <div 
      onClick={() => isLong && setExpanded(!expanded)}
      className={cn(
        "flex items-start gap-4 p-4 rounded-xl bg-black/15 border border-white/5 hover:border-white/15 hover:bg-black/25 transition-all duration-300 group relative overflow-hidden",
        isLong && "cursor-pointer"
      )}
    >
      <div className={`absolute top-0 left-0 w-0.5 h-full opacity-40 ${accent}`} />
      
      {/* Icon Side */}
      <div className="flex flex-col items-center justify-center w-10 shrink-0">
        <div className="p-2 rounded-lg bg-white/5 border border-white/8 flex-shrink-0 shadow-lg group-hover:bg-white/10 transition-all">
          {icon}
        </div>
        <span className="text-[6px] font-black uppercase tracking-tighter text-white/10 mt-0.5">arch</span>
      </div>

      {/* Separator */}
      <div className="w-[1px] h-8 bg-white/5 shrink-0 self-center" />

      {/* Content Side */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/30 group-hover:text-white/50 transition-colors">{title}</span>
        <div className={cn(
          "text-[11px] text-white/50 leading-relaxed font-medium transition-all duration-300",
          !expanded && isLong && "line-clamp-2"
        )}>
          {typeof description === 'object' ? JSON.stringify(description) : description}
        </div>
        {!expanded && isLong && (
          <span className="text-[7px] font-black text-blue-400/60 uppercase mt-0.5 animate-pulse">Click to explore</span>
        )}
      </div>
    </div>
  )
}



function CodeBlock({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-xl font-mono text-sm leading-relaxed border border-white/8 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] bg-[#111] group overflow-hidden">
      <div className={`transition-all duration-300 relative ${expanded ? '' : 'max-h-[200px] overflow-hidden'}`}>
        <SyntaxHighlighter
          language="javascript"
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '11px' }}
        >
          {code}
        </SyntaxHighlighter>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#111] to-transparent pointer-events-none" />
        )}
      </div>
      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
        <button onClick={handleCopy} className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-colors border border-white/8">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setExpanded(!expanded)} className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white transition-colors border border-white/8 text-[10px] font-bold uppercase tracking-wider">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
    </div>
  )
}
