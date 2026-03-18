import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

export const getList = (params: Query = {}) => {
  return http.get<any, Query>(baseUrlApi("strategy-templates"), { params });
};

export const editData = (id: number | string, data: Query) => {
  return http.request<any>("put", baseUrlApi(`strategy-templates/${id}`), {
    data
  });
};

export const addData = (data: Query) => {
  return http.post<any, Query>(baseUrlApi("strategy-templates"), { data });
};

export const delData = (id: number | string) => {
  return http.request<any>("delete", baseUrlApi(`strategy-templates/${id}`));
};

export const testStrategyRule = (symbol: string, data: Query) => {
  return http.post<any, Query>(
    baseUrlApi(`strategy-templates/test/${symbol}`),
    {
      data
    }
  );
};
