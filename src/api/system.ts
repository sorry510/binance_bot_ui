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
