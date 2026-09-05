<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getFeaturesOptions } from "../../api/trade";
import {
  editData,
  getAlertPipelineStatus,
  getMarketConditionUpdateTask,
  getServiceConfig,
  testPusher,
  updateMarketCondition,
  type AlertPipelineStatus,
  type MarketConditionUpdateTask
} from "../../api/service";

defineOptions({
  name: "Dashboard"
});

const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const symbols = ref<string[]>([]);
const excludeSymbols = ref<string[]>([]);
const marketAnalysis = ref<{
  source: string;
  confidence: number;
  reason: string;
} | null>(null);
const marketUpdateTask = ref<MarketConditionUpdateTask | null>(null);
let marketProgressTimer: ReturnType<typeof setTimeout> | undefined;
let marketProgressPollFailures = 0;
const alertStatus = ref<AlertPipelineStatus | null>(null);
const alertStatusLoading = ref(false);
let alertStatusTimer: ReturnType<typeof setTimeout> | undefined;
const config = reactive<Record<string, any>>({
  tradeFutureEnable: 0,
  wsFuturesEnable: 0,
  WsFuturesFastMoveEnable: 0,
  WsFuturesFastMoveThreshold: 0,
  WsFuturesFastMoveRecover: 0,
  WsFuturesFastMoveCooldownSec: 0,
  WsFuturesFastMoveWindows: "",
  WsFuturesLiquidationEnable: 0,
  WsFuturesLiquidationAlertWindowSec: 60,
  WsFuturesLiquidationAlertNotionalThreshold: 5000000,
  WsFuturesLiquidationAlertCooldownSec: 300,
  AgentAlertPipelineEnable: 0,
  AgentAlertAnalysisEnable: 0,
  AgentAlertMinSeverity: "medium",
  AgentAlertCooldownSec: 900,
  AgentAlertMaxConcurrent: 2,
  AgentAlertMaxPerMinute: 6,
  AgentMarketRegimeScheduleEnable: 1,
  AgentMarketRegimeIntervalMin: 60,
  AgentMaxStartsPerMinute: 30,
  AgentMaxStartsPerHour: 300,
  AgentMaxTokensPerTask: 240000,
  AgentMaxToolCallsPerTask: 12,
  futuresPositionConvertEnable: 0,
  coinAllowLong: 1,
  coinAllowShort: 0,
  tradeStrategyTrade: "",
  tradeStrategyCoin: "",
  coinMaxCount: 0,
  lossMaxCount: 0,
  lossAutoScale: 0,
  marketCondition: 0,
  marketConditionIsAuto: 0,
  coinOrderType: "",
  tradeFutureTest: 0,
  FutureTestAutoTradeCountLimit: 0,
  FutureTestFeeRate: 0.0005,
  noticeCoinEnable: 0,
  listenCoinEnable: 0,
  listenFundingRate: 0,
  spotNewEnable: 0,
  tradeNewEnable: 0,
  debug: "0",
  externalLinks: []
});

const strategyTradeOptions = [
  "line1",
  "line2",
  "line3",
  "line4",
  "line5",
  "line6",
  "line7"
];
const strategyCoinOptions = [
  "coin1",
  "coin2",
  "coin3",
  "coin4",
  "coin5",
  "coin6"
];
const marketOptions = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 7 },
  { value: 8 },
  { value: 9 },
  { value: 10 },
  { value: 11 }
];
const alertSeverityOptions = ["low", "medium", "high", "critical"];
function translateDynamic(prefix: string, value?: string) {
  if (!value) return "-";
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
const currentMarketConditionLabel = computed(() => {
  const value = Number(config.marketCondition);
  if (!marketOptions.some(item => item.value === value)) return String(value);
  return `${value} - ${t(`dashboard.market.${value}`)}`;
});
const marketUpdateRunning = computed(() =>
  ["queued", "running"].includes(marketUpdateTask.value?.status || "")
);
const marketProgressLabel = computed(() => {
  const stage = marketUpdateTask.value?.stage;
  return stage ? t(`dashboard.marketProgress.${stage}`) : "";
});

async function fetchConfig() {
  loading.value = true;
  try {
    const res = await getServiceConfig();
    const data = res?.data || {};
    Object.assign(config, data);
    excludeSymbols.value = String(data.coinExcludeSymbols || "")
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean);
    try {
      config.externalLinks = JSON.parse(data.externalLinks || "[]");
    } catch {
      config.externalLinks = [];
    }
  } finally {
    loading.value = false;
  }
}

async function fetchAlertStatus() {
  alertStatusLoading.value = true;
  try {
    const res = await getAlertPipelineStatus({ limit: 10 });
    if (res?.code === 200 && res?.data) {
      alertStatus.value = res.data as AlertPipelineStatus;
    }
  } finally {
    alertStatusLoading.value = false;
  }
}

function scheduleAlertStatusPoll() {
  if (alertStatusTimer !== undefined) clearTimeout(alertStatusTimer);
  alertStatusTimer = setTimeout(async () => {
    try {
      await fetchAlertStatus();
    } finally {
      scheduleAlertStatusPoll();
    }
  }, 5000);
}

async function saveField(field: string, value: any) {
  loading.value = true;
  try {
    await editData({ [field]: value });
    await fetchConfig();
    ElMessage.success(t("dashboard.message.updateSuccess"));
  } catch {
    ElMessage.error(t("dashboard.message.updateFail"));
  } finally {
    loading.value = false;
  }
}

async function onExcludeChange() {
  await saveField("future_exclude_symbols", excludeSymbols.value.join(","));
}

async function onTestPusher() {
  try {
    await testPusher();
    ElMessage.success(t("dashboard.message.sendSuccess"));
  } catch {
    ElMessage.error(t("dashboard.message.sendFail"));
  }
}

async function onUpdateMarketCondition() {
  if (marketUpdateRunning.value) return;
  clearMarketProgressTimer();
  try {
    const res = await updateMarketCondition();
    if (res?.code !== 200 || !res?.data?.taskId) {
      throw new Error("market condition task was not created");
    }
    marketUpdateTask.value = res.data as MarketConditionUpdateTask;
    marketProgressPollFailures = 0;
    scheduleMarketConditionProgressPoll(0);
  } catch {
    ElMessage.error(t("dashboard.message.updateFail"));
  }
}

function scheduleMarketConditionProgressPoll(delay: number) {
  clearMarketProgressTimer();
  marketProgressTimer = setTimeout(() => {
    void pollMarketConditionProgress();
  }, delay);
}

async function pollMarketConditionProgress() {
  const taskId = marketUpdateTask.value?.taskId;
  if (!taskId) return;
  try {
    const res = await getMarketConditionUpdateTask(taskId);
    if (res?.code !== 200 || !res?.data) {
      throw new Error("market condition task was not found");
    }
    const task = res.data as MarketConditionUpdateTask;
    marketUpdateTask.value = task;
    marketProgressPollFailures = 0;
    if (task.status === "succeeded") {
      await handleMarketConditionUpdateSuccess(task);
      return;
    }
    if (task.status === "failed") {
      ElMessage.error(task.error || t("dashboard.message.updateFail"));
      return;
    }
    scheduleMarketConditionProgressPoll(1000);
  } catch {
    marketProgressPollFailures++;
    if (marketProgressPollFailures < 3) {
      scheduleMarketConditionProgressPoll(1500);
      return;
    }
    if (marketUpdateTask.value) {
      marketUpdateTask.value = {
        ...marketUpdateTask.value,
        status: "failed",
        stage: "failed",
        progress: 100,
        error: t("dashboard.message.progressQueryFail")
      };
    }
    ElMessage.error(t("dashboard.message.progressQueryFail"));
  }
}

async function handleMarketConditionUpdateSuccess(
  task: MarketConditionUpdateTask
) {
  const result = task.result;
  if (result) {
    config.marketCondition = result.marketCondition;
  }
  try {
    await fetchConfig();
  } catch {
    // The completed task result remains authoritative when config refresh fails.
  }
  if (result) {
    marketAnalysis.value = {
      source: result.source || "algorithm",
      confidence: Number(result.confidence || 0),
      reason: result.reason || ""
    };
  }
  const conditionName = result
    ? `${result.marketCondition} - ${result.name}`
    : currentMarketConditionLabel.value;
  const detail = result?.reason ? `，${result.reason}` : "";
  ElMessage.success(
    `${t("dashboard.message.marketAnalysisSuccess")}: ${conditionName}${detail}`
  );
}

function clearMarketProgressTimer() {
  if (marketProgressTimer !== undefined) {
    clearTimeout(marketProgressTimer);
    marketProgressTimer = undefined;
  }
}

async function fetchSymbols() {
  const res = await getFeaturesOptions();
  symbols.value = res?.data || [];
}

function gotoTestStrategyResult() {
  router.push({ name: "testStrategyResult" });
}

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchSymbols(), fetchAlertStatus()]);
  scheduleAlertStatusPoll();
});

onBeforeUnmount(() => {
  clearMarketProgressTimer();
  if (alertStatusTimer !== undefined) {
    clearTimeout(alertStatusTimer);
    alertStatusTimer = undefined;
  }
});
</script>

<template>
  <div class="dashboard-container p-4">
    <el-collapse
      v-loading="loading"
      :model-value="[
        'futures',
        'ai_alert',
        'ai_scheduler',
        'ai_governance',
        'new_coin_rush',
        'coin_notice',
        'market_listen',
        'funding_rate',
        'debug',
        'external'
      ]"
    >
      <el-collapse-item name="futures" :title="t('dashboard.section.futures')">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.futures") }}</span>
            <el-switch
              :model-value="config.tradeFutureEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('future_enable', value)"
            />
          </div>
        </template>

        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.websocket")
            }}</span>
            <el-switch
              :model-value="config.wsFuturesEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('ws_futures_enable', value)"
            />
            <span class="hint green">{{
              t("dashboard.hint.autoUpdatePrice")
            }}</span>
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.fastMoveEnable")
            }}</span>
            <el-switch
              :model-value="config.WsFuturesFastMoveEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('ws_futures_fast_move_enable', value)"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.fastMoveThreshold")
            }}</span>
            <el-input
              v-model="config.WsFuturesFastMoveThreshold"
              type="number"
              class="compact-input"
              @change="
                value =>
                  saveField('ws_futures_fast_move_threshold', Number(value))
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.fastMoveRecover")
            }}</span>
            <el-input
              v-model="config.WsFuturesFastMoveRecover"
              type="number"
              class="compact-input"
              @change="
                value =>
                  saveField('ws_futures_fast_move_recover', Number(value))
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.fastMoveCooldownSec")
            }}</span>
            <el-input
              v-model="config.WsFuturesFastMoveCooldownSec"
              type="number"
              class="compact-input"
              @change="
                value =>
                  saveField('ws_futures_fast_move_cooldown_sec', Number(value))
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.fastMoveWindows")
            }}</span>
            <el-input
              v-model="config.WsFuturesFastMoveWindows"
              class="wide-select"
              @change="
                value => saveField('ws_futures_fast_move_windows', value)
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.liquidationCollectionEnable")
            }}</span>
            <el-switch
              :model-value="config.WsFuturesLiquidationEnable"
              :active-value="1"
              :inactive-value="0"
              @change="
                value => saveField('ws_futures_liquidation_enable', value)
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.liquidationAlertWindowSec")
            }}</span>
            <el-input
              v-model="config.WsFuturesLiquidationAlertWindowSec"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField(
                    'ws_futures_liquidation_alert_window_sec',
                    Number(value)
                  )
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.liquidationAlertNotionalThreshold")
            }}</span>
            <el-input
              v-model="config.WsFuturesLiquidationAlertNotionalThreshold"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField(
                    'ws_futures_liquidation_alert_notional_threshold',
                    Number(value)
                  )
              "
            />
            <span class="hint green">USDT</span>
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.liquidationAlertCooldownSec")
            }}</span>
            <el-input
              v-model="config.WsFuturesLiquidationAlertCooldownSec"
              type="number"
              min="1"
              class="compact-input"
              @change="
                value =>
                  saveField(
                    'ws_futures_liquidation_alert_cooldown_sec',
                    Number(value)
                  )
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.positionConvert")
            }}</span>
            <el-switch
              :model-value="config.futuresPositionConvertEnable"
              :active-value="1"
              :inactive-value="0"
              @change="
                value => saveField('futures_position_convert_enable', value)
              "
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.allowLong")
            }}</span>
            <el-switch
              :model-value="config.coinAllowLong"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('future_allow_long', value)"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.allowShort")
            }}</span>
            <el-switch
              :model-value="config.coinAllowShort"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('future_allow_short', value)"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.strategyTrade")
            }}</span>
            <el-select
              :model-value="config.tradeStrategyTrade"
              class="compact-select"
              @change="value => saveField('future_strategy_trade', value)"
            >
              <el-option
                v-for="item in strategyTradeOptions"
                :key="item"
                :label="t(`dashboard.strategyTrade.${item}`)"
                :value="item"
              />
            </el-select>
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.strategyCoin")
            }}</span>
            <el-select
              :model-value="config.tradeStrategyCoin"
              class="compact-select"
              @change="value => saveField('future_strategy_coin', value)"
            >
              <el-option
                v-for="item in strategyCoinOptions"
                :key="item"
                :label="t(`dashboard.strategyCoin.${item}`)"
                :value="item"
              />
            </el-select>
          </div>

          <div class="field-row">
            <span class="field-label">{{ t("dashboard.field.maxCount") }}</span>
            <el-input
              v-model="config.coinMaxCount"
              type="number"
              class="compact-input"
              @change="value => saveField('future_max_count', Number(value))"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.lossMaxCount")
            }}</span>
            <el-input
              v-model="config.lossMaxCount"
              type="number"
              class="compact-input"
              @change="value => saveField('loss_max_count', Number(value))"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.lossAutoScale")
            }}</span>
            <el-switch
              :model-value="config.lossAutoScale"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('loss_auto_scale', value)"
            />
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.marketCondition")
            }}</span>
            <el-select
              :model-value="config.marketCondition"
              class="compact-select market-select"
              @change="value => saveField('market_condition', Number(value))"
            >
              <el-option
                v-for="item in marketOptions"
                :key="item.value"
                :label="t(`dashboard.market.${item.value}`)"
                :value="item.value"
              />
            </el-select>
            <el-tag type="primary" effect="plain">
              {{ t("dashboard.field.currentMarketCondition") }}:
              {{ currentMarketConditionLabel }}
            </el-tag>
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.marketConditionAuto")
            }}</span>
            <el-switch
              :model-value="config.marketConditionIsAuto"
              :active-value="1"
              :inactive-value="0"
              @change="
                value => saveField('market_condition_is_auto', Number(value))
              "
            />
            <el-button
              v-if="config.marketConditionIsAuto === 1"
              type="success"
              size="small"
              :loading="marketUpdateRunning"
              :disabled="marketUpdateRunning"
              @click="onUpdateMarketCondition"
              >{{ t("dashboard.button.updateNow") }}</el-button
            >
            <span v-if="config.marketConditionIsAuto === 1" class="hint">{{
              t("dashboard.hint.autoRefresh")
            }}</span>
          </div>

          <div v-if="marketUpdateTask" class="field-row field-row-top">
            <span class="field-label">{{
              t("dashboard.field.marketAnalysisProgress")
            }}</span>
            <div class="market-progress">
              <el-progress
                :percentage="marketUpdateTask.progress"
                :status="
                  marketUpdateTask.status === 'succeeded'
                    ? 'success'
                    : marketUpdateTask.status === 'failed'
                      ? 'exception'
                      : undefined
                "
                :indeterminate="marketUpdateTask.stage === 'calling_llm'"
                :duration="3"
              />
              <div class="market-progress-stage">
                {{ marketProgressLabel }}
              </div>
            </div>
          </div>

          <div v-if="marketAnalysis" class="field-row field-row-top">
            <span class="field-label">{{
              t("dashboard.field.latestMarketAnalysis")
            }}</span>
            <div class="market-analysis">
              <div class="market-analysis-meta">
                <el-tag
                  :type="marketAnalysis.source === 'llm' ? 'success' : 'info'"
                  size="small"
                >
                  {{
                    marketAnalysis.source === "llm"
                      ? t("dashboard.analysis.llm")
                      : t("dashboard.analysis.algorithm")
                  }}
                </el-tag>
                <span v-if="marketAnalysis.confidence > 0" class="hint">
                  {{ t("dashboard.analysis.confidence") }}:
                  {{ Math.round(marketAnalysis.confidence * 100) }}%
                </span>
              </div>
              <div v-if="marketAnalysis.reason" class="market-analysis-reason">
                {{ marketAnalysis.reason }}
              </div>
            </div>
          </div>

          <div class="field-row field-row-top">
            <span class="field-label">{{
              t("dashboard.field.excludeSymbols")
            }}</span>
            <el-select
              v-model="excludeSymbols"
              multiple
              filterable
              clearable
              class="wide-select"
              @change="onExcludeChange"
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
              t("dashboard.field.orderType")
            }}</span>
            <el-select
              :model-value="config.coinOrderType"
              class="compact-select"
              @change="value => saveField('future_order_type', value)"
            >
              <el-option
                :label="t('dashboard.orderType.market')"
                value="MARKET"
              />
              <el-option
                :label="t('dashboard.orderType.limit')"
                value="LIMIT"
              />
            </el-select>
            <span class="hint green">{{
              config.coinOrderType === "LIMIT"
                ? t("dashboard.hint.limitMode")
                : t("dashboard.hint.marketMode")
            }}</span>
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.testStrategy")
            }}</span>
            <el-switch
              :model-value="config.tradeFutureTest"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('future_test', value)"
            />
            <el-button
              type="success"
              size="small"
              @click="gotoTestStrategyResult"
              >{{ t("dashboard.button.viewTestResult") }}</el-button
            >
          </div>

          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.testAutoTradeLimit")
            }}</span>
            <el-input
              v-model="config.FutureTestAutoTradeCountLimit"
              type="number"
              class="compact-input"
              @change="
                value =>
                  saveField('future_test_auto_trade_count_limit', Number(value))
              "
            />
            <span class="hint red">{{
              t("dashboard.hint.testAutoTradeLimit")
            }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.testFeeRate")
            }}</span>
            <el-input-number
              v-model="config.FutureTestFeeRate"
              :min="0"
              :max="0.1"
              :step="0.0001"
              :precision="6"
              controls-position="right"
              class="compact-input"
              @change="
                value => saveField('future_test_fee_rate', Number(value || 0))
              "
            />
            <span class="hint">{{ t("dashboard.hint.testFeeRate") }}</span>
          </div>
        </div>
      </el-collapse-item>

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

      <el-collapse-item name="new_coin_rush">
        <template #title>
          <div class="dashboard-text">
            {{ t("dashboard.section.newCoinRush") }}
          </div>
        </template>
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.spotNewEnable")
            }}</span>
            <el-switch
              :model-value="config.spotNewEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('spot_new_enable', value)"
            />
          </div>
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.futureNewEnable")
            }}</span>
            <el-switch
              :model-value="config.tradeNewEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('future_new_enable', value)"
            />
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item name="coin_notice">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.coinNotice") }}</span>
            <el-switch
              :model-value="config.noticeCoinEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('notice_coin_enable', value)"
            />
          </div>
        </template>
      </el-collapse-item>

      <el-collapse-item name="market_listen">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.marketListen") }}</span>
            <el-switch
              :model-value="config.listenCoinEnable"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('listen_coin_enable', value)"
            />
          </div>
        </template>
      </el-collapse-item>

      <el-collapse-item name="funding_rate">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.fundingRate") }}</span>
            <el-switch
              :model-value="config.listenFundingRate"
              :active-value="1"
              :inactive-value="0"
              @change="value => saveField('listen_funding_rate_enable', value)"
            />
          </div>
        </template>
      </el-collapse-item>

      <el-collapse-item name="debug">
        <template #title>
          <div class="dashboard-text flex items-center gap-3">
            <span>{{ t("dashboard.section.debug") }}</span>
            <span :class="config.debug === '1' ? 'red' : 'green'">{{
              config.debug === "1"
                ? t("dashboard.state.on")
                : t("dashboard.state.off")
            }}</span>
          </div>
        </template>
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{ t("dashboard.field.pushTest") }}</span>
            <el-button type="primary" size="small" @click="onTestPusher">{{
              t("dashboard.button.testPush")
            }}</el-button>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item
        name="external"
        :title="t('dashboard.section.externalLinks')"
      >
        <div class="dashboard-body">
          <div
            v-if="
              Array.isArray(config.externalLinks) && config.externalLinks.length
            "
            class="external-links"
          >
            <el-link
              v-for="link in config.externalLinks"
              :key="link.title"
              :href="link.url"
              target="_blank"
              type="primary"
              >{{ link.title }}</el-link
            >
          </div>
          <div v-else class="hint">
            {{ t("dashboard.hint.noExternalLinks") }}
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.dashboard-container {
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

.market-select {
  width: 150px;
}

.market-analysis {
  max-width: 720px;
}

.market-analysis-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
}

.market-analysis-reason {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.market-progress {
  width: min(560px, calc(100% - 20px));
}

.market-progress-stage {
  margin-top: 5px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.wide-select {
  width: min(900px, calc(100% - 152px));
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.red {
  color: #e53935;
}

.green {
  color: #2e7d32;
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

.external-links {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

@media (width <= 900px) {
  .alert-status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
