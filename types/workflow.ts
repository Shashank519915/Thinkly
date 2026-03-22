export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "error" | "monitor";
  label: string;
  description: string;
  stage?: string;
  tool?: string;
  apiEndpoint?: string;
  nextNodes?: string[];
  falseNextNodes?: string[];
  errorNodes?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: "default" | "condition" | "error";
  label?: string;
}

export interface SystemArchitecture {
  state_management: string;
  idempotency_strategy: string;
  scaling_mechanisms: string;
  ai_injectors: string[];
  fault_tolerance: string;
}

export interface WorkflowResponse {
  workflow_type?: string;
  patterns_detected?: string[];
  workflow: {
    input: string;
    process: string;
    output: string;
  };
  architecture: SystemArchitecture;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  tools: string[];
  logic: string;
  impact: {
    time_saved: string;
    automation: string;
    confidence: string;
    current_cost_estimate: string;
    automated_cost_estimate: string;
  };
}
