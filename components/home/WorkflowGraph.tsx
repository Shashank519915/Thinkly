import { useState, useMemo, useCallback, useEffect, memo as reactMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
  MarkerType,
  ReactFlowInstance,
  MiniMap
} from '@xyflow/react'
// Required styles for React Flow
import '@xyflow/react/dist/style.css'

import { cn } from "@/lib/utils"
import {
  Zap,
  Play,
  AlertTriangle,
  GitMerge,
  Server,
  X,
  Activity,
  LayoutGrid,
  Loader2,
  Check
} from 'lucide-react'
import { WorkflowNode } from '@/types/workflow'
import dagre from 'dagre'
import { AnimatePresence, motion } from 'framer-motion'


const NODE_W = 280
const NODE_H = 160

const getIcon = (type: string) => {
  if (type === "trigger") return <Play className="w-3.5 h-3.5 text-white" />
  if (type === "condition") return <GitMerge className="w-3.5 h-3.5 text-white" />
  if (type === "error") return <AlertTriangle className="w-3.5 h-3.5 text-white" />
  if (type === "monitor") return <Activity className="w-3.5 h-3.5 text-white" />
  return <Server className="w-3.5 h-3.5 text-white" />
}

const getTypeAccent = (type: string) => {
  if (type === 'trigger') return '#60a5fa'   // blue
  if (type === 'condition') return '#f59e0b'  // amber
  if (type === 'error') return '#f43f5e'      // rose
  if (type === 'monitor') return '#10b981'    // emerald
  return '#a78bfa'                            // purple (action/logic)
}

const getIconBg = (type: string) => {
  if (type === 'condition') return 'bg-gradient-to-br from-orange-500 to-amber-600'
  if (type === 'error') return 'bg-gradient-to-br from-red-500 to-rose-600'
  if (type === 'monitor') return 'bg-gradient-to-br from-[#10b981] to-[#047857]'
  if (type === 'trigger') return 'bg-gradient-to-br from-blue-500 to-blue-700'
  return 'bg-gradient-to-br from-purple-500 to-indigo-600'
}

// ✅ PERFORMANCE: Wrapped in reactMemo to prevent unnecessary re-renders of existing nodes
const GlassNode = reactMemo(({ data }: { data: any }) => {
  const nodeData = data as WorkflowNode
  const runStatus = data.runStatus as { status: string, output?: any } | undefined
  const accent = getTypeAccent(nodeData.type)
  const isRunning = runStatus?.status === 'running'
  const isSuccess = runStatus?.status === 'success'
  const isMobile = data.isMobile

  return (
    <div
      className={cn(
        "rounded-2xl bg-[#111111]/95 border border-white/10 text-white relative transition-all duration-300 overflow-hidden",
        !isMobile && "shadow-2xl", // Only add heavy shadows on desktop
        isRunning && "ring-2 ring-blue-500 ring-offset-4 ring-offset-black",
        isSuccess && "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
      )}
      style={{ 
        width: NODE_W, 
        borderLeft: `6px solid ${accent}`,
        backdropFilter: isMobile ? 'none' : 'blur(20px)' // ✅ Disable heavy blur on mobile
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 relative z-10 bg-white/[0.01]">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg bg-white/5", isRunning && "animate-pulse")}>
          {getIcon(nodeData.type)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: accent }}>{nodeData.type}</span>
          <h4 className="text-sm font-bold text-white truncate leading-tight">{nodeData.label}</h4>
        </div>

        {isSuccess && (
          <div className="ml-auto w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500" />
          </div>
        )}
        {isRunning && (
          <div className="ml-auto">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4 min-h-[80px] flex flex-col justify-between gap-3 relative z-10">
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 pr-2">{nodeData.description}</p>

        <div className="flex items-center gap-2">
          {nodeData.tool && (
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-semibold text-white/30 truncate">
              {nodeData.tool}
            </span>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-white/20 !border-white/10 !left-[-7px]" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-white/20 !border-white/10 !right-[-7px]" />
    </div>
  )
})

const nodeTypes = { custom: GlassNode }

interface WorkflowGraphProps {
  nodes: WorkflowNode[]
  isRunningLive?: boolean
  runLogs?: Record<string, any>
}

interface CustomNodeData extends WorkflowNode {
  runStatus?: { status: string; output?: any }
  isMobile: boolean
  [key: string]: any // Satisfy Record<string, unknown> constraint
}

// ✅ Type-safe node definition for React Flow
type AppNode = Node<CustomNodeData>

export function WorkflowGraph({
  nodes: rawNodes,
  isRunningLive = false,
  runLogs = {},
}: WorkflowGraphProps) {
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isMobile, setIsMobile] = useState(true) // ✅ Mobile-First Initial State
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    setIsInitialized(true)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ✅ STEP 1: Calculate structural placement ONLY when the graph structure changes.
  // This prevents expensive dagre layout calculations during status updates.
  const positionedNodes = useMemo(() => {
    if (!rawNodes || rawNodes.length === 0) return []

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 200, marginx: 60, marginy: 60 })
    g.setDefaultEdgeLabel(() => ({}))

    rawNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
    
    // Setup edges for dagre calculation
    const nodeIds = new Set(rawNodes.map(n => n.id))
    rawNodes.forEach(n => {
      const targets = [
        ...(n.nextNodes || (n as any).next_nodes || []),
        ...(n.falseNextNodes || (n as any).false_next_nodes || []),
        ...(n.errorNodes || (n as any).error_nodes || [])
      ]
      targets.forEach(tid => {
        if (nodeIds.has(tid)) g.setEdge(n.id, tid)
      })
    })

    dagre.layout(g)

    return rawNodes.map(n => {
      const pos = g.node(n.id)
      return {
        id: n.id,
        type: 'custom',
        data: n,
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 }
      }
    })
  }, [rawNodes.map(n => n.id).join(',')]) // Only recalculate if nodes are added/removed

  // ✅ STEP 2: Hydrate nodes with status data and edges with styling.
  // This memo is cheaper and runs when statuses update.
  const { layoutedNodes, initialEdges } = useMemo(() => {
    const nodeIds = new Set(rawNodes.map(n => n.id))
    
    const nodes: AppNode[] = positionedNodes.map(n => ({
      ...n,
      data: { 
        ...(n.data as WorkflowNode), 
        runStatus: runLogs[n.id],
        isMobile // Pass hint to GlassNode for visual pruning
      }
    }))

    const edges: Edge[] = rawNodes.flatMap(n => {
      const result: Edge[] = []
      const nextArr = n.nextNodes || (n as any).next_nodes || []
      const falseArr = n.falseNextNodes || (n as any).false_next_nodes || []
      const errorArr = n.errorNodes || (n as any).error_nodes || []

      nextArr.forEach((targetId: string) => {
        if (nodeIds.has(targetId)) {
          result.push({
            id: `e-${n.id}-next-${targetId}`,
            source: n.id,
            target: targetId,
            animated: isRunningLive,
            style: { 
              stroke: '#8b5cf6', 
              strokeWidth: isMobile ? 2 : 3, // Simpler line on mobile
              // ✅ Disable expensive drop-shadow filter on mobile GPU
              filter: isMobile ? 'none' : 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' 
            },
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              width: isMobile ? 16 : 22, 
              height: isMobile ? 16 : 22, 
              color: '#8b5cf6' 
            },
          })
        }
      })

      // False and Error edges follow simpler styles
      falseArr.forEach((targetId: string) => {
        if (nodeIds.has(targetId)) {
          result.push({
            id: `e-${n.id}-false-${targetId}`,
            source: n.id,
            target: targetId,
            animated: false,
            label: 'FALSE',
            labelStyle: { fill: '#f59e0b', fontWeight: 700, fontSize: isMobile ? 7 : 8 },
            labelBgStyle: { fill: 'rgba(0,0,0,0.6)' },
            style: { stroke: 'rgba(245,158,11,0.75)', strokeWidth: isMobile ? 1 : 2, strokeDasharray: '5 4' },
          })
        }
      })

      errorArr.forEach((targetId: string) => {
        if (nodeIds.has(targetId)) {
          result.push({
            id: `e-${n.id}-error-${targetId}`,
            source: n.id,
            target: targetId,
            animated: false,
            label: 'ERROR',
            labelStyle: { fill: '#f43f5e', fontWeight: 700, fontSize: isMobile ? 7 : 8 },
            labelBgStyle: { fill: 'rgba(0,0,0,0.6)' },
            style: { stroke: 'rgba(244,63,94,0.75)', strokeWidth: isMobile ? 1 : 2, strokeDasharray: '5 4' },
          })
        }
      })
      return result
    })

    return { layoutedNodes: nodes, initialEdges: edges }
  }, [positionedNodes, runLogs, isMobile, isRunningLive])

  const onInit = useCallback((instance: ReactFlowInstance<AppNode, Edge>) => {
    setTimeout(() => {
      const nodes = instance.getNodes()
      const trigger = nodes.find(n => n.data.type === 'trigger') || nodes[0]
      if (trigger) {
        instance.setCenter(trigger.position.x + NODE_W / 2, trigger.position.y + NODE_H / 2, { 
          zoom: isMobile ? 0.6 : 1, 
          duration: 800 
        })
      }
    }, 150)
  }, [isMobile])

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: isInitialized ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full min-h-[400px] relative"
    >
      <ReactFlow<AppNode, Edge>
        nodes={layoutedNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNode(node.data as unknown as WorkflowNode)}
        fitView
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <Background
          color="#8b5cf6"
          gap={40}
          size={1}
          className="opacity-[0.03]"
        />

        {/* Control Panel matched to MiniMap width */}
        <Controls
          position="bottom-left"
          orientation="horizontal"
          showInteractive={false}
          style={{ width: isMobile ? 120 : 150 }}
          className="!flex !flex-row !justify-around !bg-black/95 !border-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.5)] !rounded-xl overflow-hidden scale-75 sm:scale-[0.95] !p-1 [&_button]:!bg-transparent [&_button]:!border-none [&_button_svg]:!fill-white/60 [&_button]:hover:!bg-white/10 [&_button]:!transition-colors !mb-[120px] sm:!mb-[135px] !ml-[20px] origin-bottom-left"
        />

        {!isMobile && (
          <MiniMap
            position="bottom-left"
            style={{ width: 150, height: 100 }}
            className="!bg-black/80 !border-white/10 !rounded-2xl !shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden origin-bottom-left !mb-[20px] !ml-[20px]"
            maskColor="rgba(255,255,255,0.03)"
            maskStrokeColor="rgba(255,255,255,0.2)"
            maskStrokeWidth={2}
            nodeColor={(n) => getTypeAccent(n.data?.type as string) || '#a78bfa'}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        )}



        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">


          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-panel w-72 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl relative"
                style={{ borderTop: `3px solid ${getTypeAccent(selectedNode.type)}` }}
              >
                <button onClick={() => setSelectedNode(null)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getIconBg(selectedNode.type)}`}>
                    {getIcon(selectedNode.type)}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase opacity-40" style={{ color: getTypeAccent(selectedNode.type) }}>{selectedNode.type}</div>
                    <div className="text-sm font-bold text-white leading-tight">{selectedNode.label}</div>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed mb-4">
                  {typeof selectedNode.description === 'object' ? JSON.stringify(selectedNode.description) : selectedNode.description}
                </p>
                {selectedNode.tool && (
                  <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Tool</span>
                    <span className="text-[10px] font-bold text-blue-400">{selectedNode.tool}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ReactFlow>
    </motion.div>
  )
}
