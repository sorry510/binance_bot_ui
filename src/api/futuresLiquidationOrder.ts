import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getFuturesLiquidationOrders = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/liquidation-orders"), {
    params
  });
};
