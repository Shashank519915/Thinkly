import { useState, useEffect } from "react"
import { Sparkles, RefreshCw, ArrowRight, ArrowLeft, CheckCircle2, Clock, Users, Zap, Calendar } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import BlurText from "@/components/ui/BlurText"
import BorderGlow from "@/components/ui/BorderGlow"
import SplitText from "@/components/ui/SplitText"

const COMMON_TOOLS = [
  "Salesforce", "Slack", "Gmail", "Google Sheets", "Discord", "Jira", "Notion", "HubSpot", "Zendesk", "Trello", "Asana", "GitHub", "Monday.com", "Intercom", "Airtable", "ClickUp", "Pipedrive"
]

const PLACEHOLDER_EXAMPLES = [
  "e.g. I export leads from Salesforce, qualify them via email, and sync to HubSpot...",
  "e.g. Every Friday, summarize all Slack conversations and create Jira tickets...",
  "e.g. When a new file is added to Google Drive, notify the team and upload to Notion...",
  "e.g. Send a personalized welcome email to every new signup in my database...",
  "e.g. Extract company data from incoming Gmails and append to a Google Sheet...",
  "e.g. Sync new Shopify orders to a Discord channel and update inventory in Airtable..."
]

export function HeroInput({ onGenerate, loading }: { onGenerate: (text: string) => void, loading?: boolean }) {
  const [step, setStep] = useState(1)

  // Form State
  const [objective, setObjective] = useState("")
  const [tools, setTools] = useState<string[]>([])
  const [triggerType, setTriggerType] = useState<"Event" | "Schedule">("Event")
  const [triggerCondition, setTriggerCondition] = useState("")
  const [hours, setHours] = useState("5")
  const [teamSize, setTeamSize] = useState("1-5")

  // Rotating Placeholder Logic
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  // Loading Animation Cycle (0: Appear, 1: Stay, 2: Disappear, 3: Wait)
  const [loadingCycle, setLoadingCycle] = useState(0)

  useEffect(() => {
    if (isFocused || objective) return
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isFocused, objective])

  useEffect(() => {
    if (!loading) {
      setLoadingCycle(0)
      return
    }

    let timer: NodeJS.Timeout
    if (loadingCycle === 0) {
      timer = setTimeout(() => setLoadingCycle(1), 1500)
    } else if (loadingCycle === 1) {
      timer = setTimeout(() => setLoadingCycle(2), 2000)
    } else if (loadingCycle === 2) {
      timer = setTimeout(() => setLoadingCycle(3), 1500)
    } else {
      timer = setTimeout(() => setLoadingCycle(0), 500)
    }

    return () => clearTimeout(timer)
  }, [loading, loadingCycle])

  const handleNext = () => setStep(s => Math.min(s + 1, 4))
  const handlePrev = () => setStep(s => Math.max(s - 1, 1))

  const handleSubmit = () => {
    if (!objective.trim()) return;
    const payload = {
      objective,
      techStack: tools.length > 0 ? tools : ["Unknown"],
      trigger: { type: triggerType, condition: triggerCondition || "Always" },
      currentFriction: { hoursPerWeek: hours, teamSize }
    }
    onGenerate(JSON.stringify(payload, null, 2))
  }

  const toggleTool = (tool: string) => {
    if (tools.includes(tool)) setTools(tools.filter(t => t !== tool))
    else setTools([...tools, tool])
  }

  // Common animation config
  const slideTransition = {
    initial: { opacity: 0, y: 15, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -15, filter: "blur(4px)", transition: { duration: 0.2 } },
    transition: { duration: 0.4 }
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center mt-6 md:mt-12 mb-16 relative z-10 px-4">
      {/* Title Header - Persistent */}
      <div className="text-center w-full mb-10">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white/30 via-white/70 to-white/90 drop-shadow-sm">
          Design your <span className="italic">workflow</span>
        </h2>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
          Describe a repetitive process — <span className="text-white/80 font-medium">Thinkly</span> will help you automate it
        </p>
      </div>

      <div className="w-full max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <BorderGlow
              key="auto-loader-glow"
              borderRadius={24}
              backgroundColor="transparent"
              glowColor="167 139 250"
              animated={true}
              className="w-full h-[350px]"
            >
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full h-full glass-panel flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl rounded-3xl p-8"
              >
                <div className="flex items-center gap-8 mb-4">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-[var(--color-accent-blue)] opacity-30 blur-2xl rounded-full animate-pulse" />
                    <RefreshCw className="relative w-14 h-14 text-[var(--color-accent-blue)] animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <SplitText
                    key={`loading-text-${loadingCycle === 0 || loadingCycle === 1 ? 'in' : 'out'}`}
                    text="Architecting your workflow..."
                    className="text-white/90 font-black text-3xl md:text-4xl tracking-tight drop-shadow-lg"
                    delay={40}
                    duration={1.2}
                    reverse={loadingCycle === 2 || loadingCycle === 3}
                    from={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    textAlign="left"
                  />
                </div>

                <div className="h-6">
                  <BlurText
                    key="static-loading-sub"
                    text="Systemic Node Analysis in Progress"
                    className="text-white/30 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase"
                    delay={0}
                    animateBy="words"
                  />
                </div>
              </motion.div>
            </BorderGlow>
          ) : (
            <motion.div
              layout
              key="designer-card"
              className={cn(
                "w-full glass-panel relative group shadow-2xl bg-black/40 backdrop-blur-xl transition-all duration-700 flex flex-col overflow-hidden h-[350px] rounded-3xl"
              )}
            >
              <div className="flex flex-col h-full w-full relative">
                {/* CONTENT AREA */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`step-${step}`}
                    className="flex-1 p-5 md:p-6 overflow-hidden"
                    {...slideTransition}
                  >
                    {/* STEP 1: INTENT */}
                    {step === 1 && (
                      <div className="flex flex-col h-full">
                        <BlurText text="How can I help you today?" className="text-xl font-bold text-white mb-0.5" delay={50} animateBy="words" />
                        <BlurText text="Describe the manual, repetitive task you want to eliminate." className="text-[13px] text-white/50 mb-3" delay={30} animateBy="words" />

                        <div className="relative flex-1">
                          <textarea
                            autoFocus
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className="w-full h-full bg-black/20 border border-white/10 rounded-2xl text-white placeholder-transparent p-5 resize-none focus:outline-none focus:border-[var(--color-accent-purple)]/50 transition-colors text-lg md:text-xl leading-relaxed shadow-inner"
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                          />
                          <AnimatePresence mode="wait">
                            {!objective && (
                              <div className="absolute inset-x-5 top-5 pointer-events-none text-white/20 text-lg md:text-xl leading-relaxed italic">
                                <BlurText
                                  text={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                                  delay={40}
                                  animateBy="none"
                                  className="w-full h-full"
                                  animationFrom={{ opacity: 0, filter: 'blur(10px)', y: 0 }}
                                  animationTo={[{ opacity: 0.5, filter: 'blur(5px)', y: 0 }, { opacity: 1, filter: 'blur(0px)', y: 0 }]}
                                />
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: TOOLS */}
                    {step === 2 && (
                      <div className="flex flex-col h-full overflow-hidden">
                        <BlurText text="Technology Stack" className="text-xl font-bold text-white mb-0.5" delay={50} animateBy="words" />
                        <BlurText text="Select the applications involved in this workflow." className="text-[13px] text-white/50 mb-3" delay={30} animateBy="words" />

                        <div className="flex flex-wrap gap-2 overflow-y-auto pr-2 custom-scrollbar">
                          {COMMON_TOOLS.map(t => {
                            const active = tools.includes(t)
                            return (
                              <button
                                key={t}
                                onClick={() => toggleTool(t)}
                                className={cn(
                                  "px-4 py-2 rounded-xl border text-[13px] font-bold tracking-wide transition-all duration-200 active:scale-95 flex items-center gap-2",
                                  active
                                    ? "bg-[var(--color-accent-purple)]/20 border-[var(--color-accent-purple)]/50 text-white shadow-[0_0_15px_rgba(167,139,250,0.2)]"
                                    : "bg-black/20 border-white/10 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/20 shadow-sm"
                                )}
                              >
                                {active && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent-purple)]" />}
                                {t}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* STEP 3: TRIGGER */}
                    {step === 3 && (
                      <div className="flex flex-col h-full">
                        <BlurText text="Trigger Activation" className="text-lg font-bold text-white mb-0.5" delay={50} animateBy="words" />
                        <BlurText text="Choose how this workflow starts automatically." className="text-[12px] text-white/50 mb-2.5" delay={30} animateBy="words" />

                        <div className="flex flex-col gap-2 mb-2.5">
                          <button
                            onClick={() => setTriggerType("Event")}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-all active:scale-[0.99] group/btn",
                              triggerType === "Event"
                                ? "bg-gradient-to-r from-[var(--color-accent-blue)]/20 to-transparent border-[var(--color-accent-blue)]/50 text-white shadow-[inset_0_0_20px_rgba(96,165,250,0.1)]"
                                : "bg-black/20 border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60"
                            )}
                          >
                            <div className="flex flex-col items-center justify-center w-10 shrink-0">
                              <Zap className={cn("w-5 h-5", triggerType === "Event" ? "text-[var(--color-accent-blue)] drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" : "")} />
                              <span className="text-[8px] font-black mt-0.5 uppercase tracking-tighter">Instant</span>
                            </div>

                            <div className="w-px h-8 bg-white/10" />

                            <div className="text-left">
                              <h4 className="font-bold text-[13px] uppercase tracking-wide">Event-Driven</h4>
                              <p className="text-[10px] opacity-60 leading-tight">Launches on a specific live trigger (e.g. New Email).</p>
                            </div>
                          </button>

                          <button
                            onClick={() => setTriggerType("Schedule")}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-all active:scale-[0.99] group/btn",
                              triggerType === "Schedule"
                                ? "bg-gradient-to-r from-[var(--color-accent-purple)]/20 to-transparent border-[var(--color-accent-purple)]/50 text-white shadow-[inset_0_0_20px_rgba(167,139,250,0.1)]"
                                : "bg-black/20 border-white/10 text-white/40 hover:bg-white/5 hover:text-white/60"
                            )}
                          >
                            <div className="flex flex-col items-center justify-center w-10 shrink-0">
                              <Calendar className={cn("w-5 h-5", triggerType === "Schedule" ? "text-[var(--color-accent-purple)] drop-shadow-[0_0_10px_rgba(167,139,250,0.8)]" : "")} />
                              <span className="text-[8px] font-black mt-0.5 uppercase tracking-tighter">Cycle</span>
                            </div>

                            <div className="w-px h-8 bg-white/10" />

                            <div className="text-left">
                              <h4 className="font-bold text-[13px] uppercase tracking-wide">Scheduled Cron</h4>
                              <p className="text-[10px] opacity-60 leading-tight">Runs on a recurring clock or time intervals.</p>
                            </div>
                          </button>
                        </div>

                        <div className="mt-auto">
                          <label className="text-[11px] font-bold text-white/70 mb-1 block ml-1 uppercase tracking-widest">Filter Conditions</label>
                          <input
                            type="text"
                            placeholder="e.g. Only run if company size > 50..."
                            value={triggerCondition}
                            onChange={e => setTriggerCondition(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[var(--color-accent-purple)]/50 transition-colors shadow-inner"
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 4: METRICS */}
                    {step === 4 && (
                      <div className="flex flex-col h-full">
                        <BlurText text="Calibration" className="text-xl font-bold text-white mb-0.5" delay={50} animateBy="words" />
                        <BlurText text="Define your current ROI baseline." className="text-[13px] text-white/50 mb-3" delay={30} animateBy="words" />

                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-[12px] font-bold text-white/90 flex items-center gap-2 uppercase tracking-tight">
                                <Clock className="w-4 h-4 text-[var(--color-accent-blue)]" />
                                Hours lost per week
                              </label>
                              <span className="text-[var(--color-accent-blue)] font-black bg-[var(--color-accent-blue)]/10 px-3 py-1 rounded-full text-[12px] tabular-nums">{hours}H</span>
                            </div>
                            <input
                              type="range"
                              min="0" max="40" step="1"
                              value={hours}
                              onChange={e => setHours(e.target.value)}
                              className="w-full accent-[var(--color-accent-blue)] h-2 bg-white/5 rounded-full appearance-none outline-none cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="text-[12px] font-bold text-white/90 flex items-center gap-2 mb-3 uppercase tracking-tight">
                              <Users className="w-4 h-4 text-[var(--color-accent-purple)]" />
                              Team Size Impacted
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {["Solo", "2-5", "6-20", "20+"].map(size => (
                                <button
                                  key={size}
                                  onClick={() => setTeamSize(size)}
                                  className={cn(
                                    "px-4 py-2 rounded-xl border text-[12px] font-bold transition-all",
                                    teamSize === size
                                      ? "bg-[var(--color-accent-purple)]/20 border-[var(--color-accent-purple)]/50 text-white shadow-lg"
                                      : "bg-black/10 border-white/10 text-white/40 hover:text-white"
                                  )}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* NAVIGATION FOOTER */}
                <div className="h-[74px] px-8 flex justify-between items-center bg-white/[0.02] border-t border-white/10 shrink-0">
                  {step > 1 ? (
                    <button
                      onClick={handlePrev}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all font-bold text-sm border border-transparent hover:border-white/10 active:scale-95"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                  ) : <div />}

                  {step < 4 ? (
                    <button
                      onClick={handleNext}
                      disabled={!objective.trim() && step === 1}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 shadow-lg active:scale-95"
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="flex items-center gap-3 bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] hover:from-[var(--color-accent-purple)]/90 hover:to-[var(--color-accent-blue)]/90 text-white px-10 py-3 rounded-xl font-black text-sm transition-all shadow-[0_4px_20px_rgba(167,139,250,0.3)] hover:shadow-[0_0_30px_rgba(167,139,250,0.6)] hover:scale-105 active:scale-95 group"
                    >
                      <Sparkles className="w-4 h-4 group-hover:animate-spin" />
                      AUTOMATE
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
