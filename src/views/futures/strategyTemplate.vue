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
  addData,
  delData,
  editData,
  getList,
  testStrategyRule
} from "../../api/strategyTemplate";
import { codeMirrorBasicSetup } from "../../utils/codemirror";

defineOptions({ name: "strategyTemplate" });
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

const list = ref<TemplateRow[]>([]);
const listLoading = ref(false);
const dialogLoading = ref(false);

const createDialogVisible = ref(false);
const createForm = reactive({ name: "" });

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
    const res = await getList();
    list.value = res?.data || [];
  } finally {
    listLoading.value = false;
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
    await fetchData();
  } finally {
    dialogLoading.value = false;
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
</script>

<template>
  <div class="p-4 strategy-template-page">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="success" @click="openCreateDialog">{{
        t("strategyTemplatePage.button.add")
      }}</el-button>
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
        prop="name"
        :label="t('strategyTemplatePage.table.name')"
        show-overflow-tooltip
        align="center"
      />
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
              t("strategyTemplatePage.button.add")
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
              :label="t('strategyTemplatePage.technology.period')"
              align="center"
              width="120"
            >
              <template #default="{ row }">
                <el-input v-model="row.period" size="small" />
              </template>
            </el-table-column>
            <el-table-column
              v-if="tab.key === 'kc'"
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
