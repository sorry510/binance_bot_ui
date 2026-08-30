import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

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

export const getServiceConfig = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("service/config"), { params });
};

export const editData = (data: Query) => {
  return http.request<any>("put", baseUrlApi("service/config"), { data });
};

export const testPusher = (params: Query = {}) => {
  return http.post<any, Query>(baseUrlApi("test-pusher"), { params });
};

export const updateMarketCondition = (params: Query = {}) => {
  return http.post<any, Query>(baseUrlApi("update-market-condition"), {
    params
  });
};

export const getMarketConditionUpdateTask = (taskId: string) => {
  return http.get<any, Query>(
    baseUrlApi(`update-market-condition/${encodeURIComponent(taskId)}`)
  );
};

export const getLog = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("pm2-log?key=sorry510"), { params });
};

export const getAlertPipelineStatus = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("agents/alerts/status"), { params });
};
