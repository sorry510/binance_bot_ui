import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;
const api = (path: string) => baseUrlApi(`spot-quant/${path}`);

// Spot Quant: only local ticker settings and templates in stage 06-2.
// None of these endpoints place Binance orders.
export const getFeatures = (params: Query = {}) =>
  http.get<any, Query>(api("symbols"), { params });
export const getFeature = (id: number | string) =>
  http.get<any, Query>(api(`symbols/${id}`));
export const addFeature = (data: Query) =>
  http.post<any, Query>(api("symbols"), { data });
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

// 06-5: Spot-only managed lifecycle read model. These endpoints cannot
// send live BUY/SELL/CANCEL orders or claim wallet holdings.
export interface SpotPosition {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  bought_qty: string;
  remaining_qty: string;
  avg_cost_quote: string;
  realized_pnl: string;
  status: "PENDING_BUY" | "OPEN" | "CLOSED";
  created_at: number;
  updated_at: number;
  closed_at: number;
}
export interface SpotPositionView {
  position: SpotPosition;
  mark_price?: string;
  price_time?: number;
  has_mark_price: boolean;
  realized_pnl: string;
  unrealized_pnl?: string;
  total_pnl?: string;
  fully_priced: boolean;
  unpriced_fees: Record<string, string>;
  needs_review: boolean;
  review_reason?: string;
}
export interface SpotQuoteSummary {
  quote_asset: "USDT" | "USDC" | "FDUSD";
  positions: number;
  realized_pnl: string;
  total_pnl?: string;
  fully_priced: boolean;
  missing_prices: number;
  unpriced_positions: number;
  review_positions: number;
}
export interface SpotPositionPage {
  list: SpotPositionView[];
  total: number;
  page: number;
  limit: number;
  summary: SpotQuoteSummary[];
}
export interface SpotManagedOrder {
  id: number;
  position_id: number;
  symbol: string;
  side: "BUY" | "SELL";
  order_type: string;
  client_order_id: string;
  exchange_order_id: string;
  requested_qty: string;
  filled_qty: string;
  status: string;
  created_at: number;
  updated_at: number;
}
export interface SpotTradeFill {
  id: number;
  position_id: number;
  order_id: number;
  exchange_order_id: string;
  trade_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: string;
  price: string;
  quote_qty: string;
  commission: string;
  commission_asset: string;
  trade_time: number;
}
export interface SpotPositionDetail {
  view: SpotPositionView;
  orders: SpotManagedOrder[];
  fills: SpotTradeFill[];
  review_issues: string[];
  manual_trading_enabled: false;
  binance_wallet_owned: false;
}
export const getSpotPositionPage = (params: Query = {}) =>
  http.get<{ code: number; data: SpotPositionPage; msg: string }, Query>(
    api("positions"),
    { params }
  );
export const getSpotPositionDetail = (id: number) =>
  http.get<{ code: number; data: SpotPositionDetail; msg: string }, Query>(
    api(`positions/${id}`)
  );
export const getSpotOrderPage = (params: Query = {}) =>
  http.get<
    {
      code: number;
      data: { total: number; list: SpotManagedOrder[] };
      msg: string;
    },
    Query
  >(api("orders"), { params });
export const rebuildSpotLocalPosition = (id: number) =>
  http.request<{ code: number; data: SpotPosition; msg: string }>(
    "post",
    api(`positions/${id}/rebuild`),
    { data: { confirm: true } }
  );
