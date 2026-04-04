"use client"
import { useState, useEffect } from "react"
import { HeroInput } from "@/components/home/HeroInput"
import { OutputCards } from "@/components/home/OutputCards"
import { AlertCircle, Wrench, Plus, RefreshCw } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"
import { WorkflowResponse } from "@/types/workflow"
import dynamic from "next/dynamic"
import { Header } from "@/components/layout/Header"
import { MyWorkflowsView, SavedWorkflow } from "@/components/views/MyWorkflowsView"
import { IntegrationsView } from "@/components/views/IntegrationsView"
import { AutomationsView } from "@/components/views/AutomationsView"
import { RefinementChat } from "@/components/home/RefinementChat"
import { supabase } from "@/lib/supabase/client"
import LoadingScreen from "@/components/ui/LoadingScreen"
import { BottomBlurOverlay } from "@/components/ui/BottomBlurOverlay"
import { useWorkflow } from "@/components/providers/WorkflowProvider"

const FluidGlassBackground = dynamic(() => import("@/components/ui/FluidGlassBackground"), { ssr: false })

export default function Home() {
  const {
    user, guestId, loading, data, meta, error, activeTab, appView, showMigrationModal,
    setLoading, setData, setMeta, setError, setActiveTab, setAppView, setShowMigrationModal,
    fetchSharedWorkflow, migrateWorkflows
  } = useWorkflow()

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isAppVisible, setIsAppVisible] = useState(false)
  const [messages, setMessages] = useState<{ role: string, parts: { text: string }[] }[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 5000)
    const appTimer = setTimeout(() => setIsAppVisible(true), 5500)
    
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get("s")
    if (shareId) {
      fetchSharedWorkflow(shareId).then(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('s')
        window.history.replaceState({}, '', url)
      })
    }

    return () => {
      clearTimeout(timer)
      clearTimeout(appTimer)
    }
  }, [])

  const handleDuplicateWorkflow = async (duplicateData: WorkflowResponse, prompt: string) => {
    const now = new Date().toISOString()
    const id = Date.now()
    setMeta({
      title: duplicateData.workflow_type || "Copied Workflow",
      prompt,
      workflowId: id.toString(),
      generatedAt: now,
      source: "saved",
      isOwner: true
    })

    if (user) {
      await supabase.from('workflows').insert({
        user_id: user.id, prompt, data: duplicateData, id_temp: id, created_at: now
      })
    } else if (guestId) {
      const newEntry = { id, prompt, data: duplicateData, date: now }
      const existing = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
      localStorage.setItem("thinkly_history", JSON.stringify([newEntry, ...existing]))
      await supabase.from('guest_workflows').insert({
        guest_id: guestId, prompt, data: duplicateData, id_temp: id, created_at: now
      })
    }
  }

  const handleApplyPatch = async (patched: WorkflowResponse) => {
    setData(patched)
    if (!meta) return
    const now = new Date().toISOString()
    if (user) {
      await supabase.from('workflows').update({ data: patched, updated_at: now }).eq('user_id', user.id).eq('id_temp', meta.workflowId)
    } else if (guestId) {
      const existing = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
      const updated = existing.map((e: any) => e.id.toString() === meta.workflowId ? { ...e, data: patched } : e)
      localStorage.setItem("thinkly_history", JSON.stringify(updated))
      await supabase.from('guest_workflows').update({ data: patched }).eq('guest_id', guestId).eq('id_temp', meta.workflowId)
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

  const handleTabChange = (tab: any) => {
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
    const newHistory = [...messages, { role: "model", parts: [{ text: JSON.stringify(data) }] }]
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
    setLoading(true); setError(null); setData(null); setMeta(null)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, history, model })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Generation failed")

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

      if (user) {
        await supabase.from('workflows').insert({ user_id: user.id, prompt: originalPrompt, data: result.data, created_at: now, id_temp: tempId })
      } else if (guestId) {
        const existing = JSON.parse(localStorage.getItem("thinkly_history") || "[]")
        localStorage.setItem("thinkly_history", JSON.stringify([{ id: tempId, prompt: originalPrompt, data: result.data, date: now }, ...existing]))
        await supabase.from('guest_workflows').insert({ guest_id: guestId, prompt: originalPrompt, data: result.data, created_at: now, id_temp: tempId })
      }
    } catch (err: any) {
      setError(err.message.includes("API Key") ? "Missing API Key. Please add GEMINI_API_KEY to your .env.local file." : err.message)
    } finally {
      setLoading(false)
    }
  }

  const showingOutput = appView === "output" && data

  return (
    <div className="relative w-full h-full min-h-screen bg-black overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <FluidGlassBackground mode="lens" className="w-full h-full" />
      </div>

      <AnimatePresence>
        {isInitialLoading && (
          <motion.div key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.15, filter: "blur(100px)" }} transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-0 z-[99999] pointer-events-none">
            <LoadingScreen />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: isAppVisible ? 1 : 0 }} transition={{ duration: 1.5 }} className="flex flex-col h-screen w-full relative overflow-hidden bg-transparent z-10">
        <div className="w-full px-4 flex-none z-20">
          <Header activeTab={activeTab} onTabChange={handleTabChange} onNewWorkflow={handleNewWorkflow} />
        </div>

        <main className="flex-1 overflow-y-auto w-full relative z-10 pt-8" style={{ overflowX: 'clip' }}>
          <AnimatePresence mode="wait">
            {showingOutput && (
              <motion.div key="output" initial={{ opacity: 0, scale: 0.96, y: 32 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 32 }} transition={{ type: "spring", damping: 22, stiffness: 110 }}>
                <OutputCards data={data!} meta={meta!} onBack={activeTab === "My Workflows" ? () => { setAppView("home"); setData(null); setMeta(null) } : undefined} onDuplicate={handleDuplicateWorkflow} mode="design" />
                <BottomBlurOverlay />
                <RefinementChat workflow={data!} originalPrompt={meta!.prompt} workflowId={meta!.workflowId} onApplyPatch={handleApplyPatch} disabled={loading} isOwner={meta!.isOwner} />
              </motion.div>
            )}

            {!showingOutput && activeTab === "Dashboard" && (
              <motion.div key="home" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 2.5, filter: "blur(15px)" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col w-full">
                <HeroInput onGenerate={handleGenerateClick} loading={loading} />
                {error && <div className="flex items-center justify-center mt-8 gap-3 text-red-500 bg-red-500/10 border border-red-500/30 p-4 rounded-xl max-w-lg mx-auto shadow-sm animate-in fade-in slide-in-from-top-4"><AlertCircle className="w-5 h-5 shrink-0" /><p className="font-medium text-sm">{error}</p></div>}
                <div className="fixed bottom-6 right-6 flex gap-4 z-40 opacity-50 hover:opacity-100 transition-opacity">
                  <a href="/privacy" className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-widest transition-colors">Privacy</a>
                  <a href="/terms" className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-widest transition-colors">Terms</a>
                </div>
              </motion.div>
            )}

            {!showingOutput && activeTab === "My Workflows" && (
              <motion.div key="workflows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                <MyWorkflowsView onSelect={handleWorkflowSelect} />
              </motion.div>
            )}

            {["Integrations", "Automations"].includes(activeTab as string) && !showingOutput && (
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                {activeTab === "Integrations" ? <IntegrationsView /> : <AutomationsView />}
              </motion.div>
            )}

            {(activeTab as string) === "Performance" && !showingOutput && (
              <motion.div key="performance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center mt-32 text-center">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-md shadow-lg"><Wrench className="w-12 h-12 text-white/40" /></div>
                <h2 className="text-2xl font-bold text-white mb-2">{activeTab}</h2>
                <p className="text-white/50 max-w-md">This feature is actively under development for Phase 4. Check back soon!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {showMigrationModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl rounded-3xl text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30"><RefreshCw className="w-8 h-8 text-blue-400" /></div>
                <h3 className="text-2xl font-bold text-white mb-3">Welcome Back!</h3>
                <p className="text-white/50 text-sm mb-8 leading-relaxed">We found workflows you created while logged out. Would you like to migrate them to your account now?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={migrateWorkflows} disabled={loading} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all active:scale-95 disabled:opacity-50">{loading ? "Migrating..." : "Yes, Migrate My Workflows"}</button>
                  <button onClick={() => setShowMigrationModal(false)} className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold transition-all">Maybe Later</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {showingOutput && (
          <button onClick={handleNewWorkflow} className="hidden md:flex fixed bottom-8 right-8 z-[100] group items-center bg-gradient-to-r from-[var(--color-accent-purple)]/90 to-[var(--color-accent-blue)]/90 hover:from-[var(--color-accent-purple)] hover:to-[var(--color-accent-blue)] text-white rounded-full h-14 shadow-[0_0_20px_rgba(167,139,250,0.4)] hover:shadow-[0_0_30px_rgba(167,139,250,0.6)] transition-all duration-300 border border-white/20 hover:border-white/40 active:scale-95 cursor-pointer">
            <div className="w-14 h-14 flex items-center justify-center shrink-0"><Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90 drop-shadow-sm" /></div>
            <div className="overflow-hidden transition-all duration-300 max-w-0 group-hover:max-w-[140px] opacity-0 group-hover:opacity-100"><span className="font-semibold whitespace-nowrap pr-6 tracking-wide">New Workflow</span></div>
          </button>
        )}
      </motion.div>
    </div>
  )
}
