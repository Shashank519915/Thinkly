"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Terminal,
  ChevronRight,
  Activity,
  History,
  Rocket,
  X,
  Database,
  Globe,
  Box,
  PlayCircle,
  PauseCircle,
  Volume2 // Added Volume2 for 'listening' status icon
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { WorkflowResponse } from "@/types/workflow"

interface AutomationInstance {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'listening' | 'paused'; // Added 'listening' and 'paused'
  logs: any[];
  current_step_id: string;
  created_at: string;
  updated_at: string;
}

export function AutomationsView() {
  const [instances, setInstances] = useState<AutomationInstance[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedInstance, setSelectedInstance] = useState<AutomationInstance | null>(null); // Added for potential instance details view

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        fetchData(user.id)
      } else {
        setLoading(false)
      }
    }
    checkUser()

    // Poll for updates every 5 seconds for live status
    const interval = setInterval(() => {
      if (userId) fetchInstances(userId)
    }, 5000)

    return () => clearInterval(interval)
  }, [userId])

  const fetchData = async (uid: string) => {
    setLoading(true)
    await Promise.all([
      fetchInstances(uid),
      fetchWorkflows(uid)
    ])
    setLoading(false)
  }

  const fetchInstances = async (uid: string) => {
    const { data } = await supabase
      .from('automation_instances')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (data) setInstances(data)
  }

  // Store latest state in refs to avoid constant React interval resets
  const stateRef = useRef({ instances, userId, workflows });
  useEffect(() => {
    stateRef.current = { instances, userId, workflows };
  }, [instances, userId, workflows]);

  // Reliable Polling Loop
  useEffect(() => {
    if (!userId) return;

    let isPolling = false;
    const pollActiveListeners = async () => {
      if (document.hidden) {
        console.log(`[POLL TICK] Tab is hidden. Listener paused.`);
        return;
      }
      if (isPolling) return; // Prevent concurrent overlaps
      isPolling = true;

      try {
        const { instances: curInst, userId: curUid, workflows: curWf } = stateRef.current;
        const listeners = curInst.filter(i => i.status === 'listening');
        console.log(`[POLL TICK] Found ${listeners.length} listening instances. (Tab Active)`);

        for (const inst of listeners) {
          const wf = curWf.find((w: any) => w.id === inst.workflow_id);
          if (!wf) continue;

          try {
            console.log(`[POLL] Fetching /api/automations/poll for instance ${inst.id}`);
            const res = await fetch('/api/automations/poll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceId: inst.id,
                userId: curUid,
                nodes: wf.data.nodes,
                edges: wf.data.edges || []
              })
            });
            const data = await res.json();
            console.log(`[POLL RESULT]`, data);

            if (data.triggered) {
              console.log("Triggered instance!", inst.id);
              fetchInstances(curUid!); // Instantly update UI to show 'running'
            }
          } catch (e) { console.error("Poll API err", e); }
        }
      } finally {
        isPolling = false;
      }
    };

    // Run poll immediately, then set interval
    pollActiveListeners();
    const interval = setInterval(pollActiveListeners, 10000);
    return () => clearInterval(interval);
  }, [userId]); // Only remount if the user logs out/in

  const fetchWorkflows = async (uid: string) => {
    const { data } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (data) setWorkflows(data)
  }

  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null)
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null)
  const [setupData, setSetupData] = useState<Record<string, string>>({})
  const [requirements, setRequirements] = useState<{ type: 'input' | 'trigger', key: string }[]>([])

  const scanRequirements = (wf: any) => {
    const found: { type: 'input' | 'trigger', key: string }[] = [];
    const jsonString = JSON.stringify(wf.data);
    const matches = jsonString.matchAll(/\{\{\$?(input|trigger)\.(.+?)\}\}/g);

    const seen = new Set();
    for (const match of matches) {
      const type = match[1] as 'input' | 'trigger';
      const key = match[2].split('.')[0].replace('}}', '');
      const uniqueKey = `${type}:${key}`;
      if (!seen.has(uniqueKey) && type === 'input') {
        found.push({ type, key });
        seen.add(uniqueKey);
      }
    }
    return found;
  }

  const handleSelectWorkflow = (wf: any) => {
    const reqs = scanRequirements(wf);
    setSelectedWorkflow(wf);
    setRequirements(reqs);
    setSetupData({});
    if (reqs.length === 0) {
      // If no reqs, we could auto-deploy, but better to show a confirmation
    }
  }

  const handleDeploy = async () => {
    if (!selectedWorkflow) return;

    try {
      setIsDeploying(true);
      const triggerData: Record<string, any> = {};
      const inputData: Record<string, any> = {};

      requirements.forEach(r => {
        let val: any = setupData[`${r.type}:${r.key}`];
        try {
          if (val && (val.startsWith('{') || val.startsWith('['))) {
            val = JSON.parse(val);
          }
        } catch (e) {
          // Keep as string if parsing fails
        }
        if (r.type === 'trigger') triggerData[r.key] = val;
        if (r.type === 'input') inputData[r.key] = val;
      });

      const response = await fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          workflowName: selectedWorkflow.name || selectedWorkflow.workflow_type || 'Untitled Workflow',
          nodes: selectedWorkflow.data.nodes,
          edges: selectedWorkflow.data.edges || [],
          userId: userId,
          triggerData,
          inputData
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowDeployModal(false);
        setSelectedWorkflow(null);
        fetchInstances(userId!);
      }
    } catch (err) {
      console.error("Deploy error:", err);
    } finally {
      setIsDeploying(false);
    }
  }

  const toggleInstanceStatus = async (instId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'listening' ? 'paused' : 'listening';
    await supabase.from('automation_instances').update({ status: newStatus }).eq('id', instId);
    fetchInstances(userId!);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'listening': return { label: 'LISTENING', icon: <Volume2 className="w-3 h-3 animate-pulse" />, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' }
      case 'running': return { label: 'RUNNING', icon: <RefreshCw className="w-3 h-3 animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
      case 'success': return { label: 'COMPLETED', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
      case 'failed': return { label: 'FAILED', icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
      case 'paused': return { label: 'PAUSED', icon: <PauseCircle className="w-3 h-3" />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' }
      default: return { label: 'PENDING', icon: <Clock className="w-3 h-3" />, color: 'text-white/40', bg: 'bg-white/5 border-white/10' }
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Rocket className="w-8 h-8 text-[var(--color-accent-blue)]" />
            Automations Hub
          </h2>
          <p className="text-white/40 font-medium max-w-xl">
            Monitor live instances, view execution logs, and manage your deployed workflow blueprints.
          </p>
        </div>

        <button
          onClick={() => setShowDeployModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/90 text-white font-bold text-sm shadow-[0_8px_32px_rgba(59,130,246,0.3)] transition-all active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          Deploy New Instance
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Instance List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-widest uppercase opacity-40 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Recent Deployments
            </h3>
            <button onClick={() => userId && fetchInstances(userId)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-white/20">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <span className="text-sm font-medium">Loading activity...</span>
            </div>
          ) : instances.length > 0 ? (
            <div className="space-y-3">
              {instances.map((inst) => {
                const statusDisplay = getStatusDisplay(inst.status);
                return (
                  <motion.div
                    key={inst.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 relative bg-transparent"
                  >
                    <div
                      onClick={() => setExpandedInstanceId(expandedInstanceId === inst.id ? null : inst.id)}
                      className="glass-panel p-5 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-black/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border",
                          statusDisplay.bg, statusDisplay.color
                        )}>
                          {statusDisplay.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-white flex items-center gap-2">
                            {inst.workflow_name}
                            <span className="text-[10px] text-white/20 font-mono">#{inst.id.slice(0, 8)}</span>
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-white/40 flex items-center gap-1 uppercase font-bold tracking-wider">
                              <History className="w-3 h-3" />
                              {new Date(inst.created_at).toLocaleTimeString()}
                            </span>
                            <div className={`px-2 py-1 rounded-md border text-[10px] font-bold flex items-center gap-1.5 w-fit ${statusDisplay.bg} ${statusDisplay.color}`}>
                              {statusDisplay.icon}
                              {statusDisplay.label}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {(inst.status === 'listening' || inst.status === 'paused' || inst.status === 'success' || inst.status === 'failed') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleInstanceStatus(inst.id, inst.status); }}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors z-10"
                            title={inst.status === 'listening' ? 'Pause Listener' : 'Start Listening'}
                          >
                            {inst.status === 'listening' ? (
                              <PauseCircle className="w-5 h-5 text-amber-400" />
                            ) : (
                              <PlayCircle className="w-5 h-5 text-emerald-400" />
                            )}
                          </button>
                        )}
                        <div className="text-right">
                          <div className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1">STEPS EXECUTED</div>
                          <div className="text-2xl font-black text-white">{inst.logs?.filter((l: any) => l.status === 'success').length || 0}</div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-white/20 transition-transform ${expandedInstanceId === inst.id ? 'rotate-90 text-white' : ''}`} />
                      </div>
                    </div>

                    {/* Expandable Live Execution Terminal UI */}
                    <AnimatePresence>
                      {expandedInstanceId === inst.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-5 mt-1 mx-4 bg-black border border-white/10 rounded-2xl shadow-2xl font-mono text-[11px] text-white/70 space-y-3 relative overflow-hidden">
                            {/* Matrix Terminal Styling Overlay */}
                            <div className="absolute inset-0 bg-blue-500/[0.03] pointer-events-none" />

                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                              <h5 className="text-[10px] text-blue-400 uppercase font-black tracking-widest flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Live Execution Terminal
                              </h5>
                              <span className="text-[9px] text-white/30 tracking-widest uppercase">ID: {inst.id}</span>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {inst.logs?.length > 0 ? inst.logs.map((log: any, idx: number) => (
                                <div key={idx} className="flex gap-4 p-3 rounded-lg bg-black/40 border border-white/[0.03]">
                                  <span className="text-white/20 whitespace-nowrap pt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                  <span className={cn('font-bold pt-0.5', log.status === 'success' ? 'text-emerald-400' : 'text-rose-400')}>
                                    [{log.status.toUpperCase()}]
                                  </span>
                                  <div className="flex-1 w-full overflow-hidden">
                                    <div className="text-white/80 break-words leading-relaxed whitespace-pre-wrap">
                                      <span className="text-blue-300 font-bold">Node {log.nodeId.substring(0, 8)}</span>: {log.message}
                                    </div>

                                    {log.data && (
                                      <div className="mt-3 overflow-x-auto rounded-lg bg-black p-3 border border-white/5 custom-scrollbar relative">
                                        <pre className="text-[10px] text-emerald-400/80 font-medium whitespace-pre break-normal">
                                          {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )) : (
                                <div className="text-white/20 italic p-2 flex items-center gap-2">
                                  <Activity className="w-4 h-4 animate-pulse" /> Listening for triggers...
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="glass-panel p-20 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <Terminal className="w-8 h-8 text-white/10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No active instances</h3>
              <p className="text-white/30 text-sm max-w-xs mx-auto">
                Ready to go live? Deploy one of your workflow blueprints to start processing real data.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-black/40 border border-white/10 rounded-2xl shadow-xl">
            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Total Successful Runs</h4>
            <div className="text-4xl font-bold text-white tabular-nums">
              {instances.filter(i => i.status === 'success').length}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px]">
              <span className="text-white/30 font-bold uppercase">Success Rate</span>
              <span className="text-green-400 font-bold">
                {instances.length > 0
                  ? Math.round((instances.filter(i => i.status === 'success').length / instances.length) * 100)
                  : 0}%
              </span>
            </div>
          </div>

          <div className="glass-panel p-6 bg-black/40 border border-white/10 rounded-2xl shadow-xl">
            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Live Activity Log</h4>
            <div className="space-y-3">
              {instances.slice(0, 3).flatMap(i => i.logs.slice(-1)).filter(Boolean).length > 0 ? (
                instances.slice(0, 3).flatMap(i => i.logs.slice(-1)).map((log, idx) => (
                  <div key={idx} className="flex gap-3 text-[11px] leading-relaxed">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <p className="text-white/50">
                      <span className="text-blue-400 font-bold">Node {log.nodeId.slice(0, 4)}</span> {log.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/20 italic">No activity yet...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deploy Modal */}
      <AnimatePresence>
        {showDeployModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg glass-panel relative p-8 bg-white/[0.02] shadow-[0_64px_128px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Subtle accent glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    Deploy Workflow
                  </h3>
                  <p className="text-white/40 text-sm font-medium mt-1">Select a blueprint to launch as a live automation instance.</p>
                </div>
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-white/20 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {!selectedWorkflow ? (
                  workflows.length > 0 ? workflows.map(wf => (
                    <button
                      key={wf.id}
                      onClick={() => handleSelectWorkflow(wf)}
                      disabled={isDeploying}
                      className="w-full text-left p-4 rounded-xl glass-panel bg-black/10 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                          {(() => {
                            if (wf.name) return wf.name;
                            try {
                              const parsed = JSON.parse(wf.prompt);
                              return parsed.objective || wf.workflow_type || 'Untitled Workflow';
                            } catch (e) { return wf.prompt || 'Untitled Workflow'; }
                          })()}
                        </div>
                        <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-2">
                          {wf.data.nodes.length} Nodes • Created {new Date(wf.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Play className="w-5 h-5 text-white/20 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                  )) : (
                    <div className="text-center py-10 text-white/20 font-medium">No saved workflows found.</div>
                  )
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Rocket className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Configuring {selectedWorkflow.name || 'Workflow'}</div>
                        <div className="text-[10px] text-blue-400/60 uppercase font-black tracking-tighter">Setup Required Parameters</div>
                      </div>
                    </div>

                    {requirements.map((req, idx) => (
                      <div key={idx} className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">
                          Input Parameter: {req.key}
                        </label>
                        <textarea
                          value={setupData[`${req.type}:${req.key}`] || ''}
                          onChange={(e) => setSetupData(prev => ({ ...prev, [`${req.type}:${req.key}`]: e.target.value }))}
                          placeholder={`Enter ${req.key}...`}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all min-h-[100px] resize-none"
                        />
                      </div>
                    ))}

                    {requirements.length === 0 && (
                      <div className="text-center py-6 text-white/40 text-sm italic">
                        No parameters required. Click deploy to start.
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setSelectedWorkflow(null)}
                        className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeploying ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-5 h-5 fill-current" />
                            Launch Instance
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ")
}
