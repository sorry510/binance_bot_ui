import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getResults = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("test-strategy-results"), { params });
};

export const delAllResults = () => {
  return http.request<any>("delete", baseUrlApi("test-strategy-results"));
};

export const delResults = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`test-strategy-results/${id}`));
};
