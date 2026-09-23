<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  editData,
  getMarketConditionUpdateTask,
  getServiceConfig,
  getSmartLocalV2Preview,
  testPusher,
  updateMarketCondition,
  type MarketConditionUpdateTask,
  type SmartLocalV2Result
} from "../../api/service";

defineOptions({
  name: "Dashboard"
});

const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const selectorPreviewVisible = ref(false);
const selectorPreviewLoading = ref(false);
const selectorPreview = ref<SmartLocalV2Result | null>(null);
const marketAnalysis = ref<{
  source: string;
  confidence: number;
  reason: string;
} | null>(null);
const marketUpdateTask = ref<MarketConditionUpdateTask | null>(null);
let marketProgressTimer: ReturnType<typeof setTimeout> | undefined;
let marketProgressPollFailures = 0;
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
  "coin6",
  "smart_local_v2"
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
    try {
      config.externalLinks = JSON.parse(data.externalLinks || "[]");
    } catch {
      config.externalLinks = [];
    }
  } finally {
    loading.value = false;
  }
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

async function openSmartLocalV2Preview() {
  selectorPreviewVisible.value = true;
  selectorPreviewLoading.value = true;
  try {
    const res = await getSmartLocalV2Preview(5);
    if (res?.code !== 200 || !res?.data) {
      throw new Error(res?.msg || t("dashboard.selectorPreview.loadFailed"));
    }
    selectorPreview.value = res.data as SmartLocalV2Result;
  } catch (error: any) {
    selectorPreview.value = null;
    ElMessage.error(
      error?.message || t("dashboard.selectorPreview.loadFailed")
    );
  } finally {
    selectorPreviewLoading.value = false;
  }
}

function formatCompactNumber(value: number) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
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

function gotoTestStrategyResult() {
  router.push({ name: "testStrategyResult" });
}

onMounted(async () => {
  await fetchConfig();
});

onBeforeUnmount(() => {
  clearMarketProgressTimer();
});
</script>

<template>
  <div class="dashboard-container p-4">
    <el-collapse
      v-loading="loading"
      :model-value="[
        'futures',
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
            <div class="selector-field-control">
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
              <el-button
                v-if="config.tradeStrategyCoin === 'smart_local_v2'"
                size="small"
                @click="openSmartLocalV2Preview"
              >
                {{ t("dashboard.selectorPreview.button") }}
              </el-button>
            </div>
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

    <el-dialog
      v-model="selectorPreviewVisible"
      :title="t('dashboard.selectorPreview.title')"
      width="92%"
      top="5vh"
    >
      <div v-loading="selectorPreviewLoading" class="selector-preview">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          :title="t('dashboard.selectorPreview.localOnly')"
        />
        <div v-if="selectorPreview" class="selector-preview-meta">
          <el-tag effect="plain">
            {{ t("dashboard.selectorPreview.source") }}:
            {{ selectorPreview.source }}
          </el-tag>
          <el-tag type="success" effect="plain">
            REST: {{ selectorPreview.meta?.rest_api_used ? "yes" : "no" }}
          </el-tag>
          <el-tag effect="plain">
            {{ t("dashboard.selectorPreview.cooldown") }}:
            {{ selectorPreview.meta?.cooldown_minute }}m
          </el-tag>
          <el-tag effect="plain">
            {{ t("dashboard.selectorPreview.freshness") }}:
            {{ Number(selectorPreview.meta?.max_data_age_ms || 0) / 1000 }}s
          </el-tag>
        </div>

        <el-table
          v-if="selectorPreview"
          :data="selectorPreview.candidates"
          size="small"
          border
          class="selector-candidate-table"
        >
          <el-table-column prop="rank" label="#" width="56" />
          <el-table-column
            prop="symbol"
            :label="t('dashboard.selectorPreview.symbol')"
            width="130"
          />
          <el-table-column
            prop="score"
            :label="t('dashboard.selectorPreview.score')"
            width="85"
          />
          <el-table-column
            :label="t('dashboard.selectorPreview.volume')"
            width="110"
          >
            <template #default="{ row }">
              {{ formatCompactNumber(row.quote_volume_24h) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="t('dashboard.selectorPreview.trades')"
            width="105"
          >
            <template #default="{ row }">
              {{ formatCompactNumber(row.trade_count_24h) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="t('dashboard.selectorPreview.change')"
            width="95"
          >
            <template #default="{ row }">
              {{ Number(row.percent_change_24h).toFixed(2) }}%
            </template>
          </el-table-column>
          <el-table-column
            :label="t('dashboard.selectorPreview.momentum')"
            width="100"
          >
            <template #default="{ row }">
              {{ Number(row.local_momentum_pct).toFixed(3) }}%
            </template>
          </el-table-column>
          <el-table-column
            :label="t('dashboard.selectorPreview.reasons')"
            min-width="260"
          >
            <template #default="{ row }">
              <div class="selector-reason-list">
                <el-tag
                  v-for="reason in row.reasons"
                  :key="reason"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  {{ reason }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('dashboard.selectorPreview.risks')"
            min-width="220"
          >
            <template #default="{ row }">
              <div class="selector-reason-list">
                <el-tag
                  v-for="risk in row.risks"
                  :key="risk"
                  size="small"
                  type="warning"
                  effect="plain"
                >
                  {{ risk }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-collapse v-if="selectorPreview" class="selector-excluded">
          <el-collapse-item name="excluded">
            <template #title>
              {{
                t("dashboard.selectorPreview.excluded", {
                  count: selectorPreview.excluded?.length || 0
                })
              }}
            </template>
            <el-table
              :data="selectorPreview.excluded"
              size="small"
              max-height="300"
            >
              <el-table-column prop="symbol" label="Symbol" width="160" />
              <el-table-column
                prop="reason"
                :label="t('dashboard.selectorPreview.excludedReason')"
              />
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.dashboard-container {
  color: var(--el-text-color-primary);
  background-color: var(--el-bg-color);
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

.selector-field-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.selector-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.selector-candidate-table {
  margin-top: 12px;
}

.selector-reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.selector-excluded {
  margin-top: 14px;
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

.external-links {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
</style>
