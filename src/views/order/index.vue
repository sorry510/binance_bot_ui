<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getManagedCycleDetails,
  getManagedOrderCycles,
  previewHistoryBulk,
  applyHistoryBulk,
  deleteManagedHistory,
  type ManagedChildOrder,
  type ManagedCycle,
  type ManagedCycleDetail,
  type ManagedFill,
  type ManagedHistoryFilters,
  type HistoryBulkRequest,
  type HistoryBulkPreview
} from "@/api/order";

defineOptions({ name: "OrderList" });
const { t } = useI18n();
const tr = (name: string) => t(`orderPage.${name}`);

const loading = ref(false);
const rows = ref<ManagedCycle[]>([]);
const total = ref(0);
const filteredPnL = ref<
  Record<string, { realized: string; unrealized: string; total: string }>
>({});
const pnlUnpriced = ref(0);
const detailCache = reactive<Record<string, ManagedCycleDetail>>({});
const detailLoading = reactive<Record<string, boolean>>({});
const query = reactive({
  page: 1,
  limit: 20,
  account_id: "main",
  owner: "",
  symbol: "",
  position_side: "",
  status: "",
  settlement: "",
  range: [] as string[]
});
let requestToken = 0;
const bulkVisible = ref(false);
const bulkBusy = ref(false);
const deleteBusy = ref(false);
const bulkAction = ref<HistoryBulkRequest["action"]>("update");
const bulkStatus = ref("");
const bulkCompleteness = ref("");
const bulkReason = ref("");
const bulkPreview = ref<HistoryBulkPreview | null>(null);
const bulkRequest = ref<HistoryBulkRequest | null>(null);

function currentFilters(): ManagedHistoryFilters {
  return {
    account_id: query.account_id,
    owner: query.owner || undefined,
    symbol: query.symbol.trim() || undefined,
    position_side: query.position_side || undefined,
    status: query.status || undefined,
    settlement: query.settlement || undefined,
    start_time: query.range?.[0] ? Number(query.range[0]) : undefined,
    end_time: query.range?.[1] ? Number(query.range[1]) : undefined,
    page: query.page,
    limit: query.limit
  };
}
function openBulk(action: HistoryBulkRequest["action"]) {
  bulkAction.value = action;
  bulkStatus.value = "";
  bulkCompleteness.value = "";
  bulkReason.value = "";
  bulkPreview.value = null;
  bulkRequest.value = null;
  bulkVisible.value = true;
}
function invalidateBulkPreview() {
  bulkPreview.value = null;
  bulkRequest.value = null;
}
function createBulkRequest(): HistoryBulkRequest {
  const request: HistoryBulkRequest = {
    filters: currentFilters(),
    action: bulkAction.value
  };
  if (bulkAction.value === "update") {
    if (bulkStatus.value === "__clear__") request.clear_status = true;
    else if (bulkStatus.value) request.status_override = bulkStatus.value;
    if (bulkCompleteness.value === "__clear__") {
      request.clear_completeness = true;
    } else if (bulkCompleteness.value) {
      request.completeness_override = bulkCompleteness.value;
    }
  }
  return request;
}
async function prepareBulk() {
  if (
    bulkAction.value === "update" &&
    !bulkStatus.value &&
    !bulkCompleteness.value
  ) {
    ElMessage.warning(tr("bulk.chooseField"));
    return;
  }
  bulkBusy.value = true;
  invalidateBulkPreview();
  try {
    const request = createBulkRequest();
    const response = await previewHistoryBulk(request);
    if (!response.data.count) {
      ElMessage.warning(tr("bulk.empty"));
      return;
    }
    bulkRequest.value = request;
    bulkPreview.value = response.data;
  } catch (error) {
    ElMessage.error(failureMessage(error));
  } finally {
    bulkBusy.value = false;
  }
}
async function applyBulk() {
  const preview = bulkPreview.value;
  const request = bulkRequest.value;
  if (!preview || !request) return;
  if (bulkReason.value.trim().length < 8) {
    ElMessage.warning(tr("bulk.reasonRequired"));
    return;
  }
  const keyword = `UPDATE ${preview.count}`;
  try {
    await ElMessageBox.prompt(
      `${tr("bulk.confirmDescription")} ${preview.count}. ${tr("bulk.typeHint")} ${keyword}`,
      tr("bulk.confirmTitle"),
      {
        type: "info",
        confirmButtonText: tr("bulk.confirm"),
        cancelButtonText: tr("bulk.cancel"),
        inputPattern: new RegExp(`^${keyword}$`),
        inputErrorMessage: tr("bulk.confirmInvalid")
      }
    );
  } catch {
    return;
  }
  bulkBusy.value = true;
  try {
    const response = await applyHistoryBulk({
      ...request,
      expected_digest: preview.digest,
      reason: bulkReason.value.trim()
    });
    ElMessage.success(`${tr("bulk.success")}: ${response.data.updated}`);
    bulkVisible.value = false;
    invalidateBulkPreview();
    await load(true);
  } catch (error) {
    ElMessage.error(failureMessage(error));
    invalidateBulkPreview();
  } finally {
    bulkBusy.value = false;
  }
}

// Only the current search criteria are used; deleting ignores pagination.
// The backend independently verifies the expected count and terminal state.
async function deleteFiltered() {
  if (deleteBusy.value) return;
  deleteBusy.value = true;
  try {
    const filters = currentFilters();
    const refreshed = await getManagedOrderCycles({
      ...filters,
      page: 1,
      limit: 1
    });
    const count = Number(refreshed.data.total || 0);
    if (!count) {
      ElMessage.warning(tr("bulk.empty"));
      return;
    }
    await ElMessageBox.confirm(
      t("orderPage.bulk.deleteConfirmMessage", { count }),
      tr("bulk.deleteConfirmTitle"),
      {
        confirmButtonText: tr("bulk.confirm"),
        cancelButtonText: tr("bulk.cancel"),
        type: "warning",
        closeOnClickModal: false
      }
    );
    const outcome = await deleteManagedHistory({
      filters,
      expected_count: count
    });
    ElMessage.success(
      t("orderPage.bulk.deleteSuccess", {
        positions: outcome.data.positions,
        orders: outcome.data.orders,
        fills: outcome.data.fills
      })
    );
    await load(true);
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(failureMessage(error));
    }
  } finally {
    deleteBusy.value = false;
  }
}
function failureMessage(error: unknown) {
  const value = error as {
    message?: string;
    response?: { data?: { msg?: string } };
  };
  return (
    value?.response?.data?.msg || value?.message || tr("message.loadError")
  );
}
function formatTime(value: number | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}
function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "-";
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
function display(value: string | number | null | undefined) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}
function signed(value: string | null | undefined) {
  return value === null || value === undefined
    ? ""
    : Number(value) > 0
      ? "text-green-600"
      : Number(value) < 0
        ? "text-red-500"
        : "";
}
function feeText(fees: ManagedCycle["fees"]) {
  return fees.length
    ? fees.map(item => `${item.amount} ${item.asset}`).join(" / ")
    : "-";
}
function statusLabel(value: string) {
  return tr(`state.${value}`);
}
function settlementLabel(value: string) {
  return tr(`settlement.${value}`);
}
function completenessType(value: string): "success" | "warning" | "info" {
  if (value === "verified") return "success";
  if (value === "incomplete") return "warning";
  return "info";
}
function resetDetailCache() {
  for (const key of Object.keys(detailCache)) delete detailCache[key];
  for (const key of Object.keys(detailLoading)) delete detailLoading[key];
}
async function load(reset = false) {
  if (reset) query.page = 1;
  const current = ++requestToken;
  loading.value = true;
  resetDetailCache();
  try {
    const res = await getManagedOrderCycles(currentFilters());
    if (current !== requestToken) return;
    const data = res.data;
    rows.value = data.list || [];
    total.value = Number(data.total || 0);
    filteredPnL.value = data.filtered_pnl || {};
    pnlUnpriced.value = Number(data.pnl_unpriced_count || 0);
  } catch (error) {
    if (current === requestToken) {
      rows.value = [];
      total.value = 0;
      filteredPnL.value = {};
      pnlUnpriced.value = 0;
      ElMessage.error(failureMessage(error));
    }
  } finally {
    if (current === requestToken) loading.value = false;
  }
}
function reset() {
  Object.assign(query, {
    page: 1,
    limit: 20,
    account_id: "main",
    owner: "",
    symbol: "",
    position_side: "",
    status: "",
    settlement: "",
    range: []
  });
  load();
}
async function onExpand(row: ManagedCycle, expandedRows: ManagedCycle[]) {
  const key = `${row.account_id}:${row.position_id}`;
  if (!expandedRows.some(item => item.position_id === row.position_id)) return;
  if (detailCache[key] || detailLoading[key]) return;
  detailLoading[key] = true;
  try {
    const res = await getManagedCycleDetails(row.position_id, row.account_id);
    detailCache[key] = res.data;
  } catch (error) {
    ElMessage.error(failureMessage(error));
  } finally {
    detailLoading[key] = false;
  }
}
function childIntent(intent: string) {
  return tr(`intent.${intent}`);
}
function fillStatus(fill: ManagedFill) {
  return fill.rest_verified
    ? tr("completeness.verified")
    : tr("fill.provisional");
}
function fetchPage(page: number) {
  query.page = page;
  load();
}
function updatePageSize(size: number) {
  query.limit = size;
  load(true);
}
onMounted(() => load());
</script>

<template>
  <div class="p-4">
    <el-form :inline="true" class="mb-2">
      <el-form-item :label="tr('filter.account')">
        <el-select v-model="query.account_id" style="width: 105px">
          <el-option label="Main" value="main" />
          <el-option label="Lead" value="lead" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tr('filter.symbol')">
        <el-input
          v-model="query.symbol"
          clearable
          style="width: 130px"
          :placeholder="tr('filter.symbolPlaceholder')"
          @keyup.enter="load(true)"
        />
      </el-form-item>
      <el-form-item :label="tr('filter.owner')">
        <el-select
          v-model="query.owner"
          filterable
          allow-create
          default-first-option
          clearable
          style="width: 160px"
          :placeholder="tr('filter.ownerPlaceholder')"
        >
          <el-option :label="tr('state.all')" value="" />
          <el-option label="auto_strategy" value="auto_strategy" />
          <el-option label="notice_auto_order" value="notice_auto_order" />
          <el-option label="new_coin_rush" value="new_coin_rush" />
          <el-option label="funding_rate" value="funding_rate" />
          <el-option label="agent_trade" value="agent_trade" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tr('filter.side')">
        <el-select v-model="query.position_side" style="width: 100px">
          <el-option :label="tr('state.all')" value="" />
          <el-option :label="tr('side.long')" value="LONG" />
          <el-option :label="tr('side.short')" value="SHORT" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tr('filter.status')">
        <el-select v-model="query.status" style="width: 120px">
          <el-option :label="tr('state.all')" value="" />
          <el-option :label="tr('state.active')" value="active" />
          <el-option :label="tr('state.suspended')" value="suspended" />
          <el-option :label="tr('state.closed')" value="closed" />
          <el-option
            :label="tr('state.reconcile_required')"
            value="reconcile_required"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="tr('filter.settlement')">
        <el-select v-model="query.settlement" style="width: 140px">
          <el-option :label="tr('state.all')" value="" />
          <el-option :label="tr('settlement.open')" value="open" />
          <el-option :label="tr('settlement.incomplete')" value="incomplete" />
          <el-option :label="tr('settlement.settled')" value="settled" />
          <el-option :label="tr('settlement.legacy')" value="legacy" />
        </el-select>
      </el-form-item>
      <el-form-item :label="tr('filter.time')">
        <el-date-picker
          v-model="query.range"
          type="datetimerange"
          value-format="x"
          style="width: 360px"
          :start-placeholder="tr('filter.start')"
          :end-placeholder="tr('filter.end')"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="load(true)">
          {{ tr("button.search") }}
        </el-button>
        <el-button @click="reset">{{ tr("button.reset") }}</el-button>
        <el-button :loading="loading" @click="load()">{{
          tr("button.refresh")
        }}</el-button>
      </el-form-item>
    </el-form>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-button
        type="danger"
        plain
        :loading="deleteBusy"
        @click="deleteFiltered"
      >
        {{ tr("bulk.delete") }}
      </el-button>
      <el-button
        type="primary"
        plain
        :loading="bulkBusy"
        @click="openBulk('update')"
      >
        {{ tr("bulk.update") }}
      </el-button>
      <el-text size="small" type="info">{{ tr("bulk.scope") }}</el-text>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <span>{{ tr("summary.total") }}: {{ total }}</span>
      <span>{{ tr("summary.filtered") }}:</span>
      <template v-if="Object.keys(filteredPnL).length">
        <span v-for="(amount, asset) in filteredPnL" :key="asset">
          <strong :class="signed(amount.total)"
            >{{ amount.total }} {{ asset }}</strong
          >
          ({{ tr("summary.realized") }}:
          <span :class="signed(amount.realized)">{{ amount.realized }}</span
          >, {{ tr("summary.unrealized") }}:
          <span :class="signed(amount.unrealized)">{{ amount.unrealized }}</span
          >)
        </span>
      </template>
      <span v-else>-</span>
      <el-tooltip :content="tr('summary.explanation')" placement="top">
        <el-tag type="info" size="small">{{
          tr("summary.filterScope")
        }}</el-tag>
      </el-tooltip>
      <el-text v-if="pnlUnpriced" type="warning" size="small">
        {{ tr("summary.unpriced") }}: {{ pnlUnpriced }}
      </el-text>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      size="small"
      border
      row-key="position_id"
      style="width: 100%"
      @expand-change="onExpand"
    >
      <el-table-column type="expand" width="48">
        <template #default="{ row }">
          <div
            v-loading="detailLoading[`${row.account_id}:${row.position_id}`]"
            class="px-3 py-3"
          >
            <template
              v-if="detailCache[`${row.account_id}:${row.position_id}`]"
            >
              <div class="mb-2 text-sm">
                {{ tr("detail.cycle") }} #{{ row.position_id }} ·
                {{ tr("detail.orderCount") }}
                {{
                  detailCache[`${row.account_id}:${row.position_id}`].orders
                    .length
                }}
              </div>
              <el-table
                :data="
                  detailCache[`${row.account_id}:${row.position_id}`].orders
                "
                size="small"
                stripe
                border
                style="width: 100%"
                row-key="managed.id"
              >
                <el-table-column type="expand" width="42">
                  <template #default="{ row: child }">
                    <el-table
                      :data="child.fills"
                      size="small"
                      border
                      style="width: 100%"
                      class="ml-2"
                    >
                      <el-table-column
                        prop="trade_id"
                        :label="tr('fill.tradeId')"
                        min-width="100"
                      />
                      <el-table-column
                        prop="order_id"
                        :label="tr('fill.orderId')"
                        min-width="120"
                      />
                      <el-table-column
                        prop="qty"
                        :label="tr('detail.quantity')"
                        min-width="130"
                      />
                      <el-table-column
                        prop="price"
                        :label="tr('detail.avgPrice')"
                        min-width="130"
                      />
                      <el-table-column
                        :label="tr('detail.fee')"
                        min-width="140"
                      >
                        <template #default="{ row: trade }">
                          {{ display(trade.commission) }}
                          {{ display(trade.commission_asset) }}
                        </template>
                      </el-table-column>
                      <el-table-column
                        :label="tr('fill.realizedPnl')"
                        min-width="140"
                      >
                        <template #default="{ row: trade }">
                          {{ display(trade.realized_pnl) }}
                          {{ display(trade.pnl_asset) }}
                        </template>
                      </el-table-column>
                      <el-table-column
                        :label="tr('fill.verified')"
                        min-width="155"
                      >
                        <template #default="{ row: trade }">
                          <el-tag
                            :type="trade.rest_verified ? 'success' : 'warning'"
                            size="small"
                          >
                            {{ fillStatus(trade) }}
                          </el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column
                        :label="tr('table.updatedAt')"
                        min-width="170"
                      >
                        <template #default="{ row: trade }">{{
                          formatTime(trade.trade_time)
                        }}</template>
                      </el-table-column>
                    </el-table>
                    <el-empty
                      v-if="child.fills.length === 0"
                      :description="tr('detail.noFills')"
                      :image-size="48"
                    />
                  </template>
                </el-table-column>
                <el-table-column :label="tr('detail.intent')" min-width="115">
                  <template #default="{ row: child }">{{
                    childIntent(child.managed.intent)
                  }}</template>
                </el-table-column>
                <el-table-column
                  prop="managed.status"
                  :label="tr('filter.status')"
                  min-width="125"
                />
                <el-table-column
                  prop="managed.order_type"
                  :label="tr('detail.type')"
                  min-width="155"
                />
                <el-table-column
                  prop="managed.requested_qty"
                  :label="tr('detail.requestedQty')"
                  min-width="120"
                />
                <el-table-column
                  prop="filled_qty_from_fills"
                  :label="tr('detail.filledQty')"
                  min-width="130"
                />
                <el-table-column :label="tr('detail.avgPrice')" min-width="145">
                  <template #default="{ row: child }">{{
                    display(child.avg_price)
                  }}</template>
                </el-table-column>
                <el-table-column :label="tr('detail.fee')" min-width="150">
                  <template #default="{ row: child }">
                    {{
                      child.completeness === "verified"
                        ? feeText(child.fees)
                        : "-"
                    }}
                  </template>
                </el-table-column>
                <el-table-column
                  :label="tr('detail.orderGrossPnl')"
                  min-width="155"
                >
                  <template #default="{ row: child }">
                    {{
                      child.completeness === "verified"
                        ? display(child.gross_pnl)
                        : "-"
                    }}
                    {{
                      child.completeness === "verified"
                        ? display(child.pnl_asset)
                        : ""
                    }}
                  </template>
                </el-table-column>
                <el-table-column
                  prop="managed.client_order_id"
                  :label="tr('detail.clientId')"
                  min-width="195"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="managed.exchange_order_id"
                  :label="tr('detail.exchangeId')"
                  min-width="130"
                />
                <el-table-column
                  prop="managed.actual_order_id"
                  :label="tr('detail.actualId')"
                  min-width="130"
                />
              </el-table>
            </template>
            <el-empty
              v-else-if="!detailLoading[`${row.account_id}:${row.position_id}`]"
              :description="tr('detail.retry')"
              :image-size="48"
            />
          </div>
        </template>
      </el-table-column>

      <el-table-column
        prop="position_id"
        :label="tr('table.positionId')"
        width="110"
      />
      <el-table-column prop="symbol" :label="tr('table.symbol')" width="115" />
      <el-table-column :label="tr('table.currentPrice')" min-width="125">
        <template #default="{ row }">
          <el-tooltip
            :content="
              tr('table.priceUpdated') + ': ' + formatTime(row.price_updated_at)
            "
          >
            <span>{{ display(row.current_price) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column :label="tr('table.side')" width="90">
        <template #default="{ row }">
          <el-tag
            :type="row.position_side === 'LONG' ? 'success' : 'danger'"
            size="small"
          >
            {{
              row.position_side === "LONG" ? tr("side.long") : tr("side.short")
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="owner"
        :label="tr('filter.owner')"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column :label="tr('table.status')" min-width="125">
        <template #default="{ row }">
          <el-tooltip
            :content="
              row.status_manually_set
                ? tr('bulk.realStatus') + statusLabel(row.system_status)
                : statusLabel(row.status)
            "
          >
            <span>{{ statusLabel(row.status) }}</span>
          </el-tooltip>
          <el-tag v-if="row.status_manually_set" size="small" type="warning">
            {{ tr("bulk.manual") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="tr('table.realizedPnl')" min-width="135">
        <template #default="{ row }">
          <span :class="signed(row.realized_pnl)">{{
            display(row.realized_pnl)
          }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tr('table.unrealizedPnl')" min-width="135">
        <template #default="{ row }">
          <span :class="signed(row.unrealized_pnl)">{{
            display(row.unrealized_pnl)
          }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="tr('table.profit')" min-width="175">
        <template #default="{ row }">
          <span :class="signed(row.total_pnl)">
            {{ display(row.total_pnl) }} {{ row.display_pnl_asset || "" }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="tr('table.returnPct')" min-width="130">
        <template #default="{ row }">
          <span :class="signed(row.display_return_pct)">
            {{
              row.display_return_pct == null
                ? "-"
                : row.display_return_pct + "%"
            }}
          </span>
        </template>
      </el-table-column>

      <el-table-column :label="tr('table.openQty')" min-width="120">
        <template #default="{ row }">{{ display(row.open_qty) }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.closeQty')" min-width="120">
        <template #default="{ row }">{{ display(row.close_qty) }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.remaining')" min-width="120">
        <template #default="{ row }">{{ display(row.remaining_qty) }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.leverage')" min-width="90">
        <template #default="{ row }">{{
          row.leverage == null ? "-" : row.leverage + "x"
        }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.openAvg')" min-width="155">
        <template #default="{ row }">{{
          display(row.open_avg_price)
        }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.closeAvg')" min-width="155">
        <template #default="{ row }">{{
          display(row.close_avg_price)
        }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.fee')" min-width="165">
        <template #default="{ row }">{{
          row.completeness === "verified" ? feeText(row.fees) : "-"
        }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.duration')" min-width="105">
        <template #default="{ row }">{{
          formatDuration(row.duration_millis)
        }}</template>
      </el-table-column>
      <el-table-column :label="tr('table.updatedAt')" min-width="168">
        <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
      </el-table-column>
    </el-table>

    <div class="mt-4 flex justify-end">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.limit"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @current-change="fetchPage"
        @size-change="updatePageSize"
      />
    </div>

    <el-dialog
      v-model="bulkVisible"
      :title="tr('bulk.title.update')"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
      @closed="invalidateBulkPreview"
    >
      <el-alert
        :title="tr('bulk.safetyTitle')"
        :description="tr('bulk.safetyDescription')"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
      />
      <el-form label-position="top">
        <el-form-item
          v-if="bulkAction === 'update'"
          :label="tr('bulk.statusLabel')"
        >
          <el-select
            v-model="bulkStatus"
            style="width: 100%"
            @change="invalidateBulkPreview"
          >
            <el-option :label="tr('bulk.unchanged')" value="" />
            <el-option :label="tr('bulk.clear')" value="__clear__" />
            <el-option :label="tr('state.active')" value="active" />
            <el-option :label="tr('state.suspended')" value="suspended" />
            <el-option :label="tr('state.closed')" value="closed" />
            <el-option
              :label="tr('state.reconcile_required')"
              value="reconcile_required"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="bulkAction === 'update'"
          :label="tr('bulk.completenessLabel')"
        >
          <el-select
            v-model="bulkCompleteness"
            style="width: 100%"
            @change="invalidateBulkPreview"
          >
            <el-option :label="tr('bulk.unchanged')" value="" />
            <el-option :label="tr('bulk.clear')" value="__clear__" />
            <el-option :label="tr('completeness.pending')" value="pending" />
            <el-option
              :label="tr('completeness.incomplete')"
              value="incomplete"
            />
            <el-option
              :label="tr('completeness.manual_reviewed')"
              value="manual_reviewed"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="tr('bulk.reason')">
          <el-input
            v-model="bulkReason"
            type="textarea"
            :rows="3"
            maxlength="512"
            show-word-limit
            :placeholder="tr('bulk.reasonPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <el-button :loading="bulkBusy" @click="prepareBulk">
        {{ tr("bulk.preview") }}
      </el-button>
      <el-alert
        v-if="bulkPreview"
        type="info"
        :closable="false"
        show-icon
        class="mt-3"
        :title="`${tr('bulk.matched')}: ${bulkPreview.count}`"
        :description="tr('bulk.confirmScope')"
      />
      <template #footer>
        <el-button @click="bulkVisible = false">{{
          tr("bulk.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="bulkBusy"
          :disabled="!bulkPreview || bulkReason.trim().length < 8"
          @click="applyBulk"
        >
          {{ tr("bulk.confirm") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
