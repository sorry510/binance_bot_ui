<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import {
  getFuturesAccount,
  getFuturesOpenOrders,
  getFuturesPositions
} from "../../api/trade";

defineOptions({
  name: "futuresAccount"
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
    .reduce((sum, row) => sum + Number(row.unRealizedProfit || 0), 0)
    .toFixed(2);
});

function formatTime(ts: number | string) {
  if (!ts) return "-";
  const d = new Date(Number(ts));
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

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

async function fetchData(type = tabName.value) {
  if (type === "account") {
    const res = await getFuturesAccount();
    const assets = res?.data?.assets || [];
    accountAssets.value = assets.filter(
      (item: any) => Number(item.walletBalance) > 0
    );
  } else if (type === "position") {
    const res = await getFuturesPositions();
    const rows = res?.data?.positions || [];
    positions.value = rows
      .filter(
        (item: any) =>
          !search.symbol ||
          String(item.symbol).includes(search.symbol.toUpperCase())
      )
      .map((position: any) => {
        const positionAmtFloatAbs = Math.abs(Number(position.positionAmt || 0));
        const unRealizedProfit = Number(position.unRealizedProfit || 0);
        const leverage = Number(position.leverage || 0);
        const markPrice = Number(position.markPrice || 0);
        const nowProfit =
          positionAmtFloatAbs > 0 && markPrice > 0
            ? (unRealizedProfit / (positionAmtFloatAbs * markPrice)) *
              leverage *
              100
            : 0;

        return {
          ...position,
          unRealizedProfit: Number(unRealizedProfit.toFixed(2)),
          nowProfit: Number(nowProfit.toFixed(6))
        };
      });
  } else if (type === "openOrder") {
    const res = await getFuturesOpenOrders();
    openOrders.value = res?.data?.openOrders || [];
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
      <el-tab-pane :label="t('futuresAccountPage.tab.asset')" name="account">
        <el-table :data="accountAssets" border size="small">
          <el-table-column
            prop="asset"
            :label="t('futuresAccountPage.table.asset')"
            min-width="100"
          />
          <el-table-column
            prop="walletBalance"
            :label="t('futuresAccountPage.table.balance')"
            min-width="120"
          />
          <el-table-column
            prop="unrealizedProfit"
            :label="t('futuresAccountPage.table.unrealized')"
            min-width="120"
          />
          <el-table-column
            prop="marginBalance"
            :label="t('futuresAccountPage.table.marginBalance')"
            min-width="120"
          />
          <el-table-column
            prop="availableBalance"
            :label="t('futuresAccountPage.table.available')"
            min-width="120"
          />
          <el-table-column
            prop="maxWithdrawAmount"
            :label="t('futuresAccountPage.table.maxWithdraw')"
            min-width="120"
          />
          <el-table-column
            :label="t('futuresAccountPage.table.updateTime')"
            min-width="180"
          >
            <template #default="{ row }">{{
              formatTime(row.updateTime)
            }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane
        :label="t('futuresAccountPage.tab.position')"
        name="position"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <el-input
            v-model="search.symbol"
            :placeholder="t('futuresAccountPage.placeholder.symbol')"
            style="width: 150px"
            clearable
            @keyup.enter="fetchData('position')"
          />
          <el-button type="success" @click="fetchData('position')">{{
            t("futuresAccountPage.button.search")
          }}</el-button>
          <span
            >{{ t("futuresAccountPage.label.currentProfit") }}:
            {{ allProfit }}</span
          >
          <span
            >{{ t("futuresAccountPage.label.positionCount") }}:
            {{ positions.length }}</span
          >
          <el-select
            v-model="interval"
            style="width: 90px"
            @change="changeRefreshInterval"
          >
            <el-option v-for="n in 30" :key="n" :label="`${n}s`" :value="n" />
          </el-select>
          <span>{{ t("futuresAccountPage.label.refreshInterval") }}</span>
        </div>

        <el-table :data="positions" border size="small">
          <el-table-column
            prop="symbol"
            :label="t('futuresAccountPage.table.symbol')"
            min-width="120"
          />
          <el-table-column
            prop="positionAmt"
            :label="t('futuresAccountPage.table.positionAmt')"
            min-width="100"
          />
          <el-table-column
            prop="entryPrice"
            :label="t('futuresAccountPage.table.entryPrice')"
            min-width="100"
          />
          <el-table-column
            prop="markPrice"
            :label="t('futuresAccountPage.table.markPrice')"
            min-width="100"
          />
          <el-table-column
            :label="t('futuresAccountPage.table.unrealized')"
            min-width="120"
          >
            <template #default="{ row }">
              <span :style="{ color: row.nowProfit < 0 ? 'red' : 'green' }">{{
                row.unRealizedProfit
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('futuresAccountPage.table.profitRate')"
            min-width="100"
          >
            <template #default="{ row }">
              <span :style="{ color: row.nowProfit < 0 ? 'red' : 'green' }">{{
                row.nowProfit
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="leverage"
            :label="t('futuresAccountPage.table.leverage')"
            min-width="80"
          />
          <el-table-column
            prop="positionSide"
            :label="t('futuresAccountPage.table.side')"
            min-width="90"
          />
        </el-table>
      </el-tab-pane>

      <el-tab-pane
        :label="t('futuresAccountPage.tab.openOrder')"
        name="openOrder"
      >
        <el-table :data="openOrders" border size="small">
          <el-table-column
            prop="symbol"
            :label="t('futuresAccountPage.table.symbol')"
            min-width="120"
          />
          <el-table-column
            prop="price"
            :label="t('futuresAccountPage.table.orderPrice')"
            min-width="100"
          />
          <el-table-column
            prop="origQty"
            :label="t('futuresAccountPage.table.orderQty')"
            min-width="100"
          />
          <el-table-column
            prop="executedQty"
            :label="t('futuresAccountPage.table.executedQty')"
            min-width="100"
          />
          <el-table-column
            prop="side"
            :label="t('futuresAccountPage.table.tradeSide')"
            min-width="90"
          />
          <el-table-column
            prop="positionSide"
            :label="t('futuresAccountPage.table.positionSide')"
            min-width="90"
          />
          <el-table-column
            :label="t('futuresAccountPage.table.updateTime')"
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
