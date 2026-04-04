"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, ArrowUp, ChevronDown, ChevronUp,
  CheckCircle2, X, AlertTriangle, Bot, User,
  RefreshCw, Loader2, Terminal, Zap
} from "lucide-react"
import { WorkflowResponse } from "@/types/workflow"
import { WorkflowPatch, mergeWorkflowPatch } from "@/lib/ai/workflowPatcher"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"


// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "patch"
  content: string
  mode: "answer" | "patch"
  patch?: WorkflowPatch
  applied?: boolean
  dismissed?: boolean
  timestamp: string
}

interface RefinementChatProps {
  workflow: WorkflowResponse
  originalPrompt: string
  workflowId: string
  onApplyPatch: (patched: WorkflowResponse) => void
  disabled?: boolean
  isOwner?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RefinementChat({
  workflow,
  originalPrompt,
  workflowId,
  onApplyPatch,
  disabled = false,
  isOwner = true
}: RefinementChatProps) {
  const [text, setText] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [useLessTokens, setUseLessTokens] = useState(false)
  const [showTokenTooltip, setShowTokenTooltip] = useState(false)
  const [hoveredModel, setHoveredModel] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState("gemma-4-31b-it")
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [loadingStage, setLoadingStage] = useState(0)
  const isInitialMount = useRef(true)


  // Persist + restore chat history per workflow
  const storageKey = `thinkly_chat_${workflowId}`

  useEffect(() => {
    const fetchHistory = async () => {
      // 1. Try Supabase first
      try {
        const guestId = localStorage.getItem("thinkly_guest_id")
        const { data: { user } } = await supabase.auth.getUser()

        const table = user ? 'chats' : 'guest_chats'
        const idKey = user ? 'user_id' : 'guest_id'
        const idVal = user ? user.id : guestId

        if (idVal) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq(idKey, idVal)
            .eq('workflow_id', workflowId)
            .order('timestamp', { ascending: true })

          if (!error && data && data.length > 0) {
            setMessages(data as ChatMessage[])
            setTimeout(() => setExpanded(true), 800)
            return
          }
        }
      } catch (err) {
        console.warn("Supabase fetch failed, falling back to local:", err)
      }

      // 2. Fallback to localStorage
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed: ChatMessage[] = JSON.parse(saved)
          if (parsed.length > 0) {
            setMessages(parsed)
            setTimeout(() => setExpanded(true), 1000)
          }
        }
      } catch { /* ignore */ }
    }

    fetchHistory()
  }, [storageKey, workflowId])

  const persistMessages = useCallback(async (msgs: ChatMessage[]) => {
    try {
      const guestId = localStorage.getItem("thinkly_guest_id")
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Supabase Persistence (Cloud - Row per message)
      const table = user ? 'chats' : 'guest_chats'
      const idKey = user ? 'user_id' : 'guest_id'
      const idVal = user ? user.id : guestId

      if (idVal) {
        // Upsert all messages to ensure state (applied/dismissed) is synced
        const toSave = msgs.map(m => ({
          id: m.id,
          [idKey]: idVal,
          workflow_id: workflowId,
          role: m.role,
          content: m.content,
          mode: m.mode,
          patch: m.patch,
          applied: m.applied,
          dismissed: m.dismissed,
          timestamp: m.timestamp
        }))
        await supabase.from(table).upsert(toSave, { onConflict: 'id' })
      }

      // 2. Local Persistence (ONLY for Guests)
      if (!user) {
        localStorage.setItem(storageKey, JSON.stringify(msgs))
      }
    } catch (err) {
      console.error("Persistence failed:", err)
    }
  }, [storageKey, workflowId])



  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (expanded && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      if (isInitialMount.current) {
        // Just jump on initial expansion to avoid a long smooth scroll
        container.scrollTop = container.scrollHeight
        isInitialMount.current = false
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
      }
      
      // Auto-focus the textarea whenever the panel expands
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [messages, expanded])

  const handleFocus = () => {
    if (!expanded) {
      setExpanded(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const question = text.trim()
    if (!question || loading || disabled) return

    setText("")
    setError(null)

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: question,
      mode: "answer",
      timestamp: new Date().toISOString(),
    }
    const withUser = [...messages, userMsg]
    setMessages(withUser)
    setExpanded(true)
    setLoading(true)
    setLoadingStage(1) // Stage 1: Optimistic

    // Cycle stages for UI feedback
    const stageTimer = setInterval(() => {
      setLoadingStage(prev => (prev < 3 ? prev + 1 : prev))
    }, 3500)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          workflow,
          originalPrompt,
          useLessTokens,
          model: selectedModel,
          history: messages
            .slice(-10) // Limit to last 10 for performance and scope
            .map(m => ({ 
              role: m.role, 
              content: m.content,
              patch: m.patch // Include the patch summary if it exists
            })),
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Chat failed")

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: result.mode === "patch" ? "patch" : "assistant",
        content: result.answer,
        mode: result.mode,
        patch: result.patch,
        applied: false,
        dismissed: false,
        timestamp: new Date().toISOString(),
      }

      const withAnswer = [...withUser, assistantMsg]
      setMessages(withAnswer)
      await persistMessages(withAnswer)
    } catch (err: any) {
      setError(err.message)
      // Remove the user message on error
      setMessages(withUser.slice(0, -1))
    } finally {
      clearInterval(stageTimer)
      setLoading(false)
      setLoadingStage(0)
      inputRef.current?.focus()
    }

  }

  const handleApply = (msgId: string, patch: WorkflowPatch) => {
    try {
      const patched = mergeWorkflowPatch(workflow, patch)
      onApplyPatch(patched)
      const updated = messages.map(m =>
        m.id === msgId ? { ...m, applied: true } : m
      )
      setMessages(updated)
      persistMessages(updated)
    } catch (err: any) {
      setError(`Patch failed: ${err.message}`)
    }
  }

  const handleDismiss = (msgId: string) => {
    const updated = messages.map(m =>
      m.id === msgId ? { ...m, dismissed: true } : m
    )
    setMessages(updated)
    persistMessages(updated)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl z-[100] px-4 flex flex-col gap-2 pointer-events-none">

      {/* ── Chat Panel (slides up) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="pointer-events-auto relative w-full glass-panel backdrop-blur-2xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.9)] rounded-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 380 }}
          >
            {/* Absolute Dark Tint Underlay */}
            <div className="absolute inset-0 bg-black/50 -z-10 pointer-events-none" />
            
            {/* Panel header (Clickable to collapse) */}
            <button 
              type="button"
              onClick={() => setExpanded(false)}
              className="relative z-10 w-full flex items-center justify-between px-4 py-2.5 border-b border-white/8 flex-shrink-0 hover:bg-white/5 transition-colors cursor-pointer text-left group/header"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent-purple)]" />
                <span className="text-xs font-bold text-white/80 tracking-wide">Workflow Assistant</span>
                <span className="text-[10px] text-white/30 font-medium">{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="p-1 rounded-lg text-white/40 group-hover/header:text-white transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>

            {/* Messages */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scroll-smooth"
            >
              {messages.map(msg => (
                <div key={msg.id} className={`w-full flex ${msg.role === "user" ? "justify-end pl-8" : "justify-start pr-8"} gap-2`}>
                  {msg.role !== "user" && (
                    <div className="w-6 h-6 rounded-full bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {msg.mode === "patch"
                        ? <Sparkles className="w-3 h-3 text-[var(--color-accent-purple)]" />
                        : <Bot className="w-3 h-3 text-[var(--color-accent-blue)]" />
                      }
                    </div>
                  )}

                  <div className={`max-w-[82%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {/* Message bubble */}
                    <div className={`px-3 py-2 text-xs font-medium leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--color-accent-purple)]/30 border border-[var(--color-accent-purple)]/40 text-white rounded-2xl rounded-br-sm"
                        : msg.mode === "patch"
                          ? "bg-amber-400/8 border border-amber-400/25 text-white/80 rounded-2xl rounded-tl-sm"
                          : "bg-white/5 border border-white/8 text-white/75 rounded-2xl rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>

                    {/* Patch action card */}
                    {msg.mode === "patch" && msg.patch && !msg.applied && !msg.dismissed && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 flex flex-col gap-2"
                      >
                        <div className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" />
                          Workflow Change Proposed
                        </div>
                        {msg.patch.operations.length > 0 && (
                          <ul className="text-[10px] text-white/50 font-medium space-y-0.5 pl-1">
                            {msg.patch.operations.slice(0, 4).map((op, i) => (
                              <li key={i} className="flex items-start sm:items-center gap-1.5 overflow-hidden w-full">
                                <span className={`w-1.5 h-1.5 mt-1 sm:mt-0 rounded-full flex-shrink-0 ${
                                  op.op === "add_node" ? "bg-green-400" :
                                  op.op === "remove_node" ? "bg-red-400" : "bg-amber-400"
                                }`} />
                                <span className="font-mono text-[9px] whitespace-nowrap flex-shrink-0">{op.op.replace("_", " ")}</span>
                                <span className="text-white/40 truncate flex-1 min-w-0">
                                  {"nodeId" in op && <>— {op.nodeId}</>}
                                  {"node" in op && <>— {op.node.label}</>}
                                </span>
                              </li>
                            ))}
                            {msg.patch.operations.length > 4 && (
                              <li className="text-white/30 text-[9px]">+{msg.patch.operations.length - 4} more operations</li>
                            )}
                          </ul>
                        )}
                        {!msg.patch.feasible && msg.patch.reason && (
                          <p className="text-[10px] text-red-400/80">{msg.patch.reason}</p>
                        )}
                        {msg.patch.feasible && (
                          <div className="flex flex-col sm:flex-row items-stretch gap-2 mt-2 w-full">
                            {isOwner ? (
                              <button
                                onClick={() => handleApply(msg.id, msg.patch!)}
                                className="flex flex-1 justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-400/15 hover:bg-green-400/25 border border-green-400/30 text-green-400 text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-95 whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Apply Changes
                              </button>
                            ) : (
                              <div className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[9px] font-medium italic">
                                Preview only
                              </div>
                            )}
                            <button
                              onClick={() => handleDismiss(msg.id)}
                              className="flex flex-1 justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/8 border border-white/10 text-white/40 hover:text-white/70 text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                            >
                              <X className="w-3 h-3" /> Dismiss
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Applied / Dismissed states */}
                    {msg.mode === "patch" && msg.applied && (
                      <div className="flex items-center gap-1.5 text-[10px] text-green-400/70 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Applied to workflow
                      </div>
                    )}
                    {msg.mode === "patch" && msg.dismissed && (
                      <div className="text-[10px] text-white/25 font-medium">Dismissed</div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3 h-3 text-white/60" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-accent-purple)]/20 border border-[var(--color-accent-purple)]/30 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-3 h-3 text-[var(--color-accent-purple)] animate-spin" />
                  </div>
                  <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                    <span className="text-[10px] text-white/30 font-medium">
                      {loadingStage === 1 && "Analyzing context..."}
                      {loadingStage === 2 && "Refining logic..."}
                      {loadingStage === 3 && "Deep graph repair..."}
                      {loadingStage === 0 && "Thinking..."}
                    </span>

                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-[10px] text-red-400/80 bg-red-400/5 border border-red-400/20 px-3 py-2 rounded-lg font-medium">
                  {error}
                </div>
              )}


              <div ref={bottomRef} className="h-4 w-full flex-shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Bar ── */}
      <form onSubmit={handleSubmit} className="pointer-events-auto w-full relative group z-10 flex flex-col gap-1.5">
        <div className={`absolute inset-0 bg-gradient-to-r from-[var(--color-accent-purple)]/30 to-[var(--color-accent-blue)]/30 rounded-full blur-xl transition-opacity duration-500 -z-10 ${expanded ? 'opacity-100' : 'opacity-0'}`} />
        <div className={cn(
          "glass-panel relative rounded-full flex items-center shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10 group-focus-within:border-[var(--color-accent-purple)]/50 transition-all duration-500",
          expanded ? "bg-black/40" : "bg-black/[0.25]"
        )}>
          <div className="relative z-10 flex items-center w-full p-2">
            {/* Expand/collapse toggle */}
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="ml-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center active:scale-95 shrink-0"
            >
              {expanded
                ? <ChevronDown className="w-5 h-5 shadow-sm" />
                : <ChevronUp className="w-5 h-5 shadow-sm" />
              }
            </button>
            <textarea
              ref={inputRef as any}
              rows={1}
              value={text}
              onFocus={handleFocus}
              onChange={e => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={loading || disabled}
              placeholder={messages.length > 0 ? "Ask another question..." : "Ask about this workflow..."}
              className="flex-1 bg-transparent border-none text-white placeholder-white/40 font-medium focus:outline-none focus:ring-0 px-2 py-2 md:text-[13px] resize-none scrollbar-hide min-h-[44px] max-h-32"
            />

            {/* Token Optimizer (Zap) */}
            <div className="hidden md:block relative group/tooltip mx-1">
              <label 
                onMouseEnter={() => setShowTokenTooltip(true)}
                onMouseLeave={() => setShowTokenTooltip(false)}
                className={cn(
                  "flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer relative",
                  useLessTokens 
                    ? "bg-[var(--color-accent-purple)]/20 border-[var(--color-accent-purple)]/40 text-[var(--color-accent-purple)] shadow-[0_0_8px_rgba(168,85,247,0.2)]" 
                    : "bg-white/5 border-white/5 text-white/20 hover:text-white/40"
                )}
              >
                <input
                  type="checkbox"
                  checked={useLessTokens}
                  onChange={e => setUseLessTokens(e.target.checked)}
                  className="hidden"
                />
                <Zap className="w-3.5 h-3.5" />
              </label>

              {/* Glass Tooltip */}
              <AnimatePresence>
                {showTokenTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none z-[100] whitespace-nowrap"
                  >
                    <div className="text-[8px] font-black uppercase tracking-[0.15em] text-white/90">
                      Use Less Tokens
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black/90" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden md:block w-[1px] h-6 bg-white/10 mx-1" />

            {/* Model Selection Block (Desktop) */}
            <div className="hidden md:flex flex-col gap-0.5 mx-1 mr-2 p-1 rounded-2xl bg-black/40 border border-white/10 relative shadow-inner">
              {[
                { id: "gemini-2.5-flash", label: "FAST", icon: <Sparkles className="w-2.5 h-2.5" /> },
                { id: "gemma-4-31b-it", label: "STRICT", icon: <Terminal className="w-2.5 h-2.5" /> }
              ].map(m => (
                <div key={m.id} className="relative group/m-tooltip">
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredModel(m.id)}
                    onMouseLeave={() => setHoveredModel(null)}
                    onClick={() => setSelectedModel(m.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[7px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 w-[72px]",
                      selectedModel === m.id
                        ? "bg-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/10"
                        : "text-white/20 hover:text-white/40 border border-transparent"
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>

                  {/* Model Tooltip */}
                  <AnimatePresence>
                    {hoveredModel === m.id && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -4, scale: 0.98 }}
                        className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none z-[100] whitespace-nowrap"
                      >
                        <div className="text-[8px] font-black uppercase tracking-[0.15em] text-white/90">
                          {m.id}
                        </div>
                        <div className="absolute left-full top-1/2 -translate-y-1/2 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[4px] border-l-black/90" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || disabled || !text.trim()}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 disabled:hover:bg-white/10 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center active:scale-95"
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <ArrowUp className="w-5 h-5 drop-shadow-md" />
              }
            </button>
          </div>
        </div>

        {/* ── Mobile Selection Bar ── */}
        <div className="flex md:hidden justify-between items-center px-4 mt-2">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.4)]">
            {[
              { id: "gemini-2.5-flash", label: "Fast", icon: <Sparkles className="w-2.5 h-2.5" /> },
              { id: "gemma-4-31b-it", label: "Strict", icon: <Terminal className="w-2.5 h-2.5" /> }
            ].map(m => (
              <div key={m.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel(m.id)
                    setHoveredModel(m.id)
                    setTimeout(() => setHoveredModel(null), 2000)
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                    selectedModel === m.id
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-white/20 hover:text-white/40"
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>

                {/* Mobile Model Tooltip */}
                <AnimatePresence>
                  {hoveredModel === m.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2.5 py-1.5 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none z-[100] whitespace-nowrap"
                    >
                      <div className="text-[8px] font-black uppercase tracking-[0.15em] text-white/90">
                        {m.id}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black/90" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="relative group/tooltip">
            <label 
              className={cn(
                "flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-all cursor-pointer relative",
                useLessTokens 
                  ? "bg-[var(--color-accent-purple)]/20 border-[var(--color-accent-purple)]/40 text-[var(--color-accent-purple)] shadow-[0_0_8px_rgba(168,85,247,0.2)]" 
                  : "bg-black/20 border-white/5 text-white/20"
              )}
            >
              <input
                type="checkbox"
                checked={useLessTokens}
                onChange={e => {
                  setUseLessTokens(e.target.checked)
                  // Only trigger tooltip on mobile when toggling ON
                  if (e.target.checked) {
                    setShowTokenTooltip(true)
                    setTimeout(() => setShowTokenTooltip(false), 2000)
                  }
                }}
                className="hidden"
              />
              <Zap className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">TKN</span>
            </label>

            {/* Mobile Glass Tooltip */}
            <AnimatePresence>
              {showTokenTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2.5 py-1.5 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none z-[100] whitespace-nowrap"
                >
                  <div className="text-[8px] font-black uppercase tracking-[0.15em] text-white/90">
                    Use Less Tokens
                  </div>
                  {/* Centered Pointer */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black/90" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </form>
    </div>
  )
}
