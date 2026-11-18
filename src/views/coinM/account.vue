<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getCoinMPositions,
  getCoinMOrders,
  getCoinMPositionDetail,
  getCoinMWallet,
  type CoinMAssetTotal,
  type CoinMWallet,
  type CoinMPosition,
  type CoinMManagedOrder,
  type CoinMPositionDetail
} from "@/api/coinM";

defineOptions({ name: "CoinMAccountPage" });
const props = withDefaults(defineProps<{ controlled?: boolean }>(), {
  controlled: false
});
const { t } = useI18n();
const loading = ref(false);
const detailLoading = ref(false);
const tab = ref("positions");
const filters = reactive({ symbol: "", status: "", page: 1, limit: 20 });
const total = ref(0);
const positions = ref<CoinMPosition[]>([]);
const orders = ref<CoinMManagedOrder[]>([]);
const totals = ref<CoinMAssetTotal[]>([]);
const priceStatus = ref("not_required");
const showUSD = ref(false);
const wallet = ref<CoinMWallet | null>(null);
const walletError = ref("");
const walletLoading = ref(false);
const detailVisible = ref(false);
const detail = ref<CoinMPositionDetail | null>(null);

function fmtTime(ms: number | undefined) {
  if (!ms) return "-";
  return new Date(Number(ms)).toLocaleString();
}
function mustSucceed<T extends { code: number; msg: string }>(res: T): T {
  if (!res || res.code !== 200)
    throw new Error(res?.msg || "COIN-M read error");
  return res;
}
async function load(reset = false) {
  if (reset) filters.page = 1;
  loading.value = true;
  try {
    const params = {
      symbol: filters.symbol.trim().toUpperCase(),
      status: filters.status,
      page: filters.page,
      limit: filters.limit
    };
    if (tab.value === "positions") {
      const res = mustSucceed(await getCoinMPositions(params));
      positions.value = res.data?.list || [];
      totals.value = res.data?.totals || [];
      priceStatus.value = res.data?.price_status || "unavailable";
      total.value = Number(res.data?.total || 0);
    } else {
      const res = mustSucceed(await getCoinMOrders(params));
      orders.value = res.data?.list || [];
      totals.value = [];
      total.value = Number(res.data?.total || 0);
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.msg || error?.message || "COIN-M");
  } finally {
    loading.value = false;
  }
}
function switchTab() {
  filters.page = 1;
  filters.status = "";
  void load();
}
function reset() {
  filters.symbol = "";
  filters.status = "";
  void load(true);
}
async function showDetail(id: number) {
  detailVisible.value = true;
  detail.value = null;
  detailLoading.value = true;
  try {
    const res = mustSucceed(await getCoinMPositionDetail(id));
    detail.value = res.data;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.msg || error?.message || "COIN-M");
  } finally {
    detailLoading.value = false;
  }
}
async function loadWallet() {
  walletLoading.value = true;
  walletError.value = "";
  wallet.value = null;
  try {
    const response = mustSucceed(await getCoinMWallet());
    wallet.value = response.data;
  } catch (error: any) {
    walletError.value =
      error?.response?.data?.msg ||
      error?.message ||
      t("coinMPage.account.walletUnavailable");
  } finally {
    walletLoading.value = false;
  }
}
function formatted(value: string | null | undefined, asset: string) {
  return value == null ? "—" : `${value} ${asset}`;
}
function feeText(fees: CoinMAssetTotal["fees"] | undefined) {
  return fees?.length
    ? fees.map(f => `${f.amount} ${f.asset}`).join(" / ")
    : "—";
}
function pnlStatusLabel(value: string) {
  const known = [
    "verified",
    "unpriced",
    "invalid",
    "unverified_fills",
    "pending_fills"
  ];
  return known.includes(value)
    ? t("coinMPage.account.pnlStatuses." + value)
    : value;
}
onMounted(() => {
  void load();
  if (!props.controlled) void loadWallet();
});
</script>

<template>
  <div class="p-4">
    <el-alert
      type="info"
      show-icon
      :closable="false"
      class="mb-4"
      :title="
        props.controlled
          ? t('coinMPage.controlled.title')
          : t('coinMPage.account.title')
      "
      :description="
        props.controlled
          ? t('coinMPage.controlled.notice')
          : t('coinMPage.account.readOnly')
      "
    />
    <el-alert
      type="warning"
      :closable="false"
      class="mb-4"
      :title="t('coinMPage.account.pNlWarning')"
    />

    <el-card v-if="!props.controlled" shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <strong>{{ t("coinMPage.account.walletTitle") }}</strong>
          <el-button size="small" :loading="walletLoading" @click="loadWallet">
            {{ t("coinMPage.account.refresh") }}
          </el-button>
        </div>
      </template>
      <el-alert
        v-if="walletError"
        type="warning"
        show-icon
        :closable="false"
        :title="t('coinMPage.account.walletUnavailable')"
        :description="walletError"
        class="mb-3"
      />
      <template v-if="wallet">
        <el-tag type="info" class="mb-3">
          {{ t("coinMPage.account.environment") }}: {{ wallet.environment }}
        </el-tag>
        <el-table
          :data="wallet.balances"
          size="small"
          stripe
          border
          :empty-text="t('coinMPage.account.noWallet')"
        >
          <el-table-column
            prop="asset"
            :label="t('coinMPage.account.asset')"
            width="90"
          />
          <el-table-column
            prop="wallet_balance"
            :label="t('coinMPage.account.walletBalance')"
            min-width="130"
          />
          <el-table-column
            prop="available_balance"
            :label="t('coinMPage.account.availableBalance')"
            min-width="130"
          />
          <el-table-column
            prop="cross_wallet_balance"
            :label="t('coinMPage.account.crossWalletBalance')"
            min-width="135"
          />
          <el-table-column
            prop="cross_unrealized_pnl"
            :label="t('coinMPage.account.crossUnrealized')"
            min-width="135"
          />
          <el-table-column :label="t('coinMPage.account.time')" min-width="155">
            <template #default="{ row }">{{
              fmtTime(row.updated_at)
            }}</template>
          </el-table-column>
        </el-table>
      </template>
      <div class="mt-2 text-xs text-gray-500">
        {{ t("coinMPage.account.walletNote") }}
      </div>
    </el-card>

    <el-card v-if="tab === 'positions'" shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <strong>{{ t("coinMPage.account.filteredTotals") }}</strong>
          <el-switch
            v-model="showUSD"
            :active-text="t('coinMPage.account.showUSD')"
          />
        </div>
      </template>
      <el-alert
        v-if="priceStatus === 'unavailable' && total > 0"
        type="warning"
        :closable="false"
        class="mb-3"
        :title="t('coinMPage.account.markUnavailable')"
      />
      <el-table :data="totals" border stripe size="small">
        <el-table-column
          prop="asset"
          :label="t('coinMPage.account.asset')"
          width="95"
        />
        <el-table-column
          prop="positions"
          :label="t('coinMPage.account.cycles')"
          width="95"
        />
        <el-table-column
          :label="t('coinMPage.account.realized')"
          min-width="145"
        >
          <template #default="{ row }">{{
            formatted(row.realized_pnl, row.asset)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.unrealized')"
          min-width="145"
        >
          <template #default="{ row }">{{
            formatted(row.unrealized_pnl, row.asset)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.totalPnL')"
          min-width="145"
        >
          <template #default="{ row }">{{
            formatted(row.total_pnl, row.asset)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="showUSD"
          :label="t('coinMPage.account.usdReference')"
          min-width="135"
        >
          <template #default="{ row }">{{
            formatted(row.total_usd_estimate, "USD")
          }}</template>
        </el-table-column>
        <el-table-column :label="t('coinMPage.account.fees')" min-width="135">
          <template #default="{ row }">{{ feeText(row.fees) }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.evidenceStatus')"
          min-width="145"
        >
          <template #default="{ row }">
            {{ row.verified }} / {{ row.positions }}
            <el-tag v-if="row.pending > 0" type="info" size="small">
              {{ t("coinMPage.account.pending") }}: {{ row.pending }}
            </el-tag>
            <el-tag v-if="row.invalid > 0" type="danger" size="small">
              {{ t("coinMPage.account.invalid") }}: {{ row.invalid }}
            </el-tag>
            <el-tag v-else-if="row.unpriced > 0" type="warning" size="small">
              {{ t("coinMPage.account.unpriced") }}: {{ row.unpriced }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-2 text-xs text-gray-500">
        {{ t("coinMPage.account.totalsNote") }}
      </div>
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="tab" @tab-change="switchTab">
        <el-tab-pane
          :label="t('coinMPage.account.positions')"
          name="positions"
        />
        <el-tab-pane :label="t('coinMPage.account.orders')" name="orders" />
      </el-tabs>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <el-input
          v-model="filters.symbol"
          clearable
          class="!w-48"
          :placeholder="t('coinMPage.account.symbol')"
          @keyup.enter="load(true)"
        />
        <el-input
          v-model="filters.status"
          clearable
          class="!w-36"
          :placeholder="t('coinMPage.account.status')"
          @keyup.enter="load(true)"
        />
        <el-button type="primary" @click="load(true)">{{
          t("coinMPage.account.search")
        }}</el-button>
        <el-button @click="reset">{{ t("coinMPage.account.reset") }}</el-button>
        <el-button @click="load()">{{
          t("coinMPage.account.refresh")
        }}</el-button>
      </div>

      <el-table
        v-if="tab === 'positions'"
        v-loading="loading"
        :data="positions"
        border
        stripe
        size="small"
        :empty-text="t('coinMPage.account.noPositions')"
      >
        <el-table-column
          prop="symbol"
          :label="t('coinMPage.account.symbol')"
          min-width="125"
        />
        <el-table-column
          prop="position_side"
          :label="t('coinMPage.account.side')"
          width="90"
        />
        <el-table-column
          prop="status"
          :label="t('coinMPage.account.status')"
          width="115"
        />
        <el-table-column
          prop="opened_contracts"
          :label="t('coinMPage.account.contracts')"
          min-width="110"
        />
        <el-table-column
          prop="remaining_contracts"
          :label="t('coinMPage.account.remaining')"
          min-width="115"
        />
        <el-table-column
          prop="entry_price"
          :label="t('coinMPage.account.entry')"
          min-width="110"
        />
        <el-table-column
          prop="margin_asset"
          :label="t('coinMPage.account.asset')"
          width="90"
        />
        <el-table-column
          :label="t('coinMPage.account.realized')"
          min-width="150"
        >
          <template #default="{ row }">
            {{ row.realized_pnl }} {{ row.margin_asset }}
          </template>
        </el-table-column>

        <el-table-column
          :label="t('coinMPage.account.markPrice')"
          min-width="125"
        >
          <template #default="{ row }">
            {{ formatted(row.mark_price, "USD") }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.unrealized')"
          min-width="145"
        >
          <template #default="{ row }">
            {{ formatted(row.unrealized_pnl, row.margin_asset) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.totalPnL')"
          min-width="145"
        >
          <template #default="{ row }">
            {{ formatted(row.total_pnl, row.margin_asset) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="showUSD"
          :label="t('coinMPage.account.usdReference')"
          min-width="145"
        >
          <template #default="{ row }">
            {{ formatted(row.total_usd_estimate, "USD") }}
          </template>
        </el-table-column>
        <el-table-column :label="t('coinMPage.account.fees')" min-width="145">
          <template #default="{ row }">{{
            feeText(row.fees_by_asset)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.evidenceStatus')"
          min-width="140"
        >
          <template #default="{ row }">
            <el-tooltip
              :content="row.warning || row.pnl_status"
              placement="top"
            >
              <el-tag
                size="small"
                :type="
                  row.pnl_status === 'verified'
                    ? 'success'
                    : row.pnl_status === 'unpriced'
                      ? 'warning'
                      : row.pnl_status === 'pending_fills'
                        ? 'info'
                        : 'danger'
                "
                >{{ pnlStatusLabel(row.pnl_status) }}</el-tag
              >
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('coinMPage.account.time')" min-width="165">
          <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.details')"
          width="120"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click="showDetail(row.id)">{{
              t("coinMPage.account.details")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-table
        v-else
        v-loading="loading"
        :data="orders"
        border
        stripe
        size="small"
        :empty-text="t('coinMPage.account.noOrders')"
      >
        <el-table-column
          prop="symbol"
          :label="t('coinMPage.account.symbol')"
          min-width="125"
        />
        <el-table-column
          prop="position_side"
          :label="t('coinMPage.account.side')"
          width="100"
        />
        <el-table-column prop="intent" label="OPEN / CLOSE" width="110" />
        <el-table-column prop="side" label="BUY / SELL" width="100" />
        <el-table-column
          prop="requested_contracts"
          :label="t('coinMPage.account.contracts')"
          min-width="110"
        />
        <el-table-column
          prop="filled_contracts"
          :label="t('coinMPage.account.filledContracts')"
          min-width="110"
        />
        <el-table-column
          prop="status"
          :label="t('coinMPage.account.status')"
          min-width="120"
        />
        <el-table-column
          prop="client_order_id"
          label="clientOrderId"
          min-width="160"
        />
        <el-table-column :label="t('coinMPage.account.time')" min-width="165">
          <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column
          :label="t('coinMPage.account.details')"
          width="110"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="showDetail(row.position_id)"
              >{{ t("coinMPage.account.details") }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          :current-page="filters.page"
          :page-size="filters.limit"
          :total="total"
          background
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          @current-change="
            page => {
              filters.page = page;
              load();
            }
          "
          @size-change="
            size => {
              filters.limit = size;
              load(true);
            }
          "
        />
      </div>
      <div v-if="props.controlled" class="mt-4 text-xs text-gray-500">
        {{ t("coinMPage.controlled.noAction") }}
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      :title="t('coinMPage.account.details')"
      width="85%"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detail">
          <p class="mb-3">
            {{ detail.position.symbol }} · {{ detail.position.position_side }} ·
            {{ detail.position.status }}
          </p>
          <el-divider>{{ t("coinMPage.account.orders") }}</el-divider>
          <el-table :data="detail.orders || []" border size="small">
            <el-table-column prop="intent" label="OPEN / CLOSE" width="110" />
            <el-table-column prop="side" label="BUY / SELL" width="100" />
            <el-table-column prop="order_type" label="Type" min-width="120" />
            <el-table-column
              prop="requested_contracts"
              :label="t('coinMPage.account.contracts')"
              min-width="100"
            />
            <el-table-column
              prop="filled_contracts"
              label="Filled"
              min-width="100"
            />
            <el-table-column
              prop="status"
              :label="t('coinMPage.account.status')"
              min-width="110"
            />
            <el-table-column
              prop="client_order_id"
              label="clientOrderId"
              min-width="165"
            />
            <el-table-column
              prop="exchange_order_id"
              label="exchangeOrderId"
              min-width="160"
            />
          </el-table>
          <el-divider>{{ t("coinMPage.account.fills") }}</el-divider>
          <el-table :data="detail.fills || []" border size="small">
            <el-table-column
              prop="trade_id"
              :label="t('coinMPage.account.tradeId')"
              min-width="135"
            />
            <el-table-column prop="side" label="BUY / SELL" width="100" />
            <el-table-column
              prop="contracts"
              :label="t('coinMPage.account.contracts')"
              width="115"
            />
            <el-table-column
              prop="price"
              :label="t('coinMPage.account.entry')"
              width="125"
            />
            <el-table-column
              prop="realized_pnl"
              :label="t('coinMPage.account.realized')"
              min-width="145"
            >
              <template #default="{ row }"
                >{{ row.realized_pnl }} {{ row.pnl_asset }}</template
              >
            </el-table-column>
            <el-table-column
              :label="t('coinMPage.account.fee')"
              min-width="140"
            >
              <template #default="{ row }"
                >{{ row.commission }} {{ row.commission_asset }}</template
              >
            </el-table-column>
            <el-table-column
              :label="t('coinMPage.account.time')"
              min-width="165"
            >
              <template #default="{ row }">{{
                fmtTime(row.trade_time)
              }}</template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </el-dialog>
  </div>
</template>
