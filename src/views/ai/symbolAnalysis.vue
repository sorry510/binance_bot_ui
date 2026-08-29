<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { getFeaturesOptions } from "../../api/trade";
import {
  getAgentTask,
  getSymbolAnalysisHistory,
  startAgentTask,
  type AgentTask,
  type SymbolAnalysisHistoryItem,
  type TradingPlanV1
} from "../../api/agent";

defineOptions({ name: "SymbolAnalysis" });

const { t } = useI18n();
const symbols = ref<string[]>([]);
const symbol = ref("");
const prompt = ref("");
const task = ref<AgentTask | null>(null);
const history = ref<SymbolAnalysisHistoryItem[]>([]);
const historyTotal = ref(0);
const historyLoading = ref(false);
const historyDetail = ref<SymbolAnalysisHistoryItem | null>(null);
const historyDialogVisible = ref(false);
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollFailures = 0;

const analysisRunning = computed(() =>
  ["queued", "running", "waiting_llm", "waiting_tool", "validating"].includes(
    task.value?.status || ""
  )
);
const plan = computed<TradingPlanV1 | null>(() => task.value?.result || null);
const events = computed(() => task.value?.events || []);

function taskStatusType(status?: string) {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "waiting_llm" || status === "waiting_tool") return "warning";
  return "primary";
}

function directionType(direction?: string) {
  if (direction === "long") return "success";
  if (direction === "short") return "danger";
  return "info";
}

function directionLabel(direction?: string) {
  return direction ? t(`symbolAnalysisPage.direction.${direction}`) : "-";
}

function formatTime(value?: string | number) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function stageLabel(stage?: string) {
  if (!stage) return "-";
  const key = `symbolAnalysisPage.stage.${stage}`;
  const translated = t(key);
  return translated === key ? stage : translated;
}

function marketConditionLabel(value?: number | null) {
  if (!value) return "-";
  return `${value} - ${t(`dashboard.market.${value}`)}`;
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return Number(value).toLocaleString(undefined, {
    maximumSignificantDigits: 10
  });
}

function formatPercent(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

async function fetchSymbols() {
  const res = await getFeaturesOptions();
  symbols.value = Array.isArray(res?.data) ? res.data : [];
  if (!symbol.value && symbols.value.length > 0) {
    symbol.value = symbols.value.includes("BTCUSDT")
      ? "BTCUSDT"
      : symbols.value[0];
    await fetchHistory();
  }
}

async function fetchHistory() {
  const value = symbol.value.trim().toUpperCase();
  if (!value) {
    history.value = [];
    historyTotal.value = 0;
    return;
  }
  historyLoading.value = true;
  try {
    const res = await getSymbolAnalysisHistory({
      symbol: value,
      page: 1,
      limit: 20
    });
    history.value = res?.data?.list || [];
    historyTotal.value = Number(res?.data?.total || 0);
  } catch {
    history.value = [];
    historyTotal.value = 0;
  } finally {
    historyLoading.value = false;
  }
}

async function startAnalysis() {
  const value = symbol.value.trim().toUpperCase();
  if (!value) {
    ElMessage.warning(t("symbolAnalysisPage.message.symbolRequired"));
    return;
  }
  symbol.value = value;
  clearPollTimer();
  try {
    const res = await startAgentTask({
      skill: "symbol_analysis",
      input: { symbol: value, prompt: prompt.value.trim() }
    });
    if (Number(res?.code) !== 200 || !res?.data?.id) {
      throw new Error(res?.msg || t("symbolAnalysisPage.message.startFailed"));
    }
    task.value = res.data as AgentTask;
    pollFailures = 0;
    schedulePoll(0);
  } catch (error) {
    const message =
      (error as any)?.response?.data?.msg ||
      (error as Error)?.message ||
      t("symbolAnalysisPage.message.startFailed");
    ElMessage.error(message);
  }
}

function schedulePoll(delay: number) {
  clearPollTimer();
  pollTimer = setTimeout(() => void pollTask(), delay);
}

async function pollTask() {
  const taskId = task.value?.id;
  if (!taskId) return;
  try {
    const res = await getAgentTask(taskId);
    if (Number(res?.code) !== 200 || !res?.data) {
      throw new Error(
        res?.msg || t("symbolAnalysisPage.message.progressFailed")
      );
    }
    task.value = res.data as AgentTask;
    pollFailures = 0;
    if (task.value.status === "succeeded") {
      ElMessage.success(t("symbolAnalysisPage.message.completed"));
      await fetchHistory();
      return;
    }
    if (["failed", "cancelled"].includes(task.value.status)) {
      ElMessage.error(
        task.value.error || t("symbolAnalysisPage.message.failed")
      );
      await fetchHistory();
      return;
    }
    schedulePoll(1000);
  } catch {
    pollFailures++;
    if (pollFailures < 3) {
      schedulePoll(1500);
      return;
    }
    ElMessage.error(t("symbolAnalysisPage.message.progressFailed"));
  }
}

function clearPollTimer() {
  if (pollTimer !== undefined) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

function openHistory(row: SymbolAnalysisHistoryItem) {
  historyDetail.value = row;
  historyDialogVisible.value = true;
}

onMounted(async () => {
  await fetchSymbols();
});

onBeforeUnmount(() => clearPollTimer());
</script>

<template>
  <div class="symbol-analysis-page p-4">
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="section-title">{{ t("symbolAnalysisPage.title") }}</div>
      </template>
      <div class="analysis-form">
        <el-select
          v-model="symbol"
          filterable
          allow-create
          default-first-option
          class="symbol-select"
          :placeholder="t('symbolAnalysisPage.placeholder.symbol')"
          @change="fetchHistory"
        >
          <el-option
            v-for="item in symbols"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-input
          v-model="prompt"
          type="textarea"
          :rows="2"
          class="prompt-input"
          :placeholder="t('symbolAnalysisPage.placeholder.prompt')"
        />
        <el-button
          type="primary"
          :loading="analysisRunning"
          :disabled="analysisRunning"
          @click="startAnalysis"
        >
          {{ t("symbolAnalysisPage.button.analyze") }}
        </el-button>
      </div>
      <div class="form-hint">
        {{ t("symbolAnalysisPage.hint.historyCompare") }}
      </div>
    </el-card>

    <el-card v-if="task" shadow="never" class="section-card">
      <template #header>
        <div class="header-row">
          <span class="section-title">{{
            t("symbolAnalysisPage.process.title")
          }}</span>
          <div class="header-tags">
            <el-tag :type="taskStatusType(task.status)">
              {{ t(`symbolAnalysisPage.status.${task.status}`) }}
            </el-tag>
            <el-tag v-if="task.provider" type="info">{{
              task.provider
            }}</el-tag>
            <el-tag v-if="task.model" type="info">{{ task.model }}</el-tag>
          </div>
        </div>
      </template>
      <el-progress
        :percentage="task.progress"
        :status="
          task.status === 'succeeded'
            ? 'success'
            : ['failed', 'cancelled'].includes(task.status)
              ? 'exception'
              : undefined
        "
      />
      <div class="task-meta">
        <span>{{ stageLabel(task.stage) }}</span>
        <span>{{
          t("symbolAnalysisPage.process.round", {
            round: task.round,
            max: task.max_rounds
          })
        }}</span>
        <span v-if="task.usage?.total_tokens">
          {{ t("symbolAnalysisPage.process.tokens") }}:
          {{ task.usage.total_tokens }}
        </span>
      </div>
      <div class="event-panel">
        <el-timeline>
          <el-timeline-item
            v-for="(event, index) in events"
            :key="`${event.time}-${index}`"
            :timestamp="formatTime(event.time)"
            placement="top"
          >
            <div class="event-row">
              <strong>{{ stageLabel(event.stage) }}</strong>
              <el-tag v-if="event.tool" size="small" type="warning">{{
                event.tool
              }}</el-tag>
              <el-tag v-if="event.status" size="small" type="info">{{
                event.status
              }}</el-tag>
              <span v-if="event.duration_ms" class="event-duration"
                >{{ event.duration_ms }}ms</span
              >
            </div>
            <div v-if="event.message" class="event-message">
              {{ event.message }}
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
      <el-alert
        v-if="task.error"
        type="error"
        :closable="false"
        :title="task.error"
        show-icon
      />
    </el-card>

    <el-card v-if="plan" shadow="never" class="section-card">
      <template #header>
        <div class="header-row">
          <span class="section-title">{{
            t("symbolAnalysisPage.plan.title")
          }}</span>
          <el-tag :type="directionType(plan.direction)" size="large">
            {{ directionLabel(plan.direction) }}
          </el-tag>
        </div>
      </template>
      <div class="plan-summary">{{ plan.summary }}</div>
      <el-descriptions :column="4" border class="plan-descriptions">
        <el-descriptions-item :label="t('symbolAnalysisPage.plan.symbol')">
          {{ plan.symbol }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('symbolAnalysisPage.plan.asOf')">
          {{ formatTime(plan.as_of) }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('symbolAnalysisPage.plan.marketCondition')"
        >
          {{ marketConditionLabel(plan.market_condition) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('symbolAnalysisPage.plan.confidence')">
          {{ Math.round(plan.confidence * 100) }}%
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('symbolAnalysisPage.plan.entryZones')"
          :span="2"
        >
          <el-tag
            v-for="zone in plan.entry_zones"
            :key="`${zone.low}-${zone.high}`"
            class="value-tag"
          >
            {{ formatPrice(zone.low) }} - {{ formatPrice(zone.high) }}
          </el-tag>
          <span v-if="plan.entry_zones.length === 0">-</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('symbolAnalysisPage.plan.stopLoss')">
          {{ formatPrice(plan.stop_loss) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('symbolAnalysisPage.plan.takeProfits')">
          <el-tag
            v-for="price in plan.take_profits"
            :key="price"
            class="value-tag"
            type="success"
          >
            {{ formatPrice(price) }}
          </el-tag>
          <span v-if="plan.take_profits.length === 0">-</span>
        </el-descriptions-item>
      </el-descriptions>
      <div class="plan-grid">
        <div class="plan-block">
          <h4>{{ t("symbolAnalysisPage.plan.longTrigger") }}</h4>
          <p>{{ plan.long_trigger || "-" }}</p>
        </div>
        <div class="plan-block">
          <h4>{{ t("symbolAnalysisPage.plan.shortTrigger") }}</h4>
          <p>{{ plan.short_trigger || "-" }}</p>
        </div>
        <div class="plan-block">
          <h4>{{ t("symbolAnalysisPage.plan.invalidations") }}</h4>
          <ul>
            <li v-for="item in plan.invalidation_conditions" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
        <div class="plan-block">
          <h4>{{ t("symbolAnalysisPage.plan.risks") }}</h4>
          <ul>
            <li v-for="item in plan.risks" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
      <el-alert
        v-if="plan.data_missing.length"
        type="warning"
        :closable="false"
        :title="`${t('symbolAnalysisPage.plan.dataMissing')}: ${plan.data_missing.join(', ')}`"
        show-icon
      />
      <div class="evidence-title">
        {{ t("symbolAnalysisPage.plan.evidence") }}
      </div>
      <el-table :data="plan.evidence" size="small" border>
        <el-table-column
          prop="source"
          :label="t('symbolAnalysisPage.plan.source')"
          width="220"
        />
        <el-table-column
          prop="finding"
          :label="t('symbolAnalysisPage.plan.finding')"
        />
      </el-table>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="header-row">
          <span class="section-title">{{
            t("symbolAnalysisPage.history.title")
          }}</span>
          <span class="history-count">{{
            t("symbolAnalysisPage.history.total", { total: historyTotal })
          }}</span>
        </div>
      </template>
      <el-table v-loading="historyLoading" :data="history" border>
        <el-table-column
          :label="t('symbolAnalysisPage.history.time')"
          width="180"
        >
          <template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template>
        </el-table-column>
        <el-table-column
          prop="symbol"
          :label="t('symbolAnalysisPage.plan.symbol')"
          width="120"
        />
        <el-table-column
          :label="t('symbolAnalysisPage.history.status')"
          width="100"
        >
          <template #default="{ row }">
            <el-tag :type="taskStatusType(row.status)" size="small">
              {{ t(`symbolAnalysisPage.status.${row.status}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.history.direction')"
          width="100"
        >
          <template #default="{ row }">
            <el-tag :type="directionType(row.direction)" size="small">{{
              directionLabel(row.direction)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.plan.confidence')"
          width="100"
        >
          <template #default="{ row }"
            >{{ Math.round(Number(row.confidence || 0) * 100) }}%</template
          >
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.plan.marketCondition')"
          width="170"
        >
          <template #default="{ row }">{{
            marketConditionLabel(row.market_condition)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.history.analysisPrice')"
          width="130"
        >
          <template #default="{ row }">{{
            formatPrice(row.analysis_price)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.history.currentPrice')"
          width="130"
        >
          <template #default="{ row }">{{
            formatPrice(row.current_price)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('symbolAnalysisPage.history.priceChange')"
          width="120"
        >
          <template #default="{ row }">
            <span
              :class="
                Number(row.price_change_pct || 0) >= 0 ? 'positive' : 'negative'
              "
            >
              {{ formatPercent(row.price_change_pct) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="summary"
          :label="t('symbolAnalysisPage.plan.summary')"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('symbolAnalysisPage.history.operation')"
          width="90"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click="openHistory(row)">
              {{ t("symbolAnalysisPage.button.view") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty
        v-if="!historyLoading && history.length === 0"
        :description="t('symbolAnalysisPage.history.empty')"
      />
    </el-card>

    <el-dialog
      v-model="historyDialogVisible"
      :title="t('symbolAnalysisPage.history.detailTitle')"
      width="75%"
      destroy-on-close
    >
      <template v-if="historyDetail">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('symbolAnalysisPage.plan.symbol')">{{
            historyDetail.symbol
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="t('symbolAnalysisPage.history.direction')"
            >{{ directionLabel(historyDetail.direction) }}</el-descriptions-item
          >
          <el-descriptions-item :label="t('symbolAnalysisPage.plan.confidence')"
            >{{
              Math.round(Number(historyDetail.confidence || 0) * 100)
            }}%</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('symbolAnalysisPage.history.analysisPrice')"
            >{{
              formatPrice(historyDetail.analysis_price)
            }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('symbolAnalysisPage.history.currentPrice')"
            >{{
              formatPrice(historyDetail.current_price)
            }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('symbolAnalysisPage.history.priceChange')"
            >{{
              formatPercent(historyDetail.price_change_pct)
            }}</el-descriptions-item
          >
        </el-descriptions>
        <div class="history-prompt">
          <strong>{{ t("symbolAnalysisPage.history.prompt") }}:</strong>
          {{ historyDetail.prompt || "-" }}
        </div>
        <pre class="json-preview">{{
          JSON.stringify(
            historyDetail.result || { error: historyDetail.error },
            null,
            2
          )
        }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.symbol-analysis-page {
  min-height: 100%;
  background: var(--el-bg-color-page);
}

.section-card {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.header-row,
.header-tags,
.event-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.header-row {
  justify-content: space-between;
}

.analysis-form {
  display: grid;
  grid-template-columns: 220px minmax(320px, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.symbol-select,
.prompt-input {
  width: 100%;
}

.form-hint,
.history-count,
.event-duration,
.event-message,
.task-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-hint {
  margin-top: 8px;
}

.task-meta {
  display: flex;
  gap: 18px;
  margin: 8px 0 14px;
}

.event-panel {
  max-height: 360px;
  padding: 4px 8px 0 2px;
  overflow: auto;
}

.event-message {
  margin-top: 4px;
  line-height: 1.5;
}

.plan-summary {
  margin-bottom: 14px;
  font-size: 15px;
  line-height: 1.7;
}

.plan-descriptions {
  margin-bottom: 14px;
}

.value-tag {
  margin: 2px 6px 2px 0;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.plan-block {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.plan-block h4 {
  margin: 0 0 8px;
}

.plan-block p,
.plan-block ul {
  margin: 0;
  line-height: 1.7;
}

.evidence-title,
.history-prompt {
  margin: 14px 0 8px;
}

.json-preview {
  max-height: 520px;
  padding: 14px;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.positive {
  color: var(--el-color-success);
}

.negative {
  color: var(--el-color-danger);
}

@media (width <= 900px) {
  .analysis-form,
  .plan-grid {
    grid-template-columns: 1fr;
  }

  .task-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
