<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import {
  delAllResults,
  delResults,
  getResults
} from "../../api/testStrategyResult";

defineOptions({ name: "testStrategyResult" });
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
    .reduce((sum, row) => sum + Number(row.close_profit || 0), 0)
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

async function fetchData() {
  loading.value = true;
  try {
    const res = await getResults({
      ...query,
      start_time: query.start_time ? +new Date(query.start_time) : undefined,
      end_time: query.end_time ? +new Date(query.end_time) : undefined
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

async function onDeleteAll() {
  await ElMessageBox.confirm(
    t("testOrderPage.confirm.deleteAll"),
    t("testOrderPage.confirm.title"),
    { type: "warning" }
  );
  await delAllResults();
  ElMessage.success(t("testOrderPage.message.deleteSuccess"));
  await fetchData();
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
        @keyup.enter="fetchData"
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
          value="all" /><el-option label="LONG" value="LONG" /><el-option
          label="SHORT"
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
      <el-button type="primary" :loading="loading" @click="fetchData">{{
        t("testOrderPage.button.search")
      }}</el-button>
      <el-button type="danger" :loading="loading" @click="onDeleteAll">{{
        t("testOrderPage.button.deleteAll")
      }}</el-button>
      <span class="ml-auto"
        >{{ t("testOrderPage.label.currentProfit") }}: {{ allProfit }}</span
      >
    </div>
    <el-table v-loading="loading" :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('testOrderPage.table.symbol')"
        min-width="120"
      />
      <el-table-column
        prop="position_side"
        :label="t('testOrderPage.table.side')"
        min-width="90"
      />
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
        prop="close_profit"
        :label="t('testOrderPage.table.profit')"
        min-width="100"
      />
      <el-table-column
        prop="profit_percent"
        :label="t('testOrderPage.table.profitRate')"
        min-width="100"
      />
      <el-table-column
        prop="close_price"
        :label="t('testOrderPage.table.closePrice')"
        min-width="100"
      />
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
    <div class="mt-3 text-right">
      {{ t("testOrderPage.label.total") }}: {{ total }}
    </div>
  </div>
</template>
