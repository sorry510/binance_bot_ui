<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  leadStatus,
  leadConfig,
  leadMetrics,
  leadPositions,
  leadOrders,
  leadEvents,
  leadSaveCredentials,
  leadVerify,
  leadSaveConfig,
  leadPause,
  type LeadStatus,
  type LeadVerification,
  type LeadSettings,
  type LeadManagedOrder,
  type LeadManagedPosition,
  type LeadAuditEvent
} from "@/api/leadTrading";

defineOptions({ name: "FuturesLead" });
const { t } = useI18n();
const tr = (key: string) => t(`leadTradingPage.${key}`);
const busy = ref(false);
const status = ref<LeadStatus | null>(null);
const configured = ref(false);
const dirtyRisk = ref(false);
const settings = reactive<LeadSettings>({
  account_id: "lead",
  enabled: false,
  allow_new_opens: false,
  limits: {
    max_order_notional_usdt: 0,
    max_total_notional_usdt: 0,
    max_daily_realized_loss_usdt: 0,
    max_drawdown_pct: 0,
    max_positions: 0,
    max_losing_positions: 0
  }
});
const secretForm = reactive({
  api_key: "",
  api_secret: "",
  portfolio_label: ""
});
const positions = ref<LeadManagedPosition[]>([]);
const orders = ref<LeadManagedOrder[]>([]);
const events = ref<LeadAuditEvent[]>([]);
const metrics = ref<Record<string, any>>({});
const statusErrors = ref<string[]>([]);
let refreshTimer: ReturnType<typeof setInterval> | undefined;

function fail(error: unknown) {
  const err = error as {
    response?: { data?: { msg?: string } };
    message?: string;
  };
  ElMessage.error(err?.response?.data?.msg || err?.message || tr("failed"));
}
function asNumber(value: unknown) {
  if (value === null || value === undefined) return "-";
  return Number.isFinite(Number(value)) ? Number(value) : "-";
}
function timestamp(value: string | number | undefined) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}
const blocking = computed(() => status.value?.blocking_reasons || []);
const currentVerification = computed<LeadVerification>(
  () => status.value?.verification || { account_id: "lead" }
);
const readonlyBanner = computed(() => !status.value?.runtime_connected);
async function refresh() {
  const results = await Promise.allSettled([
    leadStatus(),
    leadConfig(),
    leadMetrics(),
    leadPositions({ limit: 100 }),
    leadOrders({ limit: 100 }),
    leadEvents({ limit: 50 })
  ]);
  const values = results.map(result =>
    result.status === "fulfilled" ? result.value?.data : undefined
  );
  if (values[0]) {
    status.value = values[0] as LeadStatus;
    statusErrors.value = [];
  } else {
    statusErrors.value = ["status_unavailable"];
  }
  if (values[1]) {
    configured.value = Boolean(values[1].configured);
    const incoming = values[1].settings as LeadSettings | undefined;
    if (incoming && !dirtyRisk.value) {
      Object.assign(settings, {
        account_id: "lead",
        enabled: false,
        allow_new_opens: false,
        limits: { ...settings.limits, ...incoming.limits }
      });
    }
  }
  if (values[2]) metrics.value = values[2]?.metrics || {};
  if (values[3]) positions.value = values[3]?.positions || [];
  if (values[4]) orders.value = values[4]?.orders || [];
  if (values[5]) events.value = values[5]?.events || [];
}
async function withAction(action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await action();
    ElMessage.success(tr("saveSuccess"));
    await refresh();
  } catch (error) {
    fail(error);
  } finally {
    busy.value = false;
  }
}
async function saveKey() {
  if (!secretForm.api_key.trim() || !secretForm.api_secret.trim()) {
    ElMessage.warning(tr("key") + " / " + tr("secret"));
    return;
  }
  try {
    await ElMessageBox.confirm(tr("offline"), tr("credentials"), {
      type: "warning"
    });
  } catch {
    return;
  }
  await withAction(async () => {
    await leadSaveCredentials({ ...secretForm });
    secretForm.api_key = "";
    secretForm.api_secret = "";
  });
}
function verify() {
  withAction(() => leadVerify());
}
function saveLimits() {
  settings.enabled = false;
  settings.allow_new_opens = false;
  withAction(async () => {
    await leadSaveConfig({ ...settings, limits: { ...settings.limits } });
    dirtyRisk.value = false;
  });
}
function pause() {
  withAction(() => leadPause());
}
onMounted(() => {
  refresh().catch(fail);
  refreshTimer = setInterval(() => refresh().catch(() => undefined), 15000);
});
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  secretForm.api_key = "";
  secretForm.api_secret = "";
});
</script>

<template>
  <div class="lead-page p-4">
    <div class="lead-heading">
      <h2>{{ tr("title") }}</h2>
      <el-button size="small" :loading="busy" @click="refresh">{{
        tr("refresh")
      }}</el-button>
    </div>
    <el-alert
      :title="tr('offline')"
      type="warning"
      :closable="false"
      show-icon
      class="mb-4"
    />
    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("status") }}</template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item :label="tr('ready')">{{
              status?.readiness || tr("disabled")
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('ws')">
              <el-tag :type="status?.ws_healthy ? 'success' : 'warning'">{{
                status?.ws_healthy ? "ONLINE" : "OFFLINE"
              }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="tr('keyHint')">{{
              currentVerification?.key_hint || "-"
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('portfolio')">{{
              currentVerification?.portfolio_label || "-"
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('lastChecked')">{{
              timestamp(currentVerification?.checked_at)
            }}</el-descriptions-item>
          </el-descriptions>
          <div class="lead-reasons">
            <el-tag
              v-for="reason in [...blocking, ...statusErrors]"
              :key="reason"
              size="small"
              type="warning"
              class="mr-2 mb-2"
              >{{ reason }}</el-tag
            >
          </div>
          <el-text type="info" size="small">{{ tr("offlineGate") }}</el-text>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("credentials") }}</template>
          <el-form label-position="top" size="small" autocomplete="off">
            <el-form-item :label="tr('key')">
              <el-input
                v-model="secretForm.api_key"
                maxlength="512"
                autocomplete="off"
              />
            </el-form-item>
            <el-form-item :label="tr('secret')">
              <el-input
                v-model="secretForm.api_secret"
                type="password"
                show-password
                maxlength="512"
                autocomplete="new-password"
              />
            </el-form-item>
            <el-form-item :label="tr('portfolio')">
              <el-input v-model="secretForm.portfolio_label" maxlength="128" />
            </el-form-item>
          </el-form>
          <el-space wrap>
            <el-button type="primary" :loading="busy" @click="saveKey">{{
              tr("saveCredentials")
            }}</el-button>
            <el-button :loading="busy" @click="verify">{{
              tr("verify")
            }}</el-button>
          </el-space>
          <p class="lead-note">{{ tr("notAuthorized") }}</p>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("risk") }}</template>
          <el-alert
            v-if="!configured"
            type="info"
            :closable="false"
            :title="tr('unconfigured')"
            class="mb-3"
          />
          <el-form label-position="top" size="small" class="lead-risk-form">
            <el-form-item :label="tr('maxOrder')"
              ><el-input-number
                v-model="settings.limits.max_order_notional_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
            <el-form-item :label="tr('maxTotal')"
              ><el-input-number
                v-model="settings.limits.max_total_notional_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
            <el-form-item :label="tr('dailyLoss')"
              ><el-input-number
                v-model="settings.limits.max_daily_realized_loss_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
            <el-form-item :label="tr('drawdown')"
              ><el-input-number
                v-model="settings.limits.max_drawdown_pct"
                :min="0"
                :max="100"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
            <el-form-item :label="tr('maxPositions')"
              ><el-input-number
                v-model="settings.limits.max_positions"
                :min="0"
                :max="1000"
                :precision="0"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
            <el-form-item :label="tr('maxLosing')"
              ><el-input-number
                v-model="settings.limits.max_losing_positions"
                :min="0"
                :max="1000"
                :precision="0"
                controls-position="right"
                @change="dirtyRisk = true"
            /></el-form-item>
          </el-form>
          <el-button type="primary" :loading="busy" @click="saveLimits">{{
            tr("saveLimits")
          }}</el-button>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("trading") }}</template>
          <el-alert
            type="warning"
            :closable="false"
            :title="tr('startBlocked')"
            class="mb-3"
          />
          <p>{{ tr("inherited") }}</p>
          <el-space wrap>
            <el-button :loading="busy" @click="pause">{{
              tr("pause")
            }}</el-button>
            <el-button disabled>{{ tr("startLocked") }}</el-button>
          </el-space>
          <div class="lead-divider" />
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item :label="tr('api')">{{
              asNumber(metrics.requests)
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('weight')">{{
              asNumber(metrics.estimated_weight)
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('wsUpdates')">{{
              asNumber(metrics.ws_updates)
            }}</el-descriptions-item>
            <el-descriptions-item :label="tr('dropped')">{{
              metrics.alert_queue_present === true
                ? asNumber(metrics.alerts_dropped)
                : "-"
            }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="24">
        <el-card class="lead-card" shadow="never">
          <template #header
            >{{ tr("positions") }}
            <el-text type="info" size="small"
              >— {{ tr("historical") }}</el-text
            ></template
          >
          <el-alert
            type="info"
            :title="tr('unknownLive')"
            :closable="false"
            class="mb-3"
          />
          <el-table
            :data="positions"
            border
            size="small"
            max-height="290"
            :empty-text="tr('noData')"
          >
            <el-table-column
              prop="symbol"
              :label="tr('symbol')"
              min-width="140"
            />
            <el-table-column
              prop="position_side"
              :label="tr('side')"
              min-width="90"
            />
            <el-table-column
              prop="owner"
              :label="tr('owner')"
              min-width="140"
            />
            <el-table-column
              prop="managed_qty"
              :label="tr('qty')"
              min-width="130"
            />
            <el-table-column
              prop="entry_price"
              :label="tr('entry')"
              min-width="135"
            />
            <el-table-column
              prop="status"
              :label="tr('ready')"
              min-width="135"
            />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="24">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("diagnostics") }}</template>
          <el-tabs>
            <el-tab-pane :label="tr('order')">
              <el-table
                :data="orders"
                border
                size="small"
                max-height="320"
                :empty-text="tr('noData')"
              >
                <el-table-column
                  prop="client_order_id"
                  :label="tr('order')"
                  min-width="220"
                />
                <el-table-column
                  prop="symbol"
                  :label="tr('symbol')"
                  min-width="120"
                />
                <el-table-column
                  prop="position_side"
                  :label="tr('side')"
                  min-width="90"
                />
                <el-table-column
                  prop="intent"
                  :label="tr('intent')"
                  min-width="105"
                />
                <el-table-column
                  prop="status"
                  :label="tr('ready')"
                  min-width="125"
                />
                <el-table-column
                  prop="filled_qty"
                  :label="tr('fill')"
                  min-width="110"
                />
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="tr('audit')">
              <el-table
                :data="events"
                border
                size="small"
                max-height="320"
                :empty-text="tr('noData')"
              >
                <el-table-column
                  prop="action"
                  :label="tr('event')"
                  min-width="170"
                />
                <el-table-column
                  prop="reason"
                  :label="tr('reason')"
                  min-width="220"
                />
                <el-table-column :label="tr('at')" min-width="180">
                  <template #default="{ row }">{{
                    timestamp(row.occurred_at)
                  }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.lead-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.lead-heading h2 {
  font-size: 20px;
  font-weight: 600;
}

.lead-card {
  margin-bottom: 16px;
}

.lead-risk-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.lead-risk-form :deep(.el-input-number) {
  width: 100%;
}

.lead-reasons {
  margin-top: 12px;
}

.lead-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.lead-divider {
  margin: 20px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (width <= 650px) {
  .lead-risk-form {
    grid-template-columns: 1fr;
  }
}
</style>
