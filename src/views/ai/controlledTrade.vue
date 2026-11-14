<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getFuturesOwnership,
  manualClaimFuturesOwnership,
  reconcileFuturesOwnership,
  type AccountPositionOwnership,
  type FuturesOwnershipData
} from "@/api/agent";

defineOptions({ name: "AgentControlledTrade" });
const { t } = useI18n();
const ownershipLoading = ref(false);
const ownership = ref<FuturesOwnershipData | null>(null);
const manualVisible = ref(false);
const manualSubmitting = ref(false);
const manualPosition = ref<AccountPositionOwnership | null>(null);
const manualForm = reactive({
  owner: "auto_strategy",
  quantity: "",
  reason: ""
});
const manualOwnerOptions = ["auto_strategy", "new_coin_rush", "funding_rate"];
const manualClaimFailureCodes = new Set([
  "manual_claim_invalid_input",
  "manual_claim_unauthorized",
  "manual_claim_position_not_found",
  "manual_claim_account_quantity_changed",
  "manual_claim_duplicate_exchange_position",
  "manual_claim_invalid_entry_price",
  "manual_claim_rejected"
]);

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

function openManualClaim(row: AccountPositionOwnership) {
  if (
    row.owner !== "unmanaged" ||
    !(row.account_qty > 0) ||
    ownership.value?.account_error
  )
    return;
  manualPosition.value = row;
  manualForm.owner = "auto_strategy";
  manualForm.quantity = String(row.account_qty);
  manualForm.reason = "";
  manualVisible.value = true;
}

async function submitManualClaim() {
  const row = manualPosition.value;
  if (!row || manualSubmitting.value) return;
  const qty = Number(manualForm.quantity);
  if (
    !/^\d+(\.\d{1,12})?$/.test(manualForm.quantity.trim()) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    qty > row.account_qty ||
    manualForm.reason.trim().length < 5
  ) {
    ElMessage.warning(t("controlledTradePage.ownership.manualValidation"));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t("controlledTradePage.ownership.manualConfirm", {
        symbol: row.symbol,
        side: row.position_side,
        owner: ownerLabel(manualForm.owner),
        qty: manualForm.quantity
      }),
      t("controlledTradePage.ownership.manualTitle"),
      {
        type: "warning",
        confirmButtonText: t(
          "controlledTradePage.ownership.manualConfirmButton"
        )
      }
    );
  } catch {
    return;
  }
  manualSubmitting.value = true;
  try {
    const response = await manualClaimFuturesOwnership({
      symbol: row.symbol,
      position_side: row.position_side,
      owner: manualForm.owner,
      quantity: qty,
      expected_account_qty: row.account_qty,
      reason: manualForm.reason.trim()
    });
    if (Number(response?.code) !== 200)
      throw new Error(response?.msg || "manual ownership claim failed");
    manualVisible.value = false;
    manualPosition.value = null;
    ElMessage.success(t("controlledTradePage.ownership.manualSuccess"));
    await fetchOwnership();
  } catch (error: any) {
    const code = String(error?.response?.data?.msg || error?.message || "");
    ElMessage.error(
      manualClaimFailureCodes.has(code)
        ? t(`controlledTradePage.ownership.${code}`)
        : t("controlledTradePage.ownership.manualFailed")
    );
    await fetchOwnership().catch(() => undefined);
  } finally {
    manualSubmitting.value = false;
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

onMounted(() => {
  void fetchOwnership();
});
</script>

<template>
  <div class="controlled-trade-page p-4">
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
            <el-table-column
              :label="t('controlledTradePage.table.operation')"
              fixed="right"
              width="140"
            >
              <template #default="{ row }">
                <el-button
                  v-if="
                    row.owner === 'unmanaged' &&
                    row.account_qty > 0 &&
                    !ownership?.account_error
                  "
                  size="small"
                  type="primary"
                  plain
                  @click="openManualClaim(row)"
                >
                  {{ t("controlledTradePage.ownership.manualAction") }}
                </el-button>
              </template>
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
        <el-tab-pane :label="t('controlledTradePage.ownership.manualAuditTab')">
          <el-table
            :data="ownership?.manual_adjustments || []"
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
              :label="t('controlledTradePage.ownership.owner')"
              width="160"
            >
              <template #default="{ row }">{{
                ownerLabel(row.owner)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="managed_qty"
              :label="t('controlledTradePage.ownership.managedQty')"
              width="130"
            />
            <el-table-column
              prop="account_qty"
              :label="t('controlledTradePage.ownership.accountQty')"
              width="130"
            />
            <el-table-column
              prop="operator"
              :label="t('controlledTradePage.ownership.manualOperator')"
              min-width="120"
            />
            <el-table-column
              prop="reason"
              :label="t('controlledTradePage.ownership.manualReason')"
              min-width="210"
            />
            <el-table-column
              :label="t('controlledTradePage.ownership.manualDate')"
              width="190"
            >
              <template #default="{ row }">{{
                formatTime(row.created_at)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="manualVisible"
      :title="t('controlledTradePage.ownership.manualTitle')"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!manualSubmitting"
      :show-close="!manualSubmitting"
    >
      <template v-if="manualPosition">
        <el-alert
          :title="t('controlledTradePage.ownership.manualWarning')"
          type="warning"
          show-icon
          :closable="false"
          class="mb-4"
        />
        <el-descriptions :column="2" border class="mb-4">
          <el-descriptions-item
            :label="t('controlledTradePage.table.symbol')"
            >{{ manualPosition.symbol }}</el-descriptions-item
          >
          <el-descriptions-item :label="t('controlledTradePage.table.side')">{{
            manualPosition.position_side
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="t('controlledTradePage.ownership.accountQty')"
            >{{
              formatNumber(manualPosition.account_qty, 12)
            }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('controlledTradePage.ownership.owner')"
            >{{ ownerLabel(manualPosition.owner) }}</el-descriptions-item
          >
        </el-descriptions>
        <el-form label-position="top">
          <el-form-item :label="t('controlledTradePage.ownership.manualOwner')">
            <el-select v-model="manualForm.owner" style="width: 100%">
              <el-option
                v-for="item in manualOwnerOptions"
                :key="item"
                :label="ownerLabel(item)"
                :value="item"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('controlledTradePage.ownership.manualQty')">
            <el-input
              v-model="manualForm.quantity"
              type="text"
              inputmode="decimal"
              :placeholder="
                t('controlledTradePage.ownership.manualQtyPlaceholder')
              "
            />
          </el-form-item>
          <el-form-item
            :label="t('controlledTradePage.ownership.manualReason')"
          >
            <el-input
              v-model="manualForm.reason"
              type="textarea"
              :rows="3"
              maxlength="512"
              show-word-limit
              :placeholder="
                t('controlledTradePage.ownership.manualReasonPlaceholder')
              "
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button
          :disabled="manualSubmitting"
          @click="manualVisible = false"
          >{{ t("controlledTradePage.ownership.manualCancel") }}</el-button
        >
        <el-button
          type="primary"
          :loading="manualSubmitting"
          @click="submitManualClaim"
        >
          {{ t("controlledTradePage.ownership.manualConfirmButton") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<style scoped>
.controlled-trade-page {
  min-width: 0;
}
</style>
