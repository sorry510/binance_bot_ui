<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { delAllTrade, delTrade, getOrders } from "../../api/order";

defineOptions({ name: "OrderList" });
const { t } = useI18n();

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const query = reactive<any>({
  page: 1,
  limit: 200,
  symbol: "",
  type: "",
  position_side: "",
  start_time: undefined,
  end_time: undefined
});

const allProfit = computed(() =>
  list.value
    .reduce((sum, row) => sum + Number(row.inexact_profit || 0), 0)
    .toFixed(2)
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

function profitPercent(row: any) {
  let delta = Number(row.now_price) - Number(row.avg_price);
  if (row.positionSide === "SHORT") delta = -delta;
  return Number(row.now_price)
    ? ((delta / Number(row.now_price)) * Number(row.leverage) * 100).toFixed(3)
    : "0";
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getOrders({
      ...query,
      start_time: query.start_time ? +new Date(query.start_time) : undefined,
      end_time: query.end_time ? +new Date(query.end_time) : undefined
    });
    const data = res?.data || {};
    list.value = (data.list || []).map((item: any) => {
      const row = { ...item };
      if (row.closedTime) {
        row.period = toPeriod(row.closedTime, row.updateTime);
      } else {
        let delta = Number(row.now_price) - Number(row.avg_price);
        if (row.positionSide === "SHORT") delta = -delta;
        row.inexact_profit = delta * Number(row.amount || 0);
      }
      row.profit_percent = profitPercent(row);
      return row;
    });
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("orderPage.confirm.delete", { symbol: row.symbol }),
    t("orderPage.confirm.title"),
    { type: "warning" }
  );
  await delTrade(row.id);
  ElMessage.success(t("orderPage.message.deleteSuccess"));
  await fetchData();
}

async function onDeleteAll() {
  await ElMessageBox.confirm(
    t("orderPage.confirm.deleteAll"),
    t("orderPage.confirm.title"),
    { type: "warning" }
  );
  await delAllTrade();
  ElMessage.success(t("orderPage.message.deleteSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.symbol"
        :placeholder="t('orderPage.placeholder.symbol')"
        style="width: 140px"
        @keyup.enter="fetchData"
      />
      <el-select
        v-model="query.type"
        clearable
        :placeholder="t('orderPage.placeholder.status')"
        style="width: 100px"
        ><el-option :label="t('orderPage.state.all')" value="all" /><el-option
          :label="t('orderPage.state.open')"
          value="open" /><el-option
          :label="t('orderPage.state.closed')"
          value="close"
      /></el-select>
      <el-select
        v-model="query.position_side"
        clearable
        :placeholder="t('orderPage.placeholder.side')"
        style="width: 100px"
        ><el-option :label="t('orderPage.state.all')" value="all" /><el-option
          label="LONG"
          value="LONG" /><el-option label="SHORT" value="SHORT"
      /></el-select>
      <el-date-picker
        v-model="query.start_time"
        type="datetime"
        :placeholder="t('orderPage.placeholder.startTime')"
      />
      <el-date-picker
        v-model="query.end_time"
        type="datetime"
        :placeholder="t('orderPage.placeholder.endTime')"
      />
      <el-button type="primary" :loading="loading" @click="fetchData">{{
        t("orderPage.button.search")
      }}</el-button>
      <el-button type="danger" :loading="loading" @click="onDeleteAll">{{
        t("orderPage.button.deleteAll")
      }}</el-button>
      <span class="ml-auto"
        >{{ t("orderPage.label.currentProfit") }}: {{ allProfit }}</span
      >
    </div>
    <el-table v-loading="loading" :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('orderPage.table.symbol')"
        min-width="120"
      />
      <el-table-column
        prop="positionSide"
        :label="t('orderPage.table.side')"
        min-width="90"
      />
      <el-table-column
        prop="amount"
        :label="t('orderPage.table.amount')"
        min-width="90"
      />
      <el-table-column
        prop="leverage"
        :label="t('orderPage.table.leverage')"
        min-width="80"
      />
      <el-table-column
        prop="avg_price"
        :label="t('orderPage.table.avgPrice')"
        min-width="110"
      />
      <el-table-column
        prop="now_price"
        :label="t('orderPage.table.nowPrice')"
        min-width="110"
      />
      <el-table-column
        prop="inexact_profit"
        :label="t('orderPage.table.profit')"
        min-width="110"
      />
      <el-table-column
        prop="profit_percent"
        :label="t('orderPage.table.profitRate')"
        min-width="100"
      />
      <el-table-column
        prop="period"
        :label="t('orderPage.table.period')"
        min-width="100"
      />
      <el-table-column :label="t('orderPage.table.updateTime')" min-width="170"
        ><template #default="{ row }">{{
          formatTime(row.updateTime)
        }}</template></el-table-column
      >
      <el-table-column :label="t('orderPage.table.operation')" width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("orderPage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <div class="mt-3 text-right">
      {{ t("orderPage.label.total") }}: {{ total }}
    </div>
  </div>
</template>
