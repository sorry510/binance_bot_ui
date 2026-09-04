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

const searchCacheKey = "testStrategyResultSearchParams";

function loadSearchCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(searchCacheKey) || "{}");
    return {
      symbol: typeof cache.symbol === "string" ? cache.symbol : "",
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
  type: "",
  position_side: "",
  start_time: undefined,
  end_time: undefined,
  ...loadSearchCache()
});

const searchParams = computed(() => ({
  symbol: query.symbol.trim() || undefined,
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

function saveSearchCache() {
  localStorage.setItem(
    searchCacheKey,
    JSON.stringify({
      symbol: query.symbol,
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
