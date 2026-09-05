import { http, baseUrlApi } from "@/utils/http";

type Query = Record<string, any>;

const AI_API_TIMEOUT = 30000;

export interface StrategyTemplateAIProgressEvent {
  progress: number;
  stage: string;
  tool?: string;
  message: string;
  time: string;
}

export interface StrategyTemplateAIGenerationTask {
  taskId: string;
  conversationId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  stage: string;
  events: StrategyTemplateAIProgressEvent[];
  json?: string;
  validationError?: string;
  error?: string;
  round: number;
  maxRounds: number;
  imported: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

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

export const importData = (json: string) => {
  return http.request<any>("post", baseUrlApi("strategy-templates/import"), {
    data: json,
    transformRequest: [data => data],
    headers: {
      "Content-Type": "application/json"
    }
  });
};

export const startAIGeneration = (data: {
  prompt: string;
  previousJson?: string;
  validationError?: string;
  conversationId?: string;
}) => {
  return http.post<any, typeof data>(
    baseUrlApi("strategy-templates/ai-generate"),
    { data },
    { timeout: AI_API_TIMEOUT }
  );
};

export const importAIGeneratedData = (taskId: string, json: string) => {
  return http.request<any>(
    "post",
    baseUrlApi(
      `strategy-templates/ai-generate/${encodeURIComponent(taskId)}/import`
    ),
    {
      data: json,
      transformRequest: [data => data],
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
};

export const getAIGenerationTask = (taskId: string) => {
  return http.get<any, Query>(
    baseUrlApi(`strategy-templates/ai-generate/${encodeURIComponent(taskId)}`),
    undefined,
    { timeout: AI_API_TIMEOUT }
  );
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
