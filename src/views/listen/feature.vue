<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import {
  addListenCoin,
  delListenCoin,
  getListenCoins,
  getFuturesListenSymbolOptions,
  getSpotListenSymbolOptions,
  setListenCoin,
  testStrategyRule
} from "../../api/listenCoin";
import { codeMirrorBasicSetup } from "../../utils/codemirror";
import { validateTechnologyConfig } from "../../utils/technology";

defineOptions({ name: "listenFeature" });
const props = withDefaults(defineProps<{ marketType?: 1 | 2 }>(), {
  marketType: 2
});
const pageKey = props.marketType === 1 ? "listenSpotPage" : "listenFeaturePage";
const { t } = useI18n();

type IndicatorKey =
  | "ma"
  | "ema"
  | "macd"
  | "adx"
  | "mfi"
  | "obv"
  | "cci"
  | "roc"
  | "kdj"
  | "rsi"
  | "kc"
  | "boll"
  | "donchian"
  | "atr"
  | "supertrend";

interface TechnologyItem {
  name: string;
  kline_interval: string;
  period?: number | string;
  fast_period?: number | string;
  slow_period?: number | string;
  signal_period?: number | string;
  k_period?: number | string;
  d_period?: number | string;
  multiplier?: number | string;
  std_dev_multiplier?: number | string;
  enable: boolean;
}

interface StrategyItem {
  name: string;
  type: "long" | "short" | "";
  code: string;
  fullScreen: boolean;
  enable: boolean;
}

interface ListenRow {
  id: number;
  symbol: string;
  close?: string;
  listen_type: "kline_base" | "kline_kc" | "custom"; // DB legacy field; UI always custom
  kline_interval?: string;
  change_percent?: number | string;
  notice_limit_min?: number | string;
  last_notice_time?: number;
  last_notice_type?: string;
  technology?: string;
  strategy?: string;
  enable: boolean;
  [key: string]: any;
}

function createEmptyTechnology() {
  return {
    ma: [] as TechnologyItem[],
    ema: [] as TechnologyItem[],
    macd: [] as TechnologyItem[],
    adx: [] as TechnologyItem[],
    mfi: [] as TechnologyItem[],
    obv: [] as TechnologyItem[],
    cci: [] as TechnologyItem[],
    roc: [] as TechnologyItem[],
    kdj: [] as TechnologyItem[],
    rsi: [] as TechnologyItem[],
    kc: [] as TechnologyItem[],
    boll: [] as TechnologyItem[],
    donchian: [] as TechnologyItem[],
    atr: [] as TechnologyItem[],
    supertrend: [] as TechnologyItem[]
  };
}

const listLoading = ref(false);
const dialogLoading = ref(false);
const savingIds = ref<number[]>([]);
const deletingIds = ref<number[]>([]);
const list = ref<ListenRow[]>([]);
const interval = ref(
  Number(
    localStorage.getItem(
      props.marketType === 1
        ? "listenSpotRefreshInterval"
        : "listenFeatureRefreshInterval"
    ) || (props.marketType === 1 ? 3 : 30)
  )
);
const timer = ref<number | null>(null);
const searchCacheKey =
  props.marketType === 1
    ? "listen-spot-search-cache"
    : "listen-feature-search-cache";

const search = reactive({
  symbol: "",
  enable: ""
});

const addDialogVisible = ref(false);
const addSymbolLoading = ref(false);
const addSymbolOptions = ref<{ label: string; value: string }[]>([]);
const addForm = reactive({
  symbol: ""
});

const technologyDialogVisible = ref(false);
const technologyDialogTitle = ref("");
const technologySymbolId = ref<number | null>(null);
const technology = ref(createEmptyTechnology());

const strategyDialogVisible = ref(false);
const strategyDialogTitle = ref("");
const strategySymbolId = ref<number | null>(null);
const strategy = ref<StrategyItem[]>([]);

const codeDialogVisible = ref(false);
const codeDialogTitle = ref("");
const code = ref("");
const strategyIndex = ref<number | null>(null);

const baseIntervals = [
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
  { key: "macd", label: "MACD" },
  { key: "adx", label: "ADX" },
  { key: "mfi", label: "MFI" },
  { key: "obv", label: "OBV" },
  { key: "cci", label: "CCI" },
  { key: "roc", label: "ROC" },
  { key: "kdj", label: "KDJ" },
  { key: "rsi", label: "RSI" },
  { key: "kc", label: "KC" },
  { key: "boll", label: "BOLL" },
  { key: "donchian", label: "DONCHIAN" },
  { key: "atr", label: "ATR" },
  { key: "supertrend", label: "SUPERTREND" }
] as const;

const enableOptions = [
  { labelKey: "state.all", value: "" },
  { labelKey: "state.enabled", value: "1" },
  { labelKey: "state.disabled", value: "0" }
] as const;

function normalizeSearchState() {
  if (search.enable == null) search.enable = "";
}

function saveSearchCache() {
  normalizeSearchState();
  sessionStorage.setItem(searchCacheKey, JSON.stringify({ ...search }));
}

function restoreSearchCache() {
  const raw = sessionStorage.getItem(searchCacheKey);
  if (!raw) return;
  try {
    const cached = JSON.parse(raw);
    Object.assign(search, {
      symbol: cached?.symbol || "",
      enable: cached?.enable || ""
    });
  } catch {
    sessionStorage.removeItem(searchCacheKey);
  }
}

function formatTime(ts: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleString();
}

function typeText(type: string) {
  return type === "up"
    ? t(`${pageKey}.type.up`)
    : type === "down"
      ? t(`${pageKey}.type.down`)
      : "";
}

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
    "SystemStartTime",
    "MarketCondition",
    "KdjSimple",
    "IsDesc",
    "IsAsc",
    "NowPrice",
    "NowTime",
    "NowSymbolPercentChange",
    "NowSymbolClose",
    "NowSymbolOpen",
    "NowSymbolLow",
    "NowSymbolHigh",
    "FundingRate",
    "FundingRate.Data",
    "FundingRate.Time",
    "BasicTrend"
  ]);

  if (props.marketType === 1) {
    // Funding-rate and cross-market futures globals are not available in
    // the spot rule evaluation environment.
    [
      "FundingRate",
      "FundingRate.Data",
      "FundingRate.Time",
      "BasicTrend"
    ].forEach(key => keywords.delete(key));
  }

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

            if (
              ["ma", "ema", "mfi", "cci", "roc", "rsi", "atr"].includes(key)
            ) {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.Data`);
              keywords.add(`${item.name}.Data[]`);
            }

            if (key === "obv") {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Data`);
              keywords.add(`${item.name}.Data[]`);
            }

            if (key === "macd") {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.FastPeriod`);
              keywords.add(`${item.name}.SlowPeriod`);
              keywords.add(`${item.name}.SignalPeriod`);
              keywords.add(`${item.name}.DIF`);
              keywords.add(`${item.name}.DIF[]`);
              keywords.add(`${item.name}.DEA`);
              keywords.add(`${item.name}.DEA[]`);
              keywords.add(`${item.name}.Histogram`);
              keywords.add(`${item.name}.Histogram[]`);
            }

            if (key === "adx") {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.ADX`);
              keywords.add(`${item.name}.ADX[]`);
              keywords.add(`${item.name}.PlusDI`);
              keywords.add(`${item.name}.PlusDI[]`);
              keywords.add(`${item.name}.MinusDI`);
              keywords.add(`${item.name}.MinusDI[]`);
            }

            if (key === "kdj") {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.KPeriod`);
              keywords.add(`${item.name}.DPeriod`);
              keywords.add(`${item.name}.K`);
              keywords.add(`${item.name}.K[]`);
              keywords.add(`${item.name}.D`);
              keywords.add(`${item.name}.D[]`);
              keywords.add(`${item.name}.J`);
              keywords.add(`${item.name}.J[]`);
            }

            if (key === "supertrend") {
              keywords.add(`${item.name}.KlineInterval`);
              keywords.add(`${item.name}.Period`);
              keywords.add(`${item.name}.Multiplier`);
              keywords.add(`${item.name}.Data`);
              keywords.add(`${item.name}.Data[]`);
              keywords.add(`${item.name}.Trend`);
              keywords.add(`${item.name}.Trend[]`);
            }

            if (["kc", "boll", "donchian"].includes(key)) {
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
        // Keep base completion set when parse fails.
      }
    }
  }

  if (props.marketType === 2) {
    ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"].forEach(symbol => {
      keywords.add(`${symbol}.PercentChange`);
      keywords.add(`${symbol}.Close`);
      keywords.add(`${symbol}.Open`);
      keywords.add(`${symbol}.Low`);
      keywords.add(`${symbol}.High`);
    });
  }

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
    // Spot auto refresh updates live prices without replacing a form row
    // while the user is editing its rule/notification interval.
    void fetchData(props.marketType === 1);
  }, interval.value * 1000);
}

function onIntervalChange() {
  localStorage.setItem(
    props.marketType === 1
      ? "listenSpotRefreshInterval"
      : "listenFeatureRefreshInterval",
    String(interval.value)
  );
  startTimer();
}

async function fetchData(pricesOnly = false) {
  if (!pricesOnly) {
    normalizeSearchState();
    saveSearchCache();
  }
  // listLoading.value = true;
  try {
    const res = await getListenCoins({
      type: props.marketType,
      symbol: search.symbol.trim().toUpperCase() || undefined,
      enable:
        search.enable === "" || Number.isNaN(Number(search.enable))
          ? undefined
          : Number(search.enable)
    });
    const fetched = res?.data || [];
    if (pricesOnly) {
      const liveRows = new Map<number, any>(
        fetched.map((item: any) => [item.id, item])
      );
      list.value.forEach(row => {
        const latest = liveRows.get(row.id);
        if (!latest) return;
        row.close = latest.close;
        row.last_notice_time = latest.last_notice_time;
        row.last_notice_type = latest.last_notice_type;
      });
      return;
    }
    list.value = fetched.map((item: any) => ({
      ...item,
      legacyMode: item.listen_type !== "custom",
      listen_type: "custom",
      enable: savingIds.value.includes(item.id)
        ? (list.value.find(row => row.id === item.id)?.enable ??
          Number(item.enable) > 0)
        : item.listen_type !== "custom"
          ? false
          : Number(item.enable) > 0
    }));
  } finally {
    listLoading.value = false;
  }
}

function resetSearch() {
  search.symbol = "";
  search.enable = "";
  fetchData();
}

function buildRowPayload(row: ListenRow) {
  return {
    ...row,
    listen_type: "custom",
    enable: row.enable ? 1 : 0,
    notice_limit_min: Number(row.notice_limit_min || 0),
    change_percent:
      row.change_percent === "" || row.change_percent === undefined
        ? row.change_percent
        : Number(row.change_percent)
  };
}

async function saveRow(row: ListenRow) {
  try {
    await setListenCoin(row.id, buildRowPayload(row));
    ElMessage.success(t(`${pageKey}.message.updateSuccess`));
    await fetchData();
  } catch {
    ElMessage.error(t(`${pageKey}.message.updateFail`));
  }
}

async function onEnableChange(row: ListenRow) {
  if (savingIds.value.includes(row.id)) return;
  savingIds.value = [...savingIds.value, row.id];
  try {
    const result = await setListenCoin(row.id, {
      enable: row.enable ? 1 : 0,
      listen_type: "custom"
    });
    if (result?.code !== 200) throw new Error("Update rejected");
    ElMessage.success(t(`${pageKey}.message.updateSuccess`));
    await fetchData();
  } catch {
    row.enable = !row.enable;
    ElMessage.error(t(`${pageKey}.message.updateFail`));
  } finally {
    savingIds.value = savingIds.value.filter(id => id !== row.id);
  }
}

async function onDelete(row: ListenRow) {
  try {
    await ElMessageBox.confirm(
      t(`${pageKey}.confirm.delete`, { symbol: row.symbol }),
      t(`${pageKey}.confirm.title`),
      { type: "warning" }
    );
  } catch {
    return; // The user canceled the confirmation.
  }
  deletingIds.value = [...deletingIds.value, row.id];
  try {
    const result = await delListenCoin(row.id);
    if (result?.code !== 200) throw new Error("Delete rejected");
    ElMessage.success(t(`${pageKey}.message.deleteSuccess`));
    await fetchData();
  } catch {
    ElMessage.error(t(`${pageKey}.message.deleteFail`));
  } finally {
    deletingIds.value = deletingIds.value.filter(id => id !== row.id);
  }
}

async function openAddDialog() {
  addForm.symbol = "";
  addSymbolOptions.value = [];
  addDialogVisible.value = true;
  addSymbolLoading.value = true;
  try {
    const response =
      props.marketType === 1
        ? await getSpotListenSymbolOptions()
        : await getFuturesListenSymbolOptions();
    if (response?.code !== 200 || !Array.isArray(response.data)) {
      throw new Error("Listener symbol options unavailable");
    }
    addSymbolOptions.value = response.data.map((symbol: string) => ({
      label: symbol,
      value: symbol
    }));
  } catch {
    addSymbolOptions.value = [];
    ElMessage.error(t(`${pageKey}.message.symbolOptionsFail`));
  } finally {
    addSymbolLoading.value = false;
  }
}

async function onAdd() {
  const name = addForm.symbol.trim().toUpperCase();
  if (!name || !addSymbolOptions.value.some(option => option.value === name)) {
    ElMessage.warning(t(`${pageKey}.message.invalidSymbol`));
    return;
  }
  if (list.value.some(row => row.symbol === name)) {
    ElMessage.warning(t(`${pageKey}.message.symbolExists`));
    return;
  }
  dialogLoading.value = true;
  try {
    const result = await addListenCoin({
      symbol: name,
      listen_type: "custom",
      type: props.marketType,
      createTime: Date.now(),
      updateTime: Date.now()
    });
    if (result?.code !== 200) {
      throw new Error(result?.msg || "Add listener rejected");
    }
    addDialogVisible.value = false;
    ElMessage.success(t(`${pageKey}.message.addSuccess`));
    await fetchData();
  } catch {
    ElMessage.error(t(`${pageKey}.message.addFail`));
  } finally {
    dialogLoading.value = false;
  }
}

async function openTechnologyDialog(row: ListenRow) {
  technologySymbolId.value = row.id;
  technologyDialogTitle.value = `${row.symbol} ${t(`${pageKey}.button.technology`)}`;
  if (row.technology) {
    try {
      technology.value = {
        ...createEmptyTechnology(),
        ...JSON.parse(row.technology)
      };
    } catch {
      technology.value = createEmptyTechnology();
    }
  } else {
    technology.value = createEmptyTechnology();
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
        if (item.period !== undefined)
          item.period = item.period === "" ? 0 : Number(item.period);
        if (item.fast_period !== undefined)
          item.fast_period =
            item.fast_period === "" ? 0 : Number(item.fast_period);
        if (item.slow_period !== undefined)
          item.slow_period =
            item.slow_period === "" ? 0 : Number(item.slow_period);
        if (item.signal_period !== undefined)
          item.signal_period =
            item.signal_period === "" ? 0 : Number(item.signal_period);
        if (item.k_period !== undefined)
          item.k_period = item.k_period === "" ? 0 : Number(item.k_period);
        if (item.d_period !== undefined)
          item.d_period = item.d_period === "" ? 0 : Number(item.d_period);
        if (item.multiplier !== undefined)
          item.multiplier =
            item.multiplier === "" ? 0 : Number(item.multiplier);
        if (item.std_dev_multiplier !== undefined) {
          item.std_dev_multiplier =
            item.std_dev_multiplier === ""
              ? 0
              : Number(item.std_dev_multiplier);
        }
      });
    });
    const validationIssue = validateTechnologyConfig(payload);
    if (validationIssue) {
      ElMessage.error(
        t(
          `strategyTemplatePage.validation.${validationIssue.key}`,
          validationIssue.params
        )
      );
      return;
    }
    await setListenCoin(technologySymbolId.value, {
      technology: JSON.stringify(payload),
      listen_type: "custom"
    });
    ElMessage.success(t(`${pageKey}.message.actionSuccess`));
    await fetchData();
  } catch {
    ElMessage.error(t(`${pageKey}.message.actionFail`));
  } finally {
    dialogLoading.value = false;
  }
}

function addTechnologyItem(key: IndicatorKey) {
  const defaults: Record<IndicatorKey, TechnologyItem> = {
    ma: { name: "", kline_interval: "", period: 14, enable: false },
    ema: { name: "", kline_interval: "", period: 14, enable: false },
    macd: {
      name: "",
      kline_interval: "",
      fast_period: 12,
      slow_period: 26,
      signal_period: 9,
      enable: false
    },
    adx: { name: "", kline_interval: "", period: 14, enable: false },
    mfi: { name: "", kline_interval: "", period: 14, enable: false },
    obv: { name: "", kline_interval: "", enable: false },
    cci: { name: "", kline_interval: "", period: 20, enable: false },
    roc: { name: "", kline_interval: "", period: 12, enable: false },
    kdj: {
      name: "",
      kline_interval: "",
      period: 9,
      k_period: 3,
      d_period: 3,
      enable: false
    },
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
    donchian: {
      name: "",
      kline_interval: "",
      period: 20,
      enable: false
    },
    atr: { name: "", kline_interval: "", period: 14, enable: false },
    supertrend: {
      name: "",
      kline_interval: "",
      period: 10,
      multiplier: 3,
      enable: false
    }
  };
  technology.value[key] = [...technology.value[key], { ...defaults[key] }];
}

function removeTechnologyItem(key: IndicatorKey, index: number) {
  technology.value[key] = technology.value[key].filter(
    (_, idx) => idx !== index
  );
}

function openStrategyDialog(row: ListenRow) {
  strategySymbolId.value = row.id;
  strategyDialogTitle.value = `${row.symbol} ${t(`${pageKey}.button.strategy`)}`;
  if (row.strategy) {
    try {
      strategy.value = JSON.parse(row.strategy);
    } catch {
      strategy.value = [];
    }
  } else {
    strategy.value = [];
  }
  strategyDialogVisible.value = true;
}

async function confirmStrategy() {
  if (strategySymbolId.value === null) return;
  dialogLoading.value = true;
  try {
    await setListenCoin(strategySymbolId.value, {
      strategy: JSON.stringify(strategy.value),
      listen_type: "custom"
    });
    ElMessage.success(t(`${pageKey}.message.actionSuccess`));
    await fetchData();
  } catch {
    ElMessage.error(t(`${pageKey}.message.actionFail`));
  } finally {
    dialogLoading.value = false;
  }
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
  if (strategySymbolId.value === null) {
    ElMessage.error(t(`${pageKey}.message.actionFail`));
    return;
  }
  try {
    const result = await testStrategyRule(strategySymbolId.value, {
      strategy: JSON.stringify([
        {
          name: "test_strategy",
          type: "long",
          code: code.value,
          fullScreen: false,
          enable: true
        }
      ])
    });
    if (result?.code === 200) {
      ElMessage.success(
        `${t(`${pageKey}.message.testResult`)}: ${String(result?.data?.pass)}`
      );
      return;
    }
    ElMessage.error(t(`${pageKey}.message.actionFail`));
  } catch {
    ElMessage.error(t(`${pageKey}.message.actionFail`));
  }
}

onMounted(async () => {
  restoreSearchCache();
  await fetchData();
  startTimer();
});

onBeforeUnmount(() => {
  clearTimer();
});

watch(
  search,
  () => {
    saveSearchCache();
  },
  { deep: true }
);
</script>

<template>
  <div class="p-4 listen-feature-page">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-input
          v-model="search.symbol"
          :placeholder="t(`${pageKey}.placeholder.symbol`)"
          clearable
          style="width: 160px"
          @keyup.enter="fetchData()"
        />
        <el-select
          v-model="search.enable"
          clearable
          :placeholder="t(`${pageKey}.placeholder.enable`)"
          style="width: 120px"
        >
          <el-option
            v-for="item in enableOptions"
            :key="item.value"
            :label="t(`${pageKey}.${item.labelKey}`)"
            :value="item.value"
          />
        </el-select>
        <el-button type="primary" :loading="listLoading" @click="fetchData()">{{
          t(`${pageKey}.button.search`)
        }}</el-button>
        <el-button type="primary" @click="openAddDialog">{{
          t(`${pageKey}.button.add`)
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
        <span>{{ t(`${pageKey}.label.refreshInterval`) }}</span>
      </div>
    </div>

    <el-table
      v-loading="listLoading"
      :data="list"
      border
      size="small"
      highlight-current-row
    >
      <el-table-column
        prop="symbol"
        :label="t(`${pageKey}.table.symbol`)"
        align="center"
        min-width="120"
      />
      <el-table-column
        prop="close"
        :label="t(`${pageKey}.table.currentPrice`)"
        align="center"
        min-width="140"
      >
        <template #default="{ row }">
          {{ row.close && Number(row.close) > 0 ? row.close : "—" }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.technology`)"
        align="center"
        width="120"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openTechnologyDialog(row)"
            >{{ t(`${pageKey}.button.technology`) }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.strategy`)"
        align="center"
        width="110"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openStrategyDialog(row)"
            >{{ t(`${pageKey}.button.strategy`) }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.noticeLimit`)"
        align="center"
        width="130"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.notice_limit_min"
            size="small"
            @blur="saveRow(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.lastNotice`)"
        align="center"
        min-width="220"
      >
        <template #default="{ row }">
          {{ row.last_notice_time ? formatTime(row.last_notice_time) : "" }}
          {{ typeText(row.last_notice_type) }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.enable`)"
        :fixed="props.marketType === 1 ? 'right' : undefined"
        align="center"
        width="90"
      >
        <template #default="{ row }">
          <el-switch
            v-model="row.enable"
            :loading="savingIds.includes(row.id)"
            :disabled="savingIds.includes(row.id)"
            @change="onEnableChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t(`${pageKey}.table.operation`)"
        :fixed="props.marketType === 1 ? 'right' : undefined"
        align="center"
        width="100"
      >
        <template #default="{ row }">
          <el-button
            type="danger"
            size="small"
            :loading="deletingIds.includes(row.id)"
            :disabled="deletingIds.includes(row.id)"
            @click="onDelete(row)"
            >{{ t(`${pageKey}.button.delete`) }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="addDialogVisible"
      :title="t(`${pageKey}.dialog.addTitle`)"
      width="520px"
    >
      <div class="grid gap-4">
        <el-select-v2
          v-model="addForm.symbol"
          :options="addSymbolOptions"
          :loading="addSymbolLoading"
          :placeholder="t(`${pageKey}.placeholder.selectSymbol`)"
          filterable
          clearable
          style="width: 100%"
        />
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">{{
          t(`${pageKey}.button.cancel`)
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          :disabled="
            addSymbolLoading ||
            !addForm.symbol ||
            !addSymbolOptions.some(option => option.value === addForm.symbol)
          "
          @click="onAdd"
          >{{ t(`${pageKey}.button.save`) }}</el-button
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
          <div class="indicator-toolbar">
            <el-button
              class="indicator-add-button"
              type="primary"
              @click="addTechnologyItem(tab.key)"
              >{{ t(`${pageKey}.button.add`) }}</el-button
            >
            <span
              class="indicator-description"
              :title="
                t(`strategyTemplatePage.technology.description.${tab.key}`)
              "
              >{{
                t(`strategyTemplatePage.technology.description.${tab.key}`)
              }}</span
            >
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
                    v-for="item in baseIntervals"
                    :key="item"
                    :label="item"
                    :value="item"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key !== 'macd' && tab.key !== 'obv'"
              :label="t('strategyTemplatePage.technology.period')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.fastPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.fast_period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.slowPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.slow_period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.signalPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.signal_period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kdj'"
              :label="t('strategyTemplatePage.technology.kPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.k_period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kdj'"
              :label="t('strategyTemplatePage.technology.dPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }"
                ><el-input v-model="row.d_period" size="small"
              /></template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kc' || tab.key === 'supertrend'"
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
              :label="t(`${pageKey}.table.operation`)"
              align="center"
              width="110"
            >
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  size="small"
                  @click="removeTechnologyItem(tab.key, $index)"
                  >{{ t(`${pageKey}.button.delete`) }}</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="technologyDialogVisible = false">{{
          t(`${pageKey}.button.cancel`)
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmTechnology"
          >{{ t(`${pageKey}.button.confirm`) }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="strategyDialogVisible"
      :title="strategyDialogTitle"
      width="78%"
    >
      <div class="mb-2">
        <el-button type="primary" @click="addStrategy">{{
          t(`${pageKey}.button.add`)
        }}</el-button>
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
          width="140"
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
          :label="t(`${pageKey}.table.operation`)"
          align="center"
          width="110"
        >
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="removeStrategy($index)"
              >{{ t(`${pageKey}.button.delete`) }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="strategyDialogVisible = false">{{
          t(`${pageKey}.button.cancel`)
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmStrategy"
          >{{ t(`${pageKey}.button.confirm`) }}</el-button
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
            t(`${pageKey}.button.test`)
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
.listen-feature-page :deep(.el-dialog__body) {
  padding-top: 12px;
}

.indicator-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  margin-bottom: 8px;
}

.indicator-add-button {
  flex: 0 0 auto;
}

.indicator-description {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

@media (width <= 640px) {
  .indicator-toolbar {
    gap: 6px;
  }

  .indicator-description {
    font-size: 11px;
    line-height: 18px;
  }
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
