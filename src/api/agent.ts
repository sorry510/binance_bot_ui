import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export interface AgentTaskEvent {
  task_id: string;
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

export interface AgentTask {
  id: string;
  skill: string;
  status:
    | "queued"
    | "running"
    | "waiting_llm"
    | "waiting_tool"
    | "validating"
    | "succeeded"
    | "failed"
    | "cancelled";
  stage: string;
  progress: number;
  input: string;
  result?: TradingPlanV1;
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
