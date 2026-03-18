import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getNotifyConfigs = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("notify-config"), { params });
};

export const setNotifyConfig = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`notify-config/${id}`), {
    data
  });
};

export const addNotifyConfig = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("notify-config"), { data });
};

export const delNotifyConfig = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`notify-config/${id}`));
};
