import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getFeatures = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("features"), { params });
};

export const getFeature = (id: number | string) => {
  return http.get<any, Query>(baseUrlApi(`features/${id}`));
};

export const getFeaturesOptions = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("features-options"), { params });
};

export const setFeature = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`features/${id}`), { data });
};

export const addFeature = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("features"), { data });
};

export const delFeature = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`features/${id}`));
};

export const enableFeature = (flag = 1) => {
  return http.request<any>("put", baseUrlApi(`features/enable/${flag}`));
};

export const batchEditFeatures = (data: Query) => {
  return http.request<any>("put", baseUrlApi("features/batch"), { data });
};

export const getConfig = () => {
  return http.get<any, Query>(baseUrlApi("config"));
};

export const setConfig = (data: Query) => {
  return http.request<any>("put", baseUrlApi("config"), { data });
};

export const startService = () => {
  return http.post<any, Query>(baseUrlApi("start"));
};

export const stopService = () => {
  return http.post<any, Query>(baseUrlApi("stop"));
};

export const getFuturesAccount = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/account"), { params });
};

export const getFuturesPositions = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/positions"), { params });
};

export const getFuturesOpenOrders = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/open-orders"), { params });
};

export const getLocalFuturesPositions = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/local/positions"), {
    params
  });
};

export const updateLocalFuturesPositions = (
  id: number | string,
  data: Query
) => {
  return http.request<any>("put", baseUrlApi(`futures/local/positions/${id}`), {
    data
  });
};

export const delLocalFuturesPositions = (id: number | string) => {
  return http.request<any>(
    "delete",
    baseUrlApi(`futures/local/positions/${id}`)
  );
};

export const getLocalFuturesOpenOrders = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("futures/local/open-orders"), {
    params
  });
};

export const testStrategyRule = (id: number | string, data: Query) => {
  return http.post<any, Query>(
    baseUrlApi(`features/strategy-rule/test/${id}`),
    {
      data
    }
  );
};
