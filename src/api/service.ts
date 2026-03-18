import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getServiceConfig = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("service/config"), { params });
};

export const editData = (data: Query) => {
  return http.request<any>("put", baseUrlApi("service/config"), { data });
};

export const testPusher = (params: Query = {}) => {
  return http.post<any, Query>(baseUrlApi("test-pusher"), { params });
};

export const updateMarketCondition = (params: Query = {}) => {
  return http.post<any, Query>(baseUrlApi("update-market-condition"), {
    params
  });
};

export const getLog = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("pm2-log?key=sorry510"), { params });
};
