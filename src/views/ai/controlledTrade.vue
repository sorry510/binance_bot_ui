<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  approveAgentTradeProposal,
  checkAgentTradeRisk,
  closeAgentTradeProposal,
  createAgentTradeProposal,
  executeAgentTradeProposal,
  getAgentTradeProposal,
  getAgentTradeProposals,
  getFuturesOwnership,
  reconcileAgentTradeProposal,
  reconcileFuturesOwnership,
  rejectAgentTradeProposal,
  type AgentTradeProposal,
  type AgentTradeProposalDetail,
  type AgentTradeRiskResult,
  type FuturesOwnershipData
} from "@/api/agent";

defineOptions({ name: "AgentControlledTrade" });
const { t } = useI18n();
const loading = ref(false);
const actionLoading = ref(false);
const ownershipLoading = ref(false);
const ownership = ref<FuturesOwnershipData | null>(null);
const taskId = ref("");
const rows = ref<AgentTradeProposal[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const detail = ref<AgentTradeProposalDetail | null>(null);
const query = reactive({ page: 1, limit: 20, status: "", symbol: "" });
const statusOptions = [
  "risk_rejected",
  "awaiting_approval",
  "approved",
  "rejected",
  "executing",
  "executed",
  "execution_failed",
  "execution_uncertain",
  "protection_failed",
  "closed",
  "expired"
];

const proposal = computed(() => detail.value?.proposal || null);
const risk = computed<AgentTradeRiskResult | null>(() => {
  const raw = proposal.value?.risk_json;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentTradeRiskResult;
  } catch {
    return null;
  }
});

const ownershipNeedsReconcile = computed(() => {
  const data = ownership.value;
  return Boolean(
    data?.positions?.some(item => item.status === "reconcile_required") ||
      data?.orders?.some(item => item.status === "reconcile_required")
  );
});

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function formatNumber(value?: number, digits = 6) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}
function statusType(status: string) {
  if (status === "executed") return "success";
  if (
    [
      "risk_rejected",
      "rejected",
      "execution_failed",
      "protection_failed",
      "expired"
    ].includes(status)
  )
    return "danger";
  if (["approved", "executing", "execution_uncertain"].includes(status))
    return "warning";
  return "info";
}
function parseJSON(raw?: string) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function prettyJSON(value: any) {
  return JSON.stringify(value ?? {}, null, 2);
}
function statusLabel(status: string) {
  const key = `controlledTradePage.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function ownerTagType(owner: string): "success" | "warning" | "info" {
  if (owner === "unmanaged") return "warning";
  if (owner === "agent_trade") return "success";
  return "info";
}

function ownerLabel(owner?: string) {
  if (!owner) return "-";
  const key = `controlledTradePage.owner.${owner}`;
  const translated = t(key);
  return translated === key ? owner : translated;
}

async function fetchOwnership() {
  ownershipLoading.value = true;
  try {
    const res = await getFuturesOwnership();
    ownership.value = (res?.data || null) as FuturesOwnershipData | null;
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("controlledTradePage.message.ownershipLoadFailed")
    );
  } finally {
    ownershipLoading.value = false;
  }
}

async function runOwnershipReconcile() {
  ownershipLoading.value = true;
  try {
    await reconcileFuturesOwnership();
    ElMessage.success(
      t("controlledTradePage.message.ownershipReconcileSuccess")
    );
    await fetchOwnership();
  } catch (error: any) {
    ElMessage.error(
      error?.message ||
        t("controlledTradePage.message.ownershipReconcileFailed")
    );
  } finally {
    ownershipLoading.value = false;
  }
}

async function fetchRows(showLoading = false) {
  if (showLoading) loading.value = true;
  try {
    const res = await getAgentTradeProposals({ ...query });
    rows.value = (res?.data?.list || []) as AgentTradeProposal[];
    total.value = Number(res?.data?.total || 0);
  } finally {
    if (showLoading) loading.value = false;
  }
}
async function loadDetail(id: string) {
  const res = await getAgentTradeProposal(id);
  detail.value = res?.data as AgentTradeProposalDetail;
}
async function openDetail(row: AgentTradeProposal) {
  try {
    await loadDetail(row.proposal_id);
    detailVisible.value = true;
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("controlledTradePage.message.loadFailed")
    );
  }
}
async function createProposal() {
  const value = taskId.value.trim();
  if (!value) {
    ElMessage.error(t("controlledTradePage.message.taskRequired"));
    return;
  }
  actionLoading.value = true;
  try {
    const res = await createAgentTradeProposal(value);
    if (Number(res?.code) !== 200) throw new Error(res?.msg || "create failed");
    taskId.value = "";
    ElMessage.success(t("controlledTradePage.message.created"));
    await fetchRows();
    if (res?.data?.proposal_id)
      await openDetail(res.data as AgentTradeProposal);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("controlledTradePage.message.createFailed")
    );
  } finally {
    actionLoading.value = false;
  }
}
async function runAction(action: "risk" | "approve" | "execute" | "reconcile") {
  if (!proposal.value) return;
  const id = proposal.value.proposal_id;
  actionLoading.value = true;
  try {
    if (action === "risk") await checkAgentTradeRisk(id);
    if (action === "approve") await approveAgentTradeProposal(id);
    if (action === "execute") await executeAgentTradeProposal(id);
    if (action === "reconcile") await reconcileAgentTradeProposal(id);
    ElMessage.success(t(`controlledTradePage.message.${action}Success`));
    await Promise.all([loadDetail(id), fetchRows()]);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t(`controlledTradePage.message.${action}Failed`)
    );
    await loadDetail(id).catch(() => undefined);
    await fetchRows();
  } finally {
    actionLoading.value = false;
  }
}
async function closeManagedPosition() {
  if (!proposal.value) return;
  try {
    await ElMessageBox.confirm(
      t("controlledTradePage.confirm.close"),
      t("controlledTradePage.confirm.closeTitle"),
      {
        type: "error",
        confirmButtonText: t("controlledTradePage.button.closePosition")
      }
    );
    actionLoading.value = true;
    await closeAgentTradeProposal(proposal.value.proposal_id);
    ElMessage.success(t("controlledTradePage.message.closeSuccess"));
    await Promise.all([
      loadDetail(proposal.value.proposal_id),
      fetchRows(),
      fetchOwnership()
    ]);
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("controlledTradePage.message.closeFailed")
    );
    if (proposal.value)
      await loadDetail(proposal.value.proposal_id).catch(() => undefined);
  } finally {
    actionLoading.value = false;
  }
}

async function approve() {
  await ElMessageBox.confirm(
    t("controlledTradePage.confirm.approve"),
    t("controlledTradePage.confirm.title"),
    { type: "warning" }
  );
  await runAction("approve");
}
async function execute() {
  await ElMessageBox.confirm(
    t("controlledTradePage.confirm.execute"),
    t("controlledTradePage.confirm.executeTitle"),
    {
      type: "error",
      confirmButtonText: t("controlledTradePage.button.execute")
    }
  );
  await runAction("execute");
}
async function reject() {
  if (!proposal.value) return;
  try {
    const result = await ElMessageBox.prompt(
      t("controlledTradePage.confirm.reject"),
      t("controlledTradePage.confirm.rejectTitle"),
      { inputPlaceholder: t("controlledTradePage.placeholder.rejectReason") }
    );
    actionLoading.value = true;
    await rejectAgentTradeProposal(
      proposal.value.proposal_id,
      result.value || ""
    );
    ElMessage.success(t("controlledTradePage.message.rejectSuccess"));
    await Promise.all([loadDetail(proposal.value.proposal_id), fetchRows()]);
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("controlledTradePage.message.rejectFailed")
    );
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => Promise.all([fetchRows(true), fetchOwnership()]));
</script>

<template>
  <div class="controlled-trade-page p-4">
    <el-alert
      :title="t('controlledTradePage.warning.title')"
      :description="t('controlledTradePage.warning.description')"
      type="warning"
      show-icon
      :closable="false"
      class="mb-4"
    />
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div>
          <div class="text-lg font-medium">
            {{ t("controlledTradePage.title") }}
          </div>
          <div class="mt-1 text-sm text-gray-500">
            {{ t("controlledTradePage.subtitle") }}
          </div>
        </div>
      </template>
      <div class="flex flex-wrap items-center gap-2">
        <el-input
          v-model="taskId"
          :placeholder="t('controlledTradePage.placeholder.taskId')"
          clearable
          style="width: 420px"
          @keyup.enter="createProposal"
        />
        <el-button
          type="primary"
          :loading="actionLoading"
          @click="createProposal"
        >
          {{ t("controlledTradePage.button.create") }}
        </el-button>
        <span class="text-sm text-gray-500">{{
          t("controlledTradePage.hint.create")
        }}</span>
      </div>
    </el-card>

    <el-card v-loading="ownershipLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="font-medium">
              {{ t("controlledTradePage.ownership.title") }}
            </div>
            <div class="mt-1 text-sm text-gray-500">
              {{ t("controlledTradePage.ownership.description") }}
            </div>
          </div>
          <div class="flex gap-2">
            <el-button size="small" @click="fetchOwnership">{{
              t("controlledTradePage.button.refresh")
            }}</el-button>
            <el-button
              size="small"
              type="primary"
              plain
              @click="runOwnershipReconcile"
              >{{
                t("controlledTradePage.button.reconcileOwnership")
              }}</el-button
            >
          </div>
        </div>
      </template>
      <el-alert
        v-if="ownership?.account_error"
        :title="ownership.account_error"
        type="warning"
        :closable="false"
        show-icon
        class="mb-3"
      />
      <el-alert
        v-if="ownershipNeedsReconcile"
        :title="t('controlledTradePage.ownership.reconcileRequiredWarning')"
        type="error"
        :closable="false"
        show-icon
        class="mb-3"
      />
      <el-tabs>
        <el-tab-pane
          :label="t('controlledTradePage.ownership.accountPositions')"
        >
          <el-table
            :data="ownership?.account_positions || []"
            size="small"
            max-height="360"
          >
            <el-table-column
              prop="symbol"
              :label="t('controlledTradePage.table.symbol')"
              width="130"
            />
            <el-table-column
              prop="position_side"
              :label="t('controlledTradePage.table.side')"
              width="100"
            />
            <el-table-column
              :label="t('controlledTradePage.ownership.accountQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.account_qty, 8)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('controlledTradePage.ownership.owner')"
              width="150"
            >
              <template #default="{ row }"
                ><el-tag :type="ownerTagType(row.owner)" size="small">{{
                  ownerLabel(row.owner)
                }}</el-tag></template
              >
            </el-table-column>
            <el-table-column
              :label="t('controlledTradePage.ownership.managedQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.managed_qty, 8)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="managed_status"
              :label="t('controlledTradePage.table.status')"
              width="160"
            />
            <el-table-column
              prop="source_ref"
              :label="t('controlledTradePage.ownership.sourceRef')"
              min-width="190"
            />
            <el-table-column
              :label="t('controlledTradePage.ownership.lastReconciled')"
              width="180"
            >
              <template #default="{ row }">{{
                formatTime(row.last_reconciled_at)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="t('controlledTradePage.ownership.managedOrders')">
          <el-table
            :data="ownership?.orders || []"
            size="small"
            max-height="360"
          >
            <el-table-column
              :label="t('controlledTradePage.ownership.owner')"
              width="150"
            >
              <template #default="{ row }">
                {{ ownerLabel(row.owner) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="symbol"
              :label="t('controlledTradePage.table.symbol')"
              width="130"
            />
            <el-table-column
              prop="position_side"
              :label="t('controlledTradePage.table.side')"
              width="100"
            />
            <el-table-column
              prop="intent"
              :label="t('controlledTradePage.ownership.intent')"
              width="130"
            />
            <el-table-column
              prop="status"
              :label="t('controlledTradePage.table.status')"
              width="160"
            />
            <el-table-column
              prop="client_order_id"
              label="Client Order ID"
              min-width="210"
            />
            <el-table-column
              prop="exchange_order_id"
              label="Binance Order ID"
              min-width="170"
            />
            <el-table-column
              :label="t('controlledTradePage.ownership.requestedQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.requested_qty, 8)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('controlledTradePage.ownership.filledQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.filled_qty, 8)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("controlledTradePage.history") }}</span>
          <el-button size="small" @click="fetchRows(true)">{{
            t("controlledTradePage.button.refresh")
          }}</el-button>
        </div>
      </template>
      <div class="mb-3 flex flex-wrap gap-2">
        <el-input
          v-model="query.symbol"
          clearable
          :placeholder="t('controlledTradePage.placeholder.symbol')"
          style="width: 180px"
          @keyup.enter="fetchRows(true)"
        />
        <el-select
          v-model="query.status"
          clearable
          :placeholder="t('controlledTradePage.table.status')"
          style="width: 210px"
          @change="fetchRows(true)"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item"
            :label="statusLabel(item)"
            :value="item"
          />
        </el-select>
        <el-button @click="fetchRows(true)">{{
          t("controlledTradePage.button.search")
        }}</el-button>
      </div>

      <el-table :data="rows" size="small">
        <el-table-column
          prop="proposal_id"
          :label="t('controlledTradePage.table.proposalId')"
          min-width="210"
        />
        <el-table-column
          prop="source_task_id"
          :label="t('controlledTradePage.table.taskId')"
          min-width="210"
        />
        <el-table-column
          prop="symbol"
          :label="t('controlledTradePage.table.symbol')"
          width="120"
        />
        <el-table-column
          prop="side"
          :label="t('controlledTradePage.table.side')"
          width="90"
        />
        <el-table-column
          :label="t('controlledTradePage.table.status')"
          width="160"
        >
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{
              statusLabel(row.status)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('controlledTradePage.table.risk')"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              :type="row.risk_status === 'pass' ? 'success' : 'danger'"
              size="small"
            >
              {{ row.risk_status || "-" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('controlledTradePage.table.quantity')"
          width="120"
        >
          <template #default="{ row }">{{
            formatNumber(row.quantity, 8)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('controlledTradePage.table.notional')"
          width="120"
        >
          <template #default="{ row }">{{
            formatNumber(row.notional_usdt, 2)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('controlledTradePage.table.expiresAt')"
          width="180"
        >
          <template #default="{ row }">{{
            formatTime(row.expires_at)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('controlledTradePage.table.operation')"
          width="100"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{
              t("controlledTradePage.button.detail")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.limit"
        class="mt-3 justify-end"
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-sizes="[10, 20, 50]"
        @current-change="fetchRows(true)"
        @size-change="
          () => {
            query.page = 1;
            fetchRows(true);
          }
        "
      />
    </el-card>

    <el-drawer
      v-model="detailVisible"
      :title="t('controlledTradePage.detail.title')"
      size="72%"
    >
      <template v-if="proposal">
        <div class="mb-4 flex flex-wrap gap-2">
          <el-button :loading="actionLoading" @click="runAction('risk')">{{
            t("controlledTradePage.button.risk")
          }}</el-button>
          <el-button
            v-if="proposal.status === 'awaiting_approval'"
            type="success"
            :loading="actionLoading"
            @click="approve"
            >{{ t("controlledTradePage.button.approve") }}</el-button
          >
          <el-button
            v-if="
              ['awaiting_approval', 'approved', 'risk_rejected'].includes(
                proposal.status
              )
            "
            type="danger"
            plain
            :loading="actionLoading"
            @click="reject"
            >{{ t("controlledTradePage.button.reject") }}</el-button
          >
          <el-button
            v-if="proposal.status === 'approved'"
            type="danger"
            :loading="actionLoading"
            @click="execute"
            >{{ t("controlledTradePage.button.execute") }}</el-button
          >
          <el-button
            v-if="
              [
                'executing',
                'execution_uncertain',
                'protection_failed'
              ].includes(proposal.status)
            "
            type="warning"
            :loading="actionLoading"
            @click="runAction('reconcile')"
            >{{ t("controlledTradePage.button.reconcile") }}</el-button
          >
          <el-button
            v-if="
              ['executed', 'protection_failed'].includes(proposal.status) &&
              detail?.managed_position &&
              detail.managed_position.status !== 'closed'
            "
            type="danger"
            :loading="actionLoading"
            @click="closeManagedPosition"
            >{{ t("controlledTradePage.button.closePosition") }}</el-button
          >
        </div>

        <el-descriptions :column="3" border class="mb-4">
          <el-descriptions-item
            :label="t('controlledTradePage.table.proposalId')"
            >{{ proposal.proposal_id }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.table.taskId')"
            >{{ proposal.source_task_id }}</el-descriptions-item
          >
          <el-descriptions-item :label="t('controlledTradePage.table.status')">
            <el-tag :type="statusType(proposal.status)">{{
              statusLabel(proposal.status)
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.table.symbol')"
            >{{ proposal.symbol }}</el-descriptions-item
          >
          <el-descriptions-item :label="t('controlledTradePage.table.side')">{{
            proposal.side
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.detail.marketCondition')"
            >{{ proposal.market_condition }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.detail.referencePrice')"
            >{{
              formatNumber(proposal.reference_price, 8)
            }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.table.quantity')"
            >{{ formatNumber(proposal.quantity, 8) }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.detail.leverage')"
            >{{ proposal.leverage }}x</el-descriptions-item
          >
          <el-descriptions-item :label="t('controlledTradePage.table.notional')"
            >{{
              formatNumber(proposal.notional_usdt, 2)
            }}
            USDT</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.detail.riskUsdt')"
            >{{
              formatNumber(proposal.risk_usdt, 2)
            }}
            USDT</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.table.expiresAt')"
            >{{ formatTime(proposal.expires_at) }}</el-descriptions-item
          >
        </el-descriptions>
        <el-descriptions :column="1" border class="mb-4">
          <el-descriptions-item
            :label="t('controlledTradePage.detail.entryCondition')"
            >{{ proposal.entry_condition }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.detail.entryZones')"
          >
            <pre class="inline-json">{{
              prettyJSON(parseJSON(proposal.entry_zones_json))
            }}</pre>
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.detail.stopLoss')"
            >{{ formatNumber(proposal.stop_loss, 8) }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.detail.takeProfits')"
          >
            <pre class="inline-json">{{
              prettyJSON(parseJSON(proposal.take_profits_json))
            }}</pre>
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.detail.invalidations')"
          >
            <pre class="inline-json">{{
              prettyJSON(parseJSON(proposal.invalidations_json))
            }}</pre>
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.detail.evidence')"
          >
            <pre class="inline-json">{{
              prettyJSON(parseJSON(proposal.evidence_json))
            }}</pre>
          </el-descriptions-item>
        </el-descriptions>

        <div class="section-title">
          {{ t("controlledTradePage.detail.riskChecks") }}
        </div>
        <el-table :data="risk?.checks || []" size="small" class="mb-4">
          <el-table-column
            prop="name"
            :label="t('controlledTradePage.detail.check')"
            min-width="190"
          />
          <el-table-column
            :label="t('controlledTradePage.detail.result')"
            width="100"
          >
            <template #default="{ row }"
              ><el-tag :type="row.passed ? 'success' : 'danger'">{{
                row.passed ? "PASS" : "FAIL"
              }}</el-tag></template
            >
          </el-table-column>
          <el-table-column
            prop="message"
            :label="t('controlledTradePage.detail.message')"
            min-width="300"
          />
        </el-table>

        <template
          v-if="detail?.managed_position || detail?.managed_orders?.length"
        >
          <div class="section-title">
            {{ t("controlledTradePage.detail.managedLifecycle") }}
          </div>
          <el-descriptions
            v-if="detail?.managed_position"
            :column="3"
            border
            class="mb-3"
          >
            <el-descriptions-item
              :label="t('controlledTradePage.ownership.owner')"
            >
              {{ ownerLabel(detail.managed_position.owner) }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.ownership.managedQty')"
            >
              {{ formatNumber(detail.managed_position.managed_qty, 8) }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.table.status')"
            >
              {{ detail.managed_position.status }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.detail.entryPrice')"
            >
              {{ formatNumber(detail.managed_position.entry_price, 8) }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.ownership.lastReconciled')"
            >
              {{ formatTime(detail.managed_position.last_reconciled_at) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-table
            :data="detail?.managed_orders || []"
            size="small"
            class="mb-4"
          >
            <el-table-column
              prop="intent"
              :label="t('controlledTradePage.ownership.intent')"
              width="130"
            />
            <el-table-column
              prop="status"
              :label="t('controlledTradePage.table.status')"
              width="160"
            />
            <el-table-column
              prop="client_order_id"
              label="Client Order ID"
              min-width="210"
            />
            <el-table-column
              prop="exchange_order_id"
              label="Binance Order ID"
              min-width="170"
            />
            <el-table-column
              :label="t('controlledTradePage.ownership.requestedQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.requested_qty, 8)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('controlledTradePage.ownership.filledQty')"
              width="140"
            >
              <template #default="{ row }">{{
                formatNumber(row.filled_qty, 8)
              }}</template>
            </el-table-column>
          </el-table>
        </template>

        <template v-if="detail?.execution">
          <div class="section-title">
            {{ t("controlledTradePage.detail.execution") }}
          </div>
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item
              :label="t('controlledTradePage.detail.executionStatus')"
              >{{ detail.execution.status }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('controlledTradePage.detail.clientOrderId')"
              >{{ detail.execution.client_order_id }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('controlledTradePage.detail.exchangeOrderId')"
              >{{
                detail.execution.exchange_order_id || "-"
              }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="t('controlledTradePage.detail.averagePrice')"
              >{{
                formatNumber(detail.execution.average_price, 8)
              }}</el-descriptions-item
            >
            <el-descriptions-item
              v-if="detail.execution.error"
              :label="t('controlledTradePage.detail.error')"
              :span="2"
              >{{ detail.execution.error }}</el-descriptions-item
            >
          </el-descriptions>
        </template>

        <div class="section-title">
          {{ t("controlledTradePage.detail.audit") }}
        </div>
        <el-table :data="detail?.audits || []" size="small">
          <el-table-column
            :label="t('controlledTradePage.detail.time')"
            width="180"
          >
            <template #default="{ row }">{{
              formatTime(row.created_at)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="event"
            :label="t('controlledTradePage.detail.event')"
            min-width="180"
          />
          <el-table-column
            prop="status"
            :label="t('controlledTradePage.table.status')"
            width="120"
          />
          <el-table-column
            prop="actor"
            :label="t('controlledTradePage.detail.actor')"
            width="140"
          />
          <el-table-column
            :label="t('controlledTradePage.detail.detail')"
            min-width="300"
          >
            <template #default="{ row }">
              <pre class="inline-json">{{
                prettyJSON(parseJSON(row.detail_json))
              }}</pre>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>
<style scoped>
.controlled-trade-page {
  min-width: 0;
}

.section-title {
  margin: 14px 0 8px;
  font-weight: 600;
}

.inline-json {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
