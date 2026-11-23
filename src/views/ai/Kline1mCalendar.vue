<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getFeaturesOptions } from "@/api/trade";
import {
  getBacktestPrefetch,
  getKline1mCoverage,
  startKline1mRepair,
  type BacktestPrefetch,
  type MinuteCalendarCoverage,
  type MinuteDayCoverage,
  type MinuteMonthCoverage
} from "@/api/backtest";

defineOptions({ name: "AgentBacktest1mCalendar" });
const router = useRouter();
const route = useRoute();

function formatMonth(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}
const now = new Date();
const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const monthRange = ref<[string, string]>([
  formatMonth(
    new Date(
      lastCompletedMonth.getFullYear(),
      lastCompletedMonth.getMonth() - 11,
      1
    )
  ),
  formatMonth(lastCompletedMonth)
]);
const symbolOptions = ref<string[]>([]);
const symbol = ref(
  typeof route.query.symbol === "string" ? route.query.symbol : "BTCUSDT"
);
const loading = ref(false);
const coverage = ref<MinuteCalendarCoverage | null>(null);
const selectedMonth = ref("");
const repairJob = ref<BacktestPrefetch | null>(null);
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

const months = computed(() => [...(coverage.value?.months || [])].reverse());
const selected = computed<MinuteMonthCoverage | undefined>(() =>
  coverage.value?.months.find(item => item.month === selectedMonth.value)
);
const selectedCells = computed<Array<MinuteDayCoverage | null>>(() => {
  if (!selected.value) return [];
  const day = new Date(`${selected.value.month}-01T00:00:00Z`).getUTCDay();
  return [
    ...Array.from({ length: (day + 6) % 7 }, () => null),
    ...selected.value.days
  ];
});
const isRepairing = computed(
  () =>
    !!repairJob.value && ["queued", "running"].includes(repairJob.value.status)
);
const filtersMatchCoverage = computed(
  () =>
    !!coverage.value &&
    coverage.value.symbol === symbol.value &&
    coverage.value.from === monthRange.value?.[0] &&
    coverage.value.to === monthRange.value?.[1]
);
const completedCount = computed(
  () => months.value.filter(x => x.status === "complete").length
);
const incompleteCount = computed(
  () =>
    months.value.filter(x => x.status === "partial" || x.status === "missing")
      .length
);
const statusName = (status: string) =>
  ({ complete: "完整", partial: "不完整", missing: "缺失", future: "未开始" })[
    status
  ] || status;
const dayTooltip = (day: MinuteDayCoverage) =>
  `${day.date} · ${day.stored.toLocaleString()} / ${day.expected.toLocaleString()} 分钟`;
const monthTooltip = (item: MinuteMonthCoverage) =>
  `${item.stored.toLocaleString()} / ${item.expected.toLocaleString()} 分钟`;
const stageText = (stage: string) =>
  ({
    checking: "检查本地数据",
    public_data_downloading: "下载月度 ZIP",
    public_data_importing: "解析并导入",
    rest_fallback: "REST 补齐",
    completed: "完成",
    queued: "排队中",
    failed: "失败"
  })[stage] || stage;

async function fetchSymbols() {
  try {
    const response = await getFeaturesOptions();
    const list = Array.isArray(response?.data) ? response.data : [];
    symbolOptions.value = list
      .filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.endsWith("USDT")
      )
      .sort((a: string, b: string) => a.localeCompare(b));
    if (!symbolOptions.value.includes(symbol.value)) {
      symbol.value = symbolOptions.value.includes("BTCUSDT")
        ? "BTCUSDT"
        : symbolOptions.value[0] || "";
    }
  } catch (err: any) {
    ElMessage.error(err?.message || "加载币种失败");
  }
}

async function queryCoverage() {
  if (!symbol.value || !monthRange.value?.[0] || !monthRange.value?.[1]) {
    ElMessage.warning("请选择币种和月份范围");
    return;
  }
  const current = ++generation;
  loading.value = true;
  try {
    const response = await getKline1mCoverage({
      symbol: symbol.value,
      from: monthRange.value[0],
      to: monthRange.value[1]
    });
    if (current !== generation) return;
    if (Number(response?.code) !== 200)
      throw new Error(response?.msg || "查询失败");
    coverage.value = response.data as MinuteCalendarCoverage;
    if (!coverage.value?.months?.some(x => x.month === selectedMonth.value)) {
      selectedMonth.value =
        [...coverage.value.months].reverse().find(x => x.status !== "complete")
          ?.month ||
        coverage.value.months[coverage.value.months.length - 1]?.month ||
        "";
    }
  } catch (err: any) {
    if (current === generation) ElMessage.error(err?.message || "查询失败");
  } finally {
    if (current === generation) loading.value = false;
  }
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = undefined;
}
async function refreshRepair() {
  const id = repairJob.value?.job_id;
  if (!id) return;
  try {
    const response = await getBacktestPrefetch(id);
    if (Number(response?.code) !== 200)
      throw new Error(response?.msg || "查询补数进度失败");
    if (repairJob.value?.job_id !== id) return;
    repairJob.value = response.data as BacktestPrefetch;
    if (repairJob.value.status === "succeeded") {
      ElMessage.success("1m K线补齐完成");
      await queryCoverage();
      return;
    }
    if (repairJob.value.status === "failed") {
      ElMessage.error(repairJob.value.error || "补齐失败");
      await queryCoverage();
      return;
    }
  } catch (err: any) {
    ElMessage.error(err?.message || "查询补数状态失败");
  }
  pollTimer = setTimeout(refreshRepair, 1800);
}

async function startRepair(from: string, to: string) {
  if (isRepairing.value || !symbol.value) return;
  try {
    await ElMessageBox.confirm(
      `将为 ${symbol.value} 补齐 ${from === to ? from : `${from} ～ ${to}`} 的 1m K线缺失数据，可能需要下载并写入本地数据库。`,
      "确认补齐",
      {
        type: "warning",
        confirmButtonText: "开始补齐",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }
  try {
    const response = await startKline1mRepair({
      symbol: symbol.value,
      from,
      to
    });
    if (Number(response?.code) !== 200)
      throw new Error(response?.msg || "启动失败");
    repairJob.value = response.data as BacktestPrefetch;
    stopPolling();
    await refreshRepair();
  } catch (err: any) {
    ElMessage.error(err?.message || "启动补齐失败");
  }
}

onMounted(async () => {
  await fetchSymbols();
  await queryCoverage();
});
onBeforeUnmount(() => {
  generation++;
  stopPolling();
});
</script>

<template>
  <div class="p-4 minute-calendar-page">
    <div class="page-heading">
      <div class="flex items-center gap-3">
        <el-button @click="router.push('/ai/backtest')">返回历史回测</el-button>
        <div>
          <div class="text-lg font-semibold">1m K线完整性</div>
          <div class="text-xs text-gray-500 mt-1">
            查看已保存的合约分钟 K线；仅点击补齐时才下载数据，按 UTC 日期统计。
          </div>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="mb-4">
      <div class="filter-line">
        <div class="filter-field">
          <span>币种</span>
          <el-select
            v-model="symbol"
            filterable
            placeholder="选择币种"
            style="width: 200px"
          >
            <el-option
              v-for="item in symbolOptions"
              :key="item"
              :value="item"
              :label="item"
            />
          </el-select>
        </div>
        <div class="filter-field">
          <span>月份范围</span>
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            value-format="YYYY-MM"
            :clearable="false"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            style="width: 290px"
          />
        </div>
        <el-button type="primary" :loading="loading" @click="queryCoverage"
          >查询</el-button
        >
        <el-button
          type="success"
          plain
          :disabled="!filtersMatchCoverage || isRepairing"
          @click="startRepair(monthRange[0], monthRange[1])"
          >补齐所选范围</el-button
        >
      </div>
    </el-card>

    <div v-if="coverage" class="text-sm text-gray-500 mb-3">
      {{ coverage.symbol }} · {{ coverage.from }} 至 {{ coverage.to }} · 完整
      {{ completedCount }} 个月 / 不完整 {{ incompleteCount }} 个月
    </div>
    <div v-if="repairJob" class="mb-4 repair-progress">
      <div class="flex justify-between text-sm mb-2">
        <span
          >补齐进度：{{ stageText(repairJob.stage) }}
          {{ repairJob.stage_detail || "" }}</span
        >
        <span>{{
          repairJob.status === "failed"
            ? repairJob.error
            : repairJob.progress + "%"
        }}</span>
      </div>
      <el-progress
        :percentage="repairJob.progress"
        :status="
          repairJob.status === 'failed'
            ? 'exception'
            : repairJob.status === 'succeeded'
              ? 'success'
              : undefined
        "
      />
    </div>

    <div v-loading="loading" class="calendar-layout">
      <el-card shadow="never" class="month-list">
        <template #header>
          <div class="flex justify-between items-center">
            <span>月度覆盖情况</span>
            <div class="legend">
              <span><i class="square complete" />完整</span>
              <span><i class="square partial" />不完整</span>
              <span><i class="square missing" />缺失</span>
              <span><i class="square future" />未开始</span>
            </div>
          </div>
        </template>
        <el-empty
          v-if="!months.length"
          description="请选择币种和月份范围查询"
        />
        <div v-else class="months-grid">
          <button
            v-for="item in months"
            :key="item.month"
            class="month-tile"
            :class="[item.status, { selected: selectedMonth === item.month }]"
            :aria-label="item.month + ' ' + statusName(item.status)"
            @click="selectedMonth = item.month"
          >
            <div class="month-title">
              <strong>{{ item.month }}</strong>
              <el-tag
                size="small"
                :type="
                  item.status === 'complete'
                    ? 'success'
                    : item.status === 'partial'
                      ? 'warning'
                      : 'danger'
                "
              >
                {{ statusName(item.status) }}
              </el-tag>
            </div>
            <div class="month-body">
              <div>
                <div class="month-percent">{{ item.percent.toFixed(2) }}%</div>
                <small>{{ monthTooltip(item) }}</small>
              </div>
              <div class="mini-days">
                <el-tooltip
                  v-for="day in item.days"
                  :key="day.date"
                  :content="dayTooltip(day)"
                  placement="top"
                >
                  <i :class="['square', day.status]" />
                </el-tooltip>
              </div>
            </div>
          </button>
        </div>
      </el-card>

      <el-card shadow="never" class="month-detail">
        <template #header>
          <div class="flex items-center justify-between">
            <strong>{{ selected?.month || "月份详情" }}</strong>
            <el-tag
              v-if="selected"
              :type="selected.status === 'complete' ? 'success' : 'warning'"
            >
              {{ statusName(selected.status) }}
            </el-tag>
          </div>
        </template>
        <template v-if="selected">
          <div class="detail-stat">
            <div>
              <span>覆盖率</span
              ><strong>{{ selected.percent.toFixed(2) }}%</strong>
            </div>
            <div>
              <span>已保存分钟</span
              ><b>{{ selected.stored.toLocaleString() }}</b>
            </div>
            <div>
              <span>应有分钟</span
              ><b>{{ selected.expected.toLocaleString() }}</b>
            </div>
            <div>
              <span>缺失分钟</span
              ><b>{{
                (selected.expected - selected.stored).toLocaleString()
              }}</b>
            </div>
          </div>
          <div class="text-sm font-medium mb-3">每天的数据覆盖</div>
          <div class="day-grid">
            <span
              v-for="name in ['一', '二', '三', '四', '五', '六', '日']"
              :key="name"
              class="weekday"
              >{{ name }}</span
            >
            <template
              v-for="(day, i) in selectedCells"
              :key="day?.date || 'empty-' + i"
            >
              <el-tooltip v-if="day" :content="dayTooltip(day)" placement="top">
                <div class="day-cell" :class="day.status">
                  {{ Number(day.date.slice(-2)) }}
                </div>
              </el-tooltip>
              <div v-else class="day-cell blank" />
            </template>
          </div>
          <p class="detail-hint">
            绿色表示当天所有已结束的分钟
            K线完整，黄色表示部分缺失，红色表示完全缺失。
          </p>
          <el-button
            type="primary"
            class="repair-month-button"
            :disabled="
              !filtersMatchCoverage ||
              isRepairing ||
              selected.status === 'complete' ||
              selected.status === 'future'
            "
            @click="startRepair(selected.month, selected.month)"
            >补齐当月（{{ selected.month }}）</el-button
          >
        </template>
        <el-empty v-else description="点击左侧月份查看详情" />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.minute-calendar-page {
  min-height: 100%;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.filter-line {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
}

.filter-field {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  white-space: nowrap;
}

.calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.month-list,
.month-detail {
  min-width: 0;
}

.month-tile {
  padding: 14px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.month-tile:hover,
.month-tile.selected {
  border-color: var(--el-color-primary);
}

.month-tile.selected {
  box-shadow: 0 0 0 1px var(--el-color-primary);
}

.month-tile.complete {
  background: var(--el-color-success-light-9);
}

.month-tile.partial {
  background: var(--el-color-warning-light-9);
}

.month-tile.missing {
  background: var(--el-color-danger-light-9);
}

.month-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.month-title strong {
  font-size: 16px;
}

.month-body {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  justify-content: space-between;
}

.month-percent {
  margin-bottom: 6px;
  font-size: 21px;
  font-weight: 650;
}

.month-body small {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.mini-days {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(7, 8px);
  gap: 3px;
}

.square {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--el-fill-color-darker);
  border-radius: 2px;
}

.square.complete,
.day-cell.complete {
  background: var(--el-color-success-light-7);
}

.square.partial,
.day-cell.partial {
  background: var(--el-color-warning-light-7);
}

.square.missing,
.day-cell.missing {
  background: var(--el-color-danger-light-7);
}

.square.future,
.day-cell.future {
  background: var(--el-fill-color-darker);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.legend span {
  display: flex;
  gap: 5px;
  align-items: center;
}

.detail-stat {
  padding: 12px;
  margin-bottom: 20px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.detail-stat > div {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
}

.detail-stat > div span {
  color: var(--el-text-color-secondary);
}

.detail-stat strong {
  font-size: 18px;
  color: var(--el-color-primary);
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}

.weekday {
  padding-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.day-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  font-size: 12px;
  border-radius: 5px;
}

.day-cell.blank {
  background: transparent;
}

.detail-hint {
  margin: 14px 0 20px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.repair-month-button {
  width: 100%;
}

.repair-progress {
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

@media (width <= 1150px) {
  .calendar-layout {
    grid-template-columns: 1fr;
  }
}

@media (width <= 700px) {
  .months-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .legend {
    gap: 5px;
  }
}

@media (width <= 470px) {
  .months-grid {
    grid-template-columns: 1fr;
  }
}
</style>
