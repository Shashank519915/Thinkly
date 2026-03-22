"use client"
import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import SplitText from "./SplitText"
import BlurText from "./BlurText"

export default function LoadingScreen() {
  const [statusIndex, setStatusIndex] = useState(0)
  
  const statuses = [
    "Initializing neural architecture",
    "Synchronizing cloud blueprints",
    "Authenticating secure protocols",
    "Optimizing workflow nodes",
    "Ready for launch"
  ]

  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  if (!isMounted) return <div className="fixed inset-0 z-[9999] bg-black" />

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Film Grain Effect Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <svg className="w-full h-full">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Branding */}
        <div className="text-center">
          <SplitText
            text="Thinkly"
            className="text-7xl md:text-9xl font-black text-white tracking-tight mb-2"
            delay={60}
            duration={1.2}
            from={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          />
          
          <div className="h-10">
            <BlurText
              text="AI Workflow Copilot"
              className="text-[#60a5fa] font-bold text-2xl md:text-3xl tracking-tight"
              delay={800}
              animateBy="none"
              animationFrom={{ opacity: 0, filter: 'blur(10px)', y: 10 }}
              animationTo={[{ opacity: 1, filter: 'blur(0px)', y: 0 }]}
            />
          </div>
        </div>

        {/* Status Sequence */}
        <div className="mt-24 flex flex-col items-center">
          <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden mb-4">
            <motion.div 
              initial={{ left: "-100%" }}
              animate={{ left: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
            />
          </div>
          
          <div className="h-4 overflow-hidden">
            <motion.p
              key={statusIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-white/20 text-[10px] font-mono uppercase tracking-widest text-center"
            >
              {statuses[statusIndex]}...
            </motion.p>
          </div>
        </div>
      </div>
      
      {/* Decorative corners - Subtle anchors for the minimalist view */}
      <div className="absolute top-10 left-10 w-20 h-20 border-t border-l border-white/5 rounded-tl-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 w-20 h-20 border-t border-r border-white/5 rounded-tr-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-20 h-20 border-b border-l border-white/5 rounded-bl-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-20 h-20 border-b border-r border-white/5 rounded-br-3xl pointer-events-none" />
    </div>
  )
}
