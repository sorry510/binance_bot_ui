<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getSpotPositionPage,
  getSpotOrderPage,
  rebuildSpotLocalPosition,
  type SpotPositionView,
  type SpotManagedOrder
} from "@/api/spotQuant";
import PositionDetail from "./positionDetail.vue";
import { formatSpotDecimal, formatSpotTime } from "./format";

defineOptions({ name: "SpotQuantControlledTrade" });
const { t } = useI18n();
const loading = ref(false);
const actionLoading = ref<number | null>(null);
const orderLoading = ref(false);
const tab = ref("positions");
const filters = reactive({ symbol: "", status: "", page: 1, limit: 20 });
const orderFilters = reactive({
  symbol: "",
  status: "",
  page: 1,
  limit: 20
});
const rows = ref<SpotPositionView[]>([]);
const total = ref(0);
const orderRows = ref<SpotManagedOrder[]>([]);
const orderTotal = ref(0);
const detailVisible = ref(false);
const detailId = ref<number | null>(null);
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

async function load() {
  loading.value = true;
  try {
    const res = await getSpotPositionPage({
      ...filters,
      symbol: filters.symbol.trim().toUpperCase()
    });
    if (res?.code !== 200) throw new Error(res?.msg);
    rows.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (err: any) {
    ElMessage.error(err?.message || t("spotQuantPage.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}
async function loadOrders() {
  orderLoading.value = true;
  try {
    const res = await getSpotOrderPage({
      ...orderFilters,
      symbol: orderFilters.symbol.trim().toUpperCase()
    });
    if (res?.code !== 200) throw new Error(res?.msg);
    orderRows.value = res.data?.list || [];
    orderTotal.value = res.data?.total || 0;
  } catch (err: any) {
    ElMessage.error(err?.message || t("spotQuantPage.message.loadFailed"));
  } finally {
    orderLoading.value = false;
  }
}
function changeTab() {
  if (tab.value === "positions") void load();
  else void loadOrders();
}
function openDetail(id: number) {
  detailId.value = id;
  detailVisible.value = true;
}
async function rebuild(row: SpotPositionView) {
  if (row.needs_review || actionLoading.value) return;
  try {
    await ElMessageBox.confirm(
      t("spotQuantPage.confirm.rebuild", { symbol: row.position.symbol }),
      t("spotQuantPage.confirm.title"),
      { type: "warning", confirmButtonText: t("spotQuantPage.actions.confirm") }
    );
  } catch {
    return;
  }
  actionLoading.value = row.position.id;
  try {
    const res = await rebuildSpotLocalPosition(row.position.id);
    if (res?.code !== 200) throw new Error(res?.msg);
    ElMessage.success(t("spotQuantPage.message.rebuildSuccess"));
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || t("spotQuantPage.message.rebuildFailed"));
  } finally {
    actionLoading.value = null;
  }
}
onMounted(() => {
  void load();
});
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <el-tabs v-model="tab" @tab-change="changeTab">
        <el-tab-pane
          :label="t('spotQuantPage.account.positions')"
          name="positions"
        >
          <div class="mb-4 flex flex-wrap gap-2">
            <el-input
              v-model="filters.symbol"
              clearable
              class="!w-48"
              :placeholder="t('spotQuantPage.table.symbol')"
              @keyup.enter="
                filters.page = 1;
                load();
              "
            />
            <el-select
              v-model="filters.status"
              clearable
              class="!w-44"
              :placeholder="t('spotQuantPage.table.status')"
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
                filters.page = 1;
                load();
              "
            >
              {{ t("spotQuantPage.actions.search") }}
            </el-button>
            <el-button @click="load">{{
              t("spotQuantPage.actions.refresh")
            }}</el-button>
          </div>
          <el-table v-loading="loading" :data="rows" border stripe size="small">
            <el-table-column prop="position.id" label="ID" width="85" />
            <el-table-column
              prop="position.symbol"
              :label="t('spotQuantPage.table.symbol')"
              min-width="120"
            />
            <el-table-column
              :label="t('spotQuantPage.table.status')"
              min-width="145"
            >
              <template #default="{ row }">
                <el-tag
                  :type="
                    row.needs_review
                      ? 'danger'
                      : row.position.status === 'OPEN'
                        ? 'success'
                        : 'info'
                  "
                  size="small"
                >
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
              min-width="140"
            >
              <template #default="{ row }">{{
                row.needs_review
                  ? "-"
                  : formatSpotDecimal(row.position.remaining_qty)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.realized')"
              min-width="145"
            >
              <template #default="{ row }">{{
                row.needs_review ? "-" : formatSpotDecimal(row.realized_pnl)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.review')"
              min-width="210"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tag v-if="row.needs_review" type="danger" size="small">
                  {{ t("spotQuantPage.message.needsReview") }}
                </el-tag>
                <el-tag
                  v-else-if="!row.fully_priced"
                  type="warning"
                  size="small"
                >
                  {{ t("spotQuantPage.message.unpriced") }}
                </el-tag>
                <el-tag
                  v-else-if="
                    !row.has_mark_price && row.position.status === 'OPEN'
                  "
                  type="warning"
                  size="small"
                >
                  {{ t("spotQuantPage.message.priceMissing") }}
                </el-tag>
                <el-tag v-else type="success" size="small">
                  {{ t("spotQuantPage.message.verified") }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.actions')"
              fixed="right"
              min-width="290"
            >
              <template #default="{ row }">
                <el-button
                  type="primary"
                  link
                  @click="openDetail(row.position.id)"
                >
                  {{ t("spotQuantPage.actions.detail") }}
                </el-button>
                <el-button
                  type="warning"
                  link
                  :disabled="row.needs_review"
                  :loading="actionLoading === row.position.id"
                  @click="rebuild(row)"
                >
                  {{ t("spotQuantPage.actions.rebuild") }}
                </el-button>
                <el-tooltip
                  :content="t('spotQuantPage.controlled.notReleased')"
                >
                  <span>
                    <el-button link disabled>{{
                      t("spotQuantPage.actions.manualSell")
                    }}</el-button>
                    <el-button link disabled>{{
                      t("spotQuantPage.actions.reconcile")
                    }}</el-button>
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="filters.page"
            v-model:page-size="filters.limit"
            class="mt-4 justify-end"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @change="load"
          />
        </el-tab-pane>

        <el-tab-pane :label="t('spotQuantPage.account.orders')" name="orders">
          <div class="mb-4 flex flex-wrap gap-2">
            <el-input
              v-model="orderFilters.symbol"
              clearable
              class="!w-48"
              :placeholder="t('spotQuantPage.table.symbol')"
              @keyup.enter="
                orderFilters.page = 1;
                loadOrders();
              "
            />
            <el-select
              v-model="orderFilters.status"
              clearable
              class="!w-44"
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
                orderFilters.page = 1;
                loadOrders();
              "
            >
              {{ t("spotQuantPage.actions.search") }}
            </el-button>
            <el-button @click="loadOrders">{{
              t("spotQuantPage.actions.refresh")
            }}</el-button>
          </div>
          <el-table
            v-loading="orderLoading"
            :data="orderRows"
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
              width="90"
            />
            <el-table-column
              prop="status"
              :label="t('spotQuantPage.table.status')"
              min-width="130"
            />
            <el-table-column
              prop="requested_qty"
              :label="t('spotQuantPage.table.requested')"
              min-width="145"
            />
            <el-table-column
              prop="filled_qty"
              :label="t('spotQuantPage.table.filled')"
              min-width="145"
            />
            <el-table-column
              :label="t('spotQuantPage.table.created')"
              min-width="180"
            >
              <template #default="{ row }">{{
                formatSpotTime(row.created_at)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('spotQuantPage.table.actions')"
              fixed="right"
              width="200"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openDetail(row.position_id)"
                >
                  {{ t("spotQuantPage.actions.detail") }}
                </el-button>
                <el-tooltip
                  :content="t('spotQuantPage.controlled.notReleased')"
                >
                  <span>
                    <el-button link disabled>{{
                      t("spotQuantPage.actions.cancel")
                    }}</el-button>
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="orderFilters.page"
            v-model:page-size="orderFilters.limit"
            :total="orderTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="mt-4 justify-end"
            @change="loadOrders"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <PositionDetail v-model:visible="detailVisible" :position-id="detailId" />
  </div>
</template>
