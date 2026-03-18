<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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
  setListenCoin,
  testStrategyRule
} from "../../api/listenCoin";
import { codeMirrorBasicSetup } from "../../utils/codemirror";

defineOptions({ name: "listenFeature" });
const { t } = useI18n();

type IndicatorKey = "ma" | "ema" | "rsi" | "kc" | "boll" | "atr";

interface TechnologyItem {
  name: string;
  kline_interval: string;
  period: number | string;
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
  listen_type: "kline_base" | "kline_kc" | "custom";
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
    rsi: [] as TechnologyItem[],
    kc: [] as TechnologyItem[],
    boll: [] as TechnologyItem[],
    atr: [] as TechnologyItem[]
  };
}

const listLoading = ref(false);
const dialogLoading = ref(false);
const list = ref<ListenRow[]>([]);

const addDialogVisible = ref(false);
const addForm = reactive({
  symbol: "",
  listen_type: "kline_base" as "kline_base" | "kline_kc" | "custom"
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
const kcIntervals = ["15m", "1h", "4h", "1d", "3d", "1w"];

const indicatorTabs = [
  { key: "ma", label: "MA" },
  { key: "ema", label: "EMA" },
  { key: "rsi", label: "RSI" },
  { key: "kc", label: "KC" },
  { key: "boll", label: "BOLL" },
  { key: "atr", label: "ATR" }
] as const;

function formatTime(ts: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleString();
}

function typeText(type: string) {
  return type === "up"
    ? t("listenFeaturePage.type.up")
    : type === "down"
      ? t("listenFeaturePage.type.down")
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
    "Kdj",
    "IsDesc",
    "IsAsc",
    "NowPrice",
    "NowTime",
    "NowSymbolPercentChange",
    "NowSymbolClose",
    "NowSymbolOpen",
    "NowSymbolLow",
    "NowSymbolHigh",
    "BasicTrend"
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
        // Keep base completion set when parse fails.
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
    const res = await getListenCoins({ type: 2 });
    list.value = (res?.data || []).map((item: any) => ({
      ...item,
      enable: Number(item.enable) > 0
    }));
  } finally {
    listLoading.value = false;
  }
}

function buildRowPayload(row: ListenRow) {
  return {
    ...row,
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
    ElMessage.success(t("listenFeaturePage.message.updateSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("listenFeaturePage.message.updateFail"));
  }
}

async function onDelete(row: ListenRow) {
  await ElMessageBox.confirm(
    t("listenFeaturePage.confirm.delete", { symbol: row.symbol }),
    t("listenFeaturePage.confirm.title"),
    {
      type: "warning"
    }
  );
  try {
    await delListenCoin(row.id);
    ElMessage.success(t("listenFeaturePage.message.deleteSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("listenFeaturePage.message.deleteFail"));
  }
}

function openAddDialog() {
  addForm.symbol = "";
  addForm.listen_type = "kline_base";
  addDialogVisible.value = true;
}

async function onAdd() {
  dialogLoading.value = true;
  try {
    await addListenCoin({
      symbol: addForm.symbol.trim().toUpperCase(),
      listen_type: addForm.listen_type,
      type: 2,
      createTime: Date.now(),
      updateTime: Date.now()
    });
    addDialogVisible.value = false;
    ElMessage.success(t("listenFeaturePage.message.addSuccess"));
    await fetchData();
  } finally {
    dialogLoading.value = false;
  }
}

async function openTechnologyDialog(row: ListenRow) {
  technologySymbolId.value = row.id;
  technologyDialogTitle.value = `${row.symbol} ${t("listenFeaturePage.button.technology")}`;
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
    await setListenCoin(technologySymbolId.value, {
      technology: JSON.stringify(payload)
    });
    ElMessage.success(t("listenFeaturePage.message.actionSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("listenFeaturePage.message.actionFail"));
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

function openStrategyDialog(row: ListenRow) {
  strategySymbolId.value = row.id;
  strategyDialogTitle.value = `${row.symbol} ${t("listenFeaturePage.button.strategy")}`;
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
      strategy: JSON.stringify(strategy.value)
    });
    ElMessage.success(t("listenFeaturePage.message.actionSuccess"));
    await fetchData();
  } catch {
    ElMessage.error(t("listenFeaturePage.message.actionFail"));
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
    ElMessage.error(t("listenFeaturePage.message.actionFail"));
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
        `${t("listenFeaturePage.message.testResult")}: ${String(result?.data?.pass)}`
      );
      return;
    }
    ElMessage.error(t("listenFeaturePage.message.actionFail"));
  } catch {
    ElMessage.error(t("listenFeaturePage.message.actionFail"));
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4 listen-feature-page">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="openAddDialog">{{
        t("listenFeaturePage.button.add")
      }}</el-button>
      <el-button :loading="listLoading" @click="fetchData">{{
        t("listenFeaturePage.button.refresh")
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
        prop="symbol"
        :label="t('listenFeaturePage.table.symbol')"
        align="center"
        min-width="120"
      />
      <el-table-column
        :label="t('listenFeaturePage.table.technology')"
        align="center"
        width="120"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openTechnologyDialog(row)"
            >{{ t("listenFeaturePage.button.technology") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.strategy')"
        align="center"
        width="110"
      >
        <template #default="{ row }">
          <el-button
            type="success"
            size="small"
            @click="openStrategyDialog(row)"
            >{{ t("listenFeaturePage.button.strategy") }}</el-button
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.listenType')"
        align="center"
        width="130"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.listen_type"
            size="small"
            @change="saveRow(row)"
          >
            <el-option label="kline_base" value="kline_base" />
            <el-option label="kline_kc" value="kline_kc" />
            <el-option label="custom" value="custom" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.klineInterval')"
        align="center"
        width="120"
      >
        <template #default="{ row }">
          <el-select
            v-if="row.listen_type === 'kline_base'"
            v-model="row.kline_interval"
            size="small"
            @change="saveRow(row)"
          >
            <el-option
              v-for="item in baseIntervals"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
          <el-select
            v-else-if="row.listen_type === 'kline_kc'"
            v-model="row.kline_interval"
            size="small"
            @change="saveRow(row)"
          >
            <el-option
              v-for="item in kcIntervals"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.changePercent')"
        align="center"
        width="130"
      >
        <template #default="{ row }">
          <el-input
            v-if="row.listen_type === 'kline_base'"
            v-model="row.change_percent"
            size="small"
            @blur="saveRow(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.noticeLimit')"
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
        :label="t('listenFeaturePage.table.lastNotice')"
        align="center"
        min-width="220"
      >
        <template #default="{ row }">
          {{ row.last_notice_time ? formatTime(row.last_notice_time) : "" }}
          {{ typeText(row.last_notice_type) }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.enable')"
        align="center"
        width="90"
      >
        <template #default="{ row }">
          <el-switch v-model="row.enable" @change="saveRow(row)" />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.operation')"
        align="center"
        width="90"
      >
        <template #default="{ row }">
          <el-button type="danger" size="small" @click="onDelete(row)">{{
            t("listenFeaturePage.button.delete")
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="addDialogVisible"
      :title="t('listenFeaturePage.dialog.addTitle')"
      width="520px"
    >
      <div class="grid gap-4">
        <el-input
          v-model="addForm.symbol"
          :placeholder="t('listenFeaturePage.placeholder.symbol')"
        />
        <el-select v-model="addForm.listen_type">
          <el-option label="kline_base" value="kline_base" />
          <el-option label="kline_kc" value="kline_kc" />
          <el-option label="custom" value="custom" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">{{
          t("listenFeaturePage.button.cancel")
        }}</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="onAdd">{{
          t("listenFeaturePage.button.save")
        }}</el-button>
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
              t("listenFeaturePage.button.add")
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
                    v-for="item in baseIntervals"
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
              :label="t('listenFeaturePage.table.operation')"
              align="center"
              width="110"
            >
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  size="small"
                  @click="removeTechnologyItem(tab.key, $index)"
                  >{{ t("listenFeaturePage.button.delete") }}</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="technologyDialogVisible = false">{{
          t("listenFeaturePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmTechnology"
          >{{ t("listenFeaturePage.button.confirm") }}</el-button
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
          t("listenFeaturePage.button.add")
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
          :label="t('listenFeaturePage.table.operation')"
          align="center"
          width="110"
        >
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="removeStrategy($index)"
              >{{ t("listenFeaturePage.button.delete") }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="strategyDialogVisible = false">{{
          t("listenFeaturePage.button.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="confirmStrategy"
          >{{ t("listenFeaturePage.button.confirm") }}</el-button
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
            t("listenFeaturePage.button.test")
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
