import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getOrders = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("orders"), { params });
};

export const delAllTrade = () => {
  return http.request<any>("delete", baseUrlApi("orders"));
};

export const delTrade = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`orders/${id}`));
};
