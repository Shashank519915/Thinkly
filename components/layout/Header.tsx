import { cn } from "@/lib/utils"
import {
  LayoutDashboard, History, LayoutTemplate, LineChart, Zap,
  LayoutPanelLeft, LogIn, LogOut, User, Menu, X
} from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { motion, AnimatePresence } from "framer-motion"

export type TabType = "Dashboard" | "My Workflows" | "Integrations" | "Automations" | "Performance"

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onNewWorkflow?: () => void;
}

export function Header({ activeTab, onTabChange, onNewWorkflow, className, ...props }: HeaderProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsMenuOpen(false)
  }

  const [activeInstances, setActiveInstances] = useState(0)

  useEffect(() => {
    if (!user) return;
    const fetchActive = async () => {
      const { data } = await supabase.from('automation_instances').select('id').eq('user_id', user.id).eq('status', 'running');
      setActiveInstances(data?.length || 0);
    }
    fetchActive();
    const interval = setInterval(fetchActive, 10000);
    return () => clearInterval(interval);
  }, [user])

  const tabs: { type: TabType; label: string; icon: React.ReactNode }[] = [
    { type: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { type: "My Workflows", label: "Workflows", icon: <History className="w-4 h-4" /> },
    { type: "Integrations", label: "Integrations", icon: <LayoutPanelLeft className="w-4 h-4" /> },
    { type: "Automations", label: "Automations", icon: <Zap className="w-4 h-4" /> },
  ]

  return (
    <header className={cn("mx-auto max-w-5xl w-full mt-0 sm:mt-6 mb-4 flex items-center justify-between px-6 py-3 relative z-[100]", className)} {...props}>
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative">
          <h1 className="relative text-3xl font-bold tracking-tight text-white drop-shadow-sm leading-none">Thinkly</h1>
          <p className="relative text-[10px] text-[var(--color-accent-blue)] font-medium leading-none mt-1">AI Workflow Copilot</p>
        </div>

        {activeInstances > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in slide-in-from-left-2 duration-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{activeInstances} LIVE</span>
          </div>
        )}
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/10 backdrop-blur-md relative overflow-hidden h-[46px]">
        {tabs.map((tab) => (
          <NavItem
            key={tab.type}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.type}
            onClick={() => onTabChange(tab.type)}
          />
        ))}
      </nav>

      {/* Mobile Trigger & Profile Container */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white transition-all active:scale-90"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {!user ? (
          <button
            onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-white/10 text-black text-xs font-bold transition-all hover:bg-white/90 active:scale-95 shadow-lg"
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center border border-white/20">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute top-12 right-0 w-48 glass-panel bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[120]"
                >
                  <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Identity</p>
                    <p className="text-[11px] font-bold text-white/90 truncate mt-1">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-red-400 text-xs font-bold transition-all mb-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Secure Logout
                  </button>
                  <div className="border-t border-white/5 pt-2 mt-1 space-y-1">
                    <a href="/privacy" className="block px-3 py-1.5 text-[10px] font-bold text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors rounded-lg hover:bg-white/5">Privacy Policy</a>
                    <a href="/terms" className="block px-3 py-1.5 text-[10px] font-bold text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors rounded-lg hover:bg-white/5">Terms of Service</a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Mobile Full-Screen/Overlay Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-20 left-6 right-6 glass-panel bg-black/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[110]"
          >
            <div className="flex flex-col gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => {
                    onTabChange(tab.type)
                    setIsMobileMenuOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-sm font-bold w-full",
                    activeTab === tab.type
                      ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span className={cn("p-2 rounded-xl transition-colors", activeTab === tab.type ? "bg-white/10 text-white" : "text-white/20")}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 px-4 h-full rounded-xl transition-all text-sm font-bold whitespace-nowrap z-10",
        active ? "text-white" : "text-white/40 hover:text-white/70"
      )}
    >
      {active && (
        <motion.div
          layoutId="header-active-tab"
          className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-20 flex items-center gap-2">
        {icon}
        <span className="hidden lg:block">{label}</span>
      </span>
    </button>
  )
}
