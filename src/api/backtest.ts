import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;
export interface BacktestConfig {
  initial_equity: number;
  position_size_pct: number;
  leverage: number;
  fee_rate: number;
  slippage_bps: number;
  stop_loss_pct: number;
  take_profit_pct: number;
}
export interface BacktestMetrics {
  net_pnl: number;
  return_pct: number;
  max_drawdown_pct: number;
  win_rate: number;
  profit_factor: number;
  sharpe: number;
  sortino: number;
  trade_count: number;
  fees: number;
  funding: number;
  average_holding_ms: number;
  by_side: BacktestGroupMetrics[];
  by_market_condition: BacktestGroupMetrics[];
}
export interface BacktestGroupMetrics {
  key: string;
  trade_count: number;
  net_pnl: number;
  win_rate: number;
  profit_factor: number;
  fees: number;
  funding: number;
  average_holding_ms: number;
}
export interface BacktestRun {
  run_id: string;
  dataset_id: string;
  dataset_spec_hash: string;
  data_hash: string;
  strategy_template_id: number;
  strategy_template_name: string;
  strategy_version: string;
  engine_version: string;
  market_condition_model: string;
  symbol: string;
  execution_interval: string;
  start_time: number;
  end_time: number;
  config: BacktestConfig;
  status: string;
  stage: string;
  progress: number;
  metrics?: BacktestMetrics;
  error?: string;
  created_at: number;
  started_at?: number;
  updated_at: number;
  completed_at?: number;
  dataset?: BacktestDataset;
}
export interface BacktestDataset {
  dataset_id: string;
  dataset_spec_hash: string;
  market: string;
  symbol: string;
  execution_interval: string;
  intervals: string[];
  benchmark_symbols: string[];
  start_time: number;
  end_time: number;
  warmup_start_time: number;
  created_at: number;
}
export interface BacktestTrade {
  sequence: number;
  symbol: string;
  side: string;
  entry_time: number;
  exit_time: number;
  entry_price: number;
  exit_price: number;
  quantity: number;
  gross_pnl: number;
  fees: number;
  funding_pnl: number;
  net_pnl: number;
  holding_ms: number;
  exit_reason: string;
  open_strategy_name?: string;
  close_strategy_name?: string;
  market_condition: number;
}
export interface BacktestEvent {
  sequence: number;
  event_time: number;
  type: string;
  action: string;
  side?: string;
  price?: number;
  quantity?: number;
  data?: any;
}
export interface BacktestEquityPoint {
  sequence: number;
  bar_time: number;
  equity: number;
  cash: number;
  unrealized_pnl: number;
  drawdown_pct: number;
  position_side?: string;
}
export interface StartBacktestRequest {
  strategy_template_id: number;
  symbol: string;
  execution_interval: string;
  start_time: number;
  end_time: number;
  config: BacktestConfig;
}
export const getBacktests = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/backtests"), { params });
export const startBacktest = (data: StartBacktestRequest) =>
  http.post<any, StartBacktestRequest>(baseUrlApi("agents/backtests"), {
    data
  });
export const getBacktest = (id: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/backtests/${encodeURIComponent(id)}`),
    { params: {} }
  );
export const cancelBacktest = (id: string) =>
  http.post<any, Query>(
    baseUrlApi(`agents/backtests/${encodeURIComponent(id)}/cancel`),
    { data: {} }
  );
export const getBacktestTrades = (id: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/backtests/${encodeURIComponent(id)}/trades`),
    { params: {} }
  );
export const getBacktestEvents = (id: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/backtests/${encodeURIComponent(id)}/events`),
    { params: {} }
  );
export const getBacktestEquity = (id: string) =>
  http.get<any, Query>(
    baseUrlApi(`agents/backtests/${encodeURIComponent(id)}/equity`),
    { params: {} }
  );
