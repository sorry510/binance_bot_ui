<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  getAgentObservabilityChanges,
  getAgentObservabilitySummary,
  getAgentObservabilityTraces,
  type AgentChangeEvent,
  type AgentObservationTrace,
  type AgentObservabilitySummary
} from "@/api/agent";

defineOptions({ name: "AgentObservability" });
const { t } = useI18n();
const loading = ref(false);
const traceLoading = ref(false);
const changeLoading = ref(false);
const period = ref("24h");
const summary = ref<AgentObservabilitySummary | null>(null);
const traces = ref<AgentObservationTrace[]>([]);
const changes = ref<AgentChangeEvent[]>([]);
const traceTotal = ref(0);
const changeTotal = ref(0);
const traceQuery = reactive({
  task_id: "",
  skill: "",
  type: "",
  status: "",
  tool_source: "",
  page: 1,
  limit: 20
});
const changeQuery = reactive({
  category: "",
  change_type: "",
  status: "",
  page: 1,
  limit: 20
});

const windowParams = computed(() => {
  const now = Date.now();
  const hours =
    period.value === "30d" ? 24 * 30 : period.value === "7d" ? 24 * 7 : 24;
  return { start_time: now - hours * 3600 * 1000, end_time: now };
});
function rate(value?: number) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}
function number(value?: number) {
  return Number(value || 0).toLocaleString();
}
function duration(value?: number) {
  return `${Math.round(Number(value || 0))} ms`;
}
function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}…` : "-";
}
function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

async function fetchSummary() {
  loading.value = true;
  try {
    const res = await getAgentObservabilitySummary(windowParams.value);
    summary.value = (res?.data || null) as AgentObservabilitySummary | null;
  } finally {
    loading.value = false;
  }
}
async function fetchTraces() {
  traceLoading.value = true;
  try {
    const res = await getAgentObservabilityTraces({
      ...traceQuery,
      ...windowParams.value
    });
    traces.value = (res?.data?.list || []) as AgentObservationTrace[];
    traceTotal.value = Number(res?.data?.total || 0);
  } finally {
    traceLoading.value = false;
  }
}
async function fetchChanges() {
  changeLoading.value = true;
  try {
    const res = await getAgentObservabilityChanges({
      ...changeQuery,
      ...windowParams.value
    });
    changes.value = (res?.data?.list || []) as AgentChangeEvent[];
    changeTotal.value = Number(res?.data?.total || 0);
  } finally {
    changeLoading.value = false;
  }
}
async function refreshAll() {
  await Promise.all([fetchSummary(), fetchTraces(), fetchChanges()]);
}
function changePeriod() {
  traceQuery.page = 1;
  changeQuery.page = 1;
  refreshAll();
}
function searchTraces() {
  traceQuery.page = 1;
  fetchTraces();
}
function searchChanges() {
  changeQuery.page = 1;
  fetchChanges();
}
onMounted(refreshAll);
</script>

<template>
  <div class="p-4 observability-page">
    <el-card shadow="never" class="mb-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">
            {{ t("agentObservabilityPage.title") }}
          </div>
          <div class="text-sm text-gray-500">
            {{ t("agentObservabilityPage.subtitle") }}
          </div>
        </div>
        <div class="flex gap-2">
          <el-select
            v-model="period"
            style="width: 120px"
            @change="changePeriod"
          >
            <el-option label="24h" value="24h" />
            <el-option label="7d" value="7d" />
            <el-option label="30d" value="30d" />
          </el-select>
          <el-button @click="refreshAll">{{
            t("agentObservabilityPage.button.refresh")
          }}</el-button>
        </div>
      </div>
    </el-card>

    <el-row v-loading="loading" :gutter="12" class="mb-4">
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.tasks") }}
          </div>
          <div class="metric-value">
            {{ number(summary?.global?.tasks) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.successRate") }}
          </div>
          <div class="metric-value">
            {{ rate(summary?.global?.success_rate) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.tokens") }}
          </div>
          <div class="metric-value">
            {{ number(summary?.global?.total_tokens) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">P95</div>
          <div class="metric-value">
            {{ duration(summary?.global?.p95_duration_ms) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.contextTokens") }}
          </div>
          <div class="metric-value">
            {{ number(summary?.context?.average_tokens) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.memoryHit") }}
          </div>
          <div class="metric-value">
            {{ rate(summary?.context?.memory_hit_rate) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.evalScore") }}
          </div>
          <div class="metric-value">
            {{ Number(summary?.eval?.average_score || 0).toFixed(1) }}
          </div></el-card
        ></el-col
      >
      <el-col :xs="12" :sm="6" :lg="3"
        ><el-card shadow="never"
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.changes") }}
          </div>
          <div class="metric-value">
            {{ number(summary?.change_events) }}
          </div></el-card
        ></el-col
      >
    </el-row>

    <el-tabs>
      <el-tab-pane :label="t('agentObservabilityPage.tab.overview')">
        <el-row :gutter="12">
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="mb-4">
              <template #header>{{
                t("agentObservabilityPage.section.skill")
              }}</template>
              <el-table :data="summary?.by_skill || []" size="small">
                <el-table-column
                  prop="label"
                  :label="t('agentObservabilityPage.table.dimension')"
                  min-width="160"
                />
                <el-table-column
                  prop="tasks"
                  :label="t('agentObservabilityPage.metric.tasks')"
                  width="80"
                />
                <el-table-column
                  :label="t('agentObservabilityPage.metric.successRate')"
                  width="110"
                  ><template #default="{ row }">{{
                    rate(row.success_rate)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('agentObservabilityPage.metric.tokens')"
                  width="110"
                  ><template #default="{ row }">{{
                    number(row.total_tokens)
                  }}</template></el-table-column
                >
                <el-table-column label="P95" width="100"
                  ><template #default="{ row }">{{
                    duration(row.p95_duration_ms)
                  }}</template></el-table-column
                >
              </el-table>
            </el-card>
          </el-col>
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="mb-4">
              <template #header>{{
                t("agentObservabilityPage.section.model")
              }}</template>
              <el-table :data="summary?.by_model || []" size="small">
                <el-table-column
                  prop="label"
                  :label="t('agentObservabilityPage.table.dimension')"
                  min-width="220"
                />
                <el-table-column
                  prop="tasks"
                  :label="t('agentObservabilityPage.metric.tasks')"
                  width="80"
                />
                <el-table-column
                  :label="t('agentObservabilityPage.metric.successRate')"
                  width="110"
                  ><template #default="{ row }">{{
                    rate(row.success_rate)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('agentObservabilityPage.metric.tokens')"
                  width="110"
                  ><template #default="{ row }">{{
                    number(row.total_tokens)
                  }}</template></el-table-column
                >
              </el-table>
            </el-card>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="mb-4">
              <template #header>{{
                t("agentObservabilityPage.section.prompt")
              }}</template>
              <el-table :data="summary?.by_prompt || []" size="small">
                <el-table-column
                  prop="label"
                  :label="t('agentObservabilityPage.table.dimension')"
                  min-width="170"
                />
                <el-table-column
                  prop="tasks"
                  :label="t('agentObservabilityPage.metric.tasks')"
                  width="80"
                />
                <el-table-column
                  :label="t('agentObservabilityPage.metric.successRate')"
                  width="110"
                  ><template #default="{ row }">{{
                    rate(row.success_rate)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('agentObservabilityPage.metric.tokens')"
                  width="110"
                  ><template #default="{ row }">{{
                    number(row.total_tokens)
                  }}</template></el-table-column
                >
              </el-table>
            </el-card>
          </el-col>
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="mb-4">
              <template #header>{{
                t("agentObservabilityPage.section.revision")
              }}</template>
              <el-table :data="summary?.by_skill_revision || []" size="small">
                <el-table-column
                  prop="label"
                  :label="t('agentObservabilityPage.table.dimension')"
                  min-width="180"
                />
                <el-table-column
                  prop="tasks"
                  :label="t('agentObservabilityPage.metric.tasks')"
                  width="80"
                />
                <el-table-column
                  :label="t('agentObservabilityPage.metric.successRate')"
                  width="110"
                  ><template #default="{ row }">{{
                    rate(row.success_rate)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('agentObservabilityPage.metric.tokens')"
                  width="110"
                  ><template #default="{ row }">{{
                    number(row.total_tokens)
                  }}</template></el-table-column
                >
              </el-table>
            </el-card>
          </el-col>
        </el-row>
        <el-card shadow="never" class="mb-4">
          <template #header>{{
            t("agentObservabilityPage.section.quality")
          }}</template>
          <el-descriptions :column="4" border size="small">
            <el-descriptions-item
              :label="t('agentObservabilityPage.metric.contextTrim')"
              >{{ rate(summary?.context?.trim_rate) }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('agentObservabilityPage.metric.evidenceCoverage')"
              >{{
                rate(summary?.evidence?.coverage_rate)
              }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('agentObservabilityPage.metric.evalPass')"
              >{{ rate(summary?.eval?.pass_rate) }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('agentObservabilityPage.metric.repairs')"
              >{{
                number(
                  (summary?.repairs || []).reduce((n, x) => n + x.count, 0)
                )
              }}</el-descriptions-item
            >
          </el-descriptions>
          <div class="mt-3 flex flex-wrap gap-2">
            <el-tag
              v-for="item in summary?.repairs || []"
              :key="`repair-${item.name}`"
              type="warning"
              effect="plain"
              >repair: {{ item.name }} × {{ item.count }}</el-tag
            >
            <el-tag
              v-for="item in summary?.errors || []"
              :key="`error-${item.name}`"
              type="danger"
              effect="plain"
              >error: {{ item.name }} × {{ item.count }}</el-tag
            >
          </div>
        </el-card>
        <el-card shadow="never" class="mb-4">
          <template #header>{{
            t("agentObservabilityPage.section.tools")
          }}</template>
          <el-table :data="summary?.tools || []" size="small">
            <el-table-column
              prop="tool"
              :label="t('agentObservabilityPage.table.tool')"
              min-width="210"
            />
            <el-table-column
              prop="source"
              :label="t('agentObservabilityPage.table.source')"
              width="90"
            />
            <el-table-column
              prop="calls"
              :label="t('agentObservabilityPage.table.calls')"
              width="80"
            />
            <el-table-column
              :label="t('agentObservabilityPage.table.errorRate')"
              width="100"
              ><template #default="{ row }">{{
                rate(row.error_rate)
              }}</template></el-table-column
            >
            <el-table-column
              :label="t('agentObservabilityPage.table.cacheRate')"
              width="100"
              ><template #default="{ row }">{{
                rate(row.cache_hit_rate)
              }}</template></el-table-column
            >
            <el-table-column
              :label="t('agentObservabilityPage.table.partialRate')"
              width="100"
              ><template #default="{ row }">{{
                rate(row.partial_rate)
              }}</template></el-table-column
            >
            <el-table-column
              prop="timeouts"
              :label="t('agentObservabilityPage.table.timeouts')"
              width="90"
            />
            <el-table-column label="P95" width="100"
              ><template #default="{ row }">{{
                duration(row.p95_latency_ms)
              }}</template></el-table-column
            >
          </el-table>
        </el-card>
        <el-card shadow="never">
          <template #header>{{
            t("agentObservabilityPage.section.mcp")
          }}</template>
          <el-table :data="summary?.mcp_servers || []" size="small">
            <el-table-column
              prop="name"
              :label="t('agentObservabilityPage.table.server')"
              min-width="150"
            />
            <el-table-column
              prop="status"
              :label="t('agentObservabilityPage.table.status')"
              width="110"
            />
            <el-table-column
              prop="protocol_version"
              :label="t('agentObservabilityPage.table.protocol')"
              width="130"
            />
            <el-table-column
              :label="t('agentObservabilityPage.table.availability')"
              width="110"
              ><template #default="{ row }">{{
                row.calls ? rate(row.availability) : "-"
              }}</template></el-table-column
            >
            <el-table-column
              prop="calls"
              :label="t('agentObservabilityPage.table.calls')"
              width="80"
            />
            <el-table-column label="P95" width="100"
              ><template #default="{ row }">{{
                duration(row.p95_latency_ms)
              }}</template></el-table-column
            >
            <el-table-column
              :label="t('agentObservabilityPage.table.catalog')"
              min-width="150"
              ><template #default="{ row }">{{
                shortHash(row.catalog_hash)
              }}</template></el-table-column
            >
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('agentObservabilityPage.tab.traces')">
        <el-card shadow="never">
          <div class="mb-3 flex flex-wrap gap-2">
            <el-input
              v-model="traceQuery.task_id"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.task')"
              style="width: 220px"
            />
            <el-input
              v-model="traceQuery.skill"
              clearable
              placeholder="Skill"
              style="width: 160px"
            />
            <el-select
              v-model="traceQuery.type"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.type')"
              style="width: 160px"
              ><el-option
                v-for="x in [
                  'task_started',
                  'context_build',
                  'llm_call',
                  'tool_call',
                  'validation',
                  'repair',
                  'task_finished',
                  'eval'
                ]"
                :key="x"
                :label="x"
                :value="x"
            /></el-select>
            <el-select
              v-model="traceQuery.tool_source"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.source')"
              style="width: 130px"
              ><el-option label="native" value="native" /><el-option
                label="mcp"
                value="mcp"
            /></el-select>
            <el-button type="primary" @click="searchTraces">{{
              t("agentObservabilityPage.button.search")
            }}</el-button>
          </div>
          <el-table v-loading="traceLoading" :data="traces" size="small">
            <el-table-column type="expand"
              ><template #default="{ row }">
                <pre class="json-box">{{ pretty(row) }}</pre>
              </template></el-table-column
            >
            <el-table-column
              :label="t('agentObservabilityPage.table.time')"
              width="170"
              ><template #default="{ row }">{{
                formatTime(row.created_at)
              }}</template></el-table-column
            >
            <el-table-column prop="task_id" label="Task ID" min-width="210" />
            <el-table-column
              prop="team_role"
              :label="t('agentObservabilityPage.table.teamRole')"
              min-width="145"
            />
            <el-table-column
              prop="team_run_id"
              :label="t('agentObservabilityPage.table.teamRun')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              prop="type"
              :label="t('agentObservabilityPage.placeholder.type')"
              width="125"
            />
            <el-table-column prop="step_id" label="Step" width="100" />
            <el-table-column prop="skill" label="Skill" min-width="140" />
            <el-table-column
              prop="tool"
              :label="t('agentObservabilityPage.table.tool')"
              min-width="170"
            />
            <el-table-column
              prop="tool_source"
              :label="t('agentObservabilityPage.table.source')"
              width="90"
            />
            <el-table-column
              prop="status"
              :label="t('agentObservabilityPage.table.status')"
              width="100"
            />
            <el-table-column
              prop="error_type"
              :label="t('agentObservabilityPage.table.error')"
              min-width="130"
            />
            <el-table-column
              :label="t('agentObservabilityPage.table.tokens')"
              width="90"
            >
              <template #default="{ row }">{{
                row.total_tokens || 0
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('agentObservabilityPage.table.duration')"
              width="100"
              ><template #default="{ row }">{{
                duration(row.duration_ms)
              }}</template></el-table-column
            >
          </el-table>
          <el-pagination
            v-model:current-page="traceQuery.page"
            class="mt-3 justify-end"
            background
            layout="total, prev, pager, next"
            :total="traceTotal"
            :page-size="traceQuery.limit"
            @current-change="fetchTraces"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('agentObservabilityPage.tab.changes')">
        <el-card shadow="never">
          <div class="mb-3 flex flex-wrap gap-2">
            <el-select
              v-model="changeQuery.category"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.category')"
              style="width: 140px"
              ><el-option label="MCP" value="mcp" /><el-option
                label="Skill"
                value="skill"
            /></el-select>
            <el-input
              v-model="changeQuery.change_type"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.changeType')"
              style="width: 190px"
            />
            <el-button type="primary" @click="searchChanges">{{
              t("agentObservabilityPage.button.search")
            }}</el-button>
          </div>
          <el-table v-loading="changeLoading" :data="changes" size="small">
            <el-table-column type="expand"
              ><template #default="{ row }">
                <pre class="json-box">{{ row.detail_json || "{}" }}</pre>
              </template></el-table-column
            >
            <el-table-column
              :label="t('agentObservabilityPage.table.time')"
              width="170"
              ><template #default="{ row }">{{
                formatTime(row.created_at)
              }}</template></el-table-column
            >
            <el-table-column
              prop="category"
              :label="t('agentObservabilityPage.placeholder.category')"
              width="90"
            />
            <el-table-column
              prop="entity_type"
              :label="t('agentObservabilityPage.table.entityType')"
              width="130"
            />
            <el-table-column
              prop="entity_name"
              :label="t('agentObservabilityPage.table.entity')"
              min-width="170"
            />
            <el-table-column
              prop="change_type"
              :label="t('agentObservabilityPage.placeholder.changeType')"
              min-width="160"
            />
            <el-table-column
              prop="from_version"
              :label="t('agentObservabilityPage.table.from')"
              width="120"
            />
            <el-table-column
              prop="to_version"
              :label="t('agentObservabilityPage.table.to')"
              width="120"
            />
            <el-table-column
              prop="status"
              :label="t('agentObservabilityPage.table.status')"
              width="110"
            />
          </el-table>
          <el-pagination
            v-model:current-page="changeQuery.page"
            class="mt-3 justify-end"
            background
            layout="total, prev, pager, next"
            :total="changeTotal"
            :page-size="changeQuery.limit"
            @current-change="fetchChanges"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.metric-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.metric-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 600;
}

.json-box {
  max-height: 360px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
