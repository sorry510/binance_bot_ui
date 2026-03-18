<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  editFundingRates,
  getFundingRateHistory,
  getFundingRates
} from "../../api/listenCoin";

defineOptions({ name: "fundingRates" });
const { t } = useI18n();

const list = ref<any[]>([]);
const history = ref<any[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref("");
const timer = ref<number | null>(null);
const search = reactive({ symbol: "" });

function clearTimer() {
  if (timer.value) {
    window.clearInterval(timer.value);
    timer.value = null;
  }
}

function formatTime(ts: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleString();
}

async function fetchData() {
  const res = await getFundingRates(search);
  list.value = res?.data || [];
}

async function showHistory(row: any) {
  dialogTitle.value = t("listenFundingRatePage.dialog.title", {
    symbol: row.symbol
  });
  dialogVisible.value = true;
  const res = await getFundingRateHistory({ symbol: row.symbol });
  history.value = (res?.data || []).slice().reverse();
}

async function saveRow(row: any) {
  await editFundingRates(row.id, { ...row });
  ElMessage.success(t("listenFundingRatePage.message.updateSuccess"));
}

onMounted(async () => {
  await fetchData();
  timer.value = window.setInterval(fetchData, 30000);
});

onBeforeUnmount(clearTimer);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-input
        v-model="search.symbol"
        :placeholder="t('listenFundingRatePage.placeholder.symbol')"
        style="width: 180px"
        @keyup.enter="fetchData"
      />
      <el-button type="primary" @click="fetchData">{{
        t("listenFundingRatePage.button.search")
      }}</el-button>
      <span class="ml-auto"
        >{{ t("listenFundingRatePage.label.total") }}: {{ list.length }}</span
      >
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('listenFundingRatePage.table.symbol')"
        min-width="120"
      />
      <el-table-column
        :label="t('listenFundingRatePage.table.rateNow')"
        min-width="140"
        ><template #default="{ row }">{{
          Number(row.now_funding_rate || 0) * 100
        }}</template></el-table-column
      >
      <el-table-column
        :label="t('listenFundingRatePage.table.time')"
        min-width="180"
        ><template #default="{ row }">{{
          formatTime(row.now_funding_time)
        }}</template></el-table-column
      >
      <el-table-column
        prop="now_price"
        :label="t('listenFundingRatePage.table.priceNow')"
        min-width="120"
      />
      <el-table-column
        :label="t('listenFundingRatePage.table.autoOrder')"
        width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.auto_order" @change="saveRow(row)"
            ><el-option
              :label="t('listenFundingRatePage.state.yes')"
              :value="1" /><el-option
              :label="t('listenFundingRatePage.state.no')"
              :value="0" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFundingRatePage.table.operation')"
        width="100"
        ><template #default="{ row }"
          ><el-button type="primary" size="small" @click="showHistory(row)">{{
            t("listenFundingRatePage.button.history")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px">
      <el-table :data="history" border size="small">
        <el-table-column
          :label="t('listenFundingRatePage.table.rate')"
          min-width="120"
          ><template #default="{ row }">{{
            Number(row.fundingRate || 0) * 100
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('listenFundingRatePage.table.time')"
          min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.fundingTime)
          }}</template></el-table-column
        >
        <el-table-column
          prop="markPrice"
          :label="t('listenFundingRatePage.table.price')"
          min-width="120"
        />
      </el-table>
    </el-dialog>
  </div>
</template>
