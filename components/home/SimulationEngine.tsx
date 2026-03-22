"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useReactFlow, getBezierPath, Position } from "@xyflow/react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, CheckCircle2, Loader2, Play, Info } from "lucide-react"

export interface SimulationStep {
  nodeId: string
  message: string
  payloadPreview: string
  actionType: "fetch" | "process" | "send" | "error"
}

interface SimulationEngineProps {
  steps: SimulationStep[]
  isActive: boolean
  onComplete: () => void
}

export function SimulationEngine({ steps, isActive, onComplete }: SimulationEngineProps) {
  const { getNodes, getEdges } = useReactFlow()
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [visiblePopups, setVisiblePopups] = useState<Record<string, boolean>>({})
  const [tokenPath, setTokenPath] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(-1)
      setVisiblePopups({})
      setTokenPath(null)
      return
    }

    if (steps.length === 0) return

    let timeout: NodeJS.Timeout
    
    async function runNext(index: number) {
      if (index >= steps.length) {
        timeout = setTimeout(onComplete, 3000)
        return
      }

      // 1. If not the first node, animate travel from previous node
      if (index > 0) {
        const prevStep = steps[index - 1]
        const currentStep = steps[index]
        const allEdges = getEdges()
        const edge = allEdges.find(e => e.source === prevStep.nodeId && e.target === currentStep.nodeId)
        
        if (edge) {
          const sourceNode = getNodes().find(n => n.id === edge.source)
          const targetNode = getNodes().find(n => n.id === edge.target)
          
          if (sourceNode?.measured && targetNode?.measured) {
            const [path] = getBezierPath({
              sourceX: sourceNode.position.x + sourceNode.measured.width!,
              sourceY: sourceNode.position.y + sourceNode.measured.height! / 2,
              targetX: targetNode.position.x,
              targetY: targetNode.position.y + targetNode.measured.height! / 2,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            })
            setTokenPath(path)
            // Wait for travel animation (1s)
            await new Promise(r => setTimeout(r, 1000))
            setTokenPath(null)
          }
        }
      }

      setCurrentStepIndex(index)
      const step = steps[index]
      
      // 2. Show popup on node
      setVisiblePopups(prev => ({ ...prev, [step.nodeId]: true }))

      // 3. Wait for user to read it
      await new Promise(r => setTimeout(r, 2200))

      // 4. Move to next
      runNext(index + 1)
    }

    runNext(0)

    return () => clearTimeout(timeout)
  }, [isActive, steps, onComplete, getNodes, getEdges])

  if (!isActive) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* ── Traveling Token ── */}
      <AnimatePresence>
        {tokenPath && (
          <motion.div
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-purple)",
              boxShadow: "0 0 15px var(--color-accent-purple), 0 0 30px var(--color-accent-purple)",
              offsetPath: `path("${tokenPath}")`,
              zIndex: 60
            }}
          >
            <div className="absolute inset-0 bg-white rounded-full scale-50 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {steps.map((step, idx) => {
          if (!visiblePopups[step.nodeId]) return null
          
          const node = getNodes().find(n => n.id === step.nodeId)
          if (!node) return null

          // Fallback to internal constants if measured is missing
          const width = node.measured?.width ?? 280 // NODE_W
          const height = node.measured?.height ?? 180 // NODE_H

          const x = node.position.x + (width / 2)
          const y = node.position.y - 12

          return (
            <motion.div
              key={`sim-popup-${step.nodeId}-${idx}`}
              initial={{ opacity: 0, y: 15, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, y: -20, transition: { duration: 0.3 } }}
              className="absolute w-[240px] glass-panel bg-black/95 backdrop-blur-3xl border border-[var(--color-accent-purple)]/50 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,1)] z-[100]"
              style={{ 
                top: y, 
                left: x, 
                transform: 'translate(-50%, -100%)' 
              }}
            >
              {/* Pulse Ring */}
              <div className="absolute inset-0 bg-[var(--color-accent-purple)]/5 animate-pulse rounded-2xl" />
              
              <div className="relative flex items-start gap-3 mb-2.5">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  step.actionType === "fetch" ? "bg-blue-500/20" : 
                  step.actionType === "process" ? "bg-amber-500/20" : "bg-green-500/20"
                }`}>
                  <Sparkles className={`w-3 h-3 ${
                    step.actionType === "fetch" ? "text-blue-400" : 
                    step.actionType === "process" ? "text-amber-400" : "text-green-400"
                  }`} />
                </div>
                <div className="text-[11px] font-bold text-white/95 leading-snug">
                  {step.message}
                </div>
              </div>

              <div className="relative bg-white/5 rounded-xl p-2.5 font-mono text-[9px] text-white/60 break-all border border-white/10 shadow-inner">
                {step.payloadPreview}
              </div>

              {/* Status bar */}
              <div className="mt-3 h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.2 }}
                  className="h-full bg-[var(--color-accent-purple)]"
                />
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* ── Travel Token Animation (Simplified for now, will refine) ── */}
      {/* Implementation: We could overlay tokens moving on SVG paths from Edges */}
    </div>
  )
}
