<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getSpotOrderPage,
  getSpotPositionPage,
  type SpotManagedOrder,
  type SpotPositionPage,
  type SpotPositionView
} from "@/api/spotQuant";
import PositionDetail from "./positionDetail.vue";
import { formatSpotDecimal, formatSpotTime, hasPreciseSpotPnL } from "./format";

defineOptions({ name: "SpotQuantAccount" });
const { t } = useI18n();
const loading = ref(false);
const orderLoading = ref(false);
const activeTab = ref("positions");
const query = reactive({ symbol: "", status: "", page: 1, limit: 20 });
const ordersQuery = reactive({ symbol: "", status: "", page: 1, limit: 20 });
const result = ref<SpotPositionPage>({
  list: [],
  total: 0,
  page: 1,
  limit: 20,
  summary: []
});
const orders = ref<SpotManagedOrder[]>([]);
const ordersTotal = ref(0);
const detailVisible = ref(false);
const detailId = ref<number | null>(null);
const interval = ref(30);
let timer: ReturnType<typeof setInterval> | undefined;

const positionRows = computed(() => result.value.list || []);
const statuses = ["PENDING_BUY", "OPEN", "CLOSED"];
const orderStatuses = [
  "NEW",
  "PARTIALLY_FILLED",
  "FILLED",
  "PENDING_CANCEL",
  "CANCELED",
  "REJECTED",
  "EXPIRED"
];

function requireSuccess<T extends { code: number; msg: string }>(res: T): T {
  if (res?.code !== 200) throw new Error(res?.msg || "Spot API error");
  return res;
}

async function loadPositions() {
  loading.value = true;
  try {
    const res = requireSuccess(
      await getSpotPositionPage({
        symbol: query.symbol.trim().toUpperCase(),
        status: query.status,
        page: query.page,
        limit: query.limit
      })
    );
    result.value = res.data;
  } catch (error: any) {
    ElMessage.error(error?.message || t("spotQuantPage.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}
async function loadOrders() {
  orderLoading.value = true;
  try {
    const res = requireSuccess(
      await getSpotOrderPage({
        symbol: ordersQuery.symbol.trim().toUpperCase(),
        status: ordersQuery.status,
        page: ordersQuery.page,
        limit: ordersQuery.limit
      })
    );
    orders.value = res.data?.list || [];
    ordersTotal.value = res.data?.total || 0;
  } catch (error: any) {
    ElMessage.error(error?.message || t("spotQuantPage.message.loadFailed"));
  } finally {
    orderLoading.value = false;
  }
}

function refresh() {
  if (activeTab.value === "positions") void loadPositions();
  else void loadOrders();
}
function startTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
  if (interval.value > 0) timer = setInterval(refresh, interval.value * 1000);
}
function changeTab() {
  if (activeTab.value === "positions") void loadPositions();
  else void loadOrders();
}
function openDetail(id: number) {
  detailId.value = id;
  detailVisible.value = true;
}
function resetPositionSearch() {
  query.symbol = "";
  query.status = "";
  query.page = 1;
  void loadPositions();
}
function resetOrderSearch() {
  ordersQuery.symbol = "";
  ordersQuery.status = "";
  ordersQuery.page = 1;
  void loadOrders();
}
function rowTag(row: SpotPositionView) {
  if (row.needs_review) return "danger";
  return row.position.status === "OPEN"
    ? "success"
    : row.position.status === "CLOSED"
      ? "info"
      : "warning";
}

onMounted(() => {
  void loadPositions();
  startTimer();
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="p-4">
    <el-alert
      class="mb-4"
      type="info"
      :closable="false"
      show-icon
      :title="t('spotQuantPage.message.localOnly')"
      :description="t('spotQuantPage.message.accountScope')"
    />
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("spotQuantPage.summary.title") }}</span>
          <span class="text-xs text-gray-400">
            {{ t("spotQuantPage.summary.filteredTotal") }}
          </span>
        </div>
      </template>
      <el-row :gutter="12">
        <el-col
          v-for="row in result.summary || []"
          :key="row.quote_asset"
          :xs="24"
          :sm="12"
          :lg="8"
        >
          <el-card shadow="never" class="mb-2">
            <div class="mb-2 font-semibold">{{ row.quote_asset }}</div>
            <el-descriptions :column="1" size="small">
              <el-descriptions-item
                :label="t('spotQuantPage.summary.positions')"
              >
                {{ row.positions }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('spotQuantPage.table.realized')">
                {{ formatSpotDecimal(row.realized_pnl) }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('spotQuantPage.table.totalPnl')">
                {{ row.fully_priced ? formatSpotDecimal(row.total_pnl) : "-" }}
              </el-descriptions-item>
            </el-descriptions>
            <el-tag
              v-if="!row.fully_priced"
              type="warning"
              size="small"
              class="mt-1"
            >
              {{ t("spotQuantPage.summary.incomplete") }}:
              {{ row.missing_prices }} / {{ row.unpriced_positions }} /
              {{ row.review_positions }}
            </el-tag>
          </el-card>
        </el-col>
      </el-row>
      <el-empty
        v-if="!result.summary?.length"
        :description="t('spotQuantPage.message.noData')"
        :image-size="55"
      />
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="activeTab" @tab-change="changeTab">
        <el-tab-pane
          :label="t('spotQuantPage.account.positions')"
          name="positions"
        >
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <el-input
              v-model="query.symbol"
              :placeholder="t('spotQuantPage.table.symbol')"
              clearable
              class="!w-48"
              @keyup.enter="
                query.page = 1;
                loadPositions();
              "
            />
            <el-select
              v-model="query.status"
              clearable
              :placeholder="t('spotQuantPage.table.status')"
              class="!w-44"
            >
              <el-option
                v-for="s in statuses"
                :key="s"
                :label="t('spotQuantPage.status.' + s)"
                :value="s"
              />
            </el-select>
            <el-button
              type="primary"
              @click="
                query.page = 1;
                loadPositions();
              "
            >
              {{ t("spotQuantPage.actions.search") }}
            </el-button>
            <el-button @click="resetPositionSearch">{{
              t("spotQuantPage.actions.reset")
            }}</el-button>
            <el-button @click="loadPositions">{{
              t("spotQuantPage.actions.refresh")
            }}</el-button>
            <el-select v-model="interval" class="!w-36" @change="startTimer">
              <el-option
                :label="t('spotQuantPage.actions.manualRefresh')"
                :value="0"
              />
              <el-option label="30s" :value="30" />
              <el-option label="60s" :value="60" />
            </el-select>
          </div>

          <el-table
            v-loading="loading"
            :data="positionRows"
            border
            stripe
            size="small"
            row-key="position.id"
          >
            <el-table-column prop="position.id" label="ID" min-width="80" />
            <el-table-column
              prop="position.symbol"
              :label="t('spotQuantPage.table.symbol')"
              min-width="120"
            />
            <el-table-column
              :label="t('spotQuantPage.table.status')"
              min-width="125"
            >
              <template #default="{ row }">
                <el-tag :type="rowTag(row)" size="small">
                  {{
                    row.needs_review
                      ? t("spotQuantPage.message.needsReview")
                      : t("spotQuantPage.status." + row.position.status)
                  }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.remaining')"
              min-width="150"
            >
              <template #default="{ row }">{{
                row.needs_review
                  ? "-"
                  : formatSpotDecimal(row.position.remaining_qty)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.average')"
              min-width="160"
            >
              <template #default="{ row }">{{
                row.needs_review
                  ? "-"
                  : formatSpotDecimal(row.position.avg_cost_quote)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.price')"
              min-width="150"
            >
              <template #default="{ row }">{{
                row.has_mark_price ? formatSpotDecimal(row.mark_price) : "-"
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.realized')"
              min-width="155"
            >
              <template #default="{ row }">{{
                row.needs_review ? "-" : formatSpotDecimal(row.realized_pnl)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.totalPnl')"
              min-width="150"
            >
              <template #default="{ row }">
                {{
                  hasPreciseSpotPnL(row)
                    ? formatSpotDecimal(row.total_pnl)
                    : "-"
                }}
              </template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.created')"
              min-width="180"
            >
              <template #default="{ row }">{{
                formatSpotTime(row.position.created_at)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.actions')"
              fixed="right"
              width="105"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openDetail(row.position.id)"
                >
                  {{ t("spotQuantPage.actions.detail") }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.limit"
            class="mt-4 justify-end"
            :total="result.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @change="loadPositions"
          />
        </el-tab-pane>

        <el-tab-pane :label="t('spotQuantPage.account.orders')" name="orders">
          <div class="mb-4 flex flex-wrap gap-2">
            <el-input
              v-model="ordersQuery.symbol"
              class="!w-48"
              clearable
              :placeholder="t('spotQuantPage.table.symbol')"
              @keyup.enter="
                ordersQuery.page = 1;
                loadOrders();
              "
            />
            <el-select
              v-model="ordersQuery.status"
              class="!w-44"
              clearable
              :placeholder="t('spotQuantPage.table.status')"
            >
              <el-option
                v-for="s in orderStatuses"
                :key="s"
                :label="s"
                :value="s"
              />
            </el-select>
            <el-button
              type="primary"
              @click="
                ordersQuery.page = 1;
                loadOrders();
              "
            >
              {{ t("spotQuantPage.actions.search") }}
            </el-button>
            <el-button @click="resetOrderSearch">{{
              t("spotQuantPage.actions.reset")
            }}</el-button>
          </div>
          <el-table
            v-loading="orderLoading"
            :data="orders"
            border
            stripe
            size="small"
          >
            <el-table-column prop="id" label="ID" width="85" />
            <el-table-column
              prop="symbol"
              :label="t('spotQuantPage.table.symbol')"
              min-width="120"
            />
            <el-table-column
              prop="side"
              :label="t('spotQuantPage.table.side')"
              min-width="100"
            />
            <el-table-column
              prop="status"
              :label="t('spotQuantPage.table.status')"
              min-width="130"
            />
            <el-table-column
              prop="requested_qty"
              :label="t('spotQuantPage.table.requested')"
              min-width="155"
            />
            <el-table-column
              prop="filled_qty"
              :label="t('spotQuantPage.table.filled')"
              min-width="155"
            />
            <el-table-column
              prop="client_order_id"
              :label="t('spotQuantPage.table.clientId')"
              min-width="185"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('spotQuantPage.table.actions')"
              fixed="right"
              width="110"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openDetail(row.position_id)"
                >
                  {{ t("spotQuantPage.actions.detail") }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="ordersQuery.page"
            v-model:page-size="ordersQuery.limit"
            class="mt-4 justify-end"
            :total="ordersTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @change="loadOrders"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <PositionDetail v-model:visible="detailVisible" :position-id="detailId" />
  </div>
</template>
