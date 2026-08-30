import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export interface AgentTaskEvent {
  task_id: string;
  conversation_id?: string;
  stage: string;
  progress: number;
  round?: number;
  message?: string;
  skill?: string;
  tool?: string;
  status?: string;
  duration_ms?: number;
  time: string;
}

export interface TradingPlanPriceZone {
  low: number;
  high: number;
}

export interface TradingPlanEvidence {
  source: string;
  finding: string;
}
export interface TradingPlanV1 {
  version: "trading_plan_v1";
  symbol: string;
  as_of: string;
  market_condition: number | null;
  direction: "long" | "short" | "neutral";
  confidence: number;
  summary: string;
  entry_zones: TradingPlanPriceZone[];
  stop_loss: number | null;
  take_profits: number[];
  long_trigger: string;
  short_trigger: string;
  invalidation_conditions: string[];
  risks: string[];
  data_missing: string[];
  evidence: TradingPlanEvidence[];
}

export interface AgentTask<T = any> {
  id: string;
  skill: string;
  conversation_id?: string;
  status:
    | "queued"
    | "running"
    | "waiting_llm"
    | "waiting_tool"
    | "validating"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "interrupted";
  stage: string;
  progress: number;
  input: string;
  result?: T;
  error?: string;
  round: number;
  max_rounds: number;
  provider?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  created_at: string;
  started_at?: string;
  updated_at: string;
  completed_at?: string;
  events: AgentTaskEvent[];
}

export interface SymbolAnalysisHistoryItem {
  id: number;
  task_id: string;
  symbol: string;
  prompt: string;
  status: string;
  direction: string;
  confidence: number;
  market_condition: number;
  analysis_price: number;
  summary: string;
  error: string;
  provider: string;
  model: string;
  created_at: number;
  completed_at: number;
  result?: TradingPlanV1;
  current_price?: number;
  price_change_pct?: number;
}

export interface SymbolAnalysisHistoryResult {
  page: number;
  limit: number;
  total: number;
  list: SymbolAnalysisHistoryItem[];
}

export const startAgentTask = (data: {
  skill: string;
  input: Record<string, any>;
}) => {
  return http.post<any, typeof data>(baseUrlApi("agents/tasks"), { data });
};

export const getAgentTask = (taskId: string) => {
  return http.get<any, Query>(
    baseUrlApi(`agents/tasks/${encodeURIComponent(taskId)}`)
  );
};

export const getSymbolAnalysisHistory = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("agents/symbol-analysis/history"), {
    params
  });
};

export interface AgentTaskListResult {
  page: number;
  limit: number;
  total: number;
  list: AgentTask[];
}

export interface SchedulerJobStatus {
  name: string;
  skill: string;
  enabled: boolean;
  interval_seconds: number;
  concurrency_policy: string;
  running: boolean;
  last_task_id?: string;
  last_status?: string;
  last_error?: string;
  run_count: number;
  skip_count: number;
  last_run_at?: number;
  next_run_at?: number;
}

export const getAgentTasks = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("agents/tasks"), { params });
};

export const getSchedulerStatus = () => {
  return http.get<any, Query>(baseUrlApi("agents/scheduler/status"));
};

export const triggerSchedulerJob = (name: string) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/scheduler/jobs/${encodeURIComponent(name)}/trigger`)
  );
};

export interface AgentRuntimeMetrics {
  tasks_started: number;
  tasks_succeeded: number;
  tasks_failed: number;
  tasks_cancelled: number;
  active_tasks: number;
  llm_calls: number;
  llm_errors: number;
  tool_calls: number;
  tool_errors: number;
  validation_errors: number;
  repairs: number;
  total_tokens: number;
  average_rounds: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
}

export interface AgentGovernanceStatus {
  governance: {
    skills: Record<string, boolean>;
    admission: {
      limits: { per_minute: number; per_hour: number };
      recent_minute: number;
      recent_hour: number;
      accepted: number;
      rejected: number;
    };
    default_budget: { max_tool_calls: number; max_total_tokens: number };
    trade_enabled: boolean;
  };
  metrics: {
    global: AgentRuntimeMetrics;
    skills: Record<string, AgentRuntimeMetrics>;
  };
}

export const getAgentGovernanceStatus = () => {
  return http.get<any, Query>(baseUrlApi("agents/governance/status"));
};

export interface AgentSkillConfig {
  id: number;
  name: string;
  display_name: string;
  description: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface AgentSkillImplementation {
  name: string;
  display_name: string;
  description: string;
}
export const getAgentSkills = () => {
  return http.get<any, Query>(baseUrlApi("agents/skills"));
};

export const getAgentSkillImplementations = () => {
  return http.get<any, Query>(baseUrlApi("agents/skills/implementations"));
};

export const createAgentSkill = (data: Record<string, any>) => {
  return http.post<any, typeof data>(baseUrlApi("agents/skills"), { data });
};

export const updateAgentSkill = (id: number, data: Record<string, any>) => {
  return http.request<any>("put", baseUrlApi(`agents/skills/${id}`), { data });
};

export const deleteAgentSkill = (id: number) => {
  return http.request<any>("delete", baseUrlApi(`agents/skills/${id}`));
};
