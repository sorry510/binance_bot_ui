import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export interface AgentTaskEvent {
  task_id: string;
  conversation_id?: string;
  step_id?: string;
  step_type?: string;
  stage: string;
  progress: number;
  round?: number;
  message?: string;
  skill?: string;
  tool?: string;
  status?: string;
  error_type?: string;
  checkpoint?: boolean;
  duration_ms?: number;
  time: string;
}

export interface AgentContextTrimRecord {
  block_id: string;
  type: string;
  source: string;
  estimated_tokens: number;
  reason: string;
}

export interface AgentContextBuildTrace {
  budget_tokens: number;
  budget_bytes: number;
  system_tokens: number;
  selected_tokens: number;
  selected_bytes: number;
  input_blocks: number;
  selected_blocks: number;
  trimmed_blocks: number;
  selected_block_ids?: string[];
  trimmed?: AgentContextTrimRecord[];
  stale_evidence_ids?: string[];
  built_at: string;
}

export interface AgentStructuredEvidence {
  id: string;
  source_type: string;
  source: string;
  as_of?: string;
  observed_at: string;
  content_hash: string;
  freshness: "fresh" | "stale" | "missing" | "unknown";
  freshness_age_ms?: number;
  stale_reason?: string;
  key_fields?: Record<string, string>;
  data_missing?: string[];
}

export interface AgentToolTrace {
  canonical_name: string;
  source_type: "native" | "mcp" | string;
  risk: "read" | "write" | "trade" | string;
  idempotent: boolean;
  timeout_ms?: number;
  cache_ttl_ms?: number;
  arguments_hash?: string;
  call_index?: number;
  call_budget?: number;
  duration_ms: number;
  cache_hit: boolean;
  partial: boolean;
  error_type?: string;
  raw_size: number;
  content_hash?: string;
  as_of?: string;
  warnings?: string[];
  provider_ref?: string;
  protocol_version?: string;
  catalog_hash?: string;
  schema_hash?: string;
}

export interface AgentExecutionStep {
  step_id: string;
  type: string;
  status: string;
  attempt: number;
  depends_on?: string[];
  input_summary?: string;
  output_summary?: string;
  started_at?: string;
  completed_at?: string;
  error_type?: string;
  error?: string;
  checkpoint?: boolean;
  context_trace?: AgentContextBuildTrace;
  evidence?: AgentStructuredEvidence[];
  tool_trace?: AgentToolTrace;
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
  execution_mode?: string;
  plan?: Record<string, any>;
  steps?: AgentExecutionStep[];
  resume_count?: number;
  runtime_version?: string;
  skill_version?: string;
  prompt_version?: string;
  prompt_hash?: string;
  model_config_id?: number;
  input_contract_version?: string;
  output_contract_version?: string;
  skill_source?: string;
  skill_source_version?: string;
  tool_catalog_hash?: string;
  skill_package_hash?: string;
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

export const cancelAgentTask = (taskId: string) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/tasks/${encodeURIComponent(taskId)}/cancel`)
  );
};

export const resumeAgentTask = (taskId: string) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/tasks/${encodeURIComponent(taskId)}/resume`)
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
  task_success_rate: number;
  llm_error_rate: number;
  tool_error_rate: number;
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
  alert_pipeline: {
    signals_received: number;
    eligible_signals: number;
    ai_tasks_started: number;
    ai_fallbacks: number;
    notifications: number;
    signal_notify_rate: number;
    ai_fallback_rate: number;
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

export interface AgentMCPServer {
  id: number;
  name: string;
  endpoint: string;
  enabled: number;
  auth_type: "none" | "bearer" | "oauth2" | "custom_header" | string;
  custom_header?: string;
  allow_private: number;
  protocol_version?: string;
  server_name?: string;
  server_version?: string;
  status: string;
  last_success_at?: number;
  last_error_at?: number;
  last_error?: string;
  catalog_hash?: string;
  created_at: number;
  updated_at: number;
  has_secret: boolean;
}

export interface AgentMCPTool {
  id: number;
  server_id: number;
  remote_name: string;
  canonical_name: string;
  description?: string;
  input_schema?: string;
  output_schema?: string;
  schema_hash: string;
  catalog_hash: string;
  status: string;
  risk: "read" | "write" | "trade" | string;
  enabled: number;
  read_only_hint: boolean;
  idempotent_hint: boolean;
  idempotent: boolean;
  timeout_ms: number;
  cache_ttl_ms: number;
  max_result_bytes: number;
}
export interface AgentMCPResource {
  id: number;
  server_id: number;
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mime_type?: string;
  size?: number;
  last_modified?: string;
  catalog_hash: string;
}

export interface AgentMCPPrompt {
  id: number;
  server_id: number;
  remote_name: string;
  title?: string;
  description?: string;
  arguments_json?: string;
  catalog_hash: string;
}

export interface AgentMCPPermission {
  id: number;
  skill_name: string;
  server_id: number;
  capability_type: "tool" | "resource" | "prompt" | string;
  capability_id: number;
  enabled: number;
  auto_load: number;
}

export interface AgentMCPCatalog {
  server: AgentMCPServer;
  tools: AgentMCPTool[];
  resources: AgentMCPResource[];
  prompts: AgentMCPPrompt[];
  permissions: AgentMCPPermission[];
}
export const getAgentMCPServers = () => {
  return http.get<any, Query>(baseUrlApi("agents/mcp/servers"));
};

export const createAgentMCPServer = (data: Record<string, any>) => {
  return http.post<any, typeof data>(baseUrlApi("agents/mcp/servers"), {
    data
  });
};

export const updateAgentMCPServer = (id: number, data: Record<string, any>) => {
  return http.request<any>("put", baseUrlApi(`agents/mcp/servers/${id}`), {
    data
  });
};

export const deleteAgentMCPServer = (id: number) => {
  return http.request<any>("delete", baseUrlApi(`agents/mcp/servers/${id}`));
};

export const getAgentMCPCatalog = (id: number) => {
  return http.get<any, Query>(baseUrlApi(`agents/mcp/servers/${id}/catalog`));
};

export const testAgentMCPServer = (id: number) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/mcp/servers/${id}/test`),
    undefined,
    { timeout: 30000 }
  );
};

export const refreshAgentMCPCatalog = (id: number) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/mcp/servers/${id}/refresh`),
    undefined,
    { timeout: 90000 }
  );
};
export const updateAgentMCPTool = (id: number, data: Record<string, any>) => {
  return http.request<any>("put", baseUrlApi(`agents/mcp/tools/${id}`), {
    data
  });
};

export const saveAgentMCPPermission = (data: Record<string, any>) => {
  return http.post<any, typeof data>(baseUrlApi("agents/mcp/permissions"), {
    data
  });
};
