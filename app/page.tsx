"use client"
import { useState, useEffect } from "react"
import { HeroInput } from "@/components/home/HeroInput"
import { OutputCards } from "@/components/home/OutputCards"
import { AlertCircle, Wrench, Plus, RefreshCw } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"
import { WorkflowResponse } from "@/types/workflow"
import dynamic from "next/dynamic"
import { Header, TabType } from "@/components/layout/Header"
import { MyWorkflowsView, SavedWorkflow } from "@/components/views/MyWorkflowsView"
import { IntegrationsView } from "@/components/views/IntegrationsView"
import { AutomationsView } from "@/components/views/AutomationsView"
import { RefinementChat } from "@/components/home/RefinementChat"
import { supabase } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import LoadingScreen from "@/components/ui/LoadingScreen"

const FluidGlassBackground = dynamic(() => import("@/components/ui/FluidGlassBackground"), { ssr: false })

export interface WorkflowMeta {
  title: string
  prompt: string
  workflowId: string // Numeric id_temp for stable chat lookup
  generatedAt: string // ISO timestamp for display
  source: "generated" | "saved" | "shared"
  isOwner: boolean
}

type AppView = "home" | "output"

export default function Home() {
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isAppVisible, setIsAppVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WorkflowResponse | null>(null)
  const [meta, setMeta] = useState<WorkflowMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("Dashboard")
  const [appView, setAppView] = useState<AppView>("home")
  const [user, setUser] = useState<User | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [hasWorkflowsToMigrate, setHasWorkflowsToMigrate] = useState(false)


  useEffect(() => {
    // Initial Load Timer - Extended for smoother transition and orb init
    const timer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 5000)

    // Pre-load App 0s before loader ends for seamless transition
    const appTimer = setTimeout(() => {
      setIsAppVisible(true)
    }, 5500)

    // Initialize Guest ID
    let currentGuestId = localStorage.getItem("thinkly_guest_id")
    if (!currentGuestId) {
      currentGuestId = crypto.randomUUID()
      localStorage.setItem("thinkly_guest_id", currentGuestId)
    }
    setGuestId(currentGuestId)

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        checkForMigration(user.id, currentGuestId!)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        checkForMigration(u.id, currentGuestId!)
      }
    })

    return () => {
      clearTimeout(timer)
      clearTimeout(appTimer)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get("s")
    if (shareId) {
      handleFetchSharedWorkflow(shareId)
    }
  }, [])

  const handleFetchSharedWorkflow = async (idTemp: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: wf, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id_temp', idTemp)
        .maybeSingle()

      if (error) throw error

      if (wf) {
        setData(wf.data)
        setMeta({
          title: wf.data.workflow_type || "Shared Workflow",
          prompt: wf.prompt,
          workflowId: wf.id_temp.toString(),
          generatedAt: wf.created_at,
          source: "shared",
          isOwner: wf.user_id === user?.id
        })
        setAppView("output")
      }
    } catch (err: any) {
      console.error("Failed to fetch shared workflow:", err)
      setError("This shared link might be invalid or no longer public.")
    } finally {
      // Clear URL params without reloading to keep shared ID out of fresh view
      const url = new URL(window.location.href)
      url.searchParams.delete('s')
      window.history.replaceState({}, '', url)
      setLoading(false)
    }
  }

  const checkForMigration = async (userId: string, guestId: string) => {
    try {
      const { count, error } = await supabase
        .from('guest_workflows')
        .select('*', { count: 'exact', head: true })
        .eq('guest_id', guestId)
      
      if (!error && count && count > 0) {
        setHasWorkflowsToMigrate(true)
        setShowMigrationModal(true)
      }
    } catch (err) {
      console.error("Migration check failed:", err)
    }
  }

  const handleMigrateWorkflows = async () => {
    if (!user || !guestId) return
    setLoading(true)
    try {
      // 1. Fetch Guest Workflows
      const { data: guestWfs, error: fetchWfError } = await supabase
        .from('guest_workflows')
        .select('*')
        .eq('guest_id', guestId)
      
      if (fetchWfError) throw fetchWfError

      if (guestWfs && guestWfs.length > 0) {
        const toInsertWfs = guestWfs.map(wf => ({
          user_id: user.id,
          prompt: wf.prompt,
          data: wf.data,
          id_temp: wf.id_temp,
          created_at: wf.created_at
        }))
        const { error: insWfError } = await supabase.from('workflows').insert(toInsertWfs)
        if (insWfError) throw insWfError
        await supabase.from('guest_workflows').delete().eq('guest_id', guestId)
      }

      // 2. Fetch Guest Chats
      const { data: guestChats, error: fetchChatError } = await supabase
        .from('guest_chats')
        .select('*')
        .eq('guest_id', guestId)
      
      if (fetchChatError) throw fetchChatError

      if (guestChats && guestChats.length > 0) {
        const toInsertChats = guestChats.map(gc => ({
          id: gc.id,
          user_id: user.id,
          workflow_id: gc.workflow_id,
          role: gc.role,
          content: gc.content,
          mode: gc.mode,
          patch: gc.patch,
          applied: gc.applied,
          dismissed: gc.dismissed,
          timestamp: gc.timestamp,
          created_at: gc.created_at
        }))
        const { error: insChatError } = await supabase.from('chats').upsert(toInsertChats)
        if (insChatError) throw insChatError
        await supabase.from('guest_chats').delete().eq('guest_id', guestId)
      }

      // 3. CLEAN LOCAL STORAGE (Success)
      localStorage.removeItem("thinkly_history")
      // Also clear any chat history keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("thinkly_chat_")) {
          localStorage.removeItem(key)
        }
      })

      setHasWorkflowsToMigrate(false)
      setShowMigrationModal(false)
      if (activeTab === "My Workflows") handleTabChange("My Workflows")
    } catch (err: any) {
      console.error("Migration failed:", err)
      setError(`Migration failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }


  // Track chat history for iterative generation refinement (full re-gen mode)
  const [messages, setMessages] = useState<{ role: string, parts: { text: string }[] }[]>([])

  const handleDuplicateWorkflow = async (duplicateData: WorkflowResponse, prompt: string) => {
    const now = new Date().toISOString()
    const id = Date.now()

    // 1. Update Meta to mark as owned
    setMeta({
      title: duplicateData.workflow_type || "Copied Workflow",
      prompt: prompt,
      workflowId: id.toString(),
      generatedAt: now,
      source: "saved",
      isOwner: true
    })

    // 2. Save Logic (Split)
    if (user) {
      // Authenticated -> Supabase only
      await supabase.from('workflows').insert({
        user_id: user.id,
        prompt: prompt,
        data: duplicateData,
        id_temp: id,
        created_at: now
      })
    } else if (guestId) {
      // Guest -> Local + Supabase Guest Tables
      const newEntry = { id, prompt, data: duplicateData, date: now }
      const existing = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
      localStorage.setItem("thinkly_history", JSON.stringify([newEntry, ...existing]))
      
      await supabase.from('guest_workflows').insert({
        guest_id: guestId,
        prompt: prompt,
        data: duplicateData,
        id_temp: id,
        created_at: now
      })
    }
  }


  const handleApplyPatch = async (patched: WorkflowResponse) => {
    setData(patched)
    if (meta) {
      if (user) {
        // Authenticated -> Supabase only
        await supabase
          .from('workflows')
          .update({ data: patched, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('id_temp', meta.workflowId)
      } else if (guestId) {
        // Guest -> Local + Supabase
        try {
          const existing: any[] = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
          const updated = existing.map(entry =>
            entry.id.toString() === meta.workflowId
              ? { ...entry, data: patched }
              : entry
          )
          localStorage.setItem("thinkly_history", JSON.stringify(updated))
        } catch { /* ignore */ }

        await supabase
          .from('guest_workflows')
          .update({ data: patched })
          .eq('guest_id', guestId)
          .eq('id_temp', meta.workflowId)
      }
    }
  }


  const handleNewWorkflow = () => {
    setActiveTab("Dashboard")
    setAppView("home")
    setData(null)
    setMeta(null)
    setError(null)
    setMessages([])
    setLoading(false)
  }

  const handleTabChange = (tab: TabType) => {
    if (appView === "output") {
      setAppView("home")
      if (tab === "Dashboard") {
        setData(null)
        setMeta(null)
      }
    }
    setActiveTab(tab)
  }

  const handleGenerateClick = (text: string, model?: string) => {
    if (!text.trim()) return
    setMessages([{ role: "user", parts: [{ text }] }])
    executeGeneration(text, [], text, model)
  }

  const handleRefineClick = (text: string, model?: string) => {
    if (!text.trim() || !data) return
    const newHistory = [
      ...messages,
      { role: "model", parts: [{ text: JSON.stringify(data) }] }
    ]
    setMessages([...newHistory, { role: "user", parts: [{ text }] }])
    executeGeneration(text, newHistory, meta?.prompt ?? text, model)
  }


  const handleWorkflowSelect = (wf: SavedWorkflow) => {
    setActiveTab("My Workflows")
    setAppView("output")
    setData(wf.data)
    setMeta({
      title: wf.data.workflow_type ?? "Saved Workflow",
      prompt: wf.prompt,
      workflowId: wf.id_temp.toString(),
      generatedAt: wf.created_at,
      source: "saved",
      isOwner: true
    })
    setError(null)
    setMessages([])
  }

  const executeGeneration = async (text: string, history: any[] = [], originalPrompt: string, model?: string) => {
    setLoading(true)
    setError(null)
    setData(null)
    setMeta(null)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, history, model })
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Generation failed")
      }

      const now = new Date().toISOString()
      const tempId = Date.now()
      setData(result.data)
      setActiveTab("Dashboard")
      setAppView("output")
      setMeta({
        title: result.data.workflow_type ?? "Generated Workflow",
        prompt: originalPrompt,
        workflowId: tempId.toString(),
        generatedAt: now,
        source: "generated",
        isOwner: true
      })

      // Save Logic
      if (user) {
        // Authenticated
        await supabase.from('workflows').insert({
          user_id: user.id,
          prompt: originalPrompt,
          data: result.data,
          created_at: now,
          id_temp: tempId
        })
      } else if (guestId) {
        // Guest
        const newEntry = { id: tempId, prompt: originalPrompt, data: result.data, date: now }
        const existing = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
        localStorage.setItem("thinkly_history", JSON.stringify([newEntry, ...existing]))

        await supabase.from('guest_workflows').insert({
          guest_id: guestId,
          prompt: originalPrompt,
          data: result.data,
          created_at: now,
          id_temp: tempId
        })
      }


    } catch (err: any) {
      if (err.message.includes("401") || err.message.includes("Missing API Key")) {
        setError("Missing API Key. Please add GEMINI_API_KEY to your .env.local file to proceed.")
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Determine what the Dashboard tab renders
  const showingOutput = appView === "output" && data

  return (
    <div className="relative w-full h-full min-h-screen bg-black overflow-hidden">
      {/* Background - Always rendered for stability and immediate init */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <FluidGlassBackground mode="lens" className="w-full h-full" />
      </div>

      <AnimatePresence>
        {isInitialLoading && (
          <motion.div
            key="loader-screen"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.15,
              filter: "blur(100px)",
            }}
            transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[99999] pointer-events-none"
          >
            <LoadingScreen />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key="main-app"
        initial={{ opacity: 0 }}
        animate={{ opacity: isAppVisible ? 1 : 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="flex flex-col h-screen w-full relative overflow-hidden bg-transparent z-10"
      >
        <div className="w-full px-4 flex-none z-20">
          <Header
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onNewWorkflow={handleNewWorkflow}
          />
        </div>

        <main className="flex-1 overflow-y-auto w-full relative z-10 pt-8" style={{ overflowX: 'clip' }}>
          <AnimatePresence mode="wait">

            {/* Output view — shown regardless of which tab is "active" */}
            {showingOutput && (
              <motion.div
                key="output"
                initial={{ opacity: 0, scale: 0.96, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: "spring", damping: 22, stiffness: 110 }}
              >
                <OutputCards
                  data={data!}
                  meta={meta!}
                  onBack={activeTab === "My Workflows" ? () => { setAppView("home"); setData(null); setMeta(null) } : undefined}
                  onDuplicate={handleDuplicateWorkflow}
                  mode="design"
                />
                {data && meta && (
                  <RefinementChat
                    workflow={data}
                    originalPrompt={meta.prompt}
                    workflowId={meta.workflowId}
                    onApplyPatch={handleApplyPatch}
                    disabled={loading}
                    isOwner={meta.isOwner}
                  />
                )}
              </motion.div>
            )}

            {/* Dashboard home — input form */}
            {!showingOutput && activeTab === "Dashboard" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 2.5, filter: "blur(15px)" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col w-full"
              >
                <HeroInput onGenerate={handleGenerateClick} loading={loading} />
                {error && (
                  <div className="flex items-center justify-center mt-8 gap-3 text-red-500 bg-red-500/10 border border-red-500/30 p-4 rounded-xl max-w-lg mx-auto shadow-sm animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium text-sm">{error}</p>
                  </div>
                )}
                
                {/* Dashboard Legal Footer */}
                <div className="fixed bottom-6 right-6 flex gap-4 z-40 opacity-50 hover:opacity-100 transition-opacity">
                  <a href="/privacy" className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-widest transition-colors">Privacy</a>
                  <a href="/terms" className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-widest transition-colors">Terms</a>
                </div>
              </motion.div>
            )}

            {/* My Workflows list view */}
            {!showingOutput && activeTab === "My Workflows" && (
              <motion.div key="workflows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                <MyWorkflowsView onSelect={handleWorkflowSelect} />
              </motion.div>
            )}


            {/* Integrations tab */}
            {activeTab === "Integrations" && !showingOutput && (
              <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                <IntegrationsView />
              </motion.div>
            )}

            {/* Automations tab */}
            {activeTab === "Automations" && !showingOutput && (
              <motion.div key="automations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                <AutomationsView />
              </motion.div>
            )}

            {/* Coming soon tabs */}
            {activeTab === "Performance" && !showingOutput && (
              <motion.div key="comingsoon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center mt-32 text-center">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-md shadow-lg">
                  <Wrench className="w-12 h-12 text-white/40" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{activeTab}</h2>
                <p className="text-white/50 max-w-md">This feature is actively under development for Phase 4. Check back soon!</p>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* ── Migration Modal ── */}
        <AnimatePresence>
          {showMigrationModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl rounded-3xl text-center"
              >
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                  <RefreshCw className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Welcome Back!</h3>
                <p className="text-white/50 text-sm mb-8 leading-relaxed">
                  We found workflows you created while logged out. Would you like to migrate them to your account now?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleMigrateWorkflows}
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? "Migrating..." : "Yes, Migrate My Workflows"}
                  </button>
                  <button
                    onClick={() => setShowMigrationModal(false)}
                    className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold transition-all"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


        {/* FAB - New Workflow */}
        {showingOutput && (
          <button
            onClick={handleNewWorkflow}
            className="hidden md:flex fixed bottom-8 right-8 z-[100] group items-center bg-gradient-to-r from-[var(--color-accent-purple)]/90 to-[var(--color-accent-blue)]/90 hover:from-[var(--color-accent-purple)] hover:to-[var(--color-accent-blue)] text-white rounded-full h-14 shadow-[0_0_20px_rgba(167,139,250,0.4)] hover:shadow-[0_0_30px_rgba(167,139,250,0.6)] transition-all duration-300 border border-white/20 hover:border-white/40 active:scale-95 cursor-pointer"
          >
            <div className="w-14 h-14 flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90 drop-shadow-sm" />
            </div>
            <div className="overflow-hidden transition-all duration-300 max-w-0 group-hover:max-w-[140px] opacity-0 group-hover:opacity-100">
              <span className="font-semibold whitespace-nowrap pr-6 tracking-wide">New Workflow</span>
            </div>
          </button>
        )}

      </motion.div>
    </div>
  )
}
