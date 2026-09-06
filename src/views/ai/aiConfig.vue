<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getFeaturesOptions } from "../../api/trade";
import {
  editData,
  getAlertPipelineStatus,
  getServiceConfig,
  type AlertPipelineStatus
} from "../../api/service";

defineOptions({ name: "AgentAIConfig" });
const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const symbols = ref<string[]>([]);
const aiTradeAllowedSymbols = ref<string[]>([]);
const alertStatus = ref<AlertPipelineStatus | null>(null);
const alertStatusLoading = ref(false);
let alertStatusTimer: ReturnType<typeof setTimeout> | undefined;
const alertSeverityOptions = ["low", "medium", "high", "critical"];
const config = reactive<Record<string, any>>({
  AgentAlertPipelineEnable: 0,
  AgentAlertAnalysisEnable: 0,
  AgentAlertMinSeverity: "medium",
  AgentAlertCooldownSec: 900,
  AgentAlertMaxConcurrent: 2,
  AgentAlertMaxPerMinute: 6,
  AgentMarketRegimeScheduleEnable: 1,
  AgentMarketRegimeIntervalMin: 60,
  AgentDailyMarketBriefScheduleEnable: 0,
  AgentDailyMarketBriefIntervalMin: 1440,
  AgentMaxStartsPerMinute: 30,
  AgentMaxStartsPerHour: 300,
  AgentMaxTokensPerTask: 240000,
  AgentMaxToolCallsPerTask: 12,
  AgentTradeExecutionEnable: 0,
  AgentTradeAllowedSymbols: "",
  AgentTradeMaxRiskUSDT: 5,
  AgentTradeMaxNotionalUSDT: 50,
  AgentTradeMaxTotalExposureUSDT: 200,
  AgentTradeMaxLeverage: 3,
  AgentTradePriceFreshnessSec: 10,
  AgentTradeMaxSlippageBps: 30,
  AgentTradeCooldownSec: 900,
  AgentTradeProposalTTLMin: 15
});

function translateDynamic(prefix: string, value?: string) {
  if (!value) return "-";
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

async function fetchConfig(showLoading = false) {
  if (showLoading) loading.value = true;
  try {
    const res = await getServiceConfig();
    const data = res?.data || {};
    Object.assign(config, data);
    aiTradeAllowedSymbols.value = String(data.AgentTradeAllowedSymbols || "")
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean);
  } finally {
    if (showLoading) loading.value = false;
  }
}

async function fetchAlertStatus(showLoading = false) {
  if (showLoading) alertStatusLoading.value = true;
  try {
    const res = await getAlertPipelineStatus({ limit: 10 });
    if (res?.code === 200 && res?.data) alertStatus.value = res.data;
  } finally {
    if (showLoading) alertStatusLoading.value = false;
  }
}

function scheduleAlertStatusPoll() {
  if (alertStatusTimer !== undefined) clearTimeout(alertStatusTimer);
  alertStatusTimer = setTimeout(async () => {
    try {
      await fetchAlertStatus(false);
    } finally {
      scheduleAlertStatusPoll();
    }
  }, 5000);
}

async function saveField(field: string, value: any) {
  loading.value = true;
  try {
    await editData({ [field]: value });
    await fetchConfig(false);
    ElMessage.success(t("dashboard.message.updateSuccess"));
  } catch {
    ElMessage.error(t("dashboard.message.updateFail"));
  } finally {
    loading.value = false;
  }
}

async function onAITradeAllowlistChange() {
  await saveField(
    "agent_trade_allowed_symbols",
    aiTradeAllowedSymbols.value.join(",")
  );
}

async function onAITradeExecutionChange(value: number | string | boolean) {
  const enabled = Number(value) === 1;
  if (enabled) {
    if (aiTradeAllowedSymbols.value.length === 0) {
      ElMessage.error(t("dashboard.message.tradeAllowlistRequired"));
      return;
    }
    try {
      await ElMessageBox.confirm(
        t("dashboard.confirm.enableControlledTrade"),
        t("dashboard.confirm.controlledTradeTitle"),
        { type: "warning" }
      );
    } catch {
      return;
    }
  }
  await saveField("agent_trade_execution_enable", enabled ? 1 : 0);
}

async function fetchSymbols() {
  const res = await getFeaturesOptions();
  symbols.value = res?.data || [];
}

onMounted(async () => {
  await Promise.all([
    fetchConfig(true),
    fetchSymbols(),
    fetchAlertStatus(true)
  ]);
  scheduleAlertStatusPoll();
});

onBeforeUnmount(() => {
  if (alertStatusTimer !== undefined) clearTimeout(alertStatusTimer);
});
</script>

<template>
  <div class="ai-config-page p-4">
    <el-card shadow="never" class="mb-4">
      <div class="text-lg font-medium">{{ t("aiConfigPage.title") }}</div>
      <div class="mt-1 text-sm text-gray-500">
        {{ t("aiConfigPage.subtitle") }}
      </div>
    </el-card>
    <el-collapse
      v-loading="loading"
      :model-value="['ai_alert', 'ai_scheduler', 'ai_governance', 'ai_trade']"
    >
      <el-collapse-item name="ai_alert">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.aiAlert") }}</span>
            <el-tag
              :type="config.AgentAlertPipelineEnable === 1 ? 'success' : 'info'"
              size="small"
            >
              {{
                config.AgentAlertPipelineEnable === 1
                  ? t("dashboard.state.on")
                  : t("dashboard.state.off")
              }}
            </el-tag>
          </div>
        </template>
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertPipelineEnable")
            }}</span>
            <el-switch
              :model-value="config.AgentAlertPipelineEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('agent_alert_pipeline_enable', value)"
            />
            <span class="hint">{{ t("dashboard.hint.alertPipeline") }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertAIEnable")
            }}</span>
            <el-switch
              :model-value="config.AgentAlertAnalysisEnable"
              :active-value="1"
              :inactive-value="0"
              :disabled="config.AgentAlertPipelineEnable !== 1"
              @change="value => saveField('agent_alert_analysis_enable', value)"
            />
            <span class="hint">{{ t("dashboard.hint.alertAIFallback") }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertMinSeverity")
            }}</span>
            <el-select
              :model-value="config.AgentAlertMinSeverity"
              class="compact-select"
              @change="value => saveField('agent_alert_min_severity', value)"
            >
              <el-option
                v-for="item in alertSeverityOptions"
                :key="item"
                :label="t(`dashboard.alertSeverity.${item}`)"
                :value="item"
              />
            </el-select>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertCooldownSec")
            }}</span>
            <el-input
              v-model="config.AgentAlertCooldownSec"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_alert_cooldown_sec', Number(value))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertMaxConcurrent")
            }}</span>
            <el-input
              v-model="config.AgentAlertMaxConcurrent"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_alert_max_concurrent', Number(value))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.alertMaxPerMinute")
            }}</span>
            <el-input
              v-model="config.AgentAlertMaxPerMinute"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_alert_max_per_minute', Number(value))
              "
            />
          </div>

          <div v-loading="alertStatusLoading" class="alert-status-panel">
            <div class="alert-status-grid">
              <el-card shadow="never">
                <template #header>{{
                  t("dashboard.alertStatus.eventBus")
                }}</template>
                <div>
                  {{ t("dashboard.alertStatus.published") }}:
                  {{ alertStatus?.event_bus?.published ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.alertStatus.dropped") }}:
                  {{ alertStatus?.event_bus?.dropped ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.alertStatus.queue") }}:
                  {{ alertStatus?.event_bus?.queue_depth ?? 0 }}/{{
                    alertStatus?.event_bus?.queue_capacity ?? 0
                  }}
                </div>
              </el-card>
              <el-card shadow="never">
                <template #header>{{
                  t("dashboard.alertStatus.signalEngine")
                }}</template>
                <div>
                  {{ t("dashboard.alertStatus.events") }}:
                  {{ alertStatus?.signal_engine?.events ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.signalType.fast_move") }}:
                  {{ alertStatus?.signal_engine?.fast_move_signals ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.signalType.liquidation_spike") }}:
                  {{ alertStatus?.signal_engine?.liquidation_signals ?? 0 }}
                </div>
              </el-card>
              <el-card shadow="never">
                <template #header>{{
                  t("dashboard.alertStatus.pipeline")
                }}</template>
                <div>
                  {{ t("dashboard.alertStatus.received") }}:
                  {{ alertStatus?.pipeline?.signals_received ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.alertStatus.aiTasks") }}:
                  {{ alertStatus?.pipeline?.ai_tasks_started ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.alertStatus.fallbacks") }}:
                  {{ alertStatus?.pipeline?.ai_fallbacks ?? 0 }}
                </div>
                <div>
                  {{ t("dashboard.alertStatus.notifications") }}:
                  {{ alertStatus?.pipeline?.notifications ?? 0 }}
                </div>
              </el-card>
            </div>

            <div class="alert-trace-title flex items-center justify-between">
              <span>{{ t("dashboard.alertStatus.recentTrace") }}</span>
              <el-button
                size="small"
                text
                type="primary"
                @click="router.push('/ai/alert-pipeline-history')"
              >
                {{ t("dashboard.alertStatus.viewAll") }}
              </el-button>
            </div>
            <el-table
              :data="alertStatus?.traces || []"
              size="small"
              max-height="320"
            >
              <el-table-column
                prop="symbol"
                :label="t('dashboard.alertStatus.symbol')"
                width="110"
              />
              <el-table-column
                :label="t('dashboard.alertStatus.signal')"
                min-width="150"
              >
                <template #default="{ row }">
                  {{ translateDynamic("dashboard.signalType", row.type) }}
                </template>
              </el-table-column>
              <el-table-column
                :label="t('dashboard.alertStatus.severity')"
                width="90"
              >
                <template #default="{ row }">
                  {{
                    translateDynamic("dashboard.alertSeverity", row.severity)
                  }}
                </template>
              </el-table-column>
              <el-table-column
                :label="t('dashboard.alertStatus.status')"
                min-width="140"
              >
                <template #default="{ row }">
                  {{ translateDynamic("dashboard.traceStatus", row.status) }}
                </template>
              </el-table-column>
              <el-table-column
                prop="task_id"
                :label="t('dashboard.alertStatus.taskId')"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column
                prop="notification_id"
                :label="t('dashboard.alertStatus.notificationId')"
                width="110"
              />
              <el-table-column
                :label="t('dashboard.alertStatus.fallback')"
                width="90"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="row.fallback ? 'warning' : 'success'"
                    size="small"
                  >
                    {{
                      row.fallback
                        ? t("dashboard.state.yes")
                        : t("dashboard.state.no")
                    }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item name="ai_scheduler">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.aiScheduler") }}</span>
            <el-tag
              :type="
                config.AgentMarketRegimeScheduleEnable === 1
                  ? 'success'
                  : 'info'
              "
              size="small"
            >
              {{
                config.AgentMarketRegimeScheduleEnable === 1
                  ? t("dashboard.state.on")
                  : t("dashboard.state.off")
              }}
            </el-tag>
          </div>
        </template>
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.marketRegimeScheduleEnable")
            }}</span>
            <el-switch
              :model-value="config.AgentMarketRegimeScheduleEnable"
              :active-value="1"
              :inactive-value="0"
              @change="
                value => saveField('agent_market_regime_schedule_enable', value)
              "
            />
            <span class="hint">{{
              t("dashboard.hint.marketRegimeSchedule")
            }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.marketRegimeIntervalMin")
            }}</span>
            <el-input
              v-model="config.AgentMarketRegimeIntervalMin"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField('agent_market_regime_interval_min', Number(value))
              "
            />
            <span class="hint">{{ t("dashboard.unit.minute") }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.dailyMarketBriefScheduleEnable")
            }}</span>
            <el-switch
              :model-value="config.AgentDailyMarketBriefScheduleEnable"
              :active-value="1"
              :inactive-value="0"
              @change="
                value =>
                  saveField('agent_daily_market_brief_schedule_enable', value)
              "
            />
            <span class="hint">{{
              t("dashboard.hint.dailyMarketBriefSchedule")
            }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.dailyMarketBriefIntervalMin")
            }}</span>
            <el-input
              v-model="config.AgentDailyMarketBriefIntervalMin"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField(
                    'agent_daily_market_brief_interval_min',
                    Number(value)
                  )
              "
            />
            <span class="hint">{{ t("dashboard.unit.minute") }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.schedulerTaskCenter")
            }}</span>
            <el-button
              type="primary"
              size="small"
              @click="router.push({ name: 'AgentTaskCenter' })"
            >
              {{ t("dashboard.button.openTaskCenter") }}
            </el-button>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item name="ai_governance">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.aiGovernance") }}</span>
            <el-tag type="warning" size="small">
              {{ t("dashboard.hint.tradeDisabled") }}
            </el-tag>
          </div>
        </template>
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.skillManagement")
            }}</span>
            <el-button
              type="primary"
              size="small"
              @click="router.push({ name: 'AgentSkillManagement' })"
            >
              {{ t("dashboard.button.openSkillManagement") }}
            </el-button>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.agentStartsPerMinute")
            }}</span>
            <el-input
              v-model="config.AgentMaxStartsPerMinute"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_max_starts_per_minute', Number(value))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.agentStartsPerHour")
            }}</span>
            <el-input
              v-model="config.AgentMaxStartsPerHour"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_max_starts_per_hour', Number(value))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.agentMaxTokens")
            }}</span>
            <el-input
              v-model="config.AgentMaxTokensPerTask"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value => saveField('agent_max_tokens_per_task', Number(value))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.agentMaxToolCalls")
            }}</span>
            <el-input
              v-model="config.AgentMaxToolCallsPerTask"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField('agent_max_tool_calls_per_task', Number(value))
              "
            />
            <span class="hint">{{
              t("dashboard.hint.globalAgentBudget")
            }}</span>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item name="ai_trade">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.aiTrade") }}</span>
            <el-tag
              :type="config.AgentTradeExecutionEnable === 1 ? 'danger' : 'info'"
              size="small"
            >
              {{
                config.AgentTradeExecutionEnable === 1
                  ? t("dashboard.state.on")
                  : t("dashboard.state.off")
              }}
            </el-tag>
          </div>
        </template>
        <div class="dashboard-body">
          <el-alert
            :title="t('dashboard.hint.controlledTrade')"
            type="warning"
            show-icon
            :closable="false"
            class="mb-3"
          />
          <div class="field-row field-row-top">
            <span class="field-label">{{
              t("dashboard.field.aiTradeAllowedSymbols")
            }}</span>
            <el-select
              v-model="aiTradeAllowedSymbols"
              multiple
              filterable
              clearable
              class="wide-select"
              @change="onAITradeAllowlistChange"
            >
              <el-option
                v-for="symbol in symbols"
                :key="symbol"
                :label="symbol"
                :value="symbol"
              />
            </el-select>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeExecutionEnable")
            }}</span>
            <el-switch
              :model-value="config.AgentTradeExecutionEnable"
              :active-value="1"
              :inactive-value="0"
              @change="onAITradeExecutionChange"
            />
            <el-button
              type="primary"
              size="small"
              @click="router.push({ name: 'AgentControlledTrade' })"
              >{{ t("dashboard.button.openControlledTrade") }}</el-button
            >
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeMaxRisk")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeMaxRiskUSDT"
              :min="0.01"
              :step="1"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_max_risk_usdt', Number(value || 0))
              "
            />
            <span class="hint">USDT</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeMaxNotional")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeMaxNotionalUSDT"
              :min="0.01"
              :step="10"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_max_notional_usdt', Number(value || 0))
              "
            />
            <span class="hint">USDT</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeMaxExposure")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeMaxTotalExposureUSDT"
              :min="0.01"
              :step="10"
              controls-position="right"
              @change="
                value =>
                  saveField(
                    'agent_trade_max_total_exposure_usdt',
                    Number(value || 0)
                  )
              "
            />
            <span class="hint">USDT</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeMaxLeverage")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeMaxLeverage"
              :min="1"
              :max="125"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_max_leverage', Number(value || 1))
              "
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeFreshness")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradePriceFreshnessSec"
              :min="1"
              controls-position="right"
              @change="
                value =>
                  saveField(
                    'agent_trade_price_freshness_sec',
                    Number(value || 1)
                  )
              "
            />
            <span class="hint">s</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeSlippage")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeMaxSlippageBps"
              :min="1"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_max_slippage_bps', Number(value || 1))
              "
            />
            <span class="hint">bps</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeCooldown")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeCooldownSec"
              :min="0"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_cooldown_sec', Number(value || 0))
              "
            />
            <span class="hint">s</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.aiTradeProposalTTL")
            }}</span>
            <el-input-number
              :model-value="config.AgentTradeProposalTTLMin"
              :min="1"
              controls-position="right"
              @change="
                value =>
                  saveField('agent_trade_proposal_ttl_min', Number(value || 1))
              "
            />
            <span class="hint">{{ t("dashboard.unit.minute") }}</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.ai-config-page {
  background-color: #fff;
}

.dashboard-body {
  padding-left: 18px;
}

.dashboard-text {
  font-size: 14px;
  line-height: 20px;
}

.field-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.field-row-top {
  align-items: flex-start;
}

.field-label {
  flex-shrink: 0;
  width: 170px;
  color: var(--el-text-color-regular);
}

.compact-input {
  width: 110px;
}

.compact-select {
  width: 120px;
}

.wide-select {
  width: min(900px, calc(100% - 152px));
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.alert-status-panel {
  margin-top: 20px;
}

.alert-status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.alert-status-grid :deep(.el-card__body) {
  font-size: 12px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.alert-trace-title {
  margin-bottom: 8px;
  font-weight: 600;
}

@media (width <= 900px) {
  .alert-status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
