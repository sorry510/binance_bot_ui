import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getFeatures = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("rush"), { params });
};

export const setFeature = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`rush/${id}`), { data });
};

export const addFeature = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("rush"), { data });
};

export const delFeature = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`rush/${id}`));
};
