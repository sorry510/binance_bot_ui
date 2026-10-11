import { http, baseUrlApi } from "@/utils/http";

export interface LeadLimits {
  max_order_notional_usdt: number;
  max_total_notional_usdt: number;
  max_daily_realized_loss_usdt: number;
  max_drawdown_pct: number;
  max_positions: number;
  max_losing_positions: number;
}
export interface LeadSettings {
  account_id: "lead";
  enabled: false;
  allow_new_opens: false;
  limits: LeadLimits;
  updated_at?: string;
}
export interface LeadVerification {
  account_id: string;
  key_hint?: string;
  portfolio_label?: string;
  lead_identity_ok?: boolean;
  usdt_whitelist_count?: number;
  portfolio_binding_confirmed?: boolean;
  read_only_checks_passed?: boolean;
  trading_ready?: boolean;
  checked_at?: string;
  blocking_reasons?: string[];
}
export interface LeadStatus {
  account_id: "lead";
  enabled: boolean;
  allow_new_opens: boolean;
  readiness: string;
  ws_healthy: boolean;
  runtime_connected: boolean;
  blocking_reasons: string[];
  verification?: LeadVerification;
}
export interface LeadManagedPosition {
  account_id: string;
  symbol: string;
  position_side: string;
  owner: string;
  managed_qty: number;
  entry_price: number;
  status: string;
  last_reconciled_at: number;
}
export interface LeadManagedOrder {
  account_id: string;
  client_order_id: string;
  symbol: string;
  position_side: string;
  intent: string;
  status: string;
  requested_qty: number;
  filled_qty: number;
  created_at: number;
}
export interface LeadAuditEvent {
  account_id: string;
  action: string;
  reason: string;
  occurred_at: string;
}
const path = (p: string) => baseUrlApi(`futures/lead/${p}`);
export const leadStatus = () => http.get<any, any>(path("status"));
export const leadConfig = () => http.get<any, any>(path("config"));
export const leadMetrics = () => http.get<any, any>(path("metrics"));
export const leadSymbols = () => http.get<any, any>(path("symbols"));
export const leadPositions = (
  params: { limit?: number; owner?: string } = {}
) => http.get<any, any>(path("positions"), { params });
export const leadOrders = (params: { limit?: number; owner?: string } = {}) =>
  http.get<any, any>(path("orders"), { params });
export const leadEvents = (params: { limit?: number } = {}) =>
  http.get<any, any>(path("events"), { params });
export const leadSaveCredentials = (data: {
  api_key: string;
  api_secret: string;
  portfolio_label: string;
}) => http.request<any>("put", path("credentials"), { data });
export const leadVerify = () =>
  http.request<any>("post", path("verify"), { data: {} });
export const leadSaveConfig = (data: LeadSettings) =>
  http.request<any>("put", path("config"), { data });
export const leadPause = () =>
  http.request<any>("post", path("pause"), { data: {} });
export const leadStart = () =>
  http.request<any>("post", path("start"), { data: {} });
export const leadReconcile = () =>
  http.request<any>("post", path("reconcile"), { data: {} });
export const leadDeleteCredentials = () =>
  http.request<any>("delete", path("credentials"));
