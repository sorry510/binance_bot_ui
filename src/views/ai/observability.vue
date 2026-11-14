<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  getAgentObservabilitySummary,
  getAgentObservabilityTraces,
  type AgentObservationTrace,
  type AgentObservabilitySummary
} from "@/api/agent";
import {
  getBinanceAPIUsage,
  getSystemHealth,
  type BinanceAPIUsageSnapshot,
  type HealthStatus,
  type SystemHealthCheck,
  type SystemHealthReport
} from "@/api/system";

defineOptions({ name: "SystemDashboard" });
const { t, te, locale } = useI18n();
const loading = ref(false);
const healthLoading = ref(false);
const health = ref<SystemHealthReport | null>(null);
const binanceUsageLoading = ref(false);
const binanceUsage = ref<BinanceAPIUsageSnapshot | null>(null);
let binanceUsageRefreshTimer: number | undefined;
let healthRefreshTimer: number | undefined;
const traceLoading = ref(false);
const period = ref("24h");
const summary = ref<AgentObservabilitySummary | null>(null);
const traces = ref<AgentObservationTrace[]>([]);
const traceTotal = ref(0);
const traceQuery = reactive({
  task_id: "",
  skill: "",
  type: "",
  status: "",
  tool_source: "",
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
  return (
    String(Math.round(Number(value || 0))) +
    " " +
    t("agentObservabilityPage.labels.durationMs")
  );
}
function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString(locale.value) : "-";
}
function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}
function healthTagType(status?: HealthStatus | string) {
  if (status === "healthy") return "success";
  if (status === "warning" || status === "unknown") return "warning";
  if (status === "error") return "danger";
  return "info";
}
function healthStatusLabel(status?: string) {
  const key = `systemDashboard.health.status.${status || "unknown"}`;
  const translated = t(key);
  return translated === key
    ? displayValue("agentObservabilityPage.values", status || "unknown")
    : translated;
}
// Translate display values without altering API identifiers, filters or raw diagnostic JSON.
function displayValue(group: string, value?: string | null) {
  if (!value) return "-";
  const key = group + "." + value;
  return te(key) ? t(key) : value;
}
function healthAge(age: string) {
  let m = age.match(/^(\d+)h(\d+)m$/);
  if (m)
    return t("systemDashboard.health.messages.ageHoursMinutes", {
      hours: m[1],
      minutes: m[2]
    });
  m = age.match(/^(\d+)m$/);
  if (m)
    return t("systemDashboard.health.messages.ageMinutes", { count: m[1] });
  m = age.match(/^(\d+)s$/);
  if (m)
    return t("systemDashboard.health.messages.ageSeconds", { count: m[1] });
  return age;
}
function translatedHealthMessage(message?: string) {
  const raw = (message || "").trim();
  if (!raw) return "-";
  const group = "systemDashboard.health.messages";
  let m: RegExpMatchArray | null;
  if ((m = raw.match(/^schema v(\d+) is older than required v(\d+)$/)))
    return t(group + ".schemaOutdated", { version: m[1], required: m[2] });
  if ((m = raw.match(/^schema v(\d+)$/)))
    return t(group + ".schema", { version: m[1] });
  if ((m = raw.match(/^Binance REST HTTP (\d+)$/)))
    return t(group + ".restCode", { code: m[1] });
  if ((m = raw.match(/^reachable in (\d+) ms$/)))
    return t(group + ".reachable", { duration: m[1] });
  if ((m = raw.match(/^last market update (\S+) ago$/)))
    return t(group + ".lastMarketUpdate", { age: healthAge(m[1]) });
  if (
    (m = raw.match(/^(\d+) healthy, (\d+) error, (\d+) other market sources$/))
  )
    return t(group + ".sourceCounts", {
      healthy: m[1],
      errors: m[2],
      other: m[3]
    });
  if ((m = raw.match(/^(\d+) healthy, (\d+) non-healthy market sources$/)))
    return t(group + ".sourceNonHealthy", { healthy: m[1], other: m[2] });
  if ((m = raw.match(/^(\d+) sources healthy$/)))
    return t(group + ".sourcesHealthy", { count: m[1] });
  if ((m = raw.match(/^(\d+)\/(\d+) MCP servers are not healthy$/)))
    return t(group + ".mcpNotHealthy", { bad: m[1], total: m[2] });
  if ((m = raw.match(/^(\d+) MCP servers healthy$/)))
    return t(group + ".mcpHealthy", { count: m[1] });
  if ((m = raw.match(/^(\d+) routing candidates; (\d+) LLM failures in 24h$/)))
    return t(group + ".llmCandidatesFailures", { count: m[1], failures: m[2] });
  if ((m = raw.match(/^(\d+) routing candidates$/)))
    return t(group + ".llmCandidates", { count: m[1] });
  const counters: Array<[RegExp, string]> = [
    [/^(\d+) scheduler jobs report errors$/, "jobsErrors"],
    [/^(\d+) scheduler jobs enabled$/, "jobsEnabled"],
    [
      /^(\d+) scheduler jobs need attention \(database freshness check\)$/,
      "jobsNeedAttention"
    ],
    [/^(\d+) scheduler jobs have recent task results$/, "jobsRecent"],
    [/^(\d+) tasks in 24h$/, "agentTasks"],
    [/^(\d+) protection failures need review$/, "protectionFailures"]
  ];
  for (const [pattern, name] of counters) {
    m = raw.match(pattern);
    if (m) return t(group + "." + name, { count: m[1] });
  }
  if ((m = raw.match(/^(\d+)\/(\d+) tasks failed in 24h$/)))
    return t(group + ".agentFailures", { failed: m[1], total: m[2] });
  if (
    (m = raw.match(
      /^execution_uncertain=(\d+) reconcile_required=(\d+) protection_failed=(\d+)$/
    ))
  )
    return t(group + ".tradeCounters", {
      uncertain: m[1],
      reconcile: m[2],
      protection: m[3]
    });
  if (/^read trade safety .* count failed$/.test(raw))
    return t(group + ".tradeReadFailed");
  return displayValue(group, raw);
}
function healthMessage(check?: SystemHealthCheck) {
  if (!check) return "-";
  return translatedHealthMessage(check.message || check.last_error);
}

function apiUsagePercent(value?: number) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}
function apiUsageStatus(value?: number): "success" | "warning" | "exception" {
  const percent = Number(value || 0);
  if (percent >= 90) return "exception";
  if (percent >= 75) return "warning";
  return "success";
}
function apiEndpointLabel(row: { method?: string; path?: string }) {
  return `${row.method || ""} ${row.path || ""}`.trim();
}
function budgetTagType(
  level?: string
): "success" | "warning" | "danger" | "info" {
  if (level === "normal") return "success";
  if (level === "warning") return "warning";
  if (level === "critical" || level === "exchange_throttled") return "danger";
  return "info";
}
function budgetLevelLabel(level?: string) {
  const key = `systemDashboard.binanceApi.budgetLevel.${level || "unknown"}`;
  const translated = t(key);
  return translated === key ? level || "unknown" : translated;
}
async function fetchHealth() {
  if (healthLoading.value) return;
  healthLoading.value = true;
  try {
    const res = await getSystemHealth();
    health.value = (res?.data || null) as SystemHealthReport | null;
  } finally {
    healthLoading.value = false;
  }
}

async function fetchBinanceUsage() {
  if (binanceUsageLoading.value) return;
  binanceUsageLoading.value = true;
  try {
    const res = await getBinanceAPIUsage();
    // Keep the previous successful snapshot if the API returns no usable data.
    if (res?.code === 200 && res?.data) {
      binanceUsage.value = res.data as BinanceAPIUsageSnapshot;
    }
  } catch {
    // Polling is silent: preserve the last snapshot and retry on the next tick.
  } finally {
    binanceUsageLoading.value = false;
  }
}

function startBinanceUsageAutoRefresh() {
  if (binanceUsageRefreshTimer) window.clearInterval(binanceUsageRefreshTimer);
  binanceUsageRefreshTimer = window.setInterval(fetchBinanceUsage, 1000);
}
function startHealthAutoRefresh() {
  if (healthRefreshTimer) window.clearInterval(healthRefreshTimer);
  healthRefreshTimer = window.setInterval(fetchHealth, 60000);
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
async function refreshAll() {
  await Promise.all([
    fetchHealth(),
    fetchBinanceUsage(),
    fetchSummary(),
    fetchTraces()
  ]);
}
function changePeriod() {
  traceQuery.page = 1;
  void Promise.all([fetchSummary(), fetchTraces()]);
}
function searchTraces() {
  traceQuery.page = 1;
  fetchTraces();
}
onMounted(() => {
  refreshAll();
  startBinanceUsageAutoRefresh();
  startHealthAutoRefresh();
});

onBeforeUnmount(() => {
  if (healthRefreshTimer) window.clearInterval(healthRefreshTimer);
  if (binanceUsageRefreshTimer) {
    window.clearInterval(binanceUsageRefreshTimer);
    binanceUsageRefreshTimer = undefined;
  }
});
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
            <el-option
              :label="t('agentObservabilityPage.period.hours24')"
              value="24h"
            />
            <el-option
              :label="t('agentObservabilityPage.period.days7')"
              value="7d"
            />
            <el-option
              :label="t('agentObservabilityPage.period.days30')"
              value="30d"
            />
          </el-select>
          <el-button @click="refreshAll">{{
            t("agentObservabilityPage.button.refresh")
          }}</el-button>
        </div>
      </div>
    </el-card>

    <el-card v-loading="healthLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-medium">
              {{ t("systemDashboard.health.title") }}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              {{ t("systemDashboard.health.subtitle") }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{
              formatTime(health?.generated_at)
            }}</span>
            <el-tag :type="healthTagType(health?.overall)">
              {{ healthStatusLabel(health?.overall) }}
            </el-tag>
          </div>
        </div>
      </template>

      <div class="health-grid">
        <div
          v-for="item in [
            { key: 'database', check: health?.database },
            { key: 'binanceRest', check: health?.binance_rest },
            { key: 'marketWs', check: health?.market_ws || health?.futures_ws },
            { key: 'llm', check: health?.llm },
            { key: 'agent', check: health?.agent },
            { key: 'trade', check: health?.trade }
          ]"
          :key="item.key"
          class="health-item"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="health-name">{{
              t(`systemDashboard.health.component.${item.key}`)
            }}</span>
            <el-tag size="small" :type="healthTagType(item.check?.status)">
              {{ healthStatusLabel(item.check?.status) }}
            </el-tag>
          </div>
          <div
            class="health-message"
            :title="item.check?.last_error || item.check?.message"
          >
            {{ healthMessage(item.check) }}
          </div>
        </div>
      </div>

      <el-collapse class="mt-4">
        <el-collapse-item
          :title="t('systemDashboard.health.wsDetails')"
          name="ws"
        >
          <el-table :data="health?.ws_markets || []" size="small">
            <el-table-column
              :label="t('systemDashboard.health.market')"
              min-width="150"
            >
              <template #default="{ row }">{{
                displayValue(
                  "systemDashboard.health.wsMarketValues",
                  row.market
                )
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.health.state')"
              min-width="130"
            >
              <template #default="{ row }">
                <el-tag :type="healthTagType(row.status)" size="small">{{
                  healthStatusLabel(row.status)
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.health.lastSuccess')"
              min-width="175"
            >
              <template #default="{ row }">{{
                formatTime(row.last_update_at)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.health.details')"
              min-width="190"
            >
              <template #default="{ row }">{{ healthMessage(row) }}</template>
            </el-table-column>
          </el-table>
        </el-collapse-item>
        <el-collapse-item
          :title="t('systemDashboard.health.moreDetails')"
          name="other"
        >
          <el-descriptions :column="4" border size="small" class="mb-4">
            <el-descriptions-item
              v-for="item in [
                { key: 'announcementWs', check: health?.announcement_ws },
                {
                  key: 'marketIntelligence',
                  check: health?.market_intelligence
                },
                { key: 'mcp', check: health?.mcp },
                { key: 'scheduler', check: health?.scheduler }
              ]"
              :key="item.key"
              :label="t('systemDashboard.health.component.' + item.key)"
            >
              <el-tag size="small" :type="healthTagType(item.check?.status)">
                {{ healthStatusLabel(item.check?.status) }}
              </el-tag>
              <div class="health-message">{{ healthMessage(item.check) }}</div>
            </el-descriptions-item>
          </el-descriptions>

          <el-row :gutter="12" class="mt-4">
            <el-col :xs="24" :lg="8">
              <div class="health-detail-title">
                {{ t("systemDashboard.health.marketSources") }}
              </div>
              <el-table
                :data="health?.market_sources || []"
                size="small"
                max-height="260"
              >
                <el-table-column
                  :label="t('systemDashboard.health.name')"
                  min-width="150"
                  ><template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.health.sourceValues",
                      row.source
                    )
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('systemDashboard.health.state')"
                  width="100"
                >
                  <template #default="{ row }">
                    <el-tag size="small" :type="healthTagType(row.status)">{{
                      healthStatusLabel(row.status)
                    }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.health.lastSuccess')"
                  min-width="170"
                >
                  <template #default="{ row }">{{
                    formatTime(row.last_success_at)
                  }}</template>
                </el-table-column>
              </el-table>
            </el-col>
            <el-col :xs="24" :lg="8">
              <div class="health-detail-title">
                {{ t("systemDashboard.health.mcpServers") }}
              </div>
              <el-table
                :data="health?.mcp_servers || []"
                size="small"
                max-height="260"
              >
                <el-table-column
                  prop="name"
                  :label="t('systemDashboard.health.name')"
                  min-width="150"
                />
                <el-table-column
                  :label="t('systemDashboard.health.state')"
                  width="100"
                >
                  <template #default="{ row }">
                    <el-tag size="small" :type="healthTagType(row.status)">{{
                      healthStatusLabel(row.status)
                    }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.health.lastSuccess')"
                  min-width="170"
                >
                  <template #default="{ row }">{{
                    formatTime(row.last_success_at)
                  }}</template>
                </el-table-column>
              </el-table>
            </el-col>
            <el-col :xs="24" :lg="8">
              <div class="health-detail-title">
                {{ t("systemDashboard.health.schedulerJobs") }}
              </div>
              <el-table
                :data="health?.scheduler_jobs || []"
                size="small"
                max-height="260"
              >
                <el-table-column
                  :label="t('systemDashboard.health.name')"
                  min-width="170"
                  ><template #default="{ row }">{{
                    displayValue("systemDashboard.health.jobValues", row.name)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('systemDashboard.health.state')"
                  width="110"
                >
                  <template #default="{ row }">
                    <el-tag
                      size="small"
                      :type="
                        row.enabled
                          ? healthTagType(
                              row.last_status === 'failed'
                                ? 'warning'
                                : 'healthy'
                            )
                          : 'info'
                      "
                    >
                      {{
                        row.enabled
                          ? row.running
                            ? t("systemDashboard.health.running")
                            : row.last_status
                              ? displayValue(
                                  "agentObservabilityPage.values",
                                  row.last_status
                                )
                              : t("systemDashboard.health.enabled")
                          : t("systemDashboard.health.status.disabled")
                      }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.health.lastRun')"
                  min-width="170"
                >
                  <template #default="{ row }">{{
                    formatTime(row.last_run_at)
                  }}</template>
                </el-table-column>
              </el-table>
            </el-col>
          </el-row>
        </el-collapse-item>
      </el-collapse>

      <el-descriptions
        v-if="health?.trade"
        :column="3"
        border
        size="small"
        class="mt-4"
      >
        <el-descriptions-item
          :label="t('systemDashboard.health.tradeCounts.executionUncertain')"
          >{{ health.trade.execution_uncertain }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('systemDashboard.health.tradeCounts.protectionFailed')"
          >{{ health.trade.protection_failed }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('systemDashboard.health.tradeCounts.reconcileRequired')"
          >{{ health.trade.reconcile_required }}</el-descriptions-item
        >
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-medium">
              {{ t("systemDashboard.binanceApi.title") }}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              {{ t("systemDashboard.binanceApi.subtitle") }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{
              formatTime(binanceUsage?.generated_at)
            }}</span>
            <el-button size="small" @click="fetchBinanceUsage">
              {{ t("agentObservabilityPage.button.refresh") }}
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="binanceUsage?.truncated"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        :title="
          t('systemDashboard.binanceApi.truncated', {
            count: number(binanceUsage?.dropped_events)
          })
        "
      />

      <el-row :gutter="12" class="mb-4">
        <el-col :xs="12" :sm="6"
          ><div class="api-usage-metric">
            <div class="metric-label">
              {{ t("systemDashboard.binanceApi.requests1m") }}
            </div>
            <div class="metric-value">
              {{ number(binanceUsage?.window_1m?.request_count) }}
            </div>
          </div></el-col
        >
        <el-col :xs="12" :sm="6"
          ><div class="api-usage-metric">
            <div class="metric-label">
              {{ t("systemDashboard.binanceApi.estimatedWeight1m") }}
            </div>
            <div class="metric-value">
              {{ number(binanceUsage?.window_1m?.estimated_weight) }}
            </div>
          </div></el-col
        >
        <el-col :xs="12" :sm="6"
          ><div class="api-usage-metric">
            <div class="metric-label">
              {{ t("agentObservabilityPage.labels.p95") }}
            </div>
            <div class="metric-value">
              {{ duration(binanceUsage?.window_1m?.p95_latency_ms) }}
            </div>
          </div></el-col
        >
        <el-col :xs="12" :sm="6"
          ><div class="api-usage-metric">
            <div class="metric-label">
              {{ t("systemDashboard.binanceApi.rateLimited") }}
            </div>
            <div class="metric-value">
              {{ number(binanceUsage?.window_5m?.count_429) }} /
              {{ number(binanceUsage?.window_5m?.count_418) }}
            </div>
          </div></el-col
        >
      </el-row>

      <el-row :gutter="12" class="mb-4">
        <el-col :xs="24" :xl="24">
          <div class="health-detail-title">
            {{ t("systemDashboard.binanceApi.budgetState") }}
          </div>
          <el-table
            :data="binanceUsage?.budgets || []"
            size="small"
            max-height="300"
          >
            <el-table-column
              :label="t('systemDashboard.binanceApi.product')"
              width="90"
            >
              <template #default="{ row }">{{
                displayValue(
                  "systemDashboard.binanceApi.productValues",
                  row.product
                )
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.binanceApi.environment')"
              width="100"
            >
              <template #default="{ row }">{{
                displayValue(
                  "systemDashboard.binanceApi.environmentValues",
                  row.environment
                )
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.binanceApi.budgetLevelLabel')"
              width="130"
            >
              <template #default="{ row }">
                <el-tag size="small" :type="budgetTagType(row.level)">
                  {{ budgetLevelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.binanceApi.effectiveWeight')"
              min-width="220"
            >
              <template #default="{ row }">
                <div class="api-weight-cell">
                  <span>
                    {{ number(row.used_weight_1m) }} +
                    {{ number(row.pending_weight) }} /
                    {{ number(row.weight_limit_1m) }}
                    ({{ Number(row.effective_percent || 0).toFixed(1) }}%)
                  </span>
                  <el-progress
                    :percentage="apiUsagePercent(row.effective_percent)"
                    :status="apiUsageStatus(row.effective_percent)"
                    :show-text="false"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.binanceApi.orderBudget')"
              min-width="180"
            >
              <template #default="{ row }">
                {{ number(row.order_count_10s) }} /
                {{ number(row.order_limit_10s) }} ·
                {{ number(row.order_count_1m) }} /
                {{ number(row.order_limit_1m) }}
              </template>
            </el-table-column>
            <el-table-column
              :label="t('systemDashboard.binanceApi.throttleUntil')"
              min-width="170"
            >
              <template #default="{ row }">
                {{ formatTime(row.throttle_until) }}
              </template>
            </el-table-column>
          </el-table>
        </el-col>
      </el-row>

      <el-collapse>
        <el-collapse-item
          :title="t('systemDashboard.binanceApi.moreDetails')"
          name="api"
        >
          <el-descriptions :column="3" border size="small" class="mb-4">
            <el-descriptions-item
              :label="t('systemDashboard.binanceApi.timeUnit.10s')"
            >
              {{
                t("systemDashboard.binanceApi.requestWindow", {
                  duration: t("systemDashboard.binanceApi.timeUnit.10s"),
                  requests: number(binanceUsage?.window_10s?.request_count),
                  weight: number(binanceUsage?.window_10s?.estimated_weight)
                })
              }}
            </el-descriptions-item>
            >
            <el-descriptions-item
              :label="t('systemDashboard.binanceApi.timeUnit.1m')"
            >
              {{
                t("systemDashboard.binanceApi.requestWindow", {
                  duration: t("systemDashboard.binanceApi.timeUnit.1m"),
                  requests: number(binanceUsage?.window_1m?.request_count),
                  weight: number(binanceUsage?.window_1m?.estimated_weight)
                })
              }}
            </el-descriptions-item>
            >
            <el-descriptions-item
              :label="t('systemDashboard.binanceApi.timeUnit.5m')"
            >
              {{
                t("systemDashboard.binanceApi.requestWindow", {
                  duration: t("systemDashboard.binanceApi.timeUnit.5m"),
                  requests: number(binanceUsage?.window_5m?.request_count),
                  weight: number(binanceUsage?.window_5m?.estimated_weight)
                })
              }}
            </el-descriptions-item>
            >
            <el-descriptions-item
              :label="t('systemDashboard.binanceApi.retainedEvents')"
              >{{ number(binanceUsage?.retained_events) }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('systemDashboard.binanceApi.droppedEvents')"
              >{{ number(binanceUsage?.dropped_events) }}</el-descriptions-item
            >
          </el-descriptions>

          <el-row :gutter="12">
            <el-col :xs="24" :xl="24">
              <div class="health-detail-title">
                {{ t("systemDashboard.binanceApi.topByWeight") }}
              </div>
              <el-table
                :data="binanceUsage?.top_endpoints_by_weight || []"
                size="small"
                max-height="420"
                class="mb-4"
              >
                <el-table-column
                  :label="t('systemDashboard.binanceApi.endpoint')"
                  min-width="220"
                  ><template #default="{ row }">{{
                    apiEndpointLabel(row)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('systemDashboard.binanceApi.product')"
                  width="85"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.productValues",
                      row.product
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.binanceApi.source')"
                  width="110"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.sourceValues",
                      row.source
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.binanceApi.requestType')"
                  width="90"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.requestTypes",
                      row.request_type
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  prop="count"
                  :label="t('systemDashboard.binanceApi.count')"
                  width="80"
                />
                <el-table-column
                  prop="estimated_weight"
                  :label="t('systemDashboard.binanceApi.weight')"
                  width="90"
                />
                <el-table-column
                  :label="t('systemDashboard.binanceApi.p95')"
                  width="90"
                  ><template #default="{ row }">{{
                    duration(row.p95_latency_ms)
                  }}</template></el-table-column
                >
              </el-table>
            </el-col>
          </el-row>

          <el-row :gutter="12">
            <el-col :xs="24" :lg="8">
              <div class="health-detail-title">
                {{ t("systemDashboard.binanceApi.sources") }}
              </div>
              <el-table
                :data="binanceUsage?.sources_5m || []"
                size="small"
                max-height="300"
              >
                <el-table-column
                  :label="t('systemDashboard.binanceApi.source')"
                  min-width="130"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.sourceValues",
                      row.source
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  prop="count"
                  :label="t('systemDashboard.binanceApi.count')"
                  width="75"
                />
                <el-table-column
                  prop="estimated_weight"
                  :label="t('systemDashboard.binanceApi.weight')"
                  width="85"
                />
              </el-table>
            </el-col>
            <el-col :xs="24" :lg="16">
              <div class="health-detail-title">
                {{ t("systemDashboard.binanceApi.recentRateLimits") }}
              </div>
              <el-table
                :data="binanceUsage?.recent_rate_limits || []"
                size="small"
                max-height="300"
              >
                <el-table-column
                  :label="t('systemDashboard.binanceApi.time')"
                  width="170"
                  ><template #default="{ row }">{{
                    formatTime(row.at)
                  }}</template></el-table-column
                >
                <el-table-column
                  prop="status_code"
                  :label="t('systemDashboard.binanceApi.status')"
                  width="80"
                />
                <el-table-column
                  :label="t('systemDashboard.binanceApi.endpoint')"
                  min-width="210"
                  ><template #default="{ row }">{{
                    apiEndpointLabel(row)
                  }}</template></el-table-column
                >
                <el-table-column
                  :label="t('systemDashboard.binanceApi.environment')"
                  width="100"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.environmentValues",
                      row.environment
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  :label="t('systemDashboard.binanceApi.requestType')"
                  width="90"
                >
                  <template #default="{ row }">{{
                    displayValue(
                      "systemDashboard.binanceApi.requestTypes",
                      row.request_type
                    )
                  }}</template>
                </el-table-column>
                <el-table-column
                  prop="retry_after"
                  :label="t('systemDashboard.binanceApi.retryAfter')"
                  width="110"
                />
              </el-table>
            </el-col>
          </el-row>
        </el-collapse-item>
      </el-collapse>
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
          ><div class="metric-label">
            {{ t("agentObservabilityPage.metric.llmErrors") }}
          </div>
          <div class="metric-value">
            {{ number(summary?.llm_errors) }}
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
                <el-table-column
                  :label="t('agentObservabilityPage.labels.p95')"
                  width="100"
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
              :label="t('agentObservabilityPage.table.source')"
              width="90"
            >
              <template #default="{ row }">{{
                displayValue("agentObservabilityPage.values", row.source)
              }}</template>
            </el-table-column>
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
            <el-table-column
              :label="t('agentObservabilityPage.labels.p95')"
              width="100"
              ><template #default="{ row }">{{
                duration(row.p95_latency_ms)
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
              :placeholder="t('agentObservabilityPage.labels.skill')"
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
                :label="displayValue('agentObservabilityPage.traceType', x)"
                :value="x"
            /></el-select>
            <el-select
              v-model="traceQuery.tool_source"
              clearable
              :placeholder="t('agentObservabilityPage.placeholder.source')"
              style="width: 130px"
              ><el-option
                :label="t('agentObservabilityPage.labels.native')"
                value="native" />
              <el-option label="MCP" value="mcp"
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
            <el-table-column
              prop="task_id"
              :label="t('agentObservabilityPage.labels.taskId')"
              min-width="210"
            />
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
              :label="t('agentObservabilityPage.placeholder.type')"
              width="125"
            >
              <template #default="{ row }">{{
                displayValue("agentObservabilityPage.traceType", row.type)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="step_id"
              :label="t('agentObservabilityPage.labels.step')"
              width="100"
            />
            <el-table-column
              prop="skill"
              :label="t('agentObservabilityPage.labels.skill')"
              min-width="140"
            />
            <el-table-column
              prop="tool"
              :label="t('agentObservabilityPage.table.tool')"
              min-width="170"
            />
            <el-table-column
              :label="t('agentObservabilityPage.table.source')"
              width="90"
            >
              <template #default="{ row }">{{
                displayValue("agentObservabilityPage.values", row.tool_source)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('agentObservabilityPage.table.status')"
              width="100"
            >
              <template #default="{ row }">{{
                displayValue("agentObservabilityPage.values", row.status)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('agentObservabilityPage.table.error')"
              min-width="130"
            >
              <template #default="{ row }">{{
                displayValue("agentObservabilityPage.values", row.error_type)
              }}</template>
            </el-table-column>
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
    </el-tabs>
  </div>
</template>

<style scoped>
.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.health-item {
  min-width: 0;
  padding: 12px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.health-name {
  font-weight: 600;
}

.health-message {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}

.health-schema {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.health-detail-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.api-usage-metric {
  min-height: 76px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.api-weight-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

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
