"use client"
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { supabase } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { WorkflowResponse } from "@/types/workflow"

export interface WorkflowMeta {
  title: string
  prompt: string
  workflowId: string
  generatedAt: string
  source: "generated" | "saved" | "shared"
  isOwner: boolean
}

type AppView = "home" | "output"
export type TabType = "Dashboard" | "My Workflows" | "Integrations" | "Automations"

interface WorkflowContextType {
  user: User | null
  guestId: string | null
  loading: boolean
  data: WorkflowResponse | null
  meta: WorkflowMeta | null
  error: string | null
  activeTab: TabType
  appView: AppView
  showMigrationModal: boolean
  hasWorkflowsToMigrate: boolean
  
  // Setters
  setLoading: (l: boolean) => void
  setData: (d: WorkflowResponse | null) => void
  setMeta: (m: WorkflowMeta | null) => void
  setError: (e: string | null) => void
  setActiveTab: (t: TabType) => void
  setAppView: (v: AppView) => void
  setShowMigrationModal: (s: boolean) => void
  
  // Actions
  fetchSharedWorkflow: (id: string) => Promise<void>
  migrateWorkflows: () => Promise<void>
  refreshUser: () => Promise<void>
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WorkflowResponse | null>(null)
  const [meta, setMeta] = useState<WorkflowMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("Dashboard")
  const [appView, setAppView] = useState<AppView>("home")
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [hasWorkflowsToMigrate, setHasWorkflowsToMigrate] = useState(false)

  useEffect(() => {
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
      if (user) checkForMigration(user.id, currentGuestId!)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) checkForMigration(u.id, currentGuestId!)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkForMigration = async (userId: string, gid: string) => {
    try {
      const { count, error } = await supabase
        .from('guest_workflows')
        .select('*', { count: 'exact', head: true })
        .eq('guest_id', gid)
      
      if (!error && count && count > 0) {
        setHasWorkflowsToMigrate(true)
        setShowMigrationModal(true)
      }
    } catch (err) {
      console.error("Migration check failed:", err)
    }
  }

  const fetchSharedWorkflow = async (idTemp: string) => {
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
      setLoading(false)
    }
  }

  const migrateWorkflows = async () => {
    if (!user || !guestId) return
    setLoading(true)
    try {
      // 1. Migrate Workflows
      const { data: guestWfs } = await supabase.from('guest_workflows').select('*').eq('guest_id', guestId)
      if (guestWfs && guestWfs.length > 0) {
        await supabase.from('workflows').insert(guestWfs.map(wf => ({
          user_id: user.id,
          prompt: wf.prompt,
          data: wf.data,
          id_temp: wf.id_temp,
          created_at: wf.created_at,
          name: wf.name,
          workflow_type: wf.workflow_type,
          node_count: wf.node_count,
          tools: wf.tools
        })))
        await supabase.from('guest_workflows').delete().eq('guest_id', guestId)
      }

      // 2. Migrate Chats
      const { data: guestChats } = await supabase.from('guest_chats').select('*').eq('guest_id', guestId)
      if (guestChats && guestChats.length > 0) {
        await supabase.from('chats').upsert(guestChats.map(gc => ({ ...gc, user_id: user.id })))
        await supabase.from('guest_chats').delete().eq('guest_id', guestId)
      }

      setShowMigrationModal(false)
      setHasWorkflowsToMigrate(false)

      // 3. Conclusive Local Cleanup: Purge all guest session data
      try {
        // Clear workflow history cache
        localStorage.removeItem("thinkly_history")
        
        // Comprehensive Chat Sweep (Prefix-matched)
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith("thinkly_chat_")) {
            localStorage.removeItem(key)
          }
        })

        // Session Rotation: Purge old ID and generate a fresh one for future guest use
        localStorage.removeItem("thinkly_guest_id")
        const nextGuestId = crypto.randomUUID()
        localStorage.setItem("thinkly_guest_id", nextGuestId)
        setGuestId(nextGuestId)
      } catch (err) {
        console.warn("Local storage cleanup partial failure:", err)
      }
    } catch (err) {
      console.error("Migration failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  return (
    <WorkflowContext.Provider value={{
      user, guestId, loading, data, meta, error, activeTab, appView, showMigrationModal, hasWorkflowsToMigrate,
      setLoading, setData, setMeta, setError, setActiveTab, setAppView, setShowMigrationModal,
      fetchSharedWorkflow, migrateWorkflows, refreshUser
    }}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (context === undefined) throw new Error("useWorkflow must be used within a WorkflowProvider")
  return context
}
