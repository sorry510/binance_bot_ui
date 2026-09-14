import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export interface OutcomeGroup {
  key: string;
  label: string;
  trade_count: number;
  wins: number;
  net_pnl: number;
  win_rate: number;
  profit_factor: number;
  fees: number;
  funding: number;
  average_holding_ms: number;
}

export interface BacktestOutcomeSummary {
  run_count: number;
  trade_count: number;
  net_pnl: number;
  return_pct: number;
  max_drawdown_pct: number;
  max_drawdown_available: boolean;
  win_rate: number;
  profit_factor: number;
  fees: number;
  funding: number;
  average_holding_ms: number;
  by_symbol: OutcomeGroup[];
  by_side: OutcomeGroup[];
  by_market_condition: OutcomeGroup[];
}

export interface PaperOutcomeSummary {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  gross_profit: number;
  net_profit: number;
  fees: number;
  average_net_profit: number;
  long_trades: number;
  short_trades: number;
  by_template: Array<Record<string, any>>;
}

export interface LiveProposalSummary {
  proposal_id: string;
  source_task_id: string;
  symbol: string;
  side: string;
  status: string;
  risk_status: string;
  market_condition: number;
  created_at: number;
  executed_at: number;
}

export interface LiveOutcomeSummary {
  proposals: number;
  executed: number;
  open_positions: number;
  closed_positions: number;
  managed_orders: number;
  pnl_available: boolean;
  recent_proposals: LiveProposalSummary[];
}

export const getBacktestOutcomes = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/outcomes/backtest"), { params });
export const getPaperOutcomes = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/outcomes/paper"), { params });
export const getLiveOutcomes = (params: Query = {}) =>
  http.get<any, Query>(baseUrlApi("agents/outcomes/live"), { params });
