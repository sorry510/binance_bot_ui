import { http, baseUrlApi } from "@/utils/http";

export type HealthStatus =
  | "healthy"
  | "warning"
  | "error"
  | "disabled"
  | "unknown";

export interface SystemHealthCheck {
  status: HealthStatus;
  message?: string;
  last_success_at?: number;
  last_error_at?: number;
  last_error?: string;
  count?: number;
}

export interface DatabaseHealthCheck extends SystemHealthCheck {
  version: number;
  required_version: number;
}

export interface MarketSourceHealth {
  source: string;
  status: string;
  last_success_at?: number;
  last_error_at?: number;
  last_error?: string;
}

export interface MCPServerHealth {
  name: string;
  status: string;
  last_success_at?: number;
  last_error_at?: number;
  last_error?: string;
}

export interface SchedulerJobHealth {
  name: string;
  skill: string;
  enabled: boolean;
  running: boolean;
  interval_seconds: number;
  last_status?: string;
  last_error?: string;
  last_run_at?: number;
  next_run_at?: number;
  run_count?: number;
  skip_count?: number;
}

export interface AgentHealthCheck extends SystemHealthCheck {
  tasks_24h: number;
  failed_24h: number;
  max_rounds_failed_24h: number;
}

export interface TradeHealthCheck extends SystemHealthCheck {
  execution_uncertain: number;
  protection_failed: number;
  reconcile_required: number;
}

export interface SystemHealthReport {
  generated_at: number;
  overall: HealthStatus;
  database: DatabaseHealthCheck;
  binance_rest: SystemHealthCheck;
  futures_ws: SystemHealthCheck;
  announcement_ws: SystemHealthCheck;
  market_intelligence: SystemHealthCheck;
  market_sources: MarketSourceHealth[];
  mcp: SystemHealthCheck;
  mcp_servers: MCPServerHealth[];
  llm: SystemHealthCheck;
  scheduler: SystemHealthCheck;
  scheduler_jobs: SchedulerJobHealth[];
  agent: AgentHealthCheck;
  trade: TradeHealthCheck;
}

export const getSystemHealth = () =>
  http.get<any, Record<string, never>>(baseUrlApi("system/health"));

export interface BinanceAPIWindowSummary {
  window_seconds: number;
  request_count: number;
  estimated_weight: number;
  error_count: number;
  count_429: number;
  count_418: number;
  average_latency_ms: number;
  p95_latency_ms: number;
}

export interface BinanceAPIExchangeLimit {
  product: string;
  environment: string;
  used_weight_1m: number;
  order_count_10s: number;
  order_count_1m: number;
  weight_limit_1m: number;
  weight_percent_1m: number;
  limit_source: string;
  retry_after?: string;
  last_status_code: number;
  last_response_at: number;
  last_rate_limited_at?: number;
}

export interface BinanceAPIEndpointStat {
  product: string;
  environment: string;
  source: string;
  request_type: "read" | "trade" | string;
  method: string;
  path: string;
  count: number;
  estimated_weight: number;
  error_count: number;
  count_429: number;
  count_418: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  last_error?: string;
  last_error_at?: number;
}

export interface BinanceAPISourceStat {
  source: string;
  count: number;
  estimated_weight: number;
  count_429: number;
  count_418: number;
}

export interface BinanceAPIRateLimitEvent {
  at: number;
  product: string;
  environment: string;
  source: string;
  request_type: "read" | "trade" | string;
  method: string;
  path: string;
  status_code: number;
  retry_after?: string;
}

export interface BinanceAPIUsageSnapshot {
  generated_at: number;
  window_10s: BinanceAPIWindowSummary;
  window_1m: BinanceAPIWindowSummary;
  window_5m: BinanceAPIWindowSummary;
  exchange_limits: BinanceAPIExchangeLimit[];
  top_endpoints_by_count: BinanceAPIEndpointStat[];
  top_endpoints_by_weight: BinanceAPIEndpointStat[];
  sources_5m: BinanceAPISourceStat[];
  recent_rate_limits: BinanceAPIRateLimitEvent[];
  retained_events: number;
  dropped_events: number;
  last_dropped_at?: number;
  truncated: boolean;
}

export const getBinanceAPIUsage = () =>
  http.get<any, Record<string, never>>(baseUrlApi("system/binance-api-usage"));
