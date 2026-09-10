<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import {
  init as initECharts,
  use as useECharts,
  type EChartsType
} from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  useStrategyTemplateOptions,
  strategyTemplatePopperClass
} from "@/composables/useStrategyTemplateOptions";
import { getFeaturesOptions } from "@/api/trade";
import {
  cancelBacktest,
  deleteBacktest,
  getBacktest,
  getBacktestEquity,
  getBacktestEvents,
  getBacktestPrefetch,
  getMarketConditionBackfill,
  getBacktestTrades,
  getBacktests,
  startBacktest,
  startBacktestPrefetch,
  startMarketConditionBackfill,
  type BacktestEquityPoint,
  type BacktestEvent,
  type BacktestMetrics,
  type BacktestPrefetch,
  type MarketConditionBackfill,
  type BacktestRun,
  type BacktestTrade
} from "@/api/backtest";

useECharts([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer
]);
defineOptions({ name: "AgentBacktest" });
const { t } = useI18n();
const {
  options: templateOptions,
  selectLoading,
  loadFirstPage,
  search: searchTemplates,
  onPopupScroll
} = useStrategyTemplateOptions();
const symbols = ref<string[]>([]);
const runs = ref<BacktestRun[]>([]);
const total = ref(0);
const loading = ref(false);
const starting = ref(false);
const prefetching = ref(false);
const prefetchJob = ref<BacktestPrefetch | null>(null);
const marketConditionBackfilling = ref(false);
const marketConditionBackfillJob = ref<MarketConditionBackfill | null>(null);
let prefetchGeneration = 0;
let marketConditionBackfillGeneration = 0;
const query = reactive({ page: 1, limit: 20 });
const now = Date.now();
const form = reactive({
  strategy_template_id: undefined as number | undefined,
  symbol: "",
  range: [new Date(now - 3 * 24 * 3600 * 1000), new Date(now)] as [Date, Date],
  initial_equity: 1000,
  position_size_pct: 1,
  leverage: 1,
  fee_rate: 0.0005,
  slippage_bps: 5,
  stop_loss_pct: 0,
  take_profit_pct: 0
});
watch(
  () => [
    form.strategy_template_id,
    form.symbol,
    form.range?.[0]?.getTime?.() || 0,
    form.range?.[1]?.getTime?.() || 0
  ],
  () => {
    if (!prefetching.value) prefetchJob.value = null;
  }
);
const detailVisible = ref(false);
const detail = ref<BacktestRun | null>(null);
const paramsVisible = ref(false);
const paramsRun = ref<BacktestRun | null>(null);
const trades = ref<BacktestTrade[]>([]);
const events = ref<BacktestEvent[]>([]);
const loadedEventsRunId = ref("");
const equity = ref<BacktestEquityPoint[]>([]);
const detailTab = ref("summary");
const chartEl = ref<HTMLElement>();
let chart: EChartsType | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const compareA = ref("");
const compareB = ref("");
const succeededRuns = computed(() =>
  runs.value.filter(x => x.status === "succeeded" && x.metrics)
);
const compareRuns = computed(
  () =>
    [
      runs.value.find(x => x.run_id === compareA.value),
      runs.value.find(x => x.run_id === compareB.value)
    ].filter(Boolean) as BacktestRun[]
);
function statusType(status: string) {
  if (status === "succeeded") return "success";
  if (["failed", "interrupted"].includes(status)) return "danger";
  if (status === "running") return "warning";
  return "info";
}
function isActiveRun(status: string) {
  return ["queued", "running"].includes(status);
}
function stageText(stage: string) {
  return t(`backtestPage.stage.${stage}`);
}
function marketConditionStageText(stage: string) {
  const key = `backtestPage.marketCondition.stageValue.${stage}`;
  return t(key);
}
function formatTime(v?: number) {
  return v ? new Date(v).toLocaleString() : "-";
}
function num(v?: number, d = 2) {
  return Number(v || 0).toFixed(d);
}
function pct(v?: number) {
  return `${num(Number(v || 0) * 100, 2)}%`;
}
function metricPct(v?: number) {
  return `${num(v, 2)}%`;
}
function formatDuration(ms?: number) {
  if (!ms) return "-";
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${num(m / 60, 1)}h` : `${m}m`;
}
async function fetchSymbols() {
  try {
    const res = await getFeaturesOptions();
    symbols.value = Array.isArray(res?.data) ? res.data : [];
    if (symbols.value.length && !symbols.value.includes(form.symbol)) {
      form.symbol = symbols.value.includes("BTCUSDT")
        ? "BTCUSDT"
        : symbols.value[0];
    }
  } catch {
    symbols.value = [];
  }
}
async function fetchRuns(show = false) {
  if (show) loading.value = true;
  try {
    const res = await getBacktests({ ...query });
    runs.value = (res?.data?.list || []) as BacktestRun[];
    total.value = Number(res?.data?.total || 0);
  } finally {
    if (show) loading.value = false;
  }
}
async function prefetchData() {
  if (!form.strategy_template_id) {
    ElMessage.error(t("backtestPage.message.templateRequired"));
    return;
  }
  if (!form.symbol) {
    ElMessage.error(t("backtestPage.message.symbolRequired"));
    return;
  }
  if (!form.range?.[0] || !form.range?.[1]) {
    ElMessage.error(t("backtestPage.message.rangeRequired"));
    return;
  }
  const generation = ++prefetchGeneration;
  prefetching.value = true;
  try {
    const res = await startBacktestPrefetch({
      strategy_template_id: Number(form.strategy_template_id),
      symbol: form.symbol.trim().toUpperCase(),
      start_time: form.range[0].getTime(),
      end_time: form.range[1].getTime()
    });
    if (Number(res?.code) !== 200)
      throw new Error(res?.msg || "prefetch failed");
    prefetchJob.value = res?.data as BacktestPrefetch;
    while (
      generation === prefetchGeneration &&
      prefetchJob.value &&
      ["queued", "running"].includes(prefetchJob.value.status)
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = await getBacktestPrefetch(prefetchJob.value.job_id);
      if (Number(status?.code) !== 200)
        throw new Error(status?.msg || "prefetch status failed");
      prefetchJob.value = status?.data as BacktestPrefetch;
    }
    if (generation !== prefetchGeneration || !prefetchJob.value) return;
    if (prefetchJob.value.status === "succeeded") {
      ElMessage.success(
        prefetchJob.value.remote_rows > 0
          ? t("backtestPage.message.prefetchFetched", {
              rows: prefetchJob.value.remote_rows
            })
          : t("backtestPage.message.prefetchLocal")
      );
    } else {
      throw new Error(
        prefetchJob.value.error || t("backtestPage.message.prefetchFailed")
      );
    }
  } catch (e: any) {
    if (generation === prefetchGeneration)
      ElMessage.error(e?.message || t("backtestPage.message.prefetchFailed"));
  } finally {
    if (generation === prefetchGeneration) prefetching.value = false;
  }
}

async function backfillMarketCondition() {
  try {
    await ElMessageBox.confirm(
      t("backtestPage.marketCondition.confirm"),
      t("backtestPage.marketCondition.confirmTitle"),
      { type: "warning" }
    );
  } catch {
    return;
  }
  const generation = ++marketConditionBackfillGeneration;
  marketConditionBackfilling.value = true;
  try {
    const res = await startMarketConditionBackfill();
    if (Number(res?.code) !== 200)
      throw new Error(res?.msg || t("backtestPage.marketCondition.failed"));
    marketConditionBackfillJob.value = res?.data as MarketConditionBackfill;
    while (
      generation === marketConditionBackfillGeneration &&
      marketConditionBackfillJob.value &&
      ["queued", "running"].includes(marketConditionBackfillJob.value.status)
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = await getMarketConditionBackfill(
        marketConditionBackfillJob.value.job_id
      );
      if (Number(status?.code) !== 200)
        throw new Error(
          status?.msg || t("backtestPage.marketCondition.failed")
        );
      marketConditionBackfillJob.value =
        status?.data as MarketConditionBackfill;
    }
    if (generation !== marketConditionBackfillGeneration) return;
    if (marketConditionBackfillJob.value?.status === "succeeded") {
      ElMessage.success(
        t("backtestPage.marketCondition.succeeded", {
          inserted: marketConditionBackfillJob.value.inserted_rows,
          skipped: marketConditionBackfillJob.value.skipped_rows
        })
      );
    } else {
      throw new Error(
        marketConditionBackfillJob.value?.error ||
          t("backtestPage.marketCondition.failed")
      );
    }
  } catch (e: any) {
    if (generation === marketConditionBackfillGeneration)
      ElMessage.error(e?.message || t("backtestPage.marketCondition.failed"));
  } finally {
    if (generation === marketConditionBackfillGeneration)
      marketConditionBackfilling.value = false;
  }
}

async function submit() {
  if (!form.strategy_template_id) {
    ElMessage.error(t("backtestPage.message.templateRequired"));
    return;
  }
  if (!form.symbol) {
    ElMessage.error(t("backtestPage.message.symbolRequired"));
    return;
  }
  if (!form.range?.[0] || !form.range?.[1]) {
    ElMessage.error(t("backtestPage.message.rangeRequired"));
    return;
  }
  starting.value = true;
  try {
    const res = await startBacktest({
      strategy_template_id: Number(form.strategy_template_id),
      symbol: form.symbol.trim().toUpperCase(),
      start_time: form.range[0].getTime(),
      end_time: form.range[1].getTime(),
      config: {
        initial_equity: Number(form.initial_equity),
        position_size_pct: Number(form.position_size_pct),
        leverage: Number(form.leverage),
        fee_rate: Number(form.fee_rate),
        slippage_bps: Number(form.slippage_bps),
        stop_loss_pct: Number(form.stop_loss_pct),
        take_profit_pct: Number(form.take_profit_pct)
      }
    });
    if (Number(res?.code) !== 200) throw new Error(res?.msg || "start failed");
    ElMessage.success(t("backtestPage.message.started"));
    await fetchRuns();
    schedule(500);
    if (res?.data?.run_id) await openDetail(res.data);
  } catch (e: any) {
    ElMessage.error(e?.message || t("backtestPage.message.startFailed"));
  } finally {
    starting.value = false;
  }
}
function openParams(row: BacktestRun) {
  paramsRun.value = row;
  paramsVisible.value = true;
}
async function openDetail(row: BacktestRun) {
  events.value = [];
  loadedEventsRunId.value = "";
  const res = await getBacktest(row.run_id);
  detail.value = (res?.data || row) as BacktestRun;
  detailVisible.value = true;
  detailTab.value = "summary";
  await loadResultData();
}
async function loadResultData() {
  if (!detail.value) return;
  const id = detail.value.run_id;
  if (detail.value.status === "succeeded") {
    const [tr, eq] = await Promise.all([
      getBacktestTrades(id),
      getBacktestEquity(id)
    ]);
    trades.value = tr?.data || [];
    equity.value = eq?.data || [];
    await nextTick();
    renderChart();
  } else {
    trades.value = [];
    equity.value = [];
  }
}
async function loadEvents() {
  if (!detail.value) return;
  const id = detail.value.run_id;
  if (loadedEventsRunId.value === id) return;
  const res = await getBacktestEvents(id);
  events.value = res?.data || [];
  loadedEventsRunId.value = id;
}
async function refreshDetail() {
  if (!detail.value) return;
  const res = await getBacktest(detail.value.run_id);
  detail.value = (res?.data || detail.value) as BacktestRun;
  if (detail.value.status === "succeeded") await loadResultData();
}
async function cancel(row: BacktestRun) {
  try {
    await cancelBacktest(row.run_id);
    ElMessage.success(t("backtestPage.message.cancelled"));
    await fetchRuns();
    if (detail.value?.run_id === row.run_id) await refreshDetail();
  } catch (e: any) {
    ElMessage.error(e?.message || "cancel failed");
  }
}
async function removeRun(row: BacktestRun) {
  if (isActiveRun(row.status)) return;
  try {
    await ElMessageBox.confirm(
      t("backtestPage.message.deleteConfirm", {
        strategy: row.strategy_template_name,
        symbol: row.symbol
      }),
      t("backtestPage.message.deleteTitle"),
      { type: "warning" }
    );
    const res = await deleteBacktest(row.run_id);
    if (Number(res?.code) !== 200) throw new Error(res?.msg || "delete failed");
    if (detail.value?.run_id === row.run_id) {
      detailVisible.value = false;
      detail.value = null;
      trades.value = [];
      events.value = [];
      equity.value = [];
      loadedEventsRunId.value = "";
    }
    if (paramsRun.value?.run_id === row.run_id) {
      paramsVisible.value = false;
      paramsRun.value = null;
    }
    if (compareA.value === row.run_id) compareA.value = "";
    if (compareB.value === row.run_id) compareB.value = "";
    ElMessage.success(t("backtestPage.message.deleted"));
    await fetchRuns();
    if (!runs.value.length && query.page > 1) {
      query.page -= 1;
      await fetchRuns();
    }
  } catch (e: any) {
    if (e === "cancel" || e === "close") return;
    ElMessage.error(e?.message || t("backtestPage.message.deleteFailed"));
  }
}
function renderChart() {
  if (!chartEl.value || !equity.value.length) return;
  if (!chart) chart = initECharts(chartEl.value);
  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: {
      data: [t("backtestPage.chart.equity"), t("backtestPage.chart.drawdown")]
    },
    xAxis: {
      type: "category",
      data: equity.value.map(x => new Date(x.bar_time).toLocaleString()),
      axisLabel: { show: false }
    },
    yAxis: [
      { type: "value", name: t("backtestPage.chart.equity") },
      { type: "value", name: "%" }
    ],
    series: [
      {
        name: t("backtestPage.chart.equity"),
        type: "line",
        showSymbol: false,
        data: equity.value.map(x => x.equity)
      },
      {
        name: t("backtestPage.chart.drawdown"),
        type: "line",
        showSymbol: false,
        yAxisIndex: 1,
        data: equity.value.map(x => x.drawdown_pct)
      }
    ]
  });
}
function metricRows(m?: BacktestMetrics) {
  if (!m) return [];
  return [
    ["net_pnl", m.net_pnl],
    ["return_pct", m.return_pct],
    ["max_drawdown_pct", m.max_drawdown_pct],
    ["win_rate", m.win_rate * 100],
    ["profit_factor", m.profit_factor],
    ["sharpe", m.sharpe],
    ["sortino", m.sortino],
    ["trade_count", m.trade_count],
    ["fees", m.fees],
    ["funding", m.funding],
    ["average_holding_ms", m.average_holding_ms]
  ];
}
function schedule(delay?: number) {
  if (timer) clearTimeout(timer);
  const wait =
    delay ?? (runs.value.some(x => isActiveRun(x.status)) ? 750 : 3000);
  timer = setTimeout(async () => {
    if (runs.value.some(x => isActiveRun(x.status))) {
      await fetchRuns();
      if (
        detailVisible.value &&
        detail.value &&
        isActiveRun(detail.value.status)
      )
        await refreshDetail();
    }
    schedule();
  }, wait);
}
onMounted(async () => {
  await Promise.all([loadFirstPage(), fetchSymbols(), fetchRuns(true)]);
  schedule();
  window.addEventListener("resize", () => chart?.resize());
});
onBeforeUnmount(() => {
  prefetchGeneration += 1;
  marketConditionBackfillGeneration += 1;
  if (timer) clearTimeout(timer);
  chart?.dispose();
});
</script>

<template>
  <div class="p-4 backtest-page">
    <el-card shadow="never" class="mb-4"
      ><template #header
        ><div>
          <div class="text-lg font-medium">{{ t("backtestPage.title") }}</div>
          <div class="text-sm text-gray-500 mt-1">
            {{ t("backtestPage.subtitle") }}
          </div>
        </div></template
      >
      <el-form label-width="150px" class="form-grid">
        <el-form-item :label="t('backtestPage.form.template')"
          ><el-select
            v-model="form.strategy_template_id"
            filterable
            remote
            :remote-method="searchTemplates"
            :loading="selectLoading"
            :disabled="prefetching"
            :popper-class="strategyTemplatePopperClass"
            style="width: 360px"
            @popup-scroll="onPopupScroll"
            ><el-option
              v-for="x in templateOptions"
              :key="x.id"
              :label="`${x.name} (#${x.id})`"
              :value="x.id" /></el-select
        ></el-form-item>
        <el-form-item :label="t('backtestPage.form.symbol')"
          ><el-select
            v-model="form.symbol"
            filterable
            :disabled="prefetching"
            style="width: 220px"
            :placeholder="t('backtestPage.form.symbol')"
            ><el-option
              v-for="item in symbols"
              :key="item"
              :label="item"
              :value="item" /></el-select
        ></el-form-item>
        <el-form-item :label="t('backtestPage.form.range')"
          ><el-date-picker
            v-model="form.range"
            type="datetimerange"
            :disabled="prefetching"
            style="width: 440px"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.initialEquity')"
          ><el-input-number v-model="form.initial_equity" :min="1"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.positionSize')"
          ><el-input-number
            v-model="form.position_size_pct"
            :min="0.01"
            :max="1"
            :step="0.1"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.leverage')"
          ><el-input-number v-model="form.leverage" :min="1" :max="125"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.feeRate')"
          ><el-input-number
            v-model="form.fee_rate"
            :min="0"
            :max="0.02"
            :step="0.0001"
            :precision="6"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.slippage')"
          ><el-input-number
            v-model="form.slippage_bps"
            :min="0"
            :max="1000"
            :step="1"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.stopLoss')"
          ><el-input-number
            v-model="form.stop_loss_pct"
            :min="0"
            :max="100"
            :step="0.5"
        /></el-form-item>
        <el-form-item :label="t('backtestPage.form.takeProfit')"
          ><el-input-number
            v-model="form.take_profit_pct"
            :min="0"
            :max="1000"
            :step="0.5"
        /></el-form-item>
        <el-form-item
          ><el-button
            :loading="marketConditionBackfilling"
            :disabled="prefetching || starting"
            @click="backfillMarketCondition"
            >{{ t("backtestPage.button.marketConditionBackfill") }}</el-button
          ><el-button :loading="prefetching" @click="prefetchData">{{
            t("backtestPage.button.prefetch")
          }}</el-button
          ><el-button
            type="primary"
            :loading="starting"
            :disabled="prefetching"
            @click="submit"
            >{{ t("backtestPage.button.start") }}</el-button
          ></el-form-item
        >
        <el-form-item
          v-if="marketConditionBackfillJob"
          :label="t('backtestPage.marketCondition.title')"
        >
          <div class="prefetch-status">
            <el-progress
              :percentage="marketConditionBackfillJob.progress"
              :status="
                marketConditionBackfillJob.status === 'failed'
                  ? 'exception'
                  : marketConditionBackfillJob.status === 'succeeded'
                    ? 'success'
                    : undefined
              "
            />
            <div class="text-sm mt-1">
              {{ t("backtestPage.marketCondition.stage") }}:
              {{ marketConditionStageText(marketConditionBackfillJob.stage) }}
            </div>
            <div class="text-sm">
              BTC 1h: {{ marketConditionBackfillJob.btc_rows }} / ETH 1h:
              {{ marketConditionBackfillJob.eth_rows }}
            </div>
            <div class="text-sm">
              {{ t("backtestPage.marketCondition.inferred") }}:
              {{ marketConditionBackfillJob.inferred_rows }} /
              {{ t("backtestPage.marketCondition.inserted") }}:
              {{ marketConditionBackfillJob.inserted_rows }} /
              {{ t("backtestPage.marketCondition.skipped") }}:
              {{ marketConditionBackfillJob.skipped_rows }}
            </div>
            <div class="text-sm text-gray-500">
              {{ t("backtestPage.marketCondition.note") }}
            </div>
            <div
              v-if="marketConditionBackfillJob.error"
              class="text-sm text-red-500"
            >
              {{ marketConditionBackfillJob.error }}
            </div>
          </div>
        </el-form-item>
        <el-form-item
          v-if="prefetchJob"
          :label="t('backtestPage.prefetch.title')"
        >
          <div class="prefetch-status">
            <el-progress
              :percentage="prefetchJob.progress"
              :status="
                prefetchJob.status === 'failed'
                  ? 'exception'
                  : prefetchJob.status === 'succeeded'
                    ? 'success'
                    : undefined
              "
            />
            <div class="text-sm mt-1">
              {{ t("backtestPage.prefetch.replay") }}:
              {{ prefetchJob.replay_interval }}
            </div>
            <div class="text-sm">
              {{ t("backtestPage.prefetch.intervals") }}:
              {{ prefetchJob.intervals.join(", ") }}
            </div>
            <div class="text-sm">
              {{ t("backtestPage.prefetch.warmup") }}:
              {{ formatTime(prefetchJob.warmup_start_time) }}
            </div>
            <div class="text-sm text-gray-500">
              {{ t("backtestPage.prefetch.rateLimit") }}
            </div>
            <div v-if="prefetchJob.status === 'succeeded'" class="text-sm">
              {{
                prefetchJob.remote_rows > 0
                  ? t("backtestPage.prefetch.fetched", {
                      rows: prefetchJob.remote_rows
                    })
                  : t("backtestPage.prefetch.local")
              }}
            </div>
            <div v-if="prefetchJob.error" class="text-sm text-red-500">
              {{ prefetchJob.error }}
            </div>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="succeededRuns.length >= 2" shadow="never" class="mb-4"
      ><template #header>{{ t("backtestPage.compare.title") }}</template>
      <div class="flex gap-3 items-center">
        <el-select v-model="compareA" clearable style="width: 300px"
          ><el-option
            v-for="x in succeededRuns"
            :key="x.run_id"
            :label="`${x.strategy_template_name} ${x.symbol} ${formatTime(x.created_at)}`"
            :value="x.run_id" /></el-select
        ><span>vs</span
        ><el-select v-model="compareB" clearable style="width: 300px"
          ><el-option
            v-for="x in succeededRuns"
            :key="x.run_id"
            :label="`${x.strategy_template_name} ${x.symbol} ${formatTime(x.created_at)}`"
            :value="x.run_id"
        /></el-select>
      </div>
      <el-table
        v-if="compareRuns.length === 2"
        :data="metricRows(compareRuns[0].metrics)"
        class="mt-3"
        size="small"
        ><el-table-column prop="0" :label="t('backtestPage.compare.metric')"
          ><template #default="{ row }">{{
            t(`backtestPage.metric.${row[0]}`)
          }}</template></el-table-column
        ><el-table-column :label="compareRuns[0].run_id"
          ><template #default="{ row }">{{
            num(row[1], 4)
          }}</template></el-table-column
        ><el-table-column :label="compareRuns[1].run_id"
          ><template #default="{ $index }">{{
            num(metricRows(compareRuns[1].metrics)[$index]?.[1] as number, 4)
          }}</template></el-table-column
        ></el-table
      ></el-card
    >

    <el-card v-loading="loading" shadow="never"
      ><template #header
        ><div class="flex justify-between">
          <span>{{ t("backtestPage.history") }}</span
          ><el-button size="small" @click="fetchRuns(true)">{{
            t("backtestPage.button.refresh")
          }}</el-button>
        </div></template
      >
      <el-table :data="runs" size="small"
        ><el-table-column
          prop="strategy_template_name"
          :label="t('backtestPage.table.strategy')"
          min-width="150"
        /><el-table-column
          prop="symbol"
          label="Symbol"
          width="110"
        /><el-table-column
          prop="execution_interval"
          :label="t('backtestPage.replayPrecision')"
          width="90"
        /><el-table-column
          :label="t('backtestPage.table.parameters')"
          width="90"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openParams(row)">{{
              t("backtestPage.button.parameters")
            }}</el-button></template
          ></el-table-column
        ><el-table-column :label="t('backtestPage.table.status')" width="120"
          ><template #default="{ row }"
            ><el-tag :type="statusType(row.status)" size="small">{{
              row.status
            }}</el-tag></template
          ></el-table-column
        ><el-table-column :label="t('backtestPage.table.progress')" width="180"
          ><template #default="{ row }"
            ><el-progress
              :percentage="row.progress"
              :status="
                row.status === 'failed'
                  ? 'exception'
                  : row.status === 'succeeded'
                    ? 'success'
                    : undefined
              "
            />
            <div class="text-xs text-gray-400 mt-1">
              {{ stageText(row.stage) }}
            </div></template
          ></el-table-column
        ><el-table-column :label="t('backtestPage.metric.net_pnl')" width="120"
          ><template #default="{ row }">{{
            row.metrics ? num(row.metrics.net_pnl) : "-"
          }}</template></el-table-column
        ><el-table-column
          :label="t('backtestPage.metric.max_drawdown_pct')"
          width="120"
          ><template #default="{ row }">{{
            row.metrics ? metricPct(row.metrics.max_drawdown_pct) : "-"
          }}</template></el-table-column
        ><el-table-column :label="t('backtestPage.table.createdAt')" width="180"
          ><template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template></el-table-column
        ><el-table-column
          :label="t('backtestPage.table.operation')"
          width="210"
          fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)">{{
              t("backtestPage.button.detail")
            }}</el-button
            ><el-button
              v-if="['queued', 'running'].includes(row.status)"
              link
              type="danger"
              @click="cancel(row)"
              >{{ t("backtestPage.button.cancel") }}</el-button
            ><el-button
              link
              type="danger"
              :disabled="isActiveRun(row.status)"
              @click="removeRun(row)"
              >{{ t("backtestPage.button.delete") }}</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <el-pagination
        v-model:current-page="query.page"
        class="mt-3 justify-end"
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.limit"
        @current-change="fetchRuns(true)"
      />
    </el-card>

    <el-dialog
      v-model="paramsVisible"
      :title="t('backtestPage.parameters.title')"
      width="680px"
    >
      <el-descriptions v-if="paramsRun" :column="2" border>
        <el-descriptions-item :label="t('backtestPage.form.template')" :span="2"
          >{{ paramsRun.strategy_template_name }} (#{{
            paramsRun.strategy_template_id
          }})</el-descriptions-item
        >
        <el-descriptions-item :label="t('backtestPage.form.symbol')">{{
          paramsRun.symbol
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.replayPrecision')">{{
          paramsRun.execution_interval
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.form.range')" :span="2"
          >{{ formatTime(paramsRun.start_time) }} -
          {{ formatTime(paramsRun.end_time) }}</el-descriptions-item
        >
        <el-descriptions-item :label="t('backtestPage.form.initialEquity')">{{
          num(paramsRun.config.initial_equity, 4)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.form.positionSize')">{{
          pct(paramsRun.config.position_size_pct)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.form.leverage')"
          >{{ paramsRun.config.leverage }}x</el-descriptions-item
        >
        <el-descriptions-item :label="t('backtestPage.form.feeRate')">{{
          pct(paramsRun.config.fee_rate)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.form.slippage')"
          >{{ num(paramsRun.config.slippage_bps, 2) }} bps</el-descriptions-item
        >
        <el-descriptions-item :label="t('backtestPage.form.stopLoss')">{{
          metricPct(paramsRun.config.stop_loss_pct)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('backtestPage.form.takeProfit')">{{
          metricPct(paramsRun.config.take_profit_pct)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-drawer
      v-model="detailVisible"
      :title="t('backtestPage.detail.title')"
      size="75%"
      ><template v-if="detail"
        ><el-descriptions :column="3" border class="mb-4"
          ><el-descriptions-item label="Run ID">{{
            detail.run_id
          }}</el-descriptions-item
          ><el-descriptions-item
            :label="t('backtestPage.detail.datasetSpecHash')"
            >{{
              detail.dataset_spec_hash?.slice(0, 16) || "-"
            }}</el-descriptions-item
          ><el-descriptions-item :label="t('backtestPage.detail.dataHash')">{{
            detail.data_hash?.slice(0, 16) || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="Strategy Version">{{
            detail.strategy_version?.slice(0, 16)
          }}</el-descriptions-item
          ><el-descriptions-item label="Engine">{{
            detail.engine_version
          }}</el-descriptions-item
          ><el-descriptions-item :label="t('backtestPage.table.status')">{{
            detail.status
          }}</el-descriptions-item
          ><el-descriptions-item :label="t('backtestPage.table.progress')"
            >{{ detail.progress }}%</el-descriptions-item
          ><el-descriptions-item
            v-if="detail.error"
            :span="3"
            :label="t('backtestPage.detail.error')"
            >{{ detail.error }}</el-descriptions-item
          ></el-descriptions
        >
        <el-tabs
          v-model="detailTab"
          @tab-change="x => x === 'events' && loadEvents()"
          ><el-tab-pane :label="t('backtestPage.detail.summary')" name="summary"
            ><template v-if="detail.metrics"
              ><el-row :gutter="12" class="mb-4"
                ><el-col
                  v-for="row in metricRows(detail.metrics).slice(0, 8)"
                  :key="String(row[0])"
                  :span="6"
                  class="mb-3"
                  ><el-card shadow="never"
                    ><div class="text-xs text-gray-500">
                      {{ t(`backtestPage.metric.${row[0]}`) }}
                    </div>
                    <div class="text-xl mt-1">
                      {{ num(row[1] as number, 4) }}
                    </div></el-card
                  ></el-col
                ></el-row
              >
              <div ref="chartEl" class="equity-chart" />
              <el-row :gutter="16" class="mt-4"
                ><el-col :span="24"
                  ><h4>{{ t("backtestPage.detail.bySide") }}</h4>
                  <el-table :data="detail.metrics.by_side" size="small"
                    ><el-table-column prop="key" label="Side" /><el-table-column
                      prop="trade_count"
                      :label="t('backtestPage.metric.trade_count')"
                    /><el-table-column :label="t('backtestPage.metric.net_pnl')"
                      ><template #default="{ row }">{{
                        num(row.net_pnl)
                      }}</template></el-table-column
                    ><el-table-column :label="t('backtestPage.metric.win_rate')"
                      ><template #default="{ row }">{{
                        pct(row.win_rate)
                      }}</template></el-table-column
                    ></el-table
                  ></el-col
                ></el-row
              ></template
            ><el-empty v-else :description="detail.status"
          /></el-tab-pane>
          <el-tab-pane :label="t('backtestPage.detail.trades')" name="trades"
            ><el-table :data="trades" size="small"
              ><el-table-column
                prop="sequence"
                label="#"
                width="60"
              /><el-table-column
                prop="side"
                label="Side"
                width="80"
              /><el-table-column
                :label="t('backtestPage.detail.entry')"
                width="180"
                ><template #default="{ row }"
                  >{{ formatTime(row.entry_time) }} @
                  {{ num(row.entry_price, 6) }}</template
                ></el-table-column
              ><el-table-column
                :label="t('backtestPage.detail.exit')"
                width="180"
                ><template #default="{ row }"
                  >{{ formatTime(row.exit_time) }} @
                  {{ num(row.exit_price, 6) }}</template
                ></el-table-column
              ><el-table-column
                prop="exit_reason"
                :label="t('backtestPage.detail.reason')"
              /><el-table-column :label="t('backtestPage.metric.net_pnl')"
                ><template #default="{ row }">{{
                  num(row.net_pnl, 4)
                }}</template></el-table-column
              ><el-table-column :label="t('backtestPage.metric.fees')"
                ><template #default="{ row }">{{
                  num(row.fees, 4)
                }}</template></el-table-column
              ><el-table-column :label="t('backtestPage.metric.funding')"
                ><template #default="{ row }">{{
                  num(row.funding_pnl, 4)
                }}</template></el-table-column
              ></el-table
            ></el-tab-pane
          >
          <el-tab-pane :label="t('backtestPage.detail.events')" name="events"
            ><el-table :data="events" size="small"
              ><el-table-column
                prop="sequence"
                label="#"
                width="60"
              /><el-table-column
                :label="t('backtestPage.detail.time')"
                width="180"
                ><template #default="{ row }">{{
                  formatTime(row.event_time)
                }}</template></el-table-column
              ><el-table-column
                prop="type"
                label="Type"
                width="100"
              /><el-table-column prop="action" label="Action" /><el-table-column
                prop="side"
                label="Side"
                width="90"
              /><el-table-column :label="t('backtestPage.detail.price')"
                ><template #default="{ row }">{{
                  num(row.price, 6)
                }}</template></el-table-column
              ></el-table
            ></el-tab-pane
          ></el-tabs
        ></template
      ></el-drawer
    >
  </div>
</template>
<style scoped>
.backtest-page {
  min-width: 0;
}

.form-grid {
  max-width: 980px;
}

.prefetch-status {
  width: min(100%, 640px);
}

.equity-chart {
  width: 100%;
  height: 360px;
}
</style>
