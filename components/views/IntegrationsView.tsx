"use client"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Puzzle,
  Settings2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Lock,
  Globe,
  Mail,
  Table as TableIcon,
  Bot,
  Zap,
  Plus
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface Integration {
  service_name: string
  is_active: boolean
}

const SUPPORTED_SERVICES = [
  {
    id: "openai",
    name: "OpenAI",
    logo: (
      <svg
        viewBox="0 0 24 24"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 text-white/80 group-hover:text-emerald-400 transition-colors duration-500"
        fill="currentColor"
      >
        <title>OpenAI</title>
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
    description: "Power your workflows with GPT-4 content generation and logic.",
    type: "API Key",
    accent: "bg-emerald-500",
    color: "emerald"
  },
  {
    id: "google",
    name: "Google Workspace",
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
      </svg>
    ),
    description: "Automate Gmail and Google Sheets simultaneously.",
    type: "OAuth2",
    accent: "bg-blue-500",
    color: "blue"
  }
]

export function IntegrationsView() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (isMounted) await fetchIntegrations()
    }

    load()

    return () => { isMounted = false }
  }, [])

  const fetchIntegrations = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("user_integrations")
        .select("service_name, is_active")

      if (!error && data) {
        setIntegrations(data)
      }
    } catch (err) {
      console.error("Fetch integrations failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectAPI = async () => {
    if (!apiKey.trim() || !showModal) return
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please login first")

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          service_name: showModal,
          api_key: apiKey
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save integration")
      }

      await fetchIntegrations()
      setShowModal(null)
      setApiKey("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleOAuthConnect = async (service: string) => {
    setIsConnecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please login first")

      const res = await fetch(`/api/auth/google/url?userId=${user.id}`)
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error("Failed to start OAuth flow:", err)
      setIsConnecting(false)
    }
  }

  const isConnected = (serviceId: string) => {
    // Both Google Sheets and Gmail share the same 'google' OAuth record
    if (serviceId === "googlesheets" || serviceId === "gmail") {
      return integrations.some(i => i.service_name === "google" && i.is_active)
    }
    return integrations.some(i => i.service_name === serviceId && i.is_active)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-in fade-in duration-700">

      {/* Header section */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">Integration Hub</h1>
            <p className="text-white/40 font-medium">Connect and manage your third-party automation tools.</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/20 uppercase tracking-widest text-[10px] font-black">Total Connected</span>
            <span className="text-2xl font-black text-white leading-none">{integrations.filter(i => i.is_active).length}</span>
          </div>
        </div>

        {/* Security Message (Below title-counter row) */}
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-accent-purple)]/60 uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              Keys are stored safely encrypted using AES-256
           </div>
           <div className="h-px w-24 bg-gradient-to-r from-[var(--color-accent-purple)]/40 to-transparent" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Zap className="w-8 h-8 text-white/10 animate-pulse" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {SUPPORTED_SERVICES.map((service) => (
            <motion.div
              key={service.id}
              whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.04)" }}
              className="glass-panel rounded-[2.5rem] bg-black/30 border border-white/5 hover:border-white/10 flex flex-col md:flex-row items-center group relative overflow-hidden transition-all duration-300"
            >
              {/* Main Content Side */}
              <div className="flex flex-1 flex-col md:flex-row items-center gap-6 p-4 md:p-5 md:pr-0">
                {/* Left Side: Logo/Status Block */}
                <div className="flex flex-col items-center justify-center w-24 md:border-r border-white/5 md:pr-6 shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform duration-500 shadow-xl">
                    {service.logo}
                  </div>
                  {isConnected(service.id) ? (
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      Connected
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/20 text-[8px] font-black uppercase tracking-widest">
                      Idle
                    </div>
                  )}
                </div>

                {/* Main Content Area */}
                <div className="flex flex-col gap-2 flex-1 min-w-0 pr-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      service.id === 'openai' ? "text-emerald-400" : "text-blue-400"
                    )}>
                      {service.type}
                    </span>
                    <div className="text-[9px] font-black uppercase tracking-widest text-white/20">
                      ID: {service.id.slice(0, 4)}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">{service.name}</h3>
                  <p className="text-xs text-white/40 font-medium leading-relaxed max-w-2xl">
                    {service.description}
                  </p>
                </div>
              </div>

              {/* Action Area (Matches metrics/buttons in Workflows) */}
              <div className="md:w-[200px] shrink-0 self-stretch relative group/action overflow-hidden">
                {/* Frosted Layer Wrapper */}
                <div className="absolute inset-0 bg-white/[0.04] backdrop-blur-3xl md:border-l border-white/5 transition-all duration-500 group-hover/action:bg-white/[0.08]" />

                <div className="relative h-full flex flex-col md:items-end p-5 pr-8 justify-center gap-3">
                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <ShieldCheck className="w-4 h-4 text-[var(--color-accent-purple)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50 truncate">AES-256 SECURE</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(service.id)
                    }}
                    disabled={isConnecting}
                    className={cn(
                      "flex items-center gap-2.5 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg",
                      isConnected(service.id)
                        ? "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10"
                        : "bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                    )}
                  >
                    {isConnected(service.id) ? (
                      <>
                        <Settings2 className="w-3.5 h-3.5" />
                        Configure
                      </>
                    ) : (
                      <>
                        {isConnecting && service.id === "google" ? <Zap className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Sync
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Connection Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Connect {SUPPORTED_SERVICES.find(s => s.id === showModal)?.name}</h2>
                  <p className="text-xs text-white/40 font-medium">Securely add your credentials.</p>
                </div>
              </div>

              {/* Special Handling for Google OAuth */}
              {showModal === 'google' && (
                <div className="mb-6 space-y-4">
                  <button
                    onClick={() => {
                      handleOAuthConnect('google')
                      setShowModal(null)
                    }}
                    className="w-full h-12 rounded-xl bg-white text-black font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/90 transition-all border-b-2 border-black/10 active:scale-[0.98]"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                       <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                       <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                       <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                       <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                    </svg>
                    Official Sync (OAuth2)
                  </button>
                  <div className="flex items-center gap-4 py-2">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">or manual override</span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                    {showModal === 'google' ? 'Manual Access Token (y29...)' : 'API Key'}
                  </label>
                  <input
                    autoFocus
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={showModal === 'google' ? "y29.a0AfB_..." : "sk-..."}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-400/50 transition-colors"
                  />
                  {showModal === 'google' && (
                    <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest mt-1 ml-1 leading-relaxed">
                      Use this to bypass Google's app verification during recruitment tests. Grab a token from the Google OAuth Playground.
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-blue-400/5 border border-blue-400/20 flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-[10px] text-blue-300/80 font-medium leading-relaxed">
                    Credentials are AES-256 encrypted. We never store keys in plain-text.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-xs font-medium flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(null)
                    setApiKey("")
                    setError(null)
                  }}
                  className="flex-1 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (showModal === 'google') {
                      // Wrap in the JSON format getGoogleAuth expects
                      const fakeTokenJson = JSON.stringify({ access_token: apiKey })
                      const res = await fetch("/api/integrations", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
                        },
                        body: JSON.stringify({
                          service_name: "google",
                          api_key: fakeTokenJson
                        })
                      })
                      if (!res.ok) {
                         const err = await res.json()
                         setError(err.error || "Failed to save manually.")
                         return
                      }
                      await fetchIntegrations()
                      setShowModal(null)
                      setApiKey("")
                    } else {
                      handleConnectAPI()
                    }
                  }}
                  disabled={saving || !apiKey.trim()}
                  className="flex-[2] h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? "Saving..." : "Save Connection"}
                  {!saving && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
