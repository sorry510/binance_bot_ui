<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
const total = ref(0);
const pagination = reactive({ page: 1, limit: 50 });
const history = ref<any[]>([]);
const historyPagination = reactive({ page: 1, limit: 50 });
const visibleHistory = computed(() => {
  const start = (historyPagination.page - 1) * historyPagination.limit;
  return history.value.slice(start, start + historyPagination.limit);
});
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

async function fetchData(resetPage = false) {
  if (resetPage) pagination.page = 1;
  const res = await getFundingRates({
    symbol: search.symbol,
    page: pagination.page,
    limit: pagination.limit
  });
  if (res?.code !== 200 || !res?.data) return;
  list.value = res.data.list || [];
  total.value = Number(res.data.total || 0);
  pagination.page = Number(res.data.page || 1);
}

function changePage(page: number) {
  pagination.page = page;
  void fetchData();
}

function changePageSize(size: number) {
  pagination.limit = size;
  void fetchData(true);
}

async function showHistory(row: any) {
  dialogTitle.value = t("listenFundingRatePage.dialog.title", {
    symbol: row.symbol
  });
  dialogVisible.value = true;
  historyPagination.page = 1;
  history.value = [];
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
        @keyup.enter="fetchData(true)"
      />
      <el-button type="primary" @click="fetchData(true)">{{
        t("listenFundingRatePage.button.search")
      }}</el-button>
      <span class="ml-auto"
        >{{ t("listenFundingRatePage.label.total") }}: {{ total }}</span
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
    <div class="mt-3 flex justify-end">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :page-sizes="[20, 50, 100, 200]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next"
        @current-change="changePage"
        @size-change="changePageSize"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px">
      <el-table :data="visibleHistory" border size="small">
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
      <div class="mt-3 flex justify-end">
        <el-pagination
          v-model:current-page="historyPagination.page"
          v-model:page-size="historyPagination.limit"
          :page-sizes="[20, 50, 100, 200]"
          :total="history.length"
          background
          layout="total, sizes, prev, pager, next"
          @size-change="historyPagination.page = 1"
        />
      </div>
    </el-dialog>
  </div>
</template>
