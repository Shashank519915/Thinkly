"use client"

import { motion } from "framer-motion"

export function BottomBlurOverlay() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 pointer-events-none z-[95] overflow-hidden"
    >
      {/* 
        The "Edge-less" Blur:
        By using inset-0, we move the div's edge far away from the visual transition.
        The blur is only revealed at the bottom via an 8-stop exponential mask.
      */}
      <div 
        className="absolute inset-0 backdrop-blur-[24px] transform-gpu"
        style={{
          maskImage: "linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.95) 6%, rgba(0, 0, 0, 0.8) 12%, rgba(0, 0, 0, 0.4) 20%, rgba(0, 0, 0, 0.1) 28%, transparent 35%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.95) 6%, rgba(0, 0, 0, 0.8) 12%, rgba(0, 0, 0, 0.4) 20%, rgba(0, 0, 0, 0.1) 28%, transparent 35%, transparent 100%)"
        }}
      />
      
      {/* Grounding Tint: Also adjusted for a lower profile */}
      <div 
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        style={{
          maskImage: "linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.8) 15%, transparent 30%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.8) 15%, transparent 30%)"
        }}
      />
    </motion.div>
  )
}
