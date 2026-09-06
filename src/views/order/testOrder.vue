<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import {
  delResults,
  delResultsByQuery,
  getResults
} from "../../api/testStrategyResult";

defineOptions({ name: "testStrategyResult" });
const { t } = useI18n();

const list = ref<any[]>([]);
const total = ref(0);
const currentProfit = ref("0.00");
const loading = ref(false);
const deleting = ref(false);
const statsTab = ref("template");

interface ReviewStatsGroup {
  key: string;
  template_id?: number;
  template_name?: string;
  strategy_name?: string;
  strategy_type?: string;
  version_hash?: string;
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  gross_profit: number;
  net_profit: number;
  fees: number;
  average_net_profit: number;
}

interface ReviewStats {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  gross_profit: number;
  net_profit: number;
  fees: number;
  average_net_profit: number;
  long_trades: number;
  short_trades: number;
  by_template: ReviewStatsGroup[];
  by_open_strategy: ReviewStatsGroup[];
  by_close_strategy: ReviewStatsGroup[];
}

function emptyStats(): ReviewStats {
  return {
    total: 0,
    open: 0,
    closed: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    win_rate: 0,
    gross_profit: 0,
    net_profit: 0,
    fees: 0,
    average_net_profit: 0,
    long_trades: 0,
    short_trades: 0,
    by_template: [],
    by_open_strategy: [],
    by_close_strategy: []
  };
}

const stats = ref<ReviewStats>(emptyStats());
const activeStatsGroups = computed<ReviewStatsGroup[]>(() => {
  if (statsTab.value === "open") return stats.value.by_open_strategy || [];
  if (statsTab.value === "close") return stats.value.by_close_strategy || [];
  return stats.value.by_template || [];
});

const searchCacheKey = "testStrategyResultSearchParams";

function loadSearchCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(searchCacheKey) || "{}");
    return {
      symbol: typeof cache.symbol === "string" ? cache.symbol : "",
      strategy_template_name:
        typeof cache.strategy_template_name === "string"
          ? cache.strategy_template_name
          : "",
      open_strategy_name:
        typeof cache.open_strategy_name === "string"
          ? cache.open_strategy_name
          : "",
      close_strategy_name:
        typeof cache.close_strategy_name === "string"
          ? cache.close_strategy_name
          : "",
      type: ["all", "open", "close"].includes(cache.type) ? cache.type : "",
      position_side: ["all", "LONG", "SHORT"].includes(cache.position_side)
        ? cache.position_side
        : "",
      start_time: Number(cache.start_time) || undefined,
      end_time: Number(cache.end_time) || undefined
    };
  } catch {
    return {};
  }
}

const query = reactive<any>({
  page: 1,
  limit: 20,
  symbol: "",
  strategy_template_name: "",
  open_strategy_name: "",
  close_strategy_name: "",
  type: "",
  position_side: "",
  start_time: undefined,
  end_time: undefined,
  ...loadSearchCache()
});

const searchParams = computed(() => ({
  symbol: query.symbol.trim() || undefined,
  strategy_template_name: query.strategy_template_name.trim() || undefined,
  open_strategy_name: query.open_strategy_name.trim() || undefined,
  close_strategy_name: query.close_strategy_name.trim() || undefined,
  type: query.type && query.type !== "all" ? query.type : undefined,
  position_side:
    query.position_side && query.position_side !== "all"
      ? query.position_side
      : undefined,
  start_time: query.start_time ? +new Date(query.start_time) : undefined,
  end_time: query.end_time ? +new Date(query.end_time) : undefined
}));

const hasSearchCondition = computed(() =>
  Object.values(searchParams.value).some(value => value !== undefined)
);

function formatTime(ts: number | string) {
  if (!ts) return "-";
  return dayjs(Number(ts)).format("YYYY-MM-DD HH:mm:ss");
}

function toPeriod(endTime: number, startTime: number) {
  if (!endTime || !startTime) return "-";
  const totalMinutes = Math.floor((endTime - startTime) / 1000 / 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function isClosed(row: any) {
  return Number(row.close_price) > 0;
}

function displayClosePrice(row: any) {
  return isClosed(row) ? row.close_price : "-";
}

function positionSideLabel(positionSide: string) {
  const side = String(positionSide || "").toLowerCase();
  if (side === "long" || side === "short") {
    return t(`testOrderPage.state.${side}`);
  }
  return positionSide || "-";
}

function profitClass(value: number | string) {
  const profit = Number(value);
  if (profit > 0) return "text-green-500";
  if (profit < 0) return "text-red-500";
  return "";
}

function shortHash(value?: string) {
  const hash = String(value || "").trim();
  return hash ? hash.slice(0, 10) : "-";
}

function strategyTemplateLabel(row: any) {
  const name = String(row.strategy_template_name || "").trim();
  if (!name) return t("testOrderPage.state.customStrategy");
  return row.strategy_template_id
    ? `${name} #${row.strategy_template_id}`
    : name;
}

function strategyRuleLabel(row: any, prefix: "open" | "close") {
  const name = String(row[`${prefix}_strategy_name`] || "").trim();
  return name || t("testOrderPage.state.unknownStrategy");
}

function statsGroupName(row: ReviewStatsGroup) {
  if (statsTab.value === "template") {
    const name = row.template_name || t("testOrderPage.state.customStrategy");
    return row.template_id ? `${name} #${row.template_id}` : name;
  }
  return row.strategy_name || t("testOrderPage.state.unknownStrategy");
}

function formatStat(value: number) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(3) : "0.000";
}

function saveSearchCache() {
  localStorage.setItem(
    searchCacheKey,
    JSON.stringify({
      symbol: query.symbol,
      strategy_template_name: query.strategy_template_name,
      open_strategy_name: query.open_strategy_name,
      close_strategy_name: query.close_strategy_name,
      type: query.type,
      position_side: query.position_side,
      start_time: searchParams.value.start_time,
      end_time: searchParams.value.end_time
    })
  );
}

function search() {
  saveSearchCache();
  fetchData(true);
}

async function fetchData(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const res = await getResults({
      page: query.page,
      limit: query.limit,
      ...searchParams.value
    });
    const data = res?.data || {};
    list.value = (data.list || []).map((row: any) => ({
      ...row,
      period:
        row.createTime === row.updateTime
          ? "-"
          : toPeriod(row.updateTime, row.createTime)
    }));
    total.value = Number(data.total || 0);
    stats.value = { ...emptyStats(), ...(data.stats || {}) };
    const profit = Number(data.current_profit || 0);
    currentProfit.value = Number.isFinite(profit) ? profit.toFixed(2) : "0.00";
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("testOrderPage.confirm.delete", { symbol: row.symbol }),
    t("testOrderPage.confirm.title"),
    { type: "warning" }
  );
  await delResults(row.id);
  ElMessage.success(t("testOrderPage.message.deleteSuccess"));
  await fetchData();
}

async function onDeleteFiltered() {
  if (!hasSearchCondition.value) {
    ElMessage.warning(t("testOrderPage.message.searchRequired"));
    return;
  }

  await ElMessageBox.confirm(
    t("testOrderPage.confirm.deleteFiltered"),
    t("testOrderPage.confirm.title"),
    { type: "warning" }
  );

  deleting.value = true;
  try {
    const res = await delResultsByQuery(searchParams.value);
    ElMessage.success(
      t("testOrderPage.message.deleteFilteredSuccess", {
        count: Number(res?.data?.deleted || 0)
      })
    );
    await fetchData(true);
  } finally {
    deleting.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.symbol"
        :placeholder="t('testOrderPage.placeholder.symbol')"
        style="width: 140px"
        @keyup.enter="search"
      />
      <el-input
        v-model="query.strategy_template_name"
        :placeholder="t('testOrderPage.placeholder.strategyTemplate')"
        style="width: 160px"
        @keyup.enter="search"
      />
      <el-input
        v-model="query.open_strategy_name"
        :placeholder="t('testOrderPage.placeholder.openStrategy')"
        style="width: 150px"
        @keyup.enter="search"
      />
      <el-input
        v-model="query.close_strategy_name"
        :placeholder="t('testOrderPage.placeholder.closeStrategy')"
        style="width: 150px"
        @keyup.enter="search"
      />
      <el-select
        v-model="query.type"
        clearable
        :placeholder="t('testOrderPage.placeholder.status')"
        style="width: 100px"
        ><el-option
          :label="t('testOrderPage.state.all')"
          value="all" /><el-option
          :label="t('testOrderPage.state.open')"
          value="open" /><el-option
          :label="t('testOrderPage.state.close')"
          value="close"
      /></el-select>
      <el-select
        v-model="query.position_side"
        clearable
        :placeholder="t('testOrderPage.placeholder.side')"
        style="width: 100px"
        ><el-option
          :label="t('testOrderPage.state.all')"
          value="all" /><el-option
          :label="t('testOrderPage.state.long')"
          value="LONG" /><el-option
          :label="t('testOrderPage.state.short')"
          value="SHORT"
      /></el-select>
      <el-date-picker
        v-model="query.start_time"
        type="datetime"
        :placeholder="t('testOrderPage.placeholder.startTime')"
      />
      <el-date-picker
        v-model="query.end_time"
        type="datetime"
        :placeholder="t('testOrderPage.placeholder.endTime')"
      />
      <el-button type="primary" :loading="loading" @click="search">{{
        t("testOrderPage.button.search")
      }}</el-button>
      <el-button
        type="danger"
        :disabled="!hasSearchCondition"
        :loading="deleting"
        @click="onDeleteFiltered"
        >{{ t("testOrderPage.button.deleteFiltered") }}</el-button
      >
      <span class="ml-auto"
        >{{ t("testOrderPage.label.currentProfit") }}: {{ currentProfit }}</span
      >
    </div>

    <div class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.total") }}
        </div>
        <div class="mt-1 text-lg font-semibold">{{ stats.total }}</div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.open") }}
        </div>
        <div class="mt-1 text-lg font-semibold">{{ stats.open }}</div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.closed") }}
        </div>
        <div class="mt-1 text-lg font-semibold">{{ stats.closed }}</div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.wins") }}
        </div>
        <div class="mt-1 text-lg font-semibold text-green-500">
          {{ stats.wins }}
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.losses") }}
        </div>
        <div class="mt-1 text-lg font-semibold text-red-500">
          {{ stats.losses }}
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.breakeven") }}
        </div>
        <div class="mt-1 text-lg font-semibold">{{ stats.breakeven }}</div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.winRate") }}
        </div>
        <div class="mt-1 text-lg font-semibold">
          {{ formatStat(stats.win_rate) }}%
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.netProfit") }}
        </div>
        <div
          class="mt-1 text-lg font-semibold"
          :class="profitClass(stats.net_profit)"
        >
          {{ formatStat(stats.net_profit) }}
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.fee") }}
        </div>
        <div class="mt-1 text-lg font-semibold">
          {{ formatStat(stats.fees) }}
        </div>
      </el-card>
      <el-card shadow="never">
        <div class="text-xs text-gray-500">
          {{ t("testOrderPage.stats.averageNetProfit") }}
        </div>
        <div
          class="mt-1 text-lg font-semibold"
          :class="profitClass(stats.average_net_profit)"
        >
          {{ formatStat(stats.average_net_profit) }}
        </div>
      </el-card>
    </div>

    <el-card shadow="never" class="mb-3">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("testOrderPage.stats.title") }}</span>
          <span class="text-xs text-gray-500">
            {{ t("testOrderPage.stats.realizedHint") }}
          </span>
        </div>
      </template>
      <el-tabs v-model="statsTab">
        <el-tab-pane
          :label="t('testOrderPage.stats.template')"
          name="template"
        />
        <el-tab-pane
          :label="t('testOrderPage.stats.openStrategy')"
          name="open"
        />
        <el-tab-pane
          :label="t('testOrderPage.stats.closeStrategy')"
          name="close"
        />
      </el-tabs>
      <el-table :data="activeStatsGroups" border size="small" max-height="300">
        <el-table-column :label="t('testOrderPage.stats.name')" min-width="180">
          <template #default="{ row }">{{ statsGroupName(row) }}</template>
        </el-table-column>
        <el-table-column :label="t('testOrderPage.stats.type')" min-width="110">
          <template #default="{ row }">{{ row.strategy_type || "-" }}</template>
        </el-table-column>
        <el-table-column
          :label="t('testOrderPage.stats.version')"
          min-width="110"
        >
          <template #default="{ row }">
            <el-tooltip :content="row.version_hash || '-'" placement="top">
              <span>{{ shortHash(row.version_hash) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          prop="total"
          :label="t('testOrderPage.stats.trades')"
          width="82"
        />
        <el-table-column
          prop="open"
          :label="t('testOrderPage.stats.open')"
          width="82"
        />
        <el-table-column
          prop="closed"
          :label="t('testOrderPage.stats.closed')"
          width="82"
        />
        <el-table-column
          prop="wins"
          :label="t('testOrderPage.stats.wins')"
          width="82"
        />
        <el-table-column
          prop="losses"
          :label="t('testOrderPage.stats.losses')"
          width="82"
        />
        <el-table-column
          prop="breakeven"
          :label="t('testOrderPage.stats.breakeven')"
          width="82"
        />
        <el-table-column :label="t('testOrderPage.stats.winRate')" width="100">
          <template #default="{ row }"
            >{{ formatStat(row.win_rate) }}%</template
          >
        </el-table-column>
        <el-table-column
          :label="t('testOrderPage.stats.netProfit')"
          min-width="105"
        >
          <template #default="{ row }">
            <span :class="profitClass(row.net_profit)">{{
              formatStat(row.net_profit)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('testOrderPage.stats.fee')" min-width="90">
          <template #default="{ row }">{{ formatStat(row.fees) }}</template>
        </el-table-column>
        <el-table-column
          :label="t('testOrderPage.stats.averageNetProfit')"
          min-width="120"
        >
          <template #default="{ row }">
            <span :class="profitClass(row.average_net_profit)">{{
              formatStat(row.average_net_profit)
            }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-table v-loading="loading" :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('testOrderPage.table.symbol')"
        min-width="120"
      />
      <el-table-column :label="t('testOrderPage.table.side')" min-width="90">
        <template #default="{ row }">
          {{ positionSideLabel(row.position_side) }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t('testOrderPage.table.strategyTemplate')"
        min-width="190"
      >
        <template #default="{ row }">
          <div>{{ strategyTemplateLabel(row) }}</div>
          <el-tooltip
            :content="row.strategy_snapshot_hash || '-'"
            placement="top"
          >
            <span class="text-xs text-gray-400">{{
              shortHash(row.strategy_snapshot_hash)
            }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('testOrderPage.table.openStrategy')"
        min-width="180"
      >
        <template #default="{ row }">
          <div>{{ strategyRuleLabel(row, "open") }}</div>
          <div class="text-xs text-gray-400">
            {{ row.open_strategy_type || "-" }} ·
            <el-tooltip
              :content="row.open_strategy_hash || '-'"
              placement="top"
            >
              <span>{{ shortHash(row.open_strategy_hash) }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('testOrderPage.table.closeStrategy')"
        min-width="180"
      >
        <template #default="{ row }">
          <div>{{ strategyRuleLabel(row, "close") }}</div>
          <div class="text-xs text-gray-400">
            {{ row.close_strategy_type || "-" }} ·
            <el-tooltip
              :content="row.close_strategy_hash || '-'"
              placement="top"
            >
              <span>{{ shortHash(row.close_strategy_hash) }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="position_amt"
        :label="t('testOrderPage.table.amount')"
        min-width="90"
      />
      <el-table-column prop="usdt" label="USDT" min-width="90" />
      <el-table-column
        prop="leverage"
        :label="t('testOrderPage.table.leverage')"
        min-width="80"
      />
      <el-table-column
        prop="price"
        :label="t('testOrderPage.table.openPrice')"
        min-width="100"
      />
      <el-table-column
        prop="now_price"
        :label="t('testOrderPage.table.nowPrice')"
        min-width="100"
      />
      <el-table-column
        :label="t('testOrderPage.table.grossProfit')"
        min-width="100"
      >
        <template #default="{ row }">
          <span :class="profitClass(row.close_profit)">
            {{ row.close_profit }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="t('testOrderPage.table.fee')" min-width="100">
        <template #default="{ row }">
          {{ row.total_fee }}
        </template>
      </el-table-column>
      <el-table-column :label="t('testOrderPage.table.profit')" min-width="100">
        <template #default="{ row }">
          <span :class="profitClass(row.gross_profit)">
            {{ row.gross_profit }}
          </span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('testOrderPage.table.profitRate')"
        min-width="100"
      >
        <template #default="{ row }">
          <span :class="profitClass(row.profit_percent)">
            {{ row.profit_percent }}
          </span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('testOrderPage.table.closePrice')"
        min-width="100"
      >
        <template #default="{ row }">
          {{ displayClosePrice(row) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="period"
        :label="t('testOrderPage.table.period')"
        min-width="100"
      />
      <el-table-column
        :label="t('testOrderPage.table.createTime')"
        min-width="170"
        ><template #default="{ row }">{{
          formatTime(row.createTime)
        }}</template></el-table-column
      >
      <el-table-column :label="t('testOrderPage.table.operation')" width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("testOrderPage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <div class="mt-3 flex items-center justify-between">
      <span>{{ t("testOrderPage.label.total") }}: {{ total }}</span>
      <el-pagination
        :current-page="query.page"
        :page-size="query.limit"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100, 200, 500, 1000, 10000]"
        :total="total"
        @current-change="
          page => {
            query.page = page;
            fetchData();
          }
        "
        @size-change="
          size => {
            query.limit = size;
            fetchData(true);
          }
        "
      />
    </div>
  </div>
</template>
