<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import {
  getManagedAnomalies,
  getManagedCycleDetails,
  type ManagedAnomalyFilters,
  type ManagedAnomalyItem,
  type ManagedCycleDetail
} from "@/api/order";

const props = defineProps<{ standalone?: boolean }>();
const { t, te } = useI18n();
const tr = (key: string) => t("orderPage.anomaly." + key);
const route = useRoute();
const expanded = ref(!!props.standalone || route.query.anomalies === "1");
const busy = ref(false);
const total = ref(0);
const settlementPendingTotal = ref(0);
const bnbCommissionPendingTotal = ref(0);
const rows = ref<ManagedAnomalyItem[]>([]);
const errorMessage = ref("");
const inspected = ref<ManagedAnomalyItem | null>(null);
const inspectDialog = ref(false);
const detail = ref<ManagedCycleDetail | null>(null);
const detailBusy = ref(false);
const detailError = ref("");
const query = reactive({
  account_id: (route.query.account_id === "lead" ? "lead" : "main") as
    | "main"
    | "lead",
  owner: "",
  symbol: "",
  position_side: "",
  category:
    typeof route.query.category === "string" ? route.query.category : "",
  page: 1,
  limit: 20
});
let requestSerial = 0;
const categories = [
  "",
  "reconcile_required",
  "managed_position_reconcile",
  "managed_order_reconcile",
  "fill_verification_pending",
  "aged_managed_order",
  "settlement_incomplete",
  "proposal_execution_uncertain",
  "proposal_protection_failed"
];
function categoryLabel(category: string) {
  const key = "orderPage.anomaly.categories." + (category || "all");
  return te(key) ? t(key) : category;
}
function timestamp(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function readableError(err: any) {
  return err?.response?.data?.msg || err?.message || tr("failed");
}
async function load(reset = false) {
  if (reset) query.page = 1;
  const n = ++requestSerial;
  busy.value = true;
  errorMessage.value = "";
  try {
    const params: ManagedAnomalyFilters = {
      account_id: query.account_id,
      owner: query.owner.trim() || undefined,
      symbol: query.symbol.trim() || undefined,
      position_side: query.position_side || undefined,
      category: query.category || undefined,
      exclude_settlement_pending: true,
      page: query.page,
      limit: query.limit
    };
    const res = await getManagedAnomalies(params);
    if (n !== requestSerial) return;
    if (!res || res.code !== 200 || !res.data) throw new Error(tr("failed"));
    rows.value = res.data.list || [];
    total.value = Number(res.data.total || 0);
    settlementPendingTotal.value = Number(
      res.data.settlement_pending_total || 0
    );
    bnbCommissionPendingTotal.value = Number(
      res.data.with_bnb_commission_total || 0
    );
  } catch (err) {
    if (n !== requestSerial) return;
    rows.value = [];
    total.value = 0;
    settlementPendingTotal.value = 0;
    bnbCommissionPendingTotal.value = 0;
    errorMessage.value = readableError(err);
    ElMessage.warning(tr("failed"));
  } finally {
    if (n === requestSerial) busy.value = false;
  }
}
function viewSettlementPending() {
  query.category = "settlement_incomplete";
  void load(true);
}
function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) void load(true);
}
async function inspect(row: ManagedAnomalyItem) {
  inspected.value = row;
  detail.value = null;
  detailError.value = "";
  inspectDialog.value = true;
  if (row.position_id == null) return;
  detailBusy.value = true;
  try {
    const res = await getManagedCycleDetails(row.position_id, row.account_id);
    if (!res || res.code !== 200 || !res.data) throw new Error(tr("failed"));
    if (inspected.value === row) detail.value = res.data;
  } catch (err) {
    if (inspected.value === row) detailError.value = readableError(err);
  } finally {
    detailBusy.value = false;
  }
}
watch(
  () => [route.query.anomalies, route.query.category, route.query.account_id],
  () => {
    if (route.query.anomalies !== "1" && !props.standalone) return;
    expanded.value = true;
    query.account_id = route.query.account_id === "lead" ? "lead" : "main";
    const next =
      typeof route.query.category === "string" ? route.query.category : "";
    query.category = categories.includes(next) ? next : "";
    void load(true);
  }
);
onMounted(() => {
  if (expanded.value) {
    const next = query.category;
    if (!categories.includes(next)) query.category = "";
    void load(true);
  }
});
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <strong>{{ tr("title") }}</strong>
          <el-tag v-if="expanded" type="warning" size="small">
            {{ tr("localOnly") }}
          </el-tag>
        </div>
        <el-button v-if="!props.standalone" @click="toggle">
          {{ expanded ? tr("collapse") : tr("expand") }}
        </el-button>
      </div>
    </template>
    <template v-if="expanded">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        :title="tr('scopeNote')"
      />
      <el-form :inline="true">
        <el-form-item :label="tr('account')">
          <el-select v-model="query.account_id" style="width: 105px">
            <el-option label="Main" value="main" />
            <el-option label="Lead" value="lead" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tr('category')">
          <el-select v-model="query.category" style="width: 230px">
            <el-option
              v-for="c in categories"
              :key="c || 'all'"
              :value="c"
              :label="categoryLabel(c)"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="tr('symbol')">
          <el-input v-model="query.symbol" clearable style="width: 125px" />
        </el-form-item>
        <el-form-item :label="tr('owner')">
          <el-input v-model="query.owner" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item :label="tr('side')">
          <el-select v-model="query.position_side" style="width: 110px">
            <el-option :label="tr('all')" value="" />
            <el-option label="LONG" value="LONG" />
            <el-option label="SHORT" value="SHORT" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="busy" @click="load(true)">
            {{ tr("search") }}
          </el-button>
          <el-button :loading="busy" @click="load()">
            {{ tr("refresh") }}
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="errorMessage"
        type="warning"
        show-icon
        :closable="false"
        :title="tr('failed')"
        :description="errorMessage"
        class="mb-3"
      />
      <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span>
          {{
            query.category === "settlement_incomplete"
              ? tr("settlementRecords")
              : tr("count")
          }}:
          <strong>{{ total }}</strong>
        </span>
        <span v-if="settlementPendingTotal > 0">
          {{ tr("settlementPending") }}:
          <strong>{{ settlementPendingTotal }}</strong>
        </span>
        <span v-if="bnbCommissionPendingTotal > 0">
          {{ tr("withBNBCommission") }}:
          <strong>{{ bnbCommissionPendingTotal }}</strong>
        </span>
        <el-button
          v-if="
            settlementPendingTotal > 0 &&
            query.category !== 'settlement_incomplete'
          "
          type="primary"
          link
          @click="viewSettlementPending"
        >
          {{ tr("viewSettlementPending") }}
        </el-button>
      </div>
      <el-alert
        v-if="settlementPendingTotal > 0"
        class="mb-3"
        type="info"
        :closable="false"
        show-icon
        :title="tr('settlementExplanation')"
      />
      <el-table
        v-loading="busy"
        :data="rows"
        border
        size="small"
        :row-key="
          row =>
            [
              row.source,
              row.account_id,
              row.managed_order_id ?? row.position_id ?? row.proposal_id
            ].join(':')
        "
      >
        <el-table-column :label="tr('category')" min-width="195">
          <template #default="{ row }">
            <el-tag type="warning" size="small">
              {{ categoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="account_id" :label="tr('account')" width="85" />
        <el-table-column prop="owner" :label="tr('owner')" min-width="120" />
        <el-table-column prop="symbol" :label="tr('symbol')" min-width="105" />
        <el-table-column prop="position_side" :label="tr('side')" width="95" />
        <el-table-column prop="status" :label="tr('status')" min-width="145" />
        <el-table-column
          :label="tr('identity')"
          min-width="185"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{
              row.client_order_id ||
              row.proposal_id ||
              (row.position_id != null ? "#" + row.position_id : "-")
            }}
          </template>
        </el-table-column>
        <el-table-column :label="tr('lastChecked')" min-width="165">
          <template #default="{ row }">
            {{ timestamp(row.last_reconciled_at || row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column :label="tr('actions')" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="inspect(row)">
              {{ tr("inspect") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty
        v-if="!busy && !rows.length && !errorMessage"
        :description="tr('empty')"
        :image-size="56"
      />
      <div class="mt-3 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.limit"
          layout="total, prev, pager, next"
          :total="total"
          :pager-count="5"
          :disabled="busy"
          @current-change="load()"
        />
      </div>
    </template>
  </el-card>

  <el-dialog
    v-model="inspectDialog"
    :title="tr('details')"
    width="85%"
    append-to-body
  >
    <template v-if="inspected">
      <el-alert
        :closable="false"
        type="warning"
        show-icon
        class="mb-3"
        :title="categoryLabel(inspected.category)"
        :description="tr('noAction')"
      />
      <el-descriptions border :column="2" size="small">
        <el-descriptions-item :label="tr('source')">{{
          inspected.source
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('account')">{{
          inspected.account_id
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('owner')">{{
          inspected.owner
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('symbol')">{{
          inspected.symbol
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('side')">{{
          inspected.position_side
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('status')">{{
          inspected.status
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('positionId')">{{
          inspected.position_id ?? "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('orderId')">{{
          inspected.managed_order_id ?? "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('clientId')">{{
          inspected.client_order_id || "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('exchangeId')">{{
          inspected.exchange_order_id || "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('proposalId')">{{
          inspected.proposal_id || "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('intent')">{{
          inspected.intent || "-"
        }}</el-descriptions-item>
        <el-descriptions-item :label="tr('qty')">
          {{ inspected.requested_qty }} / {{ inspected.filled_qty }}
        </el-descriptions-item>
        <el-descriptions-item :label="tr('lastChecked')">
          {{ timestamp(inspected.last_reconciled_at) }}
        </el-descriptions-item>
        <el-descriptions-item :label="tr('updatedAt')">
          {{ timestamp(inspected.updated_at) }}
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="inspected.position_id == null" class="mt-3 text-sm">
        {{ tr("noCycle") }}
      </div>
      <div v-else v-loading="detailBusy" class="mt-3">
        <el-alert
          v-if="detailError"
          type="warning"
          :closable="false"
          :title="tr('detailUnavailable')"
          :description="detailError"
        />
        <template v-if="detail">
          <strong>{{ tr("linkedOrders") }}</strong>
          <el-table
            class="mt-2"
            :data="detail.orders || []"
            border
            size="small"
          >
            <el-table-column type="expand">
              <template #default="{ row: child }">
                <el-table :data="child.fills || []" border size="small">
                  <el-table-column
                    prop="trade_id"
                    :label="tr('tradeId')"
                    min-width="140"
                  />
                  <el-table-column
                    prop="qty"
                    :label="tr('qty')"
                    min-width="110"
                  />
                  <el-table-column
                    prop="price"
                    :label="tr('price')"
                    min-width="110"
                  />
                  <el-table-column
                    prop="rest_verified"
                    :label="tr('restVerified')"
                    width="120"
                  >
                    <template #default="{ row: fill }">
                      {{ fill.rest_verified ? tr("yes") : tr("no") }}
                    </template>
                  </el-table-column>
                </el-table>
              </template>
            </el-table-column>
            <el-table-column
              prop="managed.intent"
              :label="tr('intent')"
              min-width="105"
            />
            <el-table-column
              prop="managed.status"
              :label="tr('status')"
              min-width="135"
            />
            <el-table-column
              prop="managed.client_order_id"
              :label="tr('clientId')"
              min-width="185"
              show-overflow-tooltip
            />
            <el-table-column
              prop="filled_qty_from_fills"
              :label="tr('filled')"
              min-width="100"
            />
          </el-table>
        </template>
      </div>
    </template>
  </el-dialog>
</template>
