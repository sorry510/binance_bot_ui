import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;
const api = (path: string) => baseUrlApi(`coin-m/${path}`);

// CM-7: COIN-M symbol/template settings, local ledger, wallet and runtime
// observations. Signed live trading is managed by the Go runner only;
// no user-facing order/cancel/position mutation route is exposed.
export const getFeatures = (params: Query = {}) =>
  http.get<any, Query>(api("symbols"), { params });
export const getFeature = (id: number | string) =>
  http.get<any, Query>(api(`symbols/${id}`));
export const setFeature = (id: number | string, data: Query) =>
  http.request<any>("put", api(`symbols/${id}`), { data });
export const enableFeature = (flag: number) =>
  http.request<any>("put", api(`symbols/enable/${flag}`));
export const batchEditFeatures = (data: Query) =>
  http.request<any>("put", api("symbols/batch"), { data });
export const testSymbolRule = (id: number | string, data: Query) =>
  http.post<any, Query>(api(`symbols/${id}/rule-test`), { data });

export const getList = (params: Query = {}) =>
  http.get<any, Query>(api("strategy-templates"), { params });
export const getTemplate = (id: number | string) =>
  http.get<any, Query>(api(`strategy-templates/${id}`));
export const addData = (data: Query) =>
  http.post<any, Query>(api("strategy-templates"), { data });
export const editData = (id: number | string, data: Query) =>
  http.request<any>("put", api(`strategy-templates/${id}`), { data });
export const delData = (id: number | string) =>
  http.request<any>("delete", api(`strategy-templates/${id}`));
export const importData = (json: string) =>
  http.request<any>("post", api("strategy-templates/import"), {
    data: json,
    transformRequest: [data => data],
    headers: { "Content-Type": "application/json" }
  });
export const testStrategyRule = (_symbol: string, data: Query) =>
  http.post<any, Query>(api("strategy-templates/rule-test"), { data });

export interface CoinMPosition {
  id: number;
  symbol: string;
  position_side: "LONG" | "SHORT" | "BOTH";
  margin_asset: string;
  contract_size: string;
  entry_price: string;
  opened_contracts: string;
  remaining_contracts: string;
  realized_pnl: string;
  status: string;
  created_at: number;
  updated_at: number;
  closed_at: number;
  mark_price?: string | null;
  mark_time?: number;
  open_filled_contracts?: string;
  close_filled_contracts?: string;
  unrealized_pnl: string | null;
  total_pnl: string | null;
  realized_usd_estimate: string | null;
  unrealized_usd_estimate: string | null;
  total_usd_estimate: string | null;
  pnl_status: string;
  warning?: string;
  fees_by_asset?: CoinMAssetFee[];
  funding_included: boolean;
}
export interface CoinMManagedOrder {
  id: number;
  position_id: number;
  symbol: string;
  position_side: string;
  side: string;
  intent: string;
  order_type: string;
  client_order_id: string;
  exchange_order_id: string;
  requested_contracts: string;
  filled_contracts: string;
  status: string;
  created_at: number;
  updated_at: number;
}
export interface CoinMTradeFill {
  id: number;
  order_id: number;
  position_id: number;
  symbol: string;
  side: string;
  trade_id: string;
  exchange_order_id: string;
  contracts: string;
  price: string;
  realized_pnl: string;
  pnl_asset: string;
  commission: string;
  commission_asset: string;
  trade_time: number;
}
export interface CoinMPositionDetail {
  position: CoinMPosition;
  orders: CoinMManagedOrder[];
  fills: CoinMTradeFill[];
}
export interface CoinMAssetFee {
  asset: string;
  amount: string;
}
export interface CoinMAssetTotal {
  asset: string;
  positions: number;
  verified: number;
  unpriced: number;
  pending: number;
  invalid: number;
  realized_pnl: string;
  unrealized_pnl: string | null;
  total_pnl: string | null;
  realized_usd_estimate: string | null;
  unrealized_usd_estimate: string | null;
  total_usd_estimate: string | null;
  fees: CoinMAssetFee[];
  funding_included: boolean;
}
export interface CoinMPositionPage extends CoinMPage<CoinMPosition> {
  totals: CoinMAssetTotal[];
  price_status: "available" | "unavailable" | "not_required";
}
export interface CoinMWalletBalance {
  asset: string;
  wallet_balance: string;
  available_balance: string;
  cross_wallet_balance: string;
  cross_unrealized_pnl: string;
  withdraw_available: string;
  updated_at: number;
}
export interface CoinMWallet {
  environment: string;
  balances: CoinMWalletBalance[];
  read_only: boolean;
}
export interface CoinMPage<T> {
  total: number;
  list: T[];
}
export const getCoinMPositions = (params: Query = {}) =>
  http.get<{ code: number; data: CoinMPositionPage; msg: string }, Query>(
    api("positions"),
    { params }
  );
export const getCoinMOrders = (params: Query = {}) =>
  http.get<
    { code: number; data: CoinMPage<CoinMManagedOrder>; msg: string },
    Query
  >(api("orders"), { params });
export const getCoinMPositionDetail = (id: number) =>
  http.get<{ code: number; data: CoinMPositionDetail; msg: string }, Query>(
    api(`positions/${id}`)
  );

export const getCoinMWallet = () =>
  http.get<{ code: number; data: CoinMWallet; msg: string }, Query>(
    api("wallet")
  );

export interface CoinMRuntimeStatus {
  environment: string;
  global_entry_enabled: boolean;
  enabled_perpetual_symbols: number;
  managed_cycles_needing_work: number;
  orders_needing_reconciliation: number;
  private_ws_verified: boolean;
  wallet_verified: boolean;
  trade_actions_available: boolean;
  read_only: boolean;
}
export const getCoinMRuntimeStatus = () =>
  http.get<{ code: number; data: CoinMRuntimeStatus; msg: string }, Query>(
    api("runtime-status")
  );
