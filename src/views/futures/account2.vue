<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  delLocalFuturesPositions,
  getFuturesAccount,
  getLocalFuturesOpenOrders,
  getLocalFuturesPositions,
  updateLocalFuturesPositions
} from "../../api/trade";

defineOptions({
  name: "futuresAccount2"
});
const { t } = useI18n();

const tabName = ref("position");
const accountAssets = ref<any[]>([]);
const positions = ref<any[]>([]);
const openOrders = ref<any[]>([]);
const interval = ref(
  Number(localStorage.getItem("accountRefreshInterval") || 30)
);
const timer = ref<number | null>(null);
const search = reactive({ symbol: "" });

const allProfit = computed(() => {
  return positions.value
    .reduce((sum, row) => sum + Number(row.unrealized_profit || 0), 0)
    .toFixed(2);
});

function clearTimer() {
  if (timer.value) {
    window.clearInterval(timer.value);
    timer.value = null;
  }
}

function startTimer() {
  clearTimer();
  timer.value = window.setInterval(() => {
    fetchData(tabName.value);
  }, interval.value * 1000);
}

function formatTime(ts: number | string) {
  if (!ts) return "-";
  const d = new Date(Number(ts));
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

async function getPositions() {
  const res = await getLocalFuturesPositions();
  const rows = res?.data?.positions || [];
  positions.value = rows
    .filter(
      (item: any) =>
        !search.symbol ||
        String(item.symbol).includes(search.symbol.toUpperCase())
    )
    .map((position: any) => {
      const positionAmtFloatAbs = Math.abs(Number(position.amount || 0));
      const unRealizedProfit = Number(position.unrealized_profit || 0);
      const leverage = Number(position.leverage || 0);
      const markPrice = Number(position.mark_price || 0);
      const nowProfit =
        positionAmtFloatAbs > 0 && markPrice > 0
          ? (unRealizedProfit / (positionAmtFloatAbs * markPrice)) *
            leverage *
            100
          : 0;

      return {
        ...position,
        unrealized_profit: Number(unRealizedProfit.toFixed(2)),
        nowProfit: Number(nowProfit.toFixed(4))
      };
    });
}

async function fetchData(type = tabName.value) {
  if (type === "account") {
    const res = await getFuturesAccount();
    accountAssets.value = res?.data?.assets || [];
  } else if (type === "position") {
    await getPositions();
  } else if (type === "openOrder") {
    const res = await getLocalFuturesOpenOrders();
    openOrders.value = res?.data?.openOrders || [];
  }
}

async function onEditLeverage(row: any) {
  try {
    await updateLocalFuturesPositions(row.id, {
      leverage: Number(row.leverage)
    });
    ElMessage.success(t("futuresAccount2Page.message.updateSuccess"));
    await getPositions();
  } catch {
    ElMessage.error(t("futuresAccount2Page.message.updateFail"));
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("futuresAccount2Page.confirm.delete", { symbol: row.symbol }),
    t("futuresAccount2Page.confirm.title"),
    { type: "warning" }
  );
  try {
    await delLocalFuturesPositions(row.id);
    ElMessage.success(t("futuresAccount2Page.message.deleteSuccess"));
    await getPositions();
  } catch {
    ElMessage.error(t("futuresAccount2Page.message.deleteFail"));
  }
}

function changeRefreshInterval() {
  localStorage.setItem("accountRefreshInterval", String(interval.value));
  startTimer();
}

watch(tabName, async val => {
  await fetchData(val);
  startTimer();
});

onMounted(async () => {
  await fetchData();
  startTimer();
});

onBeforeUnmount(() => clearTimer());
</script>

<template>
  <div class="p-4">
    <el-tabs v-model="tabName">
      <el-tab-pane :label="t('futuresAccount2Page.tab.asset')" name="account">
        <el-table :data="accountAssets" border size="small">
          <el-table-column
            prop="asset"
            :label="t('futuresAccount2Page.table.asset')"
            min-width="100"
          />
          <el-table-column
            prop="walletBalance"
            :label="t('futuresAccount2Page.table.balance')"
            min-width="120"
          />
          <el-table-column
            prop="unrealizedProfit"
            :label="t('futuresAccount2Page.table.unrealized')"
            min-width="120"
          />
          <el-table-column
            prop="availableBalance"
            :label="t('futuresAccount2Page.table.available')"
            min-width="120"
          />
        </el-table>
      </el-tab-pane>

      <el-tab-pane
        :label="t('futuresAccount2Page.tab.position')"
        name="position"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <el-input
            v-model="search.symbol"
            :placeholder="t('futuresAccount2Page.placeholder.symbol')"
            style="width: 150px"
            clearable
            @keyup.enter="getPositions"
          />
          <el-button type="success" @click="getPositions">{{
            t("futuresAccount2Page.button.search")
          }}</el-button>
          <span
            >{{ t("futuresAccount2Page.label.currentProfit") }}:
            {{ allProfit }}</span
          >
          <span
            >{{ t("futuresAccount2Page.label.positionCount") }}:
            {{ positions.length }}</span
          >
          <el-select
            v-model="interval"
            style="width: 90px"
            @change="changeRefreshInterval"
          >
            <el-option v-for="n in 30" :key="n" :label="`${n}s`" :value="n" />
          </el-select>
          <span>{{ t("futuresAccount2Page.label.refreshInterval") }}</span>
        </div>

        <el-table :data="positions" border size="small">
          <el-table-column
            prop="symbol"
            :label="t('futuresAccount2Page.table.symbol')"
            min-width="120"
          />
          <el-table-column
            prop="amount"
            :label="t('futuresAccount2Page.table.positionAmt')"
            min-width="100"
          />
          <el-table-column
            prop="entry_price"
            :label="t('futuresAccount2Page.table.entryPrice')"
            min-width="100"
          />
          <el-table-column
            prop="mark_price"
            :label="t('futuresAccount2Page.table.markPrice')"
            min-width="100"
          />
          <el-table-column
            :label="t('futuresAccount2Page.table.unrealized')"
            min-width="120"
          >
            <template #default="{ row }">
              <span :style="{ color: row.nowProfit < 0 ? 'red' : 'green' }">{{
                row.unrealized_profit
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('futuresAccount2Page.table.profitRate')"
            min-width="100"
          >
            <template #default="{ row }">
              <span :style="{ color: row.nowProfit < 0 ? 'red' : 'green' }">{{
                row.nowProfit
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('futuresAccount2Page.table.leverage')"
            min-width="120"
          >
            <template #default="{ row }">
              <el-input v-model="row.leverage" @blur="onEditLeverage(row)" />
            </template>
          </el-table-column>
          <el-table-column
            prop="side"
            :label="t('futuresAccount2Page.table.side')"
            min-width="90"
          />
          <el-table-column
            :label="t('futuresAccount2Page.table.operation')"
            width="90"
          >
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="onDelete(row)">{{
                t("futuresAccount2Page.button.delete")
              }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane
        :label="t('futuresAccount2Page.tab.openOrder')"
        name="openOrder"
      >
        <el-table :data="openOrders" border size="small">
          <el-table-column
            prop="symbol"
            :label="t('futuresAccount2Page.table.symbol')"
            min-width="120"
          />
          <el-table-column
            prop="price"
            :label="t('futuresAccount2Page.table.orderPrice')"
            min-width="100"
          />
          <el-table-column
            prop="orig_qty"
            :label="t('futuresAccount2Page.table.orderQty')"
            min-width="100"
          />
          <el-table-column
            prop="executed_qty"
            :label="t('futuresAccount2Page.table.executedQty')"
            min-width="100"
          />
          <el-table-column
            prop="side"
            :label="t('futuresAccount2Page.table.tradeSide')"
            min-width="90"
          />
          <el-table-column
            prop="position_side"
            :label="t('futuresAccount2Page.table.positionSide')"
            min-width="90"
          />
          <el-table-column
            :label="t('futuresAccount2Page.table.updateTime')"
            min-width="180"
          >
            <template #default="{ row }">{{
              formatTime(row.updateTime)
            }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
