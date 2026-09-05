<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  createLLMConfig,
  deleteLLMConfig,
  getLLMConfigs,
  getLLMConfigAPIKey,
  getLLMProviderPresets,
  getLLMRouterState,
  updateLLMRouterSettings,
  testLLMConfig,
  updateLLMConfig,
  type LLMConfigInput,
  type LLMConfigItem,
  type LLMProviderPreset,
  type LLMRouterSettings,
  type LLMHealthSnapshot
} from "@/api/llm";

defineOptions({ name: "LLMConfigManagement" });

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const switchingId = ref<number | null>(null);
const testingId = ref<number | null>(null);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const apiKeyVisible = ref(false);
const apiKeyLoading = ref(false);
const configs = ref<LLMConfigItem[]>([]);
const presets = ref<LLMProviderPreset[]>([]);
const routerSaving = ref(false);
const routerSettings = reactive<LLMRouterSettings>({
  enabled: 0,
  fallback_enabled: 1,
  failure_threshold: 3,
  cooldown_seconds: 60,
  health_window: 20
});
const healthByConfig = ref<Record<number, LLMHealthSnapshot>>({});
const form = reactive<LLMConfigInput>({
  name: "",
  provider: "deepseek",
  api_url: "",
  api_key: "",
  model: "",
  api_version: "",
  timeout_seconds: 60,
  temperature: 0.2,
  enabled: 0,
  router_candidate: 0,
  structured_output: 1,
  native_tool_calling: 0,
  reasoning: 0,
  long_context: 0,
  json_reliability: 80,
  max_context_tokens: 0,
  cost_class: "medium",
  latency_class: "medium"
});

const selectedPreset = computed(() =>
  presets.value.find(item => item.provider === form.provider)
);
const apiKeyRequired = computed(
  () => selectedPreset.value?.api_key_required === true
);
const showAPIVersion = computed(() => form.provider === "anthropic");
const editingRow = computed(() =>
  configs.value.find(item => item.id === editingId.value)
);

function providerLabel(provider: string) {
  const fallback =
    presets.value.find(item => item.provider === provider)?.display_name ||
    provider;
  const key = `llmConfigPage.provider.${provider}.name`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}
function providerDescription(provider: string) {
  const fallback =
    presets.value.find(item => item.provider === provider)?.description || "";
  const key = `llmConfigPage.provider.${provider}.description`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}
function applyPreset(provider: string, force = false) {
  const preset = presets.value.find(item => item.provider === provider);
  if (!preset) return;
  if (force || !form.api_url) form.api_url = preset.api_url || "";
  if (force || !form.api_version) form.api_version = preset.api_version || "";
}

async function fetchData() {
  loading.value = true;
  try {
    const [configRes, presetRes, routerRes] = await Promise.all([
      getLLMConfigs(),
      getLLMProviderPresets(),
      getLLMRouterState()
    ]);
    configs.value = (configRes?.data || []) as LLMConfigItem[];
    presets.value = (presetRes?.data || []) as LLMProviderPreset[];
    Object.assign(routerSettings, routerRes?.data?.settings || {});
    healthByConfig.value = Object.fromEntries(
      ((routerRes?.data?.health || []) as LLMHealthSnapshot[]).map(item => [
        item.config_id,
        item
      ])
    );
  } catch (error: any) {
    ElMessage.error(error?.message || t("llmConfigPage.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  apiKeyVisible.value = false;
  Object.assign(form, {
    name: "",
    provider: presets.value[0]?.provider || "deepseek",
    api_url: "",
    api_key: "",
    model: "",
    api_version: "",
    timeout_seconds: 60,
    temperature: 0.2,
    enabled: configs.value.length === 0 ? 1 : 0,
    router_candidate: 0,
    structured_output: 1,
    native_tool_calling: 0,
    reasoning: 0,
    long_context: 0,
    json_reliability: 80,
    max_context_tokens: 0,
    cost_class: "medium",
    latency_class: "medium"
  });
  applyPreset(form.provider, true);
}
function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: LLMConfigItem) {
  editingId.value = row.id;
  apiKeyVisible.value = false;
  Object.assign(form, {
    name: row.name,
    provider: row.provider,
    api_url: row.api_url,
    api_key: "",
    model: row.model,
    api_version: row.api_version || "",
    timeout_seconds: row.timeout_seconds || 60,
    temperature: Number(row.temperature ?? 0.2),
    enabled: row.enabled,
    router_candidate: row.router_candidate ?? 0,
    structured_output: row.structured_output ?? 1,
    native_tool_calling: row.native_tool_calling ?? 0,
    reasoning: row.reasoning ?? 0,
    long_context: row.long_context ?? 0,
    json_reliability: row.json_reliability ?? 80,
    max_context_tokens: row.max_context_tokens ?? 0,
    cost_class: row.cost_class || "medium",
    latency_class: row.latency_class || "medium"
  });
  dialogVisible.value = true;
}

async function onAPIKeyVisibilityChange(visible: boolean) {
  if (!visible || editingId.value === null || form.api_key.trim()) return;
  if (!editingRow.value?.has_api_key) return;
  apiKeyLoading.value = true;
  try {
    const res = await getLLMConfigAPIKey(editingId.value);
    form.api_key = String(res?.data?.api_key || "");
  } catch (error: any) {
    apiKeyVisible.value = false;
    ElMessage.error(
      error?.message || t("llmConfigPage.message.apiKeyLoadFailed")
    );
  } finally {
    apiKeyLoading.value = false;
  }
}

function onProviderChange(value: string) {
  applyPreset(value, true);
}

function payloadFromRow(row: LLMConfigItem): LLMConfigInput {
  return {
    name: row.name,
    provider: row.provider,
    api_url: row.api_url,
    api_key: "",
    model: row.model,
    api_version: row.api_version || "",
    timeout_seconds: row.timeout_seconds || 60,
    temperature: Number(row.temperature ?? 0.2),
    enabled: row.enabled,
    router_candidate: row.router_candidate ?? 0,
    structured_output: row.structured_output ?? 1,
    native_tool_calling: row.native_tool_calling ?? 0,
    reasoning: row.reasoning ?? 0,
    long_context: row.long_context ?? 0,
    json_reliability: row.json_reliability ?? 80,
    max_context_tokens: row.max_context_tokens ?? 0,
    cost_class: row.cost_class || "medium",
    latency_class: row.latency_class || "medium"
  };
}
function validateForm() {
  if (!form.name.trim()) {
    ElMessage.error(t("llmConfigPage.message.nameRequired"));
    return false;
  }
  if (!form.provider.trim()) {
    ElMessage.error(t("llmConfigPage.message.providerRequired"));
    return false;
  }
  if (!form.api_url.trim()) {
    ElMessage.error(t("llmConfigPage.message.apiUrlRequired"));
    return false;
  }
  if (!form.model.trim()) {
    ElMessage.error(t("llmConfigPage.message.modelRequired"));
    return false;
  }
  if (
    apiKeyRequired.value &&
    !form.api_key.trim() &&
    !editingRow.value?.has_api_key
  ) {
    ElMessage.error(t("llmConfigPage.message.apiKeyRequired"));
    return false;
  }
  return true;
}

async function save() {
  if (!validateForm()) return;
  saving.value = true;
  try {
    if (editingId.value === null) {
      await createLLMConfig({ ...form });
    } else {
      await updateLLMConfig(editingId.value, { ...form });
    }
    ElMessage.success(t("llmConfigPage.message.saved"));
    dialogVisible.value = false;
    await fetchData();
  } catch (error: any) {
    ElMessage.error(error?.message || t("llmConfigPage.message.saveFailed"));
  } finally {
    saving.value = false;
  }
}
async function testCurrent() {
  if (!validateForm()) return;
  testing.value = true;
  try {
    const res = await testLLMConfig({
      ...form,
      id: editingId.value || undefined
    });
    const data = res?.data || {};
    ElMessage.success(
      `${t("llmConfigPage.message.testSuccess")}: ${data.provider || form.provider} / ${data.model || form.model} ${data.content ? `- ${data.content}` : ""}`
    );
  } catch (error: any) {
    ElMessage.error(error?.message || t("llmConfigPage.message.testFailed"));
  } finally {
    testing.value = false;
  }
}

async function testRow(row: LLMConfigItem) {
  testingId.value = row.id;
  try {
    const res = await testLLMConfig({ ...payloadFromRow(row), id: row.id });
    const data = res?.data || {};
    ElMessage.success(
      `${t("llmConfigPage.message.testSuccess")}: ${data.model || row.model}${data.content ? ` - ${data.content}` : ""}`
    );
  } catch (error: any) {
    ElMessage.error(error?.message || t("llmConfigPage.message.testFailed"));
  } finally {
    testingId.value = null;
  }
}

async function activate(row: LLMConfigItem) {
  if (row.enabled === 1) return;
  switchingId.value = row.id;
  try {
    await updateLLMConfig(row.id, { ...payloadFromRow(row), enabled: 1 });
    ElMessage.success(t("llmConfigPage.message.activated"));
    await fetchData();
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("llmConfigPage.message.activateFailed")
    );
  } finally {
    switchingId.value = null;
  }
}
async function remove(row: LLMConfigItem) {
  try {
    await ElMessageBox.confirm(
      t("llmConfigPage.confirm.delete", { name: row.name }),
      t("llmConfigPage.confirm.title"),
      { type: "warning" }
    );
    await deleteLLMConfig(row.id);
    ElMessage.success(t("llmConfigPage.message.deleted"));
    await fetchData();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("llmConfigPage.message.deleteFailed"));
  }
}

async function saveRouterSettings() {
  routerSaving.value = true;
  try {
    await updateLLMRouterSettings({ ...routerSettings });
    ElMessage.success(t("llmConfigPage.message.routerSaved"));
    await fetchData();
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("llmConfigPage.message.routerSaveFailed")
    );
  } finally {
    routerSaving.value = false;
  }
}

function healthState(row: LLMConfigItem) {
  return healthByConfig.value[row.id]?.state || "unknown";
}
function healthLabel(row: LLMConfigItem) {
  const item = healthByConfig.value[row.id];
  if (!item || item.samples === 0) return t("llmConfigPage.health.unknown");
  return `${t(`llmConfigPage.health.${item.state}`)} · ${(item.success_rate * 100).toFixed(0)}% · ${item.average_latency_ms}ms`;
}
function capabilityTags(row: LLMConfigItem) {
  const result: string[] = [];
  if (row.structured_output === 1) result.push("JSON");
  if (row.reasoning === 1) result.push(t("llmConfigPage.capability.reasoning"));
  if (row.long_context === 1)
    result.push(t("llmConfigPage.capability.longContext"));
  if (row.native_tool_calling === 1)
    result.push(t("llmConfigPage.capability.nativeTools"));
  return result;
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-medium">
              {{ t("llmConfigPage.title") }}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              {{ t("llmConfigPage.subtitle") }}
            </div>
          </div>
          <div class="flex gap-2">
            <el-button @click="fetchData">{{
              t("llmConfigPage.button.refresh")
            }}</el-button>
            <el-button type="primary" @click="openCreate">{{
              t("llmConfigPage.button.add")
            }}</el-button>
          </div>
        </div>
      </template>
      <el-alert
        :title="t('llmConfigPage.hint.database')"
        type="info"
        :closable="false"
        class="mb-4"
      />

      <el-card shadow="never" class="mb-4 router-card">
        <template #header
          ><div class="font-medium">
            {{ t("llmConfigPage.router.title") }}
          </div></template
        >
        <el-form inline label-width="120px">
          <el-form-item :label="t('llmConfigPage.router.enabled')"
            ><el-switch
              v-model="routerSettings.enabled"
              :active-value="1"
              :inactive-value="0"
          /></el-form-item>
          <el-form-item :label="t('llmConfigPage.router.fallback')"
            ><el-switch
              v-model="routerSettings.fallback_enabled"
              :active-value="1"
              :inactive-value="0"
          /></el-form-item>
          <el-form-item :label="t('llmConfigPage.router.failureThreshold')"
            ><el-input-number
              v-model="routerSettings.failure_threshold"
              :min="1"
              :max="20"
          /></el-form-item>
          <el-form-item :label="t('llmConfigPage.router.cooldown')"
            ><el-input-number
              v-model="routerSettings.cooldown_seconds"
              :min="5"
              :max="3600"
            /><span class="ml-1">s</span></el-form-item
          >
          <el-form-item
            ><el-button
              type="primary"
              :loading="routerSaving"
              @click="saveRouterSettings"
              >{{ t("llmConfigPage.button.saveRouter") }}</el-button
            ></el-form-item
          >
        </el-form>
        <div class="text-xs text-gray-500">
          {{ t("llmConfigPage.router.hint") }}
        </div>
      </el-card>

      <el-table v-loading="loading" :data="configs" size="small">
        <el-table-column
          prop="name"
          :label="t('llmConfigPage.table.name')"
          min-width="150"
        />
        <el-table-column
          :label="t('llmConfigPage.table.provider')"
          min-width="140"
        >
          <template #default="{ row }">
            {{ providerLabel(row.provider) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="model"
          :label="t('llmConfigPage.table.model')"
          min-width="170"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('llmConfigPage.table.routing')"
          min-width="150"
        >
          <template #default="{ row }">
            <el-tag v-if="row.enabled === 1" type="success" size="small">{{
              t("llmConfigPage.state.primary")
            }}</el-tag>
            <el-tag
              v-else-if="row.router_candidate === 1"
              type="warning"
              size="small"
              >{{ t("llmConfigPage.state.candidate") }}</el-tag
            >
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('llmConfigPage.table.capabilities')"
          min-width="220"
        >
          <template #default="{ row }"
            ><div class="flex flex-wrap gap-1">
              <el-tag
                v-for="tag in capabilityTags(row)"
                :key="tag"
                size="small"
                effect="plain"
                >{{ tag }}</el-tag
              >
            </div></template
          >
        </el-table-column>
        <el-table-column
          :label="t('llmConfigPage.table.health')"
          min-width="190"
        >
          <template #default="{ row }"
            ><el-tag
              :type="
                healthState(row) === 'open'
                  ? 'danger'
                  : healthState(row) === 'closed'
                    ? 'success'
                    : 'info'
              "
              size="small"
              >{{ healthLabel(row) }}</el-tag
            ></template
          >
        </el-table-column>
        <el-table-column
          prop="api_url"
          :label="t('llmConfigPage.table.apiUrl')"
          min-width="280"
          show-overflow-tooltip
        />
        <el-table-column :label="t('llmConfigPage.table.apiKey')" width="150">
          <template #default="{ row }">
            <span v-if="row.has_api_key">{{ row.api_key_masked }}</span>
            <el-tag v-else type="info" size="small">{{
              t("llmConfigPage.state.notConfigured")
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('llmConfigPage.table.enabled')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{
                row.enabled === 1
                  ? t("llmConfigPage.state.current")
                  : t("llmConfigPage.state.inactive")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('llmConfigPage.table.operation')"
          width="300"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.enabled !== 1"
              size="small"
              type="success"
              :loading="switchingId === row.id"
              @click="activate(row)"
            >
              {{ t("llmConfigPage.button.activate") }}
            </el-button>
            <el-button
              size="small"
              :loading="testingId === row.id"
              @click="testRow(row)"
            >
              {{ t("llmConfigPage.button.test") }}
            </el-button>
            <el-button size="small" @click="openEdit(row)">{{
              t("llmConfigPage.button.edit")
            }}</el-button>
            <el-button size="small" type="danger" @click="remove(row)">{{
              t("llmConfigPage.button.delete")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId === null
          ? t('llmConfigPage.dialog.add')
          : t('llmConfigPage.dialog.edit')
      "
      width="760px"
      destroy-on-close
    >
      <el-form label-width="150px">
        <el-form-item :label="t('llmConfigPage.field.provider')" required>
          <el-select
            v-model="form.provider"
            class="w-full"
            filterable
            @change="onProviderChange"
          >
            <el-option
              v-for="item in presets"
              :key="item.provider"
              :label="providerLabel(item.provider)"
              :value="item.provider"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.name')" required>
          <el-input
            v-model="form.name"
            :placeholder="t('llmConfigPage.placeholder.name')"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.apiUrl')" required>
          <el-input
            v-model="form.api_url"
            :placeholder="t('llmConfigPage.placeholder.apiUrl')"
          />
        </el-form-item>
        <el-form-item
          :label="t('llmConfigPage.field.apiKey')"
          :required="apiKeyRequired"
        >
          <el-input
            v-model="form.api_key"
            :type="apiKeyVisible ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="
              editingRow?.has_api_key
                ? t('llmConfigPage.placeholder.apiKeyKeep')
                : t('llmConfigPage.placeholder.apiKey')
            "
          />
          <div class="api-key-controls">
            <el-switch
              v-model="apiKeyVisible"
              :loading="apiKeyLoading"
              :active-text="t('llmConfigPage.button.showApiKey')"
              :inactive-text="t('llmConfigPage.button.hideApiKey')"
              @change="onAPIKeyVisibilityChange"
            />
          </div>
          <div
            v-if="editingRow?.has_api_key && !apiKeyVisible"
            class="form-hint"
          >
            {{ t("llmConfigPage.hint.apiKeyKeep") }}
            {{ editingRow.api_key_masked }}
          </div>
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.model')" required>
          <el-input
            v-model="form.model"
            :placeholder="t('llmConfigPage.placeholder.model')"
          />
        </el-form-item>
        <el-form-item
          v-if="showAPIVersion"
          :label="t('llmConfigPage.field.apiVersion')"
        >
          <el-input v-model="form.api_version" />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.timeout')">
          <el-input-number
            v-model="form.timeout_seconds"
            :min="1"
            :max="600"
            :step="5"
            controls-position="right"
          />
          <span class="ml-2 text-xs text-gray-500">{{
            t("llmConfigPage.unit.second")
          }}</span>
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.temperature')">
          <el-input-number
            v-model="form.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :precision="1"
            controls-position="right"
          />
        </el-form-item>
        <el-divider content-position="left">{{
          t("llmConfigPage.capability.title")
        }}</el-divider>
        <el-form-item :label="t('llmConfigPage.field.routerCandidate')">
          <el-switch
            v-model="form.router_candidate"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.structuredOutput')">
          <el-switch
            v-model="form.structured_output"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.reasoning')">
          <el-switch
            v-model="form.reasoning"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.longContext')">
          <el-switch
            v-model="form.long_context"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.nativeToolCalling')">
          <el-switch
            v-model="form.native_tool_calling"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.jsonReliability')">
          <el-input-number
            v-model="form.json_reliability"
            :min="0"
            :max="100"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.maxContextTokens')">
          <el-input-number
            v-model="form.max_context_tokens"
            :min="0"
            :step="8192"
          />
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.costClass')">
          <el-select v-model="form.cost_class" class="w-full"
            ><el-option
              v-for="value in ['low', 'medium', 'high']"
              :key="value"
              :label="t(`llmConfigPage.class.${value}`)"
              :value="value"
          /></el-select>
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.latencyClass')">
          <el-select v-model="form.latency_class" class="w-full"
            ><el-option
              v-for="value in ['low', 'medium', 'high']"
              :key="value"
              :label="t(`llmConfigPage.class.${value}`)"
              :value="value"
          /></el-select>
        </el-form-item>
        <el-form-item :label="t('llmConfigPage.field.enabled')">
          <el-switch
            v-model="form.enabled"
            :active-value="1"
            :inactive-value="0"
          />
          <span class="ml-3 text-xs text-gray-500">
            {{ t("llmConfigPage.hint.enabled") }}
          </span>
        </el-form-item>
        <el-alert
          v-if="selectedPreset?.description"
          :title="providerDescription(selectedPreset.provider)"
          type="info"
          :closable="false"
          show-icon
        />
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{
          t("llmConfigPage.button.cancel")
        }}</el-button>
        <el-button :loading="testing" @click="testCurrent">{{
          t("llmConfigPage.button.test")
        }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{
          t("llmConfigPage.button.save")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.api-key-controls {
  width: 100%;
  margin-top: 6px;
}

.form-hint {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}
</style>
