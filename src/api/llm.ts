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
}

export interface LLMTestInput extends LLMConfigInput {
  id?: number;
}

export const getLLMConfigs = () =>
  http.get<any, Record<string, never>>(baseUrlApi("llm/configs"));

export const getLLMProviderPresets = () =>
  http.get<any, Record<string, never>>(baseUrlApi("llm/configs/presets"));

export const createLLMConfig = (data: LLMConfigInput) =>
  http.post<any, LLMConfigInput>(baseUrlApi("llm/configs"), { data });
export const updateLLMConfig = (id: number, data: LLMConfigInput) =>
  http.request<any>("put", baseUrlApi(`llm/configs/${id}`), { data });

export const deleteLLMConfig = (id: number) =>
  http.request<any>("delete", baseUrlApi(`llm/configs/${id}`));

export const testLLMConfig = (data: LLMTestInput) =>
  http.post<any, LLMTestInput>(baseUrlApi("llm/configs/test"), { data });
