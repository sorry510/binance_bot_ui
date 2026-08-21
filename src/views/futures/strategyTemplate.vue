<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import {
  addData,
  delData,
  editData,
  getAIGenerationTask,
  getList,
  importAIGeneratedData,
  importData,
  startAIGeneration,
  testStrategyRule,
  type StrategyTemplateAIGenerationTask
} from "../../api/strategyTemplate";
import {
  buildTemplateJsonEditorExtensions,
  codeMirrorBasicSetup
} from "../../utils/codemirror";
import { validateTechnologyConfig } from "../../utils/technology";

defineOptions({ name: "strategyTemplate" });
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
  type: "long" | "short" | "close_long" | "close_short" | "";
  code: string;
  fullScreen: boolean;
  enable: boolean;
}

interface TemplateRow {
  id: number;
  name: string;
  technology?: string;
  strategy?: string;
  nameSaving?: boolean;
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

const list = ref<TemplateRow[]>([]);
const total = ref(0);
const listLoading = ref(false);
const dialogLoading = ref(false);
const importLoading = ref(false);
const originalTemplateNames = new Map<number, string>();
const query = reactive({ page: 1, limit: 20 });

const createDialogVisible = ref(false);
const createForm = reactive({ name: "" });

const importDialogVisible = ref(false);
const importJson = ref("");

const aiDialogVisible = ref(false);
const aiPrompt = ref("");
const aiGeneratedJson = ref("");
const aiValidationError = ref("");
const aiImportLoading = ref(false);
const aiTask = ref<StrategyTemplateAIGenerationTask | null>(null);
let aiProgressTimer: ReturnType<typeof setTimeout> | undefined;
let aiProgressPollFailures = 0;

const jsonDialogVisible = ref(false);
const jsonDialogTitle = ref("");
const jsonPreview = ref("");

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

const codeBasicSetup = codeMirrorBasicSetup;
const importJsonEditorExtensions = buildTemplateJsonEditorExtensions();
const jsonPreviewEditorExtensions = [
  ...buildTemplateJsonEditorExtensions(),
  EditorState.readOnly.of(true),
  EditorView.editable.of(false)
];
const aiGenerationRunning = computed(() =>
  ["queued", "running"].includes(aiTask.value?.status || "")
);
const aiProgressEvents = computed(() =>
  [...(aiTask.value?.events || [])].reverse()
);

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
    "KdjSimple",
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
        // Ignore invalid json from server and keep base keywords.
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

async function fetchData() {
  listLoading.value = true;
  try {
    const res = await getList({ page: query.page, limit: query.limit });
    const data = res?.data || {};
    list.value = (data.list || []).map((item: TemplateRow) => ({
      ...item,
      nameSaving: false
    }));
    total.value = Number(data.total || 0);

    if (list.value.length === 0 && total.value > 0 && query.page > 1) {
      query.page -= 1;
      await fetchData();
      return;
    }

    originalTemplateNames.clear();
    list.value.forEach(item => originalTemplateNames.set(item.id, item.name));
  } finally {
    listLoading.value = false;
  }
}

async function saveTemplateName(row: TemplateRow) {
  if (row.nameSaving) return;

  const originalName = originalTemplateNames.get(row.id) ?? row.name;
  const name = row.name.trim();
  if (!name) {
    row.name = originalName;
    ElMessage.error(t("strategyTemplatePage.message.nameRequired"));
    return;
  }
  if (name === originalName) {
    row.name = name;
    return;
  }

  row.nameSaving = true;
  try {
    await editData(row.id, { name });
    row.name = name;
    originalTemplateNames.set(row.id, name);
    ElMessage.success(t("strategyTemplatePage.message.saveSuccess"));
  } catch (error) {
    row.name = originalName;
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
  } finally {
    row.nameSaving = false;
  }
}

function openCreateDialog() {
  createForm.name = "";
  createDialogVisible.value = true;
}

async function createTemplate() {
  if (!createForm.name.trim()) return;
  dialogLoading.value = true;
  try {
    await addData({ name: createForm.name.trim() });
    ElMessage.success(t("strategyTemplatePage.message.saveSuccess"));
    createDialogVisible.value = false;
    query.page = 1;
    await fetchData();
  } finally {
    dialogLoading.value = false;
  }
}

function createImportJsonTemplate() {
  return JSON.stringify(
    {
      name: "",
      technology: createEmptyTechnology(),
      strategy: []
    },
    null,
    2
  );
}

function openImportDialog() {
  importJson.value = createImportJsonTemplate();
  importDialogVisible.value = true;
}

function parseStoredTemplateJson(value: string | undefined, fallback: unknown) {
  if (!value || value.trim() === "" || value.trim() === "null") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function openJsonDialog(row: TemplateRow) {
  jsonDialogTitle.value = t("strategyTemplatePage.dialog.jsonTitle", {
    name: row.name
  });
  jsonPreview.value = JSON.stringify(
    {
      name: row.name,
      technology: parseStoredTemplateJson(row.technology, {}),
      strategy: parseStoredTemplateJson(row.strategy, [])
    },
    null,
    2
  );
  jsonDialogVisible.value = true;
}

function getImportErrorMessage(error: unknown) {
  const requestError = error as {
    message?: string;
    response?: { data?: { msg?: string } };
  };
  return (
    requestError?.response?.data?.msg ||
    requestError?.message ||
    t("strategyTemplatePage.message.importFail")
  );
}

function openAIGenerationDialog() {
  clearAIProgressTimer();
  if (!aiTask.value || aiTask.value.imported) {
    aiPrompt.value = "";
    aiGeneratedJson.value = "";
    aiValidationError.value = "";
    aiTask.value = null;
    aiProgressPollFailures = 0;
  }
  aiDialogVisible.value = true;
  if (aiGenerationRunning.value) {
    scheduleAIProgressPoll(0);
  }
}

async function generateTemplateWithAI() {
  const prompt = aiPrompt.value.trim();
  if (!prompt) {
    aiValidationError.value = t("strategyTemplatePage.ai.promptRequired");
    return;
  }

  clearAIProgressTimer();
  try {
    const res = await startAIGeneration({
      prompt,
      previousJson: aiGeneratedJson.value || undefined,
      validationError: aiValidationError.value || undefined,
      conversationId: aiTask.value?.taskId
    });
    if (Number(res?.code) !== 200 || !res?.data?.taskId) {
      throw new Error(res?.msg || t("strategyTemplatePage.ai.generateFailed"));
    }
    aiValidationError.value = "";
    aiTask.value = res.data as StrategyTemplateAIGenerationTask;
    aiProgressPollFailures = 0;
    scheduleAIProgressPoll(0);
  } catch (error) {
    aiValidationError.value = getImportErrorMessage(error);
  }
}

function scheduleAIProgressPoll(delay: number) {
  clearAIProgressTimer();
  aiProgressTimer = setTimeout(() => {
    void pollAIGenerationProgress();
  }, delay);
}

async function pollAIGenerationProgress() {
  const taskId = aiTask.value?.taskId;
  if (!taskId) return;

  try {
    const res = await getAIGenerationTask(taskId);
    if (Number(res?.code) !== 200 || !res?.data) {
      throw new Error(res?.msg || t("strategyTemplatePage.ai.progressFailed"));
    }
    const task = res.data as StrategyTemplateAIGenerationTask;
    aiTask.value = task;
    aiProgressPollFailures = 0;

    if (task.status === "succeeded") {
      aiGeneratedJson.value = task.json || "";
      aiValidationError.value = task.validationError || "";
      if (task.validationError) {
        ElMessage.warning(t("strategyTemplatePage.ai.generatedWithError"));
      } else {
        ElMessage.success(t("strategyTemplatePage.ai.generated"));
      }
      return;
    }
    if (task.status === "failed") {
      if (task.json) {
        aiGeneratedJson.value = task.json;
      }
      aiValidationError.value =
        task.error ||
        task.validationError ||
        t("strategyTemplatePage.ai.generateFailed");
      return;
    }
    scheduleAIProgressPoll(1000);
  } catch (error) {
    aiProgressPollFailures++;
    if (aiProgressPollFailures < 3) {
      scheduleAIProgressPoll(1500);
      return;
    }
    aiValidationError.value = getImportErrorMessage(error);
    if (aiTask.value) {
      aiTask.value = {
        ...aiTask.value,
        status: "failed",
        stage: "failed",
        progress: 100,
        error: aiValidationError.value
      };
    }
  }
}

async function importAIGeneratedTemplate() {
  if (!aiGeneratedJson.value.trim()) {
    aiValidationError.value = t("strategyTemplatePage.message.importRequired");
    return;
  }

  const taskId = aiTask.value?.taskId;
  if (!taskId) {
    aiValidationError.value = t("strategyTemplatePage.ai.taskRequired");
    return;
  }

  aiImportLoading.value = true;
  aiValidationError.value = "";
  try {
    const res = await importAIGeneratedData(taskId, aiGeneratedJson.value);
    if (Number(res?.code) !== 200) {
      aiValidationError.value =
        res?.msg || t("strategyTemplatePage.message.importFail");
      await syncAITaskAfterImportFailure(taskId);
      return;
    }

    const templateName = res?.data?.template?.name || "";
    const messageKey =
      res?.data?.action === "updated"
        ? "strategyTemplatePage.message.importUpdated"
        : "strategyTemplatePage.message.importCreated";
    ElMessage.success(t(messageKey, { name: templateName }));
    if (aiTask.value) {
      aiTask.value = { ...aiTask.value, imported: true };
    }
    aiDialogVisible.value = false;
    clearAIProgressTimer();
    query.page = 1;
    await fetchData();
  } catch (error) {
    aiValidationError.value = getImportErrorMessage(error);
    await syncAITaskAfterImportFailure(taskId);
  } finally {
    aiImportLoading.value = false;
  }
}

async function syncAITaskAfterImportFailure(taskId: string) {
  try {
    const res = await getAIGenerationTask(taskId);
    if (Number(res?.code) === 200 && res?.data) {
      aiTask.value = res.data as StrategyTemplateAIGenerationTask;
    }
  } catch {
    // Keep the import error visible even if progress synchronization fails.
  }
}

function aiProgressStageLabel(stage: string) {
  const key = `strategyTemplatePage.ai.stage.${stage}`;
  const translated = t(key);
  return translated === key ? stage : translated;
}

function formatAIProgressTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString();
}

function clearAIProgressTimer() {
  if (aiProgressTimer !== undefined) {
    clearTimeout(aiProgressTimer);
    aiProgressTimer = undefined;
  }
}

function onAIDialogClosed() {
  clearAIProgressTimer();
}

async function submitImportJson() {
  if (!importJson.value.trim()) {
    ElMessage.error(t("strategyTemplatePage.message.importRequired"));
    return;
  }

  importLoading.value = true;
  try {
    const res = await importData(importJson.value);
    if (Number(res?.code) !== 200) {
      ElMessage.error(res?.msg || t("strategyTemplatePage.message.importFail"));
      return;
    }

    const templateName = res?.data?.template?.name || "";
    const messageKey =
      res?.data?.action === "updated"
        ? "strategyTemplatePage.message.importUpdated"
        : "strategyTemplatePage.message.importCreated";
    ElMessage.success(t(messageKey, { name: templateName }));
    importDialogVisible.value = false;
    query.page = 1;
    await fetchData();
  } catch (error) {
    ElMessage.error(getImportErrorMessage(error));
  } finally {
    importLoading.value = false;
  }
}

async function onDelete(row: TemplateRow) {
  await ElMessageBox.confirm(
    t("strategyTemplatePage.confirm.delete", { name: row.name }),
    t("strategyTemplatePage.confirm.title"),
    { type: "warning" }
  );
  try {
    await delData(row.id);
    ElMessage.success(t("strategyTemplatePage.message.deleteSuccess"));
    await fetchData();
  } catch (error) {
    ElMessage.error(t("strategyTemplatePage.message.deleteFail"));
  }
}

function openTechnologyDialog(row: TemplateRow) {
  technologySymbolId.value = row.id;
  technologyDialogTitle.value = `${row.name} ${t("strategyTemplatePage.button.technology")}`;
  technology.value = createEmptyTechnology();
  if (row.technology) {
    try {
      technology.value = {
        ...createEmptyTechnology(),
        ...JSON.parse(row.technology)
      };
    } catch (error) {
      technology.value = createEmptyTechnology();
    }
  }
  technologyDialogVisible.value = true;
}

function openStrategyDialog(row: TemplateRow) {
  strategySymbolId.value = row.id;
  strategyDialogTitle.value = `${row.name} ${t("strategyTemplatePage.button.strategy")}`;
  if (row.strategy) {
    try {
      strategy.value = JSON.parse(row.strategy);
    } catch (error) {
      strategy.value = [];
    }
  } else {
    strategy.value = [];
  }
  strategyDialogVisible.value = true;
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
    await editData(technologySymbolId.value, {
      technology: JSON.stringify(payload)
    });
    ElMessage.success(t("strategyTemplatePage.message.actionSuccess"));
    await fetchData();
  } catch (error) {
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
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

async function confirmStrategy() {
  if (strategySymbolId.value === null) return;
  dialogLoading.value = true;
  try {
    await editData(strategySymbolId.value, {
      strategy: JSON.stringify(strategy.value)
    });
    ElMessage.success(t("strategyTemplatePage.message.actionSuccess"));
    await fetchData();
  } catch (error) {
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
  } finally {
    dialogLoading.value = false;
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

function onCodeChange(value: string) {
  code.value = value;
  if (strategyIndex.value !== null && strategy.value[strategyIndex.value]) {
    strategy.value[strategyIndex.value].code = value;
  }
}

async function onTestStrategyRule() {
  if (strategySymbolId.value === null) {
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
    return;
  }

  try {
    const testStrategy = JSON.stringify([
      {
        name: "test_strategy",
        type: "long",
        code: code.value,
        fullScreen: false,
        enable: true
      }
    ]);

    const find = list.value.find(item => item.id === strategySymbolId.value);
    const technologyRaw = find?.technology || JSON.stringify(technology.value);
    const res = await testStrategyRule("BTCUSDT", {
      strategy: testStrategy,
      technology: technologyRaw
    });
    if (res?.code === 200) {
      ElMessage.success(
        `${t("strategyTemplatePage.message.testResult")}: ${String(res?.data?.pass)}`
      );
      return;
    }
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
  } catch (error) {
    ElMessage.error(t("strategyTemplatePage.message.actionFail"));
  }
}

onMounted(fetchData);
onBeforeUnmount(clearAIProgressTimer);
</script>

<template>
  <div class="p-4 strategy-template-page">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="success" @click="openCreateDialog">{{
        t("strategyTemplatePage.button.add")
      }}</el-button>
      <el-button
        type="warning"
        :loading="importLoading"
        @click="openImportDialog"
        >{{ t("strategyTemplatePage.button.importJson") }}</el-button
      >
      <el-button type="primary" @click="openAIGenerationDialog">
        {{ t("strategyTemplatePage.button.aiGenerate") }}
      </el-button>
      <el-button type="primary" :loading="listLoading" @click="fetchData">{{
        t("strategyTemplatePage.button.refresh")
      }}</el-button>
    </div>

    <el-table
      v-loading="listLoading"
      :data="list"
      border
      size="small"
      highlight-current-row
    >
      <el-table-column
        :label="t('strategyTemplatePage.table.name')"
        align="center"
        min-width="220"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.name"
            size="small"
            :disabled="row.nameSaving"
            @blur="saveTemplateName(row)"
            @keyup.enter="saveTemplateName(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('strategyTemplatePage.table.technology')"
        align="center"
        width="140"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openTechnologyDialog(row)"
            >{{ t("strategyTemplatePage.button.technology") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('strategyTemplatePage.table.strategy')"
        align="center"
        width="120"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openStrategyDialog(row)"
            >{{ t("strategyTemplatePage.button.strategy") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('strategyTemplatePage.table.json')"
        align="center"
        width="100"
      >
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="openJsonDialog(row)">
            {{ t("strategyTemplatePage.button.viewJson") }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('strategyTemplatePage.table.operation')"
        align="center"
        width="110"
      >
        <template #default="{ row }">
          <el-button type="danger" size="small" @click="onDelete(row)">{{
            t("strategyTemplatePage.button.delete")
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3 flex justify-end">
      <el-pagination
        :current-page="query.page"
        :page-size="query.limit"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next"
        @current-change="
          page => {
            query.page = page;
            fetchData();
          }
        "
        @size-change="
          size => {
            query.limit = size;
            query.page = 1;
            fetchData();
          }
        "
      />
    </div>

    <el-dialog
      v-model="createDialogVisible"
      :title="t('strategyTemplatePage.dialog.addTitle')"
      width="500px"
    >
      <el-form label-width="120px">
        <el-form-item :label="t('strategyTemplatePage.table.name')">
          <el-input
            v-model="createForm.name"
            :placeholder="t('strategyTemplatePage.placeholder.name')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">{{
          t("strategyTemplatePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="createTemplate"
          >{{ t("strategyTemplatePage.button.confirm") }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      :title="t('strategyTemplatePage.dialog.importTitle')"
      width="80%"
      destroy-on-close
    >
      <div class="import-json-editor">
        <Codemirror
          v-model="importJson"
          :extensions="importJsonEditorExtensions"
          :basic-setup="codeBasicSetup"
          :style="{ height: '65vh' }"
          :indent-with-tab="true"
          :tab-size="2"
        />
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">{{
          t("strategyTemplatePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="importLoading"
          @click="submitImportJson"
          >{{ t("strategyTemplatePage.button.confirm") }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="jsonDialogVisible"
      :title="jsonDialogTitle"
      width="80%"
      destroy-on-close
    >
      <div class="json-preview-editor">
        <Codemirror
          :model-value="jsonPreview"
          :extensions="jsonPreviewEditorExtensions"
          :basic-setup="codeBasicSetup"
          :style="{ height: '65vh' }"
          :tab-size="2"
        />
      </div>
      <template #footer>
        <el-button type="primary" @click="jsonDialogVisible = false">
          {{ t("strategyTemplatePage.button.close") }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="aiDialogVisible"
      :title="t('strategyTemplatePage.ai.title')"
      width="82%"
      destroy-on-close
      :close-on-click-modal="!aiGenerationRunning"
      @closed="onAIDialogClosed"
    >
      <div class="ai-generation-dialog">
        <div class="ai-prompt-row">
          <el-input
            v-model="aiPrompt"
            type="textarea"
            :rows="5"
            maxlength="12288"
            show-word-limit
            :disabled="aiGenerationRunning"
            :placeholder="t('strategyTemplatePage.ai.promptPlaceholder')"
          />
          <div class="ai-generate-actions">
            <el-button
              type="primary"
              :loading="aiGenerationRunning"
              @click="generateTemplateWithAI"
            >
              {{
                aiGeneratedJson
                  ? t("strategyTemplatePage.ai.regenerate")
                  : t("strategyTemplatePage.ai.generate")
              }}
            </el-button>
          </div>
        </div>

        <div v-if="aiTask" class="ai-progress-panel">
          <div v-if="aiTask.maxRounds" class="ai-progress-round">
            {{
              t("strategyTemplatePage.ai.round", {
                round: aiTask.round || 0,
                maxRounds: aiTask.maxRounds
              })
            }}
          </div>
          <el-progress
            :percentage="aiTask.progress || 0"
            :status="aiTask.status === 'failed' ? 'exception' : undefined"
          />
          <el-scrollbar max-height="180px" class="ai-progress-log">
            <div
              v-for="(event, index) in aiProgressEvents"
              :key="`${event.time}-${index}`"
              class="ai-progress-event"
            >
              <span class="ai-progress-time">{{
                formatAIProgressTime(event.time)
              }}</span>
              <span class="ai-progress-stage">{{
                aiProgressStageLabel(event.stage)
              }}</span>
              <span class="ai-progress-percent">{{ event.progress }}%</span>
              <span class="ai-progress-tool">
                <el-tag v-if="event.tool" size="small" type="info">
                  {{ event.tool }}
                </el-tag>
                <span v-else class="ai-progress-tool-empty">—</span>
              </span>
              <span class="ai-progress-message">{{ event.message }}</span>
            </div>
          </el-scrollbar>
        </div>

        <div v-if="aiGeneratedJson" class="ai-json-section">
          <div class="ai-section-title">
            {{ t("strategyTemplatePage.ai.jsonTitle") }}
          </div>
          <div class="import-json-editor">
            <Codemirror
              v-model="aiGeneratedJson"
              :extensions="importJsonEditorExtensions"
              :basic-setup="codeBasicSetup"
              :style="{ height: '42vh' }"
              :indent-with-tab="true"
              :tab-size="2"
            />
          </div>
        </div>

        <el-alert
          v-if="aiValidationError"
          class="ai-validation-error"
          type="error"
          :closable="false"
          show-icon
          :title="t('strategyTemplatePage.ai.errorTitle')"
        >
          <template #default>
            <div class="ai-validation-error-text">
              {{ aiValidationError }}
            </div>
          </template>
        </el-alert>
      </div>
      <template #footer>
        <el-button :disabled="aiImportLoading" @click="aiDialogVisible = false">
          {{ t("strategyTemplatePage.button.cancel") }}
        </el-button>
        <el-button
          type="success"
          :loading="aiImportLoading"
          :disabled="!aiGeneratedJson || aiGenerationRunning"
          @click="importAIGeneratedTemplate"
        >
          {{ t("strategyTemplatePage.button.importJson") }}
        </el-button>
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
              >{{ t("strategyTemplatePage.button.add") }}</el-button
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
              <template #default="{ row }">
                <el-input v-model="row.name" size="small" />
              </template>
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
              v-if="tab.key !== 'macd' && tab.key !== 'obv'"
              :label="t('strategyTemplatePage.technology.period')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.fastPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.fast_period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.slowPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.slow_period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'macd'"
              :label="t('strategyTemplatePage.technology.signalPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.signal_period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kdj'"
              :label="t('strategyTemplatePage.technology.kPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.k_period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kdj'"
              :label="t('strategyTemplatePage.technology.dPeriod')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.d_period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kc' || tab.key === 'supertrend'"
              :label="t('strategyTemplatePage.technology.multiplier')"
              align="center"
              width="130"
            >
              <template #default="{ row }">
                <el-input v-model="row.multiplier" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'boll'"
              :label="t('strategyTemplatePage.technology.stdDevMultiplier')"
              align="center"
              width="160"
            >
              <template #default="{ row }">
                <el-input v-model="row.std_dev_multiplier" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              :label="t('strategyTemplatePage.technology.enable')"
              align="center"
              width="110"
            >
              <template #default="{ row }">
                <el-switch v-model="row.enable" />
              </template>
            </el-table-column>
            <el-table-column
              :label="t('strategyTemplatePage.table.operation')"
              align="center"
              width="110"
            >
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  size="small"
                  @click="removeTechnologyItem(tab.key, $index)"
                  >{{ t("strategyTemplatePage.button.delete") }}</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="technologyDialogVisible = false">{{
          t("strategyTemplatePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmTechnology"
          >{{ t("strategyTemplatePage.button.confirm") }}</el-button
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
          t("strategyTemplatePage.button.add")
        }}</el-button>
      </div>
      <el-table :data="strategy" border size="small" style="width: 100%">
        <el-table-column
          :label="t('strategyTemplatePage.strategy.name')"
          align="center"
          width="260"
        >
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" />
          </template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.code')"
          align="center"
        >
          <template #default="{ row }">
            <el-input
              v-model="row.code"
              type="textarea"
              :rows="6"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.strategy.fullScreen')"
          align="center"
          width="120"
        >
          <template #default="{ row, $index }">
            <el-switch
              v-model="row.fullScreen"
              @change="fullCodeScreenChange(row, $index)"
            />
          </template>
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
          <template #default="{ row }">
            <el-switch v-model="row.enable" />
          </template>
        </el-table-column>
        <el-table-column
          :label="t('strategyTemplatePage.table.operation')"
          align="center"
          width="110"
        >
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="removeStrategy($index)"
              >{{ t("strategyTemplatePage.button.delete") }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="strategyDialogVisible = false">{{
          t("strategyTemplatePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmStrategy"
          >{{ t("strategyTemplatePage.button.confirm") }}</el-button
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
            t("strategyTemplatePage.button.test")
          }}</el-button>
        </div>
        <Codemirror
          v-model="code"
          :extensions="codeEditorExtensions"
          :basic-setup="codeBasicSetup"
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
.strategy-template-page :deep(.el-dialog__body) {
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

.import-json-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.import-json-editor :deep(.cm-editor) {
  height: 100%;
}

.json-preview-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.json-preview-editor :deep(.cm-editor) {
  height: 100%;
}

.ai-generation-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-generate-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.ai-progress-panel {
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.ai-progress-round {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.ai-progress-log {
  margin-top: 10px;
  font-family: monospace;
  font-size: 12px;
}

.ai-progress-event {
  display: grid;
  grid-template-columns: 90px 150px 52px 205px minmax(0, 1fr);
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.ai-progress-time,
.ai-progress-percent {
  color: var(--el-text-color-secondary);
}

.ai-progress-percent {
  text-align: right;
}

.ai-progress-tool {
  min-width: 0;
}

.ai-progress-tool :deep(.el-tag) {
  max-width: 100%;
  font-family: monospace;
}

.ai-progress-tool-empty {
  color: var(--el-text-color-placeholder);
}

.ai-progress-message {
  color: var(--el-text-color-regular);
  word-break: break-word;
  white-space: normal;
}

.ai-section-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.ai-validation-error {
  align-items: flex-start;
}

.ai-validation-error-text {
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
