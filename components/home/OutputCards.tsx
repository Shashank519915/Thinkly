import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  GitBranch, Settings2, Wrench, TerminalSquare, TrendingUp, Clock, CheckCircle2, Copy, Download, Zap, Network, TrendingDown, ShieldCheck, Layers, Brain, Activity, Route, ChevronLeft, CalendarDays, Play, Loader2, Share2, Settings, Workflow, Check, ExternalLink, Plus
} from "lucide-react"
import { WorkflowResponse } from "@/types/workflow"
import { WorkflowMeta } from "@/components/providers/WorkflowProvider"
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [hasOpenedSidebar, setHasOpenedSidebar] = useState(false)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [isRunningLive, setIsRunningLive] = useState(false)
  const [runLogs, setRunLogs] = useState<Record<string, any>>({})

  const handleSidebarOpen = () => {
    setIsSidebarCollapsed(false)
    setHasOpenedSidebar(true)
  }

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
    <div className="flex flex-col gap-8 w-full max-w-[1550px] px-4 md:px-8 lg:px-12 pb-56 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out z-10">

      {/* Dashboard Header - Now at Root for Mobile Layout Flow */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-4 w-full mb-2">
        <div className="flex flex-col gap-2 sm:gap-1.5 min-w-0 order-2 sm:order-1">
          {meta.source === "saved" && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/40 hover:text-[var(--color-accent-blue)] transition-colors mb-1 sm:mb-0.5 w-fit uppercase tracking-wider"
            >
              <ChevronLeft className="w-3" />
              My Workflows
            </button>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl sm:text-3xl font-black text-white tracking-tighter uppercase leading-[0.9]">{meta.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/85 flex-shrink-0 bg-white/5 border border-white/5 px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                <CalendarDays className="w-3 h-3" />
                {formattedDate}
              </span>
              <span className="flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-black text-white/85 tracking-widest uppercase leading-none max-w-[110px] sm:max-w-none overflow-hidden">
                <span className="truncate whitespace-nowrap">ID: {workflowId}</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
            className="text-left group/prompt relative w-full sm:w-fit max-w-2xl mt-1.5"
          >
            <p className={cn(
              "text-[11px] sm:text-[10px] text-white/40 font-medium leading-relaxed transition-all duration-300 pr-8",
              isPromptExpanded
                ? "line-clamp-none opacity-100 bg-white/5 p-4 rounded-xl border border-white/10 shadow-inner"
                : "line-clamp-1 opacity-70 hover:opacity-100 italic"
            )}>
              "{cleanPrompt}"
            </p>
            {!isPromptExpanded && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/prompt:opacity-100 transition-opacity">
                <Plus className="w-3 h-3 text-white/40" />
              </div>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap order-1 sm:order-2 shrink-0">
          {!meta.isOwner && onDuplicate && (
            <button
              onClick={handleSaveToHistory}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--color-accent-blue)]/20 border border-[var(--color-accent-blue)]/30 text-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/30 transition-all text-[9.5px] font-black uppercase tracking-wider active:scale-95 disabled:opacity-50"
            >
              {saveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save
            </button>
          )}
          <button
            onClick={handleShare}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border transition-all text-[9.5px] font-black uppercase tracking-wider active:scale-95",
              shareCopied
                ? "bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                : "bg-white/5 border-white/10 text-white/85 hover:text-white hover:bg-white/10"
            )}
          >
            {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {shareCopied ? "Link" : "Share"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/85 hover:text-white hover:bg-white/10 transition-all text-[9.5px] font-black uppercase tracking-wider active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/85 hover:text-white hover:bg-white/10 transition-all text-[9.5px] font-black uppercase tracking-wider active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "JSON"}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full items-stretch lg:items-start">
        {/* Left Sidebar: Sticky Overview Pane */}
        <motion.div
          layout
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "w-full flex-shrink-0 transition-all duration-700 ease-in-out lg:sticky lg:top-8 group/sidebar relative",
            isSidebarCollapsed ? "lg:w-12" : "lg:w-[320px]"
          )}
        >
          <AnimatePresence mode="wait">
            {isSidebarCollapsed ? (
              /* Collapsed State Title Strip */
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={handleSidebarOpen}
                className={cn(
                  "flex flex-row lg:flex-col items-center justify-between lg:justify-start gap-4 lg:gap-6 py-4 px-6 lg:py-8 lg:px-0 h-auto lg:h-[540px] rounded-2xl bg-black/40 border border-white/5 hover:bg-black/60 hover:border-white/20 transition-all cursor-pointer group/strip relative overflow-hidden",
                  !hasOpenedSidebar && "animate-breathe-glow"
                )}
              >
                <div className="flex flex-row lg:flex-col items-center gap-4 relative">
                  <div className="relative">
                    <GitBranch className="w-5 h-5 text-[var(--color-accent-purple)] group-hover/strip:text-white transition-colors" />
                    {!hasOpenedSidebar && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--color-accent-purple)] shadow-[0_0_8px_var(--color-accent-purple)] animate-pulse border border-black" />
                    )}
                  </div>
                  <div className="hidden lg:block h-8 w-[1px] bg-white/10" />
                </div>
                <h4 className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] lg:rotate-180 lg:[writing-mode:vertical-rl] group-hover/strip:text-white/60 transition-colors">
                  Overview
                </h4>
                <div className="flex flex-row lg:flex-col items-center gap-4 lg:mt-auto">
                  <div className="hidden lg:block h-8 w-[1px] bg-white/10" />
                  <Plus className="w-4 h-4 text-white/20 group-hover/strip:text-white group-hover/strip:rotate-90 transition-all duration-500" />
                </div>
              </motion.div>
            ) : (
              /* Full Sidebar View */
              <motion.div
                key="expanded"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[var(--color-accent-purple)]" />
                    <h4 className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">Overview</h4>
                  </div>
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group/hide"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-white/30 group-hover/hide:text-white transition-colors lg:rotate-0 -rotate-90" />
                  </button>
                </div>

                <BreakdownCard
                  title="Input Layer"
                  description={data.nodes?.[0]?.description || (typeof data.workflow.input === 'string' && !data.workflow.input.startsWith('{') ? data.workflow.input : "Input definition for this lifecycle.")}
                  color="purple"
                />

                <BreakdownCard
                  title="Core Process"
                  description={data.workflow.process}
                  color="blue"
                />

                <BreakdownCard
                  title="Output Stage"
                  description={(() => {
                    const lastAction = [...(data.nodes || [])].reverse().find(n => n.type === 'action' || n.type === 'monitor');
                    return lastAction?.description || "Final resulting state of the automated process.";
                  })()}
                  color="teal"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {/* Right Pane: Main Technical Content */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-8 transition-all duration-700 ease-in-out">
          {/* Graph Section */}
          <div className="relative flex flex-col bg-black/20 rounded-2xl sm:rounded-3xl border border-white/5 overflow-hidden h-[540px] shadow-inner w-full">
            <div className="flex-shrink-0 flex items-center justify-center py-3.5 px-4 w-full bg-white/[0.02] border-b border-white/5">
              <p className="text-[9px] sm:text-[10px] text-white/40 font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                Drag to pan • Scroll to zoom • Click nodes for logic
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <WorkflowGraph
                nodes={data.nodes}
                isRunningLive={isRunningLive}
                runLogs={runLogs}
              />
            </div>
          </div>

          {/* Tools & Integration Stack - Positioned below Graph */}
          <Card title="Tools & Integration Stack">
            <div className="flex flex-wrap gap-2.5">
              {data.tools.map(t => (
                <span key={JSON.stringify(t)} className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.1em] bg-black/40 backdrop-blur-xl text-white/85 border-white/10 hover:border-[var(--color-accent-teal)]/30 hover:text-white transition-all duration-300 shadow-inner">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-teal)] shadow-[0_0_6px_var(--color-accent-teal)]" />
                  {typeof t === 'object' ? (t as any).label || (t as any).type || JSON.stringify(t) : t}
                </span>
              ))}
            </div>
          </Card>

          {/* Metrics & Design Stack */}
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="ROI & Business Impact">
                <div className="flex flex-col gap-3">
                  <StatCell icon={<Clock className="w-4 h-4" />} value={data.impact.time_saved} label="Estimated Time Saved" color="text-green-400" accent="bg-green-500" />
                  <StatCell icon={<Zap className="w-4 h-4" />} value={data.impact.automation} label="Automation Coverage" color="text-[var(--color-accent-purple)]" accent="bg-[var(--color-accent-purple)]" />
                </div>
              </Card>

              <Card title="System Reliability">
                <div className="flex flex-col gap-3">
                  <ArchMetric icon={<Route className="w-4 h-4 text-[var(--color-accent-blue)]" />} title="State Management" description={data.architecture.state_management} accent="bg-[var(--color-accent-blue)]" />
                  <ArchMetric icon={<ShieldCheck className="w-4 h-4 text-green-400" />} title="Idempotency Strategy" description={data.architecture.idempotency_strategy} accent="bg-green-500" />
                </div>
              </Card>
            </div>

            <Card title="Logic & Implementation Blueprint">
              <CodeBlock code={data.logic} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownCard({ title, description, color }: { title: string, description: string, color: 'purple' | 'blue' | 'teal' }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = description.length > 120
  const colorMap = {
    purple: "bg-[var(--color-accent-purple)]",
    blue: "bg-[var(--color-accent-blue)]",
    teal: "bg-[var(--color-accent-teal)]",
  }
  return (
    <div
      onClick={() => isLong && setExpanded(!expanded)}
      className={cn(
        "flex flex-col gap-3 p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-all duration-300 group/item shadow-2xl relative overflow-hidden backdrop-blur-md",
        isLong && "cursor-pointer"
      )}
    >
      <div className={cn("absolute top-0 left-0 w-1 h-full opacity-30", colorMap[color])} />
      <div className="flex items-center gap-2 mb-0.5">
        <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]", color === 'purple' ? 'text-[var(--color-accent-purple)] bg-current' : color === 'blue' ? 'text-[var(--color-accent-blue)] bg-current' : 'text-[var(--color-accent-teal)] bg-current')} />
        <span className={cn("font-black text-[9px] uppercase tracking-widest opacity-100 group-hover/item:opacity-100 transition-opacity", color === 'purple' ? 'text-[var(--color-accent-purple)]' : color === 'blue' ? 'text-[var(--color-accent-blue)]' : 'text-[var(--color-accent-teal)]')} >
          {title}
        </span>
      </div>
      <p className={cn(
        "text-[11px] text-white/70 leading-relaxed font-medium pl-3.5 border-l border-white/5 group-hover:text-white transition-all duration-300",
        !expanded && isLong && "line-clamp-3"
      )}>
        {description}
      </p>
      {!expanded && isLong && (
        <span className="text-[7px] font-black text-white/20 uppercase mt-1 pl-3.5 animate-pulse">Click to expand</span>
      )}
    </div>
  )
}

function Card({ title, icon, children, className }: { title: string, icon?: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <div className={`glass-panel p-4 sm:p-5 bg-black/35 backdrop-blur-3xl border border-white/8 shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-all duration-500 flex flex-col group/card ${className}`}>
      <div className="flex items-center gap-2.5 mb-5">
        {icon && (
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/card:bg-white/10 transition-colors shadow-lg shrink-0">
            {icon}
          </div>
        )}
        <h4 className="text-sm font-black text-white/85 tracking-tight uppercase tracking-[0.05em]">{title}</h4>
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
        "flex items-center gap-4 p-4 rounded-xl bg-black/30 border border-white/5 hover:bg-black/40 hover:border-white/15 transition-all duration-300 relative overflow-hidden group",
        isLong && "cursor-pointer"
      )}
    >
      <div className={`absolute top-0 left-0 w-0.5 h-full opacity-40 ${accent}`} />
      <div className={cn("flex flex-col items-center justify-center w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-all duration-300", color)}>
        {icon}
      </div>
      <div className="w-[1px] h-8 bg-white/5 shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/80 group-hover:text-white transition-colors">{label}</span>
        <div className={cn(
          "text-[12px] font-bold text-white/85 tracking-tight leading-relaxed transition-all duration-300",
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
        "flex items-center gap-4 p-4 rounded-xl bg-black/30 border border-white/5 hover:bg-black/40 hover:border-white/15 transition-all duration-300 group relative overflow-hidden",
        isLong && "cursor-pointer"
      )}
    >
      <div className={`absolute top-0 left-0 w-0.5 h-full opacity-40 ${accent}`} />
      <div className="flex flex-col items-center justify-center w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-all duration-300">
        {icon}
      </div>
      <div className="w-[1px] h-8 bg-white/5 shrink-0" />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/80 group-hover:text-white transition-colors">{title}</span>
        <div className={cn(
          "text-[11px] text-white/85 leading-relaxed font-medium transition-all duration-300",
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
