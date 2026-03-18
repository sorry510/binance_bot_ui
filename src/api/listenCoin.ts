import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getListenCoins = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("listen/coin"), { params });
};

export const setListenCoin = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`listen/coin/${id}`), { data });
};

export const addListenCoin = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("listen/coin"), { data });
};

export const delListenCoin = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`listen/coin/${id}`));
};

export const getFundingRates = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("listen/funding-rates"), { params });
};

export const editFundingRates = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`listen/funding-rates/${id}`), {
    data
  });
};

export const getFundingRateHistory = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("listen/funding-rate/history"), {
    params
  });
};

export const testStrategyRule = (id: number | string, data: Query) => {
  return http.post<any, Query>(baseUrlApi(`listen/strategy-rule/test/${id}`), {
    data
  });
};
