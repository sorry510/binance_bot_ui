<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getFeaturesOptions } from "../../api/trade";
import {
  editData,
  getServiceConfig,
  testPusher,
  updateMarketCondition
} from "../../api/service";

defineOptions({
  name: "Dashboard"
});

const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const symbols = ref<string[]>([]);
const excludeSymbols = ref<string[]>([]);
const config = reactive<Record<string, any>>({
  tradeFutureEnable: 0,
  wsFuturesEnable: 0,
  WsFuturesPriceChangeLimit: 0,
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
  { value: 5 }
];

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
  try {
    await updateMarketCondition();
    await fetchConfig();
    ElMessage.success(t("dashboard.message.updateSuccess"));
  } catch {
    ElMessage.error(t("dashboard.message.updateFail"));
  }
}

async function fetchSymbols() {
  const res = await getFeaturesOptions();
  symbols.value = res?.data || [];
}

function gotoNotifyConfig() {
  router.push({ name: "NotifyConfig" });
}

function gotoTestStrategyResult() {
  router.push({ name: "testStrategyResult" });
}

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchSymbols()]);
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
        'notify_config',
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
              t("dashboard.field.priceChangeLimit")
            }}</span>
            <el-input
              v-model="config.WsFuturesPriceChangeLimit"
              type="number"
              class="compact-input"
              @change="
                value =>
                  saveField('ws_futures_price_change_limit', Number(value))
              "
            />
            <span class="hint red">{{
              t("dashboard.hint.priceChangeLimit")
            }}</span>
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
              @click="onUpdateMarketCondition"
              >{{ t("dashboard.button.updateNow") }}</el-button
            >
            <span v-if="config.marketConditionIsAuto === 1" class="hint">{{
              t("dashboard.hint.autoRefresh")
            }}</span>
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

      <el-collapse-item
        name="notify_config"
        :title="t('dashboard.section.notifyConfig')"
      >
        <div class="dashboard-body">
          <div class="field-row">
            <span class="field-label">{{
              t("dashboard.field.notifyChannelConfig")
            }}</span>
            <el-button type="primary" size="small" @click="gotoNotifyConfig">{{
              t("dashboard.button.openNotifyConfig")
            }}</el-button>
          </div>
        </div>
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
