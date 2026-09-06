import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

const AGENT_API_TIMEOUT = 30000;

export interface AgentChatConversation {
  id: string;
  skill: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentChatConversationList {
  page: number;
  limit: number;
  total: number;
  list: AgentChatConversation[];
}

export interface AgentChatMessage {
  id: number;
  conversation_id: string;
  task_id?: string;
  skill?: string;
  sequence: number;
  role: string;
  content: string;
  created_at: number;
  task_status?: string;
  task_stage?: string;
  task_error?: string;
}

export interface AgentChatSkill {
  name: string;
  display_name: string;
  description: string;
  type: string;
  version: string;
}

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
  selected_memory_ids?: string[];
  trimmed_memory_ids?: string[];
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
  parent_task_id?: string;
  team_run_id?: string;
  team_name?: string;
  team_role?: string;
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
  final_model_config_id?: number;
  route_candidates?: Array<Record<string, any>>;
  route_reason?: string;
  route_fallback?: Array<Record<string, any>>;
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
  team_children?: AgentTask[];
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

export const getAgentChatConversations = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/chat/conversations"), { params });

export const createAgentChatConversation = () =>
  http.post<any, Query>(baseUrlApi("agents/chat/conversations"));

export const updateAgentChatConversation = (
  conversationId: string,
  title: string
) =>
  http.request<any>(
    "put",
    baseUrlApi(
      `agents/chat/conversations/${encodeURIComponent(conversationId)}`
    ),
    { data: { title } }
  );

export const deleteAgentChatConversation = (conversationId: string) =>
  http.request<any>(
    "delete",
    baseUrlApi(
      `agents/chat/conversations/${encodeURIComponent(conversationId)}`
    )
  );

export const getAgentChatMessages = (conversationId: string) =>
  http.get<any, Query>(
    baseUrlApi(
      `agents/chat/conversations/${encodeURIComponent(conversationId)}/messages`
    )
  );

export const sendAgentChatMessage = (
  conversationId: string,
  data: { skill: string; content: string; symbol?: string }
) =>
  http.post<any, typeof data>(
    baseUrlApi(
      `agents/chat/conversations/${encodeURIComponent(conversationId)}/messages`
    ),
    { data },
    { timeout: AGENT_API_TIMEOUT }
  );

export const getAgentChatSkills = () =>
  http.get<any, Query>(baseUrlApi("agents/chat/skills"));

export const startAgentTask = (data: {
  skill: string;
  input: Record<string, any>;
}) => {
  return http.post<any, typeof data>(
    baseUrlApi("agents/tasks"),
    { data },
    { timeout: AGENT_API_TIMEOUT }
  );
};

export const getAgentTask = (taskId: string) => {
  return http.get<any, Query>(
    baseUrlApi(`agents/tasks/${encodeURIComponent(taskId)}`),
    undefined,
    { timeout: AGENT_API_TIMEOUT }
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
  return http.get<any, Query>(
    baseUrlApi("agents/symbol-analysis/history"),
    { params },
    { timeout: AGENT_API_TIMEOUT }
  );
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
  return http.get<any, Query>(
    baseUrlApi("agents/tasks"),
    { params },
    { timeout: AGENT_API_TIMEOUT }
  );
};

export const getSchedulerStatus = () => {
  return http.get<any, Query>(
    baseUrlApi("agents/scheduler/status"),
    undefined,
    { timeout: AGENT_API_TIMEOUT }
  );
};

export const triggerSchedulerJob = (name: string) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/scheduler/jobs/${encodeURIComponent(name)}/trigger`)
  );
};

export interface AlertPipelineTraceNotification {
  id: number;
  title: string;
  content: string;
  module: string;
  level: string;
  event_type?: string;
  event_id?: string;
  signal_id?: string;
  task_id?: string;
  symbol?: string;
  create_time: number;
}

export interface AlertPipelineAuditItem {
  event_id: string;
  signal_id: string;
  task_id?: string;
  notification_id?: number;
  symbol: string;
  type: string;
  severity: string;
  action?: string;
  status: string;
  fallback: boolean;
  error?: string;
  created_at: number;
  updated_at: number;
  task_status?: string;
  task_stage?: string;
  task_error?: string;
  notification?: AlertPipelineTraceNotification;
}

export interface AlertPipelineAuditResult {
  page: number;
  limit: number;
  total: number;
  list: AlertPipelineAuditItem[];
}

export const getAlertPipelineTraces = (params: Query = {}) => {
  return http.get<any, Query>(
    baseUrlApi("agents/alerts/traces"),
    { params },
    { timeout: AGENT_API_TIMEOUT }
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
    controlled_execution_enabled?: boolean;
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
  return http.get<any, Query>(
    baseUrlApi("agents/governance/status"),
    undefined,
    { timeout: AGENT_API_TIMEOUT }
  );
};

export interface AgentSkillConfig {
  id: number;
  name: string;
  display_name: string;
  description: string;
  type: "native" | "team" | "portable" | string;
  active_version_id: number;
  enabled: number;
  chat_enabled: number;
  created_at: number;
  updated_at: number;
}

export interface AgentSkillImplementation {
  name: string;
  display_name: string;
  description: string;
  type: "native" | "team" | string;
  chat_default: number;
}

export interface AgentSkillListResult {
  page: number;
  limit: number;
  total: number;
  list: AgentSkillConfig[];
}

export const getAgentSkills = (params: Query = {}) => {
  const hasParams = Object.keys(params).length > 0;
  return http.get<any, Query>(
    baseUrlApi("agents/skills"),
    hasParams ? { params } : undefined
  );
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

export interface AgentSkillVersion {
  id: number;
  skill_id: number;
  name: string;
  package_hash: string;
  version?: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata_json?: string;
  requested_tools_json?: string;
  validation_status: string;
  validation_json?: string;
  source: string;
  source_ref?: string;
  package_path: string;
  file_count: number;
  total_bytes: number;
  created_at: number;
}

export interface AgentSkillPermission {
  id: number;
  skill_id: number;
  version_id: number;
  requested_name: string;
  resolved_name?: string;
  risk?: string;
  status: string;
  granted: number;
  reason?: string;
}

export interface AgentSkillVersionDetail {
  version: AgentSkillVersion;
  permissions: AgentSkillPermission[];
  files: string[];
}

export const importAgentSkillFile = (file: File, activate = false) => {
  const data = new FormData();
  data.append("file", file);
  data.append("activate", activate ? "1" : "0");
  return http.request<any>("post", baseUrlApi("agents/skills/import"), {
    data,
    timeout: 120000
  } as any);
};

export const importAgentSkillDirectory = (path: string, activate = false) => {
  return http.post<any, { path: string; activate: boolean }>(
    baseUrlApi("agents/skills/import-directory"),
    { data: { path, activate } },
    { timeout: 120000 }
  );
};

export const getAgentSkillVersions = (skillId: number) =>
  http.get<any, Query>(baseUrlApi(`agents/skills/${skillId}/versions`));

export const getAgentSkillVersionDetail = (versionId: number) =>
  http.get<any, Query>(baseUrlApi(`agents/skills/versions/${versionId}`));

export const getAgentSkillVersionFile = (versionId: number, path: string) =>
  http.get<any, Query>(baseUrlApi(`agents/skills/versions/${versionId}/file`), {
    params: { path }
  });

export const activateAgentSkillVersion = (versionId: number) =>
  http.post<any, Query>(
    baseUrlApi(`agents/skills/versions/${versionId}/activate`)
  );

export const updateAgentSkillPermission = (id: number, granted: number) =>
  http.request<any>("put", baseUrlApi(`agents/skills/permissions/${id}`), {
    data: { granted }
  });

export interface AgentMCPServer {
  id: number;
  name: string;
  description?: string;
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
  oauth_status?: string;
  oauth_issuer?: string;
  oauth_expires_at?: number;
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
    { timeout: 45000 }
  );
};

export const refreshAgentMCPCatalog = (id: number) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/mcp/servers/${id}/refresh`),
    undefined,
    { timeout: 120000 }
  );
};

export interface AgentMCPOAuthStartResult {
  authorization_url: string;
  callback_url: string;
  client_metadata_url: string;
  expires_at: number;
}

export const startAgentMCPOAuth = (id: number) => {
  return http.post<any, Query>(
    baseUrlApi(`agents/mcp/servers/${id}/oauth/start`),
    undefined,
    { timeout: 45000 }
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

export interface AgentMemoryScope {
  user?: string;
  skill?: string;
  symbol?: string;
  strategy?: string;
}

export interface AgentMemory {
  id: number;
  type:
    | "user_preference"
    | "strategy_fact"
    | "market_hypothesis"
    | "task_summary"
    | "lesson"
    | string;
  scope: AgentMemoryScope;
  source_task_id?: string;
  confidence: number;
  status: "candidate" | "active" | "disabled" | "expired" | string;
  content: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface AgentMemoryListResult {
  page: number;
  limit: number;
  total: number;
  list: AgentMemory[];
}

export interface AgentMemoryInput {
  type: string;
  scope: AgentMemoryScope;
  confidence: number;
  content: string;
  expires_at?: number;
  candidate?: boolean;
}

export const getAgentMemories = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/memories"), { params });

export const createAgentMemory = (data: AgentMemoryInput) =>
  http.post<any, AgentMemoryInput>(baseUrlApi("agents/memories"), { data });

export const updateAgentMemory = (
  id: number,
  data: Omit<AgentMemoryInput, "type" | "candidate">
) => http.request<any>("put", baseUrlApi(`agents/memories/${id}`), { data });

export const deleteAgentMemory = (id: number) =>
  http.request<any>("delete", baseUrlApi(`agents/memories/${id}`));

export const disableAgentMemory = (id: number) =>
  http.post<any, Query>(baseUrlApi(`agents/memories/${id}/disable`));

export const enableAgentMemory = (id: number) =>
  http.post<any, Query>(baseUrlApi(`agents/memories/${id}/enable`));

export const approveAgentMemory = (id: number) =>
  http.post<any, Query>(baseUrlApi(`agents/memories/${id}/approve`));

export interface AgentObservabilityTaskAggregate {
  tasks: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  success_rate: number;
  total_tokens: number;
  average_tokens: number;
  average_duration_ms: number;
  p95_duration_ms: number;
  average_rounds: number;
}

export interface AgentObservabilityDimension
  extends AgentObservabilityTaskAggregate {
  key: string;
  label: string;
}

export interface AgentObservabilitySummary {
  start_time: number;
  end_time: number;
  global: AgentObservabilityTaskAggregate;
  by_skill: AgentObservabilityDimension[];
  by_model: AgentObservabilityDimension[];
  by_prompt: AgentObservabilityDimension[];
  by_skill_revision: AgentObservabilityDimension[];
  context: {
    builds: number;
    average_tokens: number;
    trim_rate: number;
    memory_hit_rate: number;
    selected_memories: number;
    trimmed_memories: number;
  };
  tools: Array<{
    tool: string;
    source: string;
    calls: number;
    errors: number;
    error_rate: number;
    cache_hit_rate: number;
    partial_rate: number;
    timeouts: number;
    average_latency_ms: number;
    p95_latency_ms: number;
  }>;
  mcp_servers: Array<{
    id: number;
    name: string;
    status: string;
    protocol_version?: string;
    catalog_hash?: string;
    last_success_at?: number;
    last_error_at?: number;
    calls: number;
    errors: number;
    availability: number;
    p95_latency_ms: number;
  }>;
  repairs: Array<{ name: string; count: number }>;
  errors: Array<{ name: string; count: number }>;
  evidence: {
    validations: number;
    with_evidence: number;
    coverage_rate: number;
    average_evidence: number;
  };
  eval: {
    runs: number;
    passed: number;
    pass_rate: number;
    average_score: number;
  };
  change_events: number;
}

export interface AgentObservationTrace {
  id: number;
  task_id: string;
  conversation_id?: string;
  parent_task_id?: string;
  team_run_id?: string;
  team_name?: string;
  team_role?: string;
  type: string;
  step_id?: string;
  step_type?: string;
  skill: string;
  provider?: string;
  model?: string;
  tool?: string;
  tool_source?: string;
  provider_ref?: string;
  protocol_version?: string;
  catalog_hash?: string;
  schema_hash?: string;
  status?: string;
  error_type?: string;
  error?: string;
  round?: number;
  duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cache_hit?: boolean;
  partial?: boolean;
  context_tokens?: number;
  context_blocks?: number;
  trimmed_blocks?: number;
  memory_selected?: number;
  memory_trimmed?: number;
  evidence_count?: number;
  eval_case?: string;
  eval_score?: number;
  created_at: number;
}

export interface AgentChangeEvent {
  id: number;
  category: string;
  entity_type: string;
  entity_id?: number;
  entity_name: string;
  change_type: string;
  from_version?: string;
  to_version?: string;
  before_hash?: string;
  after_hash?: string;
  status: string;
  detail_json?: string;
  created_at: number;
}

export const getAgentObservabilitySummary = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/observability/summary"), { params });

export const getAgentObservabilityTraces = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/observability/traces"), { params });

export const getAgentObservabilityChanges = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/observability/changes"), { params });

export type AgentWorkflowName =
  | "market_scan"
  | "strategy_review"
  | "strategy_experiment"
  | "alert_triage"
  | "daily_market_brief";

export interface AgentWorkflowRun {
  id: string;
  workflow: AgentWorkflowName | string;
  schema_version: string;
  status: "queued" | "running" | "succeeded" | "failed" | string;
  stage: string;
  input?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  child_task_ids: string[];
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface AgentWorkflowListResult {
  page: number;
  limit: number;
  total: number;
  list: AgentWorkflowRun[];
}

export const startAgentWorkflow = (data: {
  workflow: AgentWorkflowName;
  input?: Record<string, any>;
}) =>
  http.post<any, typeof data>(
    baseUrlApi("agents/workflows"),
    { data },
    { timeout: AGENT_API_TIMEOUT }
  );

export const getAgentWorkflow = (id: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/workflows/${encodeURIComponent(id)}`)
  );

export const getAgentWorkflows = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/workflows"), { params });

export interface AgentTradeRiskCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface AgentTradeRiskResult {
  status: "pass" | "fail" | string;
  checks: AgentTradeRiskCheck[];
  reference_price: number;
  estimated_fill_price: number;
  slippage_bps: number;
  quantity: number;
  leverage: number;
  notional_usdt: number;
  risk_usdt: number;
  current_exposure_usdt: number;
  checked_at: number;
}

export interface AgentTradeProposal {
  id: number;
  proposal_id: string;
  source_task_id: string;
  source_skill: string;
  content_hash: string;
  symbol: string;
  side: string;
  entry_condition: string;
  entry_zones_json: string;
  stop_loss: number;
  take_profits_json: string;
  invalidations_json: string;
  evidence_json: string;
  market_condition: number;
  status: string;
  risk_status: string;
  risk_json?: string;
  risk_checked_at: number;
  quantity: number;
  reference_price: number;
  leverage: number;
  notional_usdt: number;
  risk_usdt: number;
  approved_by?: string;
  rejected_reason?: string;
  created_at: number;
  updated_at: number;
  expires_at: number;
  approved_at: number;
  rejected_at: number;
  executed_at: number;
}

export interface AgentTradeExecution {
  id: number;
  proposal_id: string;
  idempotency_key: string;
  client_order_id: string;
  exchange_order_id?: string;
  status: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  reference_price: number;
  average_price: number;
  leverage: number;
  error?: string;
  created_at: number;
  updated_at: number;
  submitted_at: number;
  completed_at: number;
}

export interface AgentTradeAudit {
  id: number;
  proposal_id: string;
  event: string;
  status: string;
  actor?: string;
  detail_json?: string;
  created_at: number;
}

export interface AgentTradeProposalListResult {
  page: number;
  limit: number;
  total: number;
  list: AgentTradeProposal[];
}

export interface AgentTradeProposalDetail {
  proposal: AgentTradeProposal;
  execution?: AgentTradeExecution;
  audits: AgentTradeAudit[];
}
export const getAgentTradeProposals = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/trade/proposals"), { params });

export const createAgentTradeProposal = (taskId: string) =>
  http.post<any, { task_id: string }>(baseUrlApi("agents/trade/proposals"), {
    data: { task_id: taskId }
  });

export const getAgentTradeProposal = (proposalId: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/trade/proposals/${encodeURIComponent(proposalId)}`)
  );

export const checkAgentTradeRisk = (proposalId: string) =>
  http.post<any, Query>(
    baseUrlApi(`agents/trade/proposals/${encodeURIComponent(proposalId)}/risk`)
  );

export const approveAgentTradeProposal = (proposalId: string) =>
  http.post<any, Query>(
    baseUrlApi(
      `agents/trade/proposals/${encodeURIComponent(proposalId)}/approve`
    )
  );

export const rejectAgentTradeProposal = (proposalId: string, reason: string) =>
  http.post<any, { reason: string }>(
    baseUrlApi(
      `agents/trade/proposals/${encodeURIComponent(proposalId)}/reject`
    ),
    { data: { reason } }
  );
export const executeAgentTradeProposal = (proposalId: string) =>
  http.post<any, Query>(
    baseUrlApi(
      `agents/trade/proposals/${encodeURIComponent(proposalId)}/execute`
    ),
    undefined,
    { timeout: AGENT_API_TIMEOUT }
  );

export const reconcileAgentTradeProposal = (proposalId: string) =>
  http.post<any, Query>(
    baseUrlApi(
      `agents/trade/proposals/${encodeURIComponent(proposalId)}/reconcile`
    ),
    undefined,
    { timeout: AGENT_API_TIMEOUT }
  );
