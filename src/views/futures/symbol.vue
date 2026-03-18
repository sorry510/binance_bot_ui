<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import {
  addFeature,
  batchEditFeatures,
  delFeature,
  enableFeature,
  getFeature,
  getFeatures,
  setFeature,
  testStrategyRule
} from "../../api/trade";
import { getList as getStrategyTemplateList } from "../../api/strategyTemplate";
import { codeMirrorBasicSetup } from "../../utils/codemirror";

defineOptions({ name: "FuturesSymbol" });

const { t } = useI18n();

type IndicatorKey = "ma" | "ema" | "rsi" | "kc" | "boll" | "atr";

interface FeatureRow {
  id: number;
  symbol: string;
  strategy_type?: string;
  technology?: string;
  strategy?: string;
  marginType?: string;
  margin_type?: string;
  usdt?: number | string;
  leverage?: number | string;
  profit?: number | string;
  loss?: number | string;
  close?: number;
  percentChange?: number;
  pin?: number;
  pin_read?: number;
  enable: boolean;
  [key: string]: any;
}

interface StrategyItem {
  name: string;
  type: "long" | "short" | "close_long" | "close_short" | "";
  code: string;
  fullScreen: boolean;
  enable: boolean;
}

interface TechnologyItem {
  name: string;
  kline_interval: string;
  period: number | string;
  multiplier?: number | string;
  std_dev_multiplier?: number | string;
  enable: boolean;
}

interface StrategyTemplateRow {
  id: number;
  name: string;
  strategy: string;
  technology: string;
}

function createEmptyTechnology() {
  return {
    ma: [] as TechnologyItem[],
    ema: [] as TechnologyItem[],
    rsi: [] as TechnologyItem[],
    kc: [] as TechnologyItem[],
    boll: [] as TechnologyItem[],
    atr: [] as TechnologyItem[]
  };
}

const klineInterval = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M"
];

const indicatorTabs = [
  { key: "ma", label: "MA" },
  { key: "ema", label: "EMA" },
  { key: "rsi", label: "RSI" },
  { key: "kc", label: "KC" },
  { key: "boll", label: "BOLL" },
  { key: "atr", label: "ATR" }
] as const;

const strategyTypeOptions = [
  "global",
  "custom",
  "line1",
  "line2",
  "line3",
  "line4",
  "line5",
  "line6",
  "line7"
];

const listLoading = ref(false);
const serviceLoading = ref(false);
const dialogLoading = ref(false);
const dialogLoading2 = ref(false);

const list = ref<FeatureRow[]>([]);
const total = ref(0);
const sort = ref("");
const interval = ref(Number(localStorage.getItem("refreshInterval") || 30));
const timer = ref<number | null>(null);

const search = reactive({
  page: 1,
  limit: 50,
  symbol_type: "USDT",
  symbol: "",
  enable: "",
  margin_type: "",
  pin: ""
});

const addDialogVisible = ref(false);
const addForm = reactive({ symbol: "" });

const batchDialogVisible = ref(false);
const batchInfo = reactive<Record<string, any>>({
  usdt: undefined,
  profit: undefined,
  loss: undefined,
  marginType: undefined,
  leverage: undefined,
  strategyType: undefined,
  strategyTemplateId: undefined
});

const technologyDialogVisible = ref(false);
const technologyDialogTitle = ref("");
const technologySymbolId = ref<number | null>(null);
const technology = ref(createEmptyTechnology());

const strategyDialogVisible = ref(false);
const strategyDialogTitle = ref("");
const strategySymbolId = ref<number | null>(null);
const strategy = ref<StrategyItem[]>([]);
const strategyTemplates = ref<StrategyTemplateRow[]>([]);
const copyTechnology = ref("");

const codeDialogVisible = ref(false);
const codeDialogTitle = ref("");
const code = ref("");
const strategyIndex = ref<number | null>(null);

const queryParams = computed(() => ({
  ...search,
  sort: sort.value,
  symbol: search.symbol.trim().toUpperCase()
}));

const codeEditorExtensions = computed(() => {
  const keywords = new Set<string>([
    "type",
    "float",
    "int",
    "string",
    "let",
    "trim",
    "upper",
    "lower",
    "split",
    "replace",
    "repeat",
    "indexOf",
    "hasPrefix",
    "now()",
    "max",
    "min",
    "abs",
    "ceil",
    "floor",
    "round",
    "all",
    "any",
    "one",
    "none",
    "map",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "groupBy",
    "count",
    "concat",
    "join",
    "reduce",
    "sum",
    "mean",
    "median",
    "first",
    "last",
    "take",
    "reverse",
    "sort",
    "sortBy",
    "keys",
    "values",
    "len",
    "Kdj",
    "IsDesc",
    "IsAsc",
    "SystemStartTime",
    "MarketCondition",
    "NowPrice",
    "NowTime",
    "NowSymbolPercentChange",
    "NowSymbolClose",
    "NowSymbolOpen",
    "NowSymbolLow",
    "NowSymbolHigh",
    "BasicTrend",
    "ROI",
    "Position",
    "Position.EntryPrice",
    "Position.MarkPrice",
    "Position.Amount",
    "Position.UnrealizedProfit",
    "Position.Leverage",
    "Position.Side",
    "Position.Mock",
    "Position.CreateTime",
    "Position.SourceType",
    "Positions",
    "Positions[]",
    "Positions[0].Symbol",
    "Positions[0].Side",
    "Positions[0].Amount",
    "Positions[0].MarginType",
    "Positions[0].Leverage",
    "Positions[0].EntryPrice",
    "Positions[0].MarkPrice",
    "Positions[0].UnrealizedProfit"
  ]);

  if (strategySymbolId.value !== null) {
    const find = list.value.find(item => item.id === strategySymbolId.value);
    if (find?.technology) {
      try {
        const localTechnology = JSON.parse(find.technology);
        const klineIntervalSet = new Set<string>();
        Object.keys(localTechnology).forEach(key => {
          localTechnology[key].forEach((item: any) => {
            if (!item?.enable) return;

            if (item.name) keywords.add(item.name);
            if (item.kline_interval) klineIntervalSet.add(item.kline_interval);

            if (["ma", "ema", "rsi", "atr"].includes(key)) {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.Data`);
              keywords.add(`${item.name}.Data[]`);
            }

            if (["kc", "boll"].includes(key)) {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.High`);
              keywords.add(`${item.name}.High[]`);
              keywords.add(`${item.name}.Low`);
              keywords.add(`${item.name}.Low[]`);
              keywords.add(`${item.name}.Mid`);
              keywords.add(`${item.name}.Mid[]`);
              if (key === "kc") keywords.add(`${item.name}.Multiplier`);
              if (key === "boll") keywords.add(`${item.name}.StdDevMultiplier`);
            }
          });
        });

        klineIntervalSet.forEach(item => {
          keywords.add(`kline_${item}`);
          keywords.add(`kline_${item}.High`);
          keywords.add(`kline_${item}.High[]`);
          keywords.add(`kline_${item}.Low`);
          keywords.add(`kline_${item}.Low[]`);
          keywords.add(`kline_${item}.Close`);
          keywords.add(`kline_${item}.Close[]`);
          keywords.add(`kline_${item}.Open`);
          keywords.add(`kline_${item}.Open[]`);
          keywords.add(`kline_${item}.Amount`);
          keywords.add(`kline_${item}.Amount[]`);
          keywords.add(`kline_${item}.Qps`);
          keywords.add(`kline_${item}.Qps[]`);
        });
      } catch (error) {
        // Ignore malformed technology payload.
      }
    }
  }

  ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"].forEach(symbol => {
    keywords.add(`${symbol}.PercentChange`);
    keywords.add(`${symbol}.Close`);
    keywords.add(`${symbol}.Open`);
    keywords.add(`${symbol}.Low`);
    keywords.add(`${symbol}.High`);
  });

  return [
    javascript(),
    oneDark,
    keymap.of([indentWithTab]),
    autocompletion({
      override: [
        completeFromList(
          Array.from(keywords).map(item => ({ label: item, type: "keyword" }))
        )
      ]
    })
  ];
});

function clearTimer() {
  if (timer.value) {
    window.clearInterval(timer.value);
    timer.value = null;
  }
}

function startTimer() {
  clearTimer();
  timer.value = window.setInterval(() => {
    getFutures();
  }, interval.value * 1000);
}

function normalizeFeature(item: any): FeatureRow {
  const pinValue = Number(item.pin || 0);
  return {
    ...item,
    enable: Number(item.enable) > 0,
    pin: pinValue,
    pin_read: pinValue
  };
}

function mapFeaturePayload(row: FeatureRow) {
  const payload = { ...row };
  delete payload.pin_read;
  return {
    ...payload,
    enable: row.enable ? 1 : 0,
    pin: Number(row.pin || 0),
    leverage:
      row.leverage === "" || row.leverage === undefined
        ? row.leverage
        : Number(row.leverage),
    usdt:
      row.usdt === "" || row.usdt === undefined ? row.usdt : Number(row.usdt),
    profit:
      row.profit === "" || row.profit === undefined
        ? row.profit
        : Number(row.profit),
    loss:
      row.loss === "" || row.loss === undefined ? row.loss : Number(row.loss)
  };
}

async function getFutures() {
  listLoading.value = true;
  try {
    const res = await getFeatures(queryParams.value);
    const data = res?.data || {};
    const rows = Array.isArray(data.list) ? data.list : [];
    list.value = rows.map(normalizeFeature);
    total.value = Number(data.total || 0);
  } finally {
    listLoading.value = false;
  }
}

async function fetchData(resetPage = false) {
  if (resetPage) search.page = 1;
  await getFutures();
  startTimer();
}

function onSortChange({
  prop,
  order
}: {
  prop: string;
  order: "ascending" | "descending" | null;
}) {
  if (!order) {
    sort.value = "";
  } else {
    sort.value = `${prop}${order === "ascending" ? "+" : "-"}`;
  }
  fetchData();
}

function onTabChange(name: string | number) {
  search.symbol_type = String(name);
  fetchData(true);
}

function onIntervalChange() {
  localStorage.setItem("refreshInterval", String(interval.value));
  startTimer();
}

function formatPrice(value: unknown, digits = 10) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0";
  return Number(num.toFixed(digits)).toString();
}

async function onEnableChange(row: FeatureRow) {
  try {
    await setFeature(row.id, mapFeaturePayload(row));
    ElMessage.success(t("futuresSymbolPage.message.editSuccess"));
  } catch {
    row.enable = !row.enable;
    ElMessage.error(t("futuresSymbolPage.message.editFail"));
  }
}

async function onPinChange(row: FeatureRow) {
  console.log("Pin change", row.symbol, row.pin_read);
  row.pin = row.pin_read ? 1 : 0;
  try {
    await setFeature(row.id, { pin: row.pin });
    ElMessage.success(t("futuresSymbolPage.message.editSuccess"));
    await getFutures();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.editFail"));
  }
}

async function onEditRow(row: FeatureRow) {
  try {
    await setFeature(row.id, mapFeaturePayload(row));
    ElMessage.success(t("futuresSymbolPage.message.editSuccess"));
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.editFail"));
  }
}

async function onDelete(row: FeatureRow) {
  await ElMessageBox.confirm(
    t("futuresSymbolPage.confirm.delete", { symbol: row.symbol }),
    t("futuresSymbolPage.confirm.title"),
    {
      type: "warning"
    }
  );
  try {
    await delFeature(row.id);
    ElMessage.success(t("futuresSymbolPage.message.deleteSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.deleteFail"));
  }
}

async function onEnableAll(flag: number) {
  await ElMessageBox.confirm(
    flag === 1
      ? t("futuresSymbolPage.confirm.enableAll")
      : t("futuresSymbolPage.confirm.disableAll"),
    t("futuresSymbolPage.confirm.title")
  );
  serviceLoading.value = true;
  try {
    await enableFeature(flag);
    ElMessage.success(t("futuresSymbolPage.message.actionSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  } finally {
    serviceLoading.value = false;
  }
}

function openAddDialog() {
  addForm.symbol = "";
  addDialogVisible.value = true;
}

async function addSymbol() {
  const symbol = addForm.symbol.trim().toUpperCase();
  if (!symbol) return;
  dialogLoading.value = true;
  try {
    await addFeature({
      symbol,
      quantity: 20,
      percentChange: 0,
      close: 0,
      open: 0,
      low: 0,
      enable: 1,
      updateTime: Date.now()
    });
    ElMessage.success(t("futuresSymbolPage.message.addSuccess"));
    addDialogVisible.value = false;
    await fetchData();
  } finally {
    dialogLoading.value = false;
  }
}

function openBatchDialog() {
  Object.assign(batchInfo, {
    usdt: undefined,
    profit: undefined,
    loss: undefined,
    marginType: undefined,
    leverage: undefined,
    strategyType: undefined,
    strategyTemplateId: undefined
  });
  batchDialogVisible.value = true;
}

async function submitBatchEdit() {
  dialogLoading2.value = true;
  try {
    await batchEditFeatures(batchInfo);
    ElMessage.success(t("futuresSymbolPage.message.actionSuccess"));
    batchDialogVisible.value = false;
    await fetchData();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  } finally {
    dialogLoading2.value = false;
  }
}

async function loadStrategyTemplates() {
  const res = await getStrategyTemplateList();
  strategyTemplates.value = res?.data || [];
}

async function openTechnologyDialog(row: FeatureRow) {
  const detail = await getFeature(row.id);
  const data = detail?.data || {};
  technologySymbolId.value = row.id;
  technologyDialogTitle.value = `${row.symbol} ${t("futuresSymbolPage.button.technology")}`;
  technology.value = createEmptyTechnology();

  if (data.technology) {
    try {
      technology.value = {
        ...createEmptyTechnology(),
        ...JSON.parse(data.technology)
      };
    } catch {
      technology.value = createEmptyTechnology();
    }
  }

  technologyDialogVisible.value = true;
}

async function confirmTechnology() {
  if (technologySymbolId.value === null) return;
  dialogLoading.value = true;
  try {
    const payload = JSON.parse(JSON.stringify(technology.value));
    Object.keys(payload).forEach((key: string) => {
      payload[key].forEach((item: any) => {
        if (item.period !== "") item.period = Number(item.period);
        if (item.multiplier !== undefined && item.multiplier !== "")
          item.multiplier = Number(item.multiplier);
        if (
          item.std_dev_multiplier !== undefined &&
          item.std_dev_multiplier !== ""
        ) {
          item.std_dev_multiplier = Number(item.std_dev_multiplier);
        }
      });
    });
    await setFeature(technologySymbolId.value, {
      technology: JSON.stringify(payload)
    });
    ElMessage.success(t("futuresSymbolPage.message.actionSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  } finally {
    dialogLoading.value = false;
  }
}

function addTechnologyItem(key: IndicatorKey) {
  const defaults: Record<IndicatorKey, TechnologyItem> = {
    ma: { name: "", kline_interval: "", period: 14, enable: false },
    ema: { name: "", kline_interval: "", period: 14, enable: false },
    rsi: { name: "", kline_interval: "", period: 14, enable: false },
    kc: {
      name: "",
      kline_interval: "",
      period: 50,
      multiplier: 2.75,
      enable: false
    },
    boll: {
      name: "",
      kline_interval: "",
      period: 21,
      std_dev_multiplier: 2,
      enable: false
    },
    atr: { name: "", kline_interval: "", period: 14, enable: false }
  };
  technology.value[key] = [...technology.value[key], { ...defaults[key] }];
}

function removeTechnologyItem(key: IndicatorKey, index: number) {
  technology.value[key] = technology.value[key].filter(
    (_, idx) => idx !== index
  );
}

async function openStrategyDialog(row: FeatureRow) {
  const detail = await getFeature(row.id);
  const data = detail?.data || {};

  strategySymbolId.value = row.id;
  copyTechnology.value = "";
  strategyDialogTitle.value = `${row.symbol} ${t("futuresSymbolPage.button.strategy")}`;

  if (data.strategy) {
    try {
      strategy.value = JSON.parse(data.strategy);
    } catch {
      strategy.value = [];
    }
  } else {
    strategy.value = [];
  }

  strategyDialogVisible.value = true;
}

function addStrategy() {
  strategy.value = [
    ...strategy.value,
    {
      name: "",
      type: "",
      code: "",
      fullScreen: false,
      enable: false
    }
  ];
}

function removeStrategy(index: number) {
  strategy.value = strategy.value.filter((_, idx) => idx !== index);
}

function selectStrategyTemplate(id?: number) {
  if (!id) return;
  const find = strategyTemplates.value.find(item => item.id === id);
  if (!find) return;

  try {
    strategy.value = JSON.parse(find.strategy || "[]");
    copyTechnology.value = find.technology || "";
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.templateError"));
  }
}

async function confirmStrategy() {
  if (strategySymbolId.value === null) return;
  dialogLoading.value = true;
  try {
    const data: Record<string, any> = {
      strategy: JSON.stringify(strategy.value)
    };
    if (copyTechnology.value) data.technology = copyTechnology.value;
    await setFeature(strategySymbolId.value, data);
    copyTechnology.value = "";
    ElMessage.success(t("futuresSymbolPage.message.actionSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  } finally {
    dialogLoading.value = false;
  }
}

function fullCodeScreenChange(row: StrategyItem, index: number) {
  if (row.fullScreen) {
    codeDialogTitle.value = `${row.name || "strategy"} code`;
    code.value = row.code || "";
    strategyIndex.value = index;
    codeDialogVisible.value = true;
  } else if (strategyIndex.value === index) {
    codeDialogVisible.value = false;
  }
}

function onCodeDialogChange(value: boolean) {
  if (!value) {
    code.value = "";
    strategyIndex.value = null;
    strategy.value = strategy.value.map(item => ({
      ...item,
      fullScreen: false
    }));
  }
}

function onCodeChange(value: string) {
  code.value = value;
  if (strategyIndex.value !== null && strategy.value[strategyIndex.value]) {
    strategy.value[strategyIndex.value].code = value;
  }
}

async function onTestStrategyRule() {
  if (strategySymbolId.value === null || strategyIndex.value === null) {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
    return;
  }

  try {
    const current = strategy.value[strategyIndex.value];
    const payload = {
      strategy: JSON.stringify([
        {
          name: "test_strategy",
          type: current?.type || "long",
          code: code.value,
          fullScreen: false,
          enable: true
        }
      ])
    };
    const res = await testStrategyRule(strategySymbolId.value, payload);
    if (res?.code === 200) {
      ElMessage.success(
        `${t("futuresSymbolPage.message.testResult")}: ${String(res?.data?.pass)}`
      );
      return;
    }
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  } catch {
    ElMessage.error(t("futuresSymbolPage.message.actionFail"));
  }
}

onMounted(async () => {
  await loadStrategyTemplates();
  await fetchData();
});

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<template>
  <div class="p-4 futures-symbol-page">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="flex w-3/4 flex-wrap items-center gap-2">
        <el-button type="success" @click="openAddDialog">{{
          t("futuresSymbolPage.button.add")
        }}</el-button>
        <el-button
          type="success"
          :loading="serviceLoading"
          @click="onEnableAll(1)"
          >{{ t("futuresSymbolPage.button.enableAll") }}</el-button
        >
        <el-button
          type="danger"
          :loading="serviceLoading"
          @click="onEnableAll(0)"
          >{{ t("futuresSymbolPage.button.disableAll") }}</el-button
        >
        <el-button type="primary" @click="openBatchDialog">{{
          t("futuresSymbolPage.button.batchEdit")
        }}</el-button>
      </div>
      <div class="w-1/4 text-right">
        {{ t("futuresSymbolPage.label.total") }}: {{ total }}
      </div>
    </div>

    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-input
          v-model="search.symbol"
          :placeholder="t('futuresSymbolPage.placeholder.symbol')"
          style="width: 150px"
          @keyup.enter="fetchData(true)"
        />
        <el-select
          v-model="search.pin"
          clearable
          :placeholder="t('futuresSymbolPage.placeholder.pin')"
          style="width: 100px"
        >
          <el-option :label="t('futuresSymbolPage.state.pin')" value="1" />
        </el-select>
        <el-select
          v-model="search.enable"
          clearable
          :placeholder="t('futuresSymbolPage.placeholder.status')"
          style="width: 100px"
        >
          <el-option :label="t('futuresSymbolPage.state.on')" value="1" />
          <el-option :label="t('futuresSymbolPage.state.off')" value="0" />
        </el-select>
        <el-select
          v-model="search.margin_type"
          clearable
          :placeholder="t('futuresSymbolPage.placeholder.marginType')"
          style="width: 130px"
        >
          <el-option label="ISOLATED" value="ISOLATED" />
          <el-option label="CROSSED" value="CROSSED" />
        </el-select>
        <el-button type="success" @click="fetchData(true)">{{
          t("futuresSymbolPage.button.search")
        }}</el-button>
      </div>

      <div class="flex items-center gap-2">
        <el-select
          v-model="interval"
          style="width: 90px"
          @change="onIntervalChange"
        >
          <el-option v-for="n in 30" :key="n" :label="`${n}s`" :value="n" />
        </el-select>
        <span>{{ t("futuresSymbolPage.label.refreshInterval") }}</span>
      </div>
    </div>

    <el-tabs v-model="search.symbol_type" @tab-change="onTabChange">
      <el-tab-pane label="USDT" name="USDT" />
      <el-tab-pane label="USDC" name="USDC" />
    </el-tabs>

    <el-table
      v-loading="listLoading"
      :data="list"
      border
      size="small"
      highlight-current-row
      @sort-change="onSortChange"
    >
      <el-table-column
        :label="t('futuresSymbolPage.table.pin')"
        align="center"
        width="50"
      >
        <template #default="{ row }">
          <el-rate
            v-model="row.pin_read"
            :max="1"
            clearable
            @change="onPinChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="symbol"
        :label="t('futuresSymbolPage.table.symbol')"
        align="center"
        min-width="80"
      />
      <el-table-column
        :label="t('futuresSymbolPage.table.strategyType')"
        align="center"
        width="115"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.strategy_type"
            size="small"
            @change="onEditRow(row)"
          >
            <el-option
              v-for="item in strategyTypeOptions"
              :key="item"
              :label="t(`futuresSymbolPage.strategyType.${item}`)"
              :value="item"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.technology')"
        align="center"
        width="115"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openTechnologyDialog(row)"
            >{{ t("futuresSymbolPage.button.technology") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.strategy')"
        align="center"
        width="100"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openStrategyDialog(row)"
            >{{ t("futuresSymbolPage.button.strategy") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.price')"
        align="center"
        min-width="85"
      >
        <template #default="{ row }">{{ formatPrice(row.close, 10) }}</template>
      </el-table-column>
      <el-table-column
        prop="percent_change"
        :label="t('futuresSymbolPage.table.change24h')"
        align="center"
        width="90"
        sortable="custom"
      >
        <template #default="{ row }">
          <span v-if="Number(row.percentChange) < 0" class="text-red-500"
            >{{ row.percentChange }}%↓</span
          >
          <span v-else class="text-green-500">{{ row.percentChange }}%↑</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.marginType')"
        align="center"
        width="125"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.marginType"
            size="small"
            @change="onEditRow(row)"
          >
            <el-option :label="t('trade.ISOLATED')" value="ISOLATED" />
            <el-option :label="t('trade.CROSSED')" value="CROSSED" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.usdt')"
        align="center"
        width="75"
      >
        <template #default="{ row }"
          ><el-input v-model="row.usdt" size="small" @blur="onEditRow(row)"
        /></template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.leverage')"
        align="center"
        width="75"
      >
        <template #default="{ row }"
          ><el-input v-model="row.leverage" size="small" @blur="onEditRow(row)"
        /></template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.takeProfit')"
        align="center"
        width="75"
      >
        <template #default="{ row }"
          ><el-input v-model="row.profit" size="small" @blur="onEditRow(row)"
        /></template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.stopLoss')"
        align="center"
        width="75"
      >
        <template #default="{ row }"
          ><el-input v-model="row.loss" size="small" @blur="onEditRow(row)"
        /></template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.enable')"
        align="center"
        width="75"
      >
        <template #default="{ row }">
          <el-switch v-model="row.enable" @change="onEnableChange(row)" />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('futuresSymbolPage.table.operation')"
        align="center"
        width="75"
      >
        <template #default="{ row }">
          <el-button type="danger" size="small" @click="onDelete(row)">{{
            t("futuresSymbolPage.button.delete")
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3 flex justify-end">
      <el-pagination
        :current-page="search.page"
        :page-size="search.limit"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @current-change="
          page => {
            search.page = page;
            fetchData();
          }
        "
        @size-change="
          size => {
            search.limit = size;
            fetchData(true);
          }
        "
      />
    </div>

    <el-dialog
      v-model="addDialogVisible"
      :title="t('futuresSymbolPage.dialog.addTitle')"
      width="500px"
    >
      <el-form label-width="120px">
        <el-form-item :label="t('futuresSymbolPage.table.symbol')">
          <el-input
            v-model="addForm.symbol"
            :placeholder="t('futuresSymbolPage.placeholder.symbol')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">{{
          t("futuresSymbolPage.button.cancel")
        }}</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="addSymbol">{{
          t("futuresSymbolPage.button.confirm")
        }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="batchDialogVisible"
      :title="t('futuresSymbolPage.dialog.batchEditTitle')"
      width="640px"
    >
      <el-form label-width="150px">
        <el-form-item :label="t('futuresSymbolPage.batch.strategyType')">
          <el-select v-model="batchInfo.strategyType" clearable>
            <el-option
              v-for="item in strategyTypeOptions"
              :key="item"
              :label="t(`futuresSymbolPage.strategyType.${item}`)"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.strategyTemplate')">
          <el-select v-model="batchInfo.strategyTemplateId" clearable>
            <el-option
              v-for="item in strategyTemplates"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.marginType')">
          <el-select v-model="batchInfo.marginType" clearable>
            <el-option label="ISOLATED" value="ISOLATED" />
            <el-option label="CROSSED" value="CROSSED" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.usdt')"
          ><el-input v-model="batchInfo.usdt"
        /></el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.leverage')"
          ><el-input v-model="batchInfo.leverage"
        /></el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.profit')"
          ><el-input v-model="batchInfo.profit"
        /></el-form-item>
        <el-form-item :label="t('futuresSymbolPage.batch.loss')"
          ><el-input v-model="batchInfo.loss"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">{{
          t("futuresSymbolPage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading2"
          @click="submitBatchEdit"
          >{{ t("futuresSymbolPage.button.confirm") }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="technologyDialogVisible"
      :title="technologyDialogTitle"
      width="1200px"
    >
      <el-tabs>
        <el-tab-pane
          v-for="tab in indicatorTabs"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        >
          <div class="mb-2">
            <el-button type="primary" @click="addTechnologyItem(tab.key)">{{
              t("futuresSymbolPage.button.add")
            }}</el-button>
          </div>
          <el-table
            :data="technology[tab.key]"
            border
            size="small"
            style="width: 100%"
          >
            <el-table-column
              :label="t('strategyTemplatePage.technology.name')"
              align="center"
              min-width="160"
            >
              <template #default="{ row }"
                ><el-input v-model="row.name" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('strategyTemplatePage.technology.klineInterval')"
              align="center"
              width="140"
            >
              <template #default="{ row }">
                <el-select v-model="row.kline_interval" size="small">
                  <el-option
                    v-for="item in klineInterval"
                    :key="item"
                    :label="item"
                    :value="item"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('strategyTemplatePage.technology.period')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kc'"
              :label="t('strategyTemplatePage.technology.multiplier')"
              align="center"
              width="130"
            >
              <template #default="{ row }"
                ><el-input v-model="row.multiplier" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'boll'"
              :label="t('strategyTemplatePage.technology.stdDevMultiplier')"
              align="center"
              width="160"
            >
              <template #default="{ row }"
                ><el-input v-model="row.std_dev_multiplier" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('strategyTemplatePage.technology.enable')"
              align="center"
              width="110"
            >
              <template #default="{ row }"
                ><el-switch v-model="row.enable"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('futuresSymbolPage.table.operation')"
              align="center"
              width="110"
            >
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  size="small"
                  @click="removeTechnologyItem(tab.key, $index)"
                  >{{ t("futuresSymbolPage.button.delete") }}</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="technologyDialogVisible = false">{{
          t("futuresSymbolPage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmTechnology"
          >{{ t("futuresSymbolPage.button.confirm") }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="strategyDialogVisible"
      :title="strategyDialogTitle"
      width="78%"
    >
      <div class="mb-2 flex items-center gap-2">
        <el-button type="primary" @click="addStrategy">{{
          t("futuresSymbolPage.button.add")
        }}</el-button>
        <el-select
          v-model="batchInfo.strategyTemplateId"
          clearable
          :placeholder="t('futuresSymbolPage.placeholder.strategyTemplate')"
          style="width: 220px"
          @change="selectStrategyTemplate"
        >
          <el-option
            v-for="item in strategyTemplates"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </div>

      <el-table :data="strategy" border size="small" style="width: 100%">
        <el-table-column
          :label="t('strategyTemplatePage.strategy.name')"
          align="center"
          width="260"
        >
          <template #default="{ row }"
            ><el-input v-model="row.name" size="small"
          /></template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.code')"
          align="center"
        >
          <template #default="{ row }"
            ><el-input
              v-model="row.code"
              type="textarea"
              :rows="6"
              size="small"
          /></template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.fullScreen')"
          align="center"
          width="120"
        >
          <template #default="{ row, $index }"
            ><el-switch
              v-model="row.fullScreen"
              @change="fullCodeScreenChange(row, $index)"
          /></template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.type')"
          align="center"
          width="160"
        >
          <template #default="{ row }">
            <el-select v-model="row.type" size="small">
              <el-option
                :label="t('strategyTemplatePage.strategy.long')"
                value="long"
              />
              <el-option
                :label="t('strategyTemplatePage.strategy.short')"
                value="short"
              />
              <el-option
                :label="t('strategyTemplatePage.strategy.closeLong')"
                value="close_long"
              />
              <el-option
                :label="t('strategyTemplatePage.strategy.closeShort')"
                value="close_short"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.enable')"
          align="center"
          width="110"
        >
          <template #default="{ row }"
            ><el-switch v-model="row.enable"
          /></template>
        </el-table-column>
        <el-table-column
          :label="t('futuresSymbolPage.table.operation')"
          align="center"
          width="110"
        >
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="removeStrategy($index)"
              >{{ t("futuresSymbolPage.button.delete") }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="strategyDialogVisible = false">{{
          t("futuresSymbolPage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmStrategy"
          >{{ t("futuresSymbolPage.button.confirm") }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="codeDialogVisible"
      :title="codeDialogTitle"
      fullscreen
      @update:model-value="onCodeDialogChange"
    >
      <div class="code-full">
        <div class="code-toolbar">
          <el-link
            href="https://expr-lang.org/docs/language-definition"
            type="success"
            target="_blank"
            >code rule</el-link
          >
          <el-button type="primary" @click="onTestStrategyRule">{{
            t("futuresSymbolPage.button.test")
          }}</el-button>
        </div>
        <Codemirror
          v-model="code"
          :extensions="codeEditorExtensions"
          :basic-setup="codeMirrorBasicSetup"
          :style="{ height: '70vh' }"
          :indent-with-tab="true"
          :tab-size="2"
          @update:model-value="onCodeChange"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.futures-symbol-page :deep(.el-rate__icon) {
  margin-right: 0;
}

.futures-symbol-page :deep(.el-dialog__body) {
  padding-top: 12px;
}

.code-full {
  width: 100%;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.code-full :deep(.cm-editor) {
  min-height: 600px;
}

.code-full :deep(.cm-tooltip-autocomplete) {
  z-index: 9999;
}
</style>
