<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import {
  leadStatus,
  leadConfig,
  leadMetrics,
  leadPositions,
  leadOrders,
  leadSaveCredentials,
  leadVerify,
  leadSaveConfig,
  leadPause,
  type LeadStatus,
  type LeadVerification,
  type LeadSettings,
  type LeadManagedOrder,
  type LeadManagedPosition
} from "@/api/leadTrading";

defineOptions({ name: "FuturesLead" });
const leadApiGuideUrl =
  "https://www.binance.com/en/support/faq/detail/2bec848b904b422197ce121d0925f20b";
const { t } = useI18n();
const tr = (key: string) => t(`leadTradingPage.${key}`);
const busy = ref(false);
const status = ref<LeadStatus | null>(null);
const configured = ref(false);
const dirtyRisk = ref(false);
const settings = reactive<LeadSettings>({
  account_id: "lead",
  allow_new_opens: false,
  limits: {
    max_order_notional_usdt: 0,
    max_total_notional_usdt: 0,
    max_daily_realized_loss_usdt: 0
  }
});
const secretForm = reactive({
  api_key: "",
  api_secret: "",
  portfolio_label: ""
});
const positions = ref<LeadManagedPosition[]>([]);
const orders = ref<LeadManagedOrder[]>([]);
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
    leadOrders({ limit: 100 })
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
        allow_new_opens: Boolean(incoming.allow_new_opens),
        limits: { ...settings.limits, ...incoming.limits }
      });
    }
  }
  if (values[2]) metrics.value = values[2]?.metrics || {};
  if (values[3]) positions.value = values[3]?.positions || [];
  if (values[4]) orders.value = values[4]?.orders || [];
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
  const { max_order_notional_usdt: order, max_total_notional_usdt: total } =
    settings.limits;
  if (!(order > 0 && total > 0 && order <= total)) {
    ElMessage.warning(tr("invalidLimits"));
    return;
  }
  withAction(async () => {
    await leadSaveConfig({ ...settings, limits: { ...settings.limits } });
    dirtyRisk.value = false;
  });
}
async function toggleOpens(enabled: boolean) {
  if (enabled) {
    const { max_order_notional_usdt: order, max_total_notional_usdt: total } =
      settings.limits;
    if (!(order > 0 && total > 0 && order <= total)) {
      ElMessage.warning(tr("invalidLimits"));
      settings.allow_new_opens = false;
      return;
    }
    try {
      await ElMessageBox.confirm(tr("enableConfirm"), tr("trading"), {
        confirmButtonText: tr("enableConfirmButton"),
        type: "warning"
      });
    } catch {
      settings.allow_new_opens = false;
      return;
    }
  }
  // The switch is the ONLY ordinary enable/disable action. Emergency Pause
  // remains a separate last-resort latch, not the regular OFF control.
  const value = enabled;
  await withAction(async () => {
    await leadSaveConfig({
      ...settings,
      allow_new_opens: value,
      limits: { ...settings.limits }
    });
    dirtyRisk.value = false;
  });
  // On an API failure, always restore the actual saved state.
  const saved = await leadConfig().catch(() => undefined);
  if (saved?.data?.settings) {
    settings.allow_new_opens = Boolean(saved.data.settings.allow_new_opens);
  }
}
async function pause() {
  // This Stage 6/Lead-01 pause is one-way for the current process.
  // A confirmation avoids an accidental irreversible click.
  try {
    await ElMessageBox.confirm(tr("pauseConfirm"), tr("pause"), {
      type: "warning"
    });
  } catch {
    return;
  }
  await withAction(() => leadPause());
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
      type="info"
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
          <template #header>
            <span class="lead-label-help">
              {{ tr("credentials") }}
              <el-popover placement="bottom-start" trigger="hover" :width="380">
                <template #reference>
                  <el-icon
                    class="lead-help-icon"
                    tabindex="0"
                    :aria-label="tr('leadKeyGuideTitle')"
                  >
                    <QuestionFilled />
                  </el-icon>
                </template>
                <div class="lead-key-guide">
                  <strong>{{ tr("leadKeyGuideTitle") }}</strong>
                  <p>{{ tr("leadKeyGuideIntro") }}</p>
                  <ol>
                    <li>{{ tr("leadKeyGuideStep1") }}</li>
                    <li>{{ tr("leadKeyGuideStep2") }}</li>
                    <li>{{ tr("leadKeyGuideStep3") }}</li>
                    <li>{{ tr("leadKeyGuideStep4") }}</li>
                  </ol>
                  <p>{{ tr("leadKeyGuideSecurity") }}</p>
                  <a
                    :href="leadApiGuideUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ tr("leadKeyGuideOfficial") }}</a
                  >
                </div>
              </el-popover>
            </span>
          </template>
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
              <el-input
                v-model="secretForm.portfolio_label"
                maxlength="128"
                :placeholder="tr('portfolioPlaceholder')"
              />
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
            <el-form-item>
              <template #label>
                <span class="lead-label-help">
                  {{ tr("maxOrder") }}
                  <el-tooltip
                    :content="tr('maxOrderHelp')"
                    placement="top"
                    :show-after="150"
                    :popper-style="{
                      maxWidth: '340px',
                      whiteSpace: 'normal',
                      lineHeight: '1.5'
                    }"
                  >
                    <el-icon
                      class="lead-help-icon"
                      tabindex="0"
                      :aria-label="tr('maxOrderHelp')"
                    >
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input-number
                v-model="settings.limits.max_order_notional_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
              />
            </el-form-item>
            <el-form-item>
              <template #label>
                <span class="lead-label-help">
                  {{ tr("maxTotal") }}
                  <el-tooltip
                    :content="tr('maxTotalHelp')"
                    placement="top"
                    :show-after="150"
                    :popper-style="{
                      maxWidth: '340px',
                      whiteSpace: 'normal',
                      lineHeight: '1.5'
                    }"
                  >
                    <el-icon
                      class="lead-help-icon"
                      tabindex="0"
                      :aria-label="tr('maxTotalHelp')"
                    >
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input-number
                v-model="settings.limits.max_total_notional_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
              />
            </el-form-item>
            <el-form-item>
              <template #label>
                <span class="lead-label-help">
                  {{ tr("dailyLoss") }}
                  <el-tooltip
                    :content="tr('dailyLossHelpTooltip')"
                    placement="top"
                    :show-after="150"
                    :popper-style="{
                      maxWidth: '340px',
                      whiteSpace: 'normal',
                      lineHeight: '1.5'
                    }"
                  >
                    <el-icon
                      class="lead-help-icon"
                      tabindex="0"
                      :aria-label="tr('dailyLossHelpTooltip')"
                    >
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input-number
                v-model="settings.limits.max_daily_realized_loss_usdt"
                :min="0"
                :precision="2"
                controls-position="right"
                @change="dirtyRisk = true"
              />
            </el-form-item>
          </el-form>
          <p class="lead-note">{{ tr("dailyLossHelp") }}</p>
          <el-button type="primary" :loading="busy" @click="saveLimits">{{
            tr("saveLimits")
          }}</el-button>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="lead-card" shadow="never">
          <template #header>{{ tr("trading") }}</template>
          <el-alert
            :type="settings.allow_new_opens ? 'warning' : 'info'"
            :closable="false"
            :title="
              tr(
                settings.allow_new_opens ? 'enabledWarning' : 'disabledWarning'
              )
            "
            class="mb-3"
          />
          <p>{{ tr("inherited") }}</p>
          <el-space wrap>
            <span>{{ tr("allowNewOpens") }}</span>
            <el-switch
              v-model="settings.allow_new_opens"
              :loading="busy"
              :disabled="busy"
              @change="toggleOpens"
            />
            <el-button :loading="busy" @click="pause">{{
              tr("pause")
            }}</el-button>
          </el-space>
          <p class="lead-note">{{ tr("stagedOnly") }}</p>
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

.lead-label-help {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.lead-help-icon {
  color: var(--el-color-primary);
  cursor: help;
  outline-offset: 2px;
}

.lead-key-guide p {
  margin: 8px 0;
  line-height: 1.55;
}

.lead-key-guide ol {
  padding-left: 20px;
  margin: 8px 0;
}

.lead-key-guide li {
  margin: 4px 0;
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
