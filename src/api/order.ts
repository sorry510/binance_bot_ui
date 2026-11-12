import { http, baseUrlApi } from "@/utils/http";

// The backend always emits JSON {code,data,msg}; response type is the first
// PureHttp.get<T,P> generic. P describes AxiosRequestConfig.data, NOT params.
export interface OrderHistoryApiResult<T> {
  code: number;
  data: T;
  msg: string;
}

export interface ManagedFill {
  market: string;
  account_id: string;
  symbol: string;
  order_id: string;
  trade_id: string;
  position_id?: number;
  client_order_id?: string;
  intent?: string;
  position_side?: string;
  qty: string;
  price: string;
  commission: string;
  commission_asset: string;
  realized_pnl: string;
  pnl_asset: string;
  trade_time: number;
  rest_verified: boolean;
}

export interface ManagedCycle {
  position_id: number;
  account_id: "main" | "lead";
  owner: string;
  symbol: string;
  position_side: "LONG" | "SHORT";
  status: string;
  system_status: string;
  system_completeness: string;
  system_incomplete_reason?: string;
  status_manually_set: boolean;
  completeness_manually_set: boolean;
  history_modified_at: number;
  settlement_status: string;
  completeness: "verified" | "pending" | "incomplete" | "manual_reviewed";
  incomplete_reason?: string;
  open_qty: string;
  close_qty: string;
  remaining_qty: string;
  open_avg_price: string | null;
  close_avg_price: string | null;
  gross_pnl: string | null;
  net_pnl: string | null;
  return_pct: string | null;
  pnl_asset?: string;
  fees: Array<{ asset: string; amount: string }>;
  leverage: number | null;
  created_at: number;
  updated_at: number;
  closed_at: number;
  duration_millis: number;
  order_count: number;
  fill_count: number;
  rest_verified_fills: number;
  current_price: string | null;
  price_updated_at: number;
  realized_pnl: string | null;
  unrealized_pnl: string | null;
  total_pnl: string | null;
  display_return_pct: string | null;
  display_pnl_asset?: string;
}

export interface ManagedChildOrder {
  managed: {
    id: number;
    position_id?: number;
    account_id: string;
    owner: string;
    symbol: string;
    position_side: string;
    client_order_id: string;
    exchange_order_id: string;
    actual_order_id?: string;
    requested_qty: number;
    filled_qty: number;
    intent: string;
    order_type: string;
    status: string;
    created_at: number;
    updated_at: number;
  };
  filled_qty_from_fills: string;
  avg_price: string | null;
  completeness: string;
  fills: ManagedFill[];
  fees: Array<{ asset: string; amount: string }>;
  gross_pnl: string | null;
  pnl_asset?: string;
}

export interface ManagedOrderPage {
  total: number;
  page: number;
  limit: number;
  list: ManagedCycle[];
  page_verified_net: Record<string, string>;
  filtered_pnl: Record<
    string,
    { realized: string; unrealized: string; total: string }
  >;
  pnl_unpriced_count: number;
}

export interface ManagedCycleDetail {
  position: ManagedCycle;
  orders: ManagedChildOrder[];
}

export interface ManagedHistoryFilters {
  account_id?: string;
  owner?: string;
  symbol?: string;
  position_side?: string;
  status?: string;
  settlement?: string;
  start_time?: number;
  end_time?: number;
  page: number;
  limit: number;
}

// Real history starts with v23 Managed cycles. Legacy order deletion remains
// disabled; neither endpoint can create or edit a live exchange position.
export const getManagedOrderCycles = (params: ManagedHistoryFilters) =>
  http.get<OrderHistoryApiResult<ManagedOrderPage>, unknown>(
    baseUrlApi("orders"),
    { params }
  );

export const getManagedCycleDetails = (id: number, accountId = "main") =>
  http.get<OrderHistoryApiResult<ManagedCycleDetail>, unknown>(
    baseUrlApi(`orders/${id}/details`),
    { params: { account_id: accountId } }
  );

// Manual status/integrity edits are presentation-only. Actual deletion is
// a separate terminal-cycle transaction, never an exchange cancel order.
export interface HistoryBulkRequest {
  filters: ManagedHistoryFilters;
  action: "update";
  status_override?: string;
  completeness_override?: string;
  clear_status?: boolean;
  clear_completeness?: boolean;
  expected_digest?: string;
  reason?: string;
}
export interface HistoryBulkPreview {
  count: number;
  active_count: number;
  digest: string;
  limit: number;
}
export interface HistoryBulkResult {
  updated: number;
  audit_rows: number;
}
export const previewHistoryBulk = (data: HistoryBulkRequest) =>
  http.post<OrderHistoryApiResult<HistoryBulkPreview>, HistoryBulkRequest>(
    baseUrlApi("orders/batch/preview"),
    { data }
  );

export const applyHistoryBulk = (data: HistoryBulkRequest) =>
  http.post<OrderHistoryApiResult<HistoryBulkResult>, HistoryBulkRequest>(
    baseUrlApi("orders/batch/apply"),
    { data }
  );

export interface PhysicalDeleteRequest {
  filters: ManagedHistoryFilters;
  expected_count: number;
}
export interface PhysicalDeleteResult {
  positions: number;
  orders: number;
  fills: number;
}
export const deleteManagedHistory = (data: PhysicalDeleteRequest) =>
  http.post<OrderHistoryApiResult<PhysicalDeleteResult>, PhysicalDeleteRequest>(
    baseUrlApi("orders/batch/delete"),
    { data }
  );
