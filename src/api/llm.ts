import { http, baseUrlApi } from "@/utils/http";

export interface LLMConfigItem {
  id: number;
  name: string;
  provider: string;
  api_url: string;
  model: string;
  api_version?: string;
  timeout_seconds: number;
  temperature: number;
  enabled: number;
  router_candidate: number;
  structured_output: number;
  native_tool_calling: number;
  reasoning: number;
  long_context: number;
  json_reliability: number;
  max_context_tokens: number;
  cost_class: "low" | "medium" | "high" | string;
  latency_class: "low" | "medium" | "high" | string;
  has_api_key: boolean;
  api_key_masked?: string;
  created_at: number;
  updated_at: number;
}

export interface LLMProviderPreset {
  provider: string;
  display_name: string;
  api_url: string;
  api_version?: string;
  api_key_required: boolean;
  description: string;
}
export interface LLMConfigInput {
  name: string;
  provider: string;
  api_url: string;
  api_key: string;
  model: string;
  api_version: string;
  timeout_seconds: number;
  temperature: number;
  enabled: number;
  router_candidate?: number;
  structured_output?: number;
  native_tool_calling?: number;
  reasoning?: number;
  long_context?: number;
  json_reliability?: number;
  max_context_tokens?: number;
  cost_class?: string;
  latency_class?: string;
}

export interface LLMRouterSettings {
  enabled: number;
  fallback_enabled: number;
  failure_threshold: number;
  cooldown_seconds: number;
  health_window: number;
}

export interface LLMHealthSnapshot {
  config_id: number;
  state: string;
  samples: number;
  success_rate: number;
  rate_429: number;
  timeouts: number;
  server_errors: number;
  average_latency_ms: number;
  consecutive_failures: number;
  open_until?: number;
}

export interface LLMRouterState {
  settings: LLMRouterSettings;
  health: LLMHealthSnapshot[];
}

export interface LLMTestInput extends LLMConfigInput {
  id?: number;
}

export const getLLMConfigs = () =>
  http.get<any, Record<string, never>>(baseUrlApi("llm/configs"));

export const getLLMConfigAPIKey = (id: number) =>
  http.get<any, Record<string, never>>(baseUrlApi(`llm/configs/${id}/api-key`));

export const getLLMProviderPresets = () =>
  http.get<any, Record<string, never>>(baseUrlApi("llm/configs/presets"));

export const createLLMConfig = (data: LLMConfigInput) =>
  http.post<any, LLMConfigInput>(baseUrlApi("llm/configs"), { data });
export const updateLLMConfig = (id: number, data: LLMConfigInput) =>
  http.request<any>("put", baseUrlApi(`llm/configs/${id}`), { data });

export const deleteLLMConfig = (id: number) =>
  http.request<any>("delete", baseUrlApi(`llm/configs/${id}`));

export const getLLMRouterState = () =>
  http.get<any, Record<string, never>>(baseUrlApi("llm/router"));

export const updateLLMRouterSettings = (data: LLMRouterSettings) =>
  http.request<any>("put", baseUrlApi("llm/router"), { data });

export const testLLMConfig = (data: LLMTestInput) =>
  http.post<any, LLMTestInput>(
    baseUrlApi("llm/configs/test"),
    { data },
    {
      timeout: Math.max(60000, Number(data.timeout_seconds || 0) * 1000 + 10000)
    }
  );
