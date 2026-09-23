import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

const AI_API_TIMEOUT = 30000;

export interface MarketConditionResult {
  marketCondition: number;
  name: string;
  source: string;
  confidence?: number;
  reason?: string;
}

export interface MarketConditionUpdateTask {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  stage: string;
  result?: MarketConditionResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AlertPipelineTrace {
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
}

export interface AlertPipelineStatus {
  event_bus: Record<string, number>;
  signal_engine: Record<string, number>;
  pipeline: Record<string, number>;
  traces: AlertPipelineTrace[];
}

export interface SmartLocalV2Candidate {
  rank: number;
  symbol: string;
  score: number;
  grade: string;
  price: number;
  percent_change_24h: number;
  quote_volume_24h: number;
  trade_count_24h: number;
  local_momentum_pct: number;
  reasons: string[];
  risks: string[];
  missing: string[];
  last_update_time: number;
}

export interface SmartLocalV2Exclusion {
  symbol: string;
  reason: string;
}

export interface SmartLocalV2RotationState {
  pool_size: number;
  batch_size: number;
  sequence: number;
  batch_symbols: string[];
  batch_ranks: number[];
}

export interface SmartLocalV2Result {
  selector: string;
  generated_at: number;
  source: string;
  candidates: SmartLocalV2Candidate[];
  next_batch: SmartLocalV2Candidate[];
  rotation: SmartLocalV2RotationState;
  excluded: SmartLocalV2Exclusion[];
  data_missing: string[];
  meta: Record<string, any>;
}

export const getServiceConfig = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("service/config"), { params });
};

export const editData = (data: Query) => {
  return http.request<any>("put", baseUrlApi("service/config"), { data });
};

export const getSmartLocalV2Preview = (
  limit = 60,
  mode: "trade" | "test" = "trade"
) => {
  return http.get<any, Query>(baseUrlApi("futures/selectors/smart-local-v2"), {
    params: { limit, mode }
  });
};

export const testPusher = (params: Query = {}) => {
  return http.post<any, Query>(baseUrlApi("test-pusher"), { params });
};

export const updateMarketCondition = (params: Query = {}) => {
  return http.post<any, Query>(
    baseUrlApi("update-market-condition"),
    { params },
    { timeout: AI_API_TIMEOUT }
  );
};

export const getMarketConditionUpdateTask = (taskId: string) => {
  return http.get<any, Query>(
    baseUrlApi(`update-market-condition/${encodeURIComponent(taskId)}`),
    undefined,
    { timeout: AI_API_TIMEOUT }
  );
};

export const getLog = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("pm2-log?key=sorry510"), { params });
};

export const getAlertPipelineStatus = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("agents/alerts/status"), { params });
};
