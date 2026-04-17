import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getMarketNoticeLogs = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/market-notice-logs"), {
    params
  });
};
