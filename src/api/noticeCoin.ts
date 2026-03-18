import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getNoticeCoins = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("notice/coin"), { params });
};

export const setNoticeCoin = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`notice/coin/${id}`), { data });
};

export const addNoticeCoin = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("notice/coin"), { data });
};

export const delNoticeCoin = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`notice/coin/${id}`));
};
