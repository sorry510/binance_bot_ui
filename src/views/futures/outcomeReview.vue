<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElCard, ElMessage, ElTable, ElTableColumn } from "element-plus";
import { getFeaturesOptions } from "@/api/trade";
import {
  useStrategyTemplateOptions,
  strategyTemplatePopperClass
} from "@/composables/useStrategyTemplateOptions";
import {
  getBacktestOutcomes,
  getPaperOutcomes,
  getLiveOutcomes,
  type BacktestOutcomeSummary,
  type PaperOutcomeSummary,
  type LiveOutcomeSummary,
  type LiveProposalSummary,
  type OutcomeGroup
} from "@/api/outcome";
import {
  getAgentTradeProposal,
  type AgentTradeProposalDetail,
  type AgentTradeRiskResult
} from "@/api/agent";

defineOptions({ name: "OutcomeReview" });
const { t } = useI18n();
const {
  options: templates,
  selectLoading,
  loadFirstPage,
  search,
  onPopupScroll
} = useStrategyTemplateOptions();
const loading = ref(false);
const activeTab = ref("backtest");
const symbols = ref<string[]>([]);
const backtest = ref<BacktestOutcomeSummary>();
const paper = ref<PaperOutcomeSummary>();
const live = ref<LiveOutcomeSummary>();
const liveDetailVisible = ref(false);
const liveDetailLoading = ref(false);
const liveDetail = ref<AgentTradeProposalDetail>();
const liveProposal = computed(() => liveDetail.value?.proposal);
const liveRisk = computed<AgentTradeRiskResult | undefined>(() => {
  const raw = liveDetail.value?.proposal?.risk_json;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AgentTradeRiskResult;
  } catch {
    return undefined;
  }
});
const compareTemplateIds = ref<number[]>([]);
const compareLoading = ref(false);
const compareRows = ref<
  Array<{
    template_id: number;
    template_name: string;
    backtest?: BacktestOutcomeSummary;
    paper?: PaperOutcomeSummary;
  }>
>([]);
const selectedTemplateMap = computed(() =>
  Object.fromEntries(templates.value.map(item => [item.id, item.name]))
);
const filters = reactive({
  range: undefined as [Date, Date] | undefined,
  strategy_template_id: undefined as number | undefined,
  symbol: "",
  side: ""
});

function params(includeTemplate = true) {
  const value: Record<string, any> = {};
  if (filters.range?.[0]) value.start_time = filters.range[0].getTime();
  if (filters.range?.[1]) value.end_time = filters.range[1].getTime();
  if (includeTemplate && filters.strategy_template_id)
    value.strategy_template_id = filters.strategy_template_id;
  if (filters.symbol) value.symbol = filters.symbol;
  if (filters.side) value.side = filters.side;
  return value;
}

async function load() {
  loading.value = true;
  try {
    const [b, p, l] = await Promise.all([
      getBacktestOutcomes(params()),
      getPaperOutcomes(params()),
      getLiveOutcomes(params(false))
    ]);
    backtest.value = b?.data;
    paper.value = p?.data;
    live.value = l?.data;
  } catch (e: any) {
    ElMessage.error(e?.message || t("outcomeReview.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}
async function loadCompare() {
  if (compareTemplateIds.value.length < 2) {
    ElMessage.warning(t("outcomeReview.message.compareRequired"));
    return;
  }
  compareLoading.value = true;
  try {
    compareRows.value = await Promise.all(
      compareTemplateIds.value.slice(0, 3).map(async templateId => {
        const base = params(false);
        base.strategy_template_id = templateId;
        const [b, p] = await Promise.all([
          getBacktestOutcomes(base),
          getPaperOutcomes(base)
        ]);
        return {
          template_id: templateId,
          template_name:
            selectedTemplateMap.value[templateId] || `#${templateId}`,
          backtest: b?.data,
          paper: p?.data
        };
      })
    );
  } finally {
    compareLoading.value = false;
  }
}

function reset() {
  filters.range = undefined;
  filters.strategy_template_id = undefined;
  filters.symbol = "";
  filters.side = "";
  load();
}
function num(value?: number, digits = 2) {
  return Number(value || 0).toFixed(digits);
}
function pct(value?: number, ratio = true) {
  const v = Number(value || 0) * (ratio ? 100 : 1);
  return `${v.toFixed(2)}%`;
}
function maxDrawdown(value?: BacktestOutcomeSummary) {
  if (!value || value.max_drawdown_available === false) return "-";
  return pct(value.max_drawdown_pct, false);
}
function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function statusLabel(status?: string) {
  if (!status) return "-";
  const key = `controlledTradePage.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}
async function openLiveDetail(row: LiveProposalSummary) {
  liveDetailLoading.value = true;
  try {
    const res = await getAgentTradeProposal(row.proposal_id);
    liveDetail.value = res?.data as AgentTradeProposalDetail;
    liveDetailVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.message || t("outcomeReview.message.liveDetailFailed"));
  } finally {
    liveDetailLoading.value = false;
  }
}
function duration(ms?: number) {
  const total = Math.floor(Number(ms || 0) / 1000);
  if (!total) return "-";
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m`;
  return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
}
function marketLabel(key: string) {
  const translated = t(`dashboard.market.${key}`);
  return translated === `dashboard.market.${key}` ? key : translated;
}
function groupLabel(row: OutcomeGroup, market = false) {
  return market ? marketLabel(row.key) : row.label;
}

const GroupTable = defineComponent({
  name: "OutcomeGroupTable",
  props: {
    title: { type: String, default: "" },
    rows: { type: Array as () => OutcomeGroup[], default: () => [] },
    market: Boolean
  },
  setup(props) {
    return () =>
      h(
        ElCard,
        { shadow: "never" },
        {
          header: () => props.title,
          default: () =>
            h(ElTable, { data: props.rows, size: "small" }, () => [
              h(ElTableColumn, {
                prop: "label",
                label: t("outcomeReview.table.group"),
                minWidth: 110,
                formatter: (row: OutcomeGroup) => groupLabel(row, props.market)
              }),
              h(ElTableColumn, {
                prop: "trade_count",
                label: t("outcomeReview.metric.trades"),
                width: 78
              }),
              h(ElTableColumn, {
                prop: "net_pnl",
                label: t("outcomeReview.metric.netPnl"),
                width: 90,
                formatter: (row: OutcomeGroup) => num(row.net_pnl)
              }),
              h(ElTableColumn, {
                prop: "win_rate",
                label: t("outcomeReview.metric.winRate"),
                width: 78,
                formatter: (row: OutcomeGroup) => pct(row.win_rate)
              })
            ])
        }
      );
  }
});

onMounted(async () => {
  await Promise.all([
    loadFirstPage(),
    getFeaturesOptions().then(res => {
      symbols.value = Array.isArray(res?.data) ? res.data : [];
    })
  ]);
  await load();
});
</script>

<template>
  <div v-loading="loading" class="p-4 outcome-review">
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div>
          <div class="text-lg font-medium">{{ t("outcomeReview.title") }}</div>
          <div class="text-sm text-gray-500 mt-1">
            {{ t("outcomeReview.subtitle") }}
          </div>
        </div>
      </template>
      <el-form inline>
        <el-form-item :label="t('outcomeReview.filter.range')">
          <el-date-picker v-model="filters.range" type="datetimerange" />
        </el-form-item>
        <el-form-item :label="t('outcomeReview.filter.strategy')">
          <el-select
            v-model="filters.strategy_template_id"
            clearable
            filterable
            remote
            :remote-method="search"
            :loading="selectLoading"
            :popper-class="strategyTemplatePopperClass"
            style="width: 260px"
            @popup-scroll="onPopupScroll"
          >
            <el-option
              v-for="item in templates"
              :key="item.id"
              :label="`${item.name} (#${item.id})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('outcomeReview.filter.symbol')">
          <el-select
            v-model="filters.symbol"
            clearable
            filterable
            style="width: 180px"
          >
            <el-option
              v-for="item in symbols"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('outcomeReview.filter.side')">
          <el-select v-model="filters.side" clearable style="width: 130px">
            <el-option label="LONG" value="LONG" /><el-option
              label="SHORT"
              value="SHORT"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">{{
            t("outcomeReview.button.search")
          }}</el-button>
          <el-button @click="reset">{{
            t("outcomeReview.button.reset")
          }}</el-button>
        </el-form-item>
      </el-form>
      <div class="text-xs text-gray-500">
        {{ t("outcomeReview.hint.separate") }}
      </div>
    </el-card>

    <el-card shadow="never" class="mb-4">
      <template #header>{{ t("outcomeReview.compare.title") }}</template>
      <div class="flex gap-3 items-center mb-3">
        <el-select
          v-model="compareTemplateIds"
          multiple
          :multiple-limit="3"
          filterable
          remote
          :remote-method="search"
          :loading="selectLoading"
          :popper-class="strategyTemplatePopperClass"
          style="width: 560px"
          @popup-scroll="onPopupScroll"
        >
          <el-option
            v-for="item in templates"
            :key="item.id"
            :label="`${item.name} (#${item.id})`"
            :value="item.id"
          />
        </el-select>
        <el-button
          type="primary"
          :loading="compareLoading"
          @click="loadCompare"
          >{{ t("outcomeReview.compare.button") }}</el-button
        >
      </div>
      <el-table v-if="compareRows.length" :data="compareRows" size="small">
        <el-table-column
          prop="template_name"
          :label="t('outcomeReview.filter.strategy')"
          min-width="180"
        />
        <el-table-column
          :label="t('outcomeReview.compare.backtestReturn')"
          width="150"
        >
          <template #default="{ row }">{{
            pct(row.backtest?.return_pct, false)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('outcomeReview.metric.maxDrawdown')"
          width="150"
        >
          <template #default="{ row }">{{
            maxDrawdown(row.backtest)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('outcomeReview.metric.profitFactor')"
          width="100"
        >
          <template #default="{ row }">{{
            num(row.backtest?.profit_factor)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('outcomeReview.compare.paperPnl')"
          width="130"
        >
          <template #default="{ row }">{{
            num(row.paper?.net_profit)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('outcomeReview.compare.paperWinRate')"
          width="150"
        >
          <template #default="{ row }">{{
            pct(row.paper?.win_rate, false)
          }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('outcomeReview.tab.backtest')" name="backtest">
        <div v-if="backtest" class="metric-grid">
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.netPnl") }}
            </div>
            <div class="metric-value">{{ num(backtest.net_pnl) }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.return") }}
            </div>
            <div class="metric-value">
              {{ pct(backtest.return_pct, false) }}
            </div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.winRate") }}
            </div>
            <div class="metric-value">
              {{ pct(backtest.win_rate) }}
            </div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.profitFactor") }}
            </div>
            <div class="metric-value">
              {{ num(backtest.profit_factor) }}
            </div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.maxDrawdown") }}
            </div>
            <div class="metric-value">
              {{ maxDrawdown(backtest) }}
            </div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.trades") }}
            </div>
            <div class="metric-value">{{ backtest.trade_count }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.fees") }}
            </div>
            <div class="metric-value">{{ num(backtest.fees) }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.avgHolding") }}
            </div>
            <div class="metric-value">
              {{ duration(backtest.average_holding_ms) }}
            </div></el-card
          >
        </div>
        <div v-if="backtest" class="text-xs text-gray-500 mt-3">
          {{ t("outcomeReview.hint.backtestBasis") }}
        </div>
        <el-row v-if="backtest" :gutter="16" class="mt-4">
          <el-col :span="8"
            ><group-table
              :title="t('outcomeReview.group.symbol')"
              :rows="backtest.by_symbol"
          /></el-col>
          <el-col :span="8"
            ><group-table
              :title="t('outcomeReview.group.side')"
              :rows="backtest.by_side"
          /></el-col>
          <el-col :span="8"
            ><group-table
              :title="t('outcomeReview.group.market')"
              :rows="backtest.by_market_condition"
              market
          /></el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane :label="t('outcomeReview.tab.paper')" name="paper">
        <div v-if="paper" class="metric-grid">
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.netPnl") }}
            </div>
            <div class="metric-value">{{ num(paper.net_profit) }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.winRate") }}
            </div>
            <div class="metric-value">
              {{ pct(paper.win_rate, false) }}
            </div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.closed") }}
            </div>
            <div class="metric-value">{{ paper.closed }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.open") }}
            </div>
            <div class="metric-value">{{ paper.open }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.fees") }}
            </div>
            <div class="metric-value">{{ num(paper.fees) }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.avgPnl") }}
            </div>
            <div class="metric-value">
              {{ num(paper.average_net_profit) }}
            </div></el-card
          >
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('outcomeReview.tab.live')" name="live">
        <el-alert
          type="info"
          :closable="false"
          class="mb-4"
          :title="t('outcomeReview.hint.livePnl')"
        />
        <div v-if="live" class="metric-grid">
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.proposals") }}
            </div>
            <div class="metric-value">{{ live.proposals }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.executed") }}
            </div>
            <div class="metric-value">{{ live.executed }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.openPositions") }}
            </div>
            <div class="metric-value">{{ live.open_positions }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.closedPositions") }}
            </div>
            <div class="metric-value">{{ live.closed_positions }}</div></el-card
          >
          <el-card shadow="never"
            ><div class="metric-label">
              {{ t("outcomeReview.metric.managedOrders") }}
            </div>
            <div class="metric-value">{{ live.managed_orders }}</div></el-card
          >
        </div>
        <el-card
          v-if="live?.recent_proposals?.length"
          shadow="never"
          class="mt-4"
        >
          <template #header>
            <div>
              <div class="font-medium">
                {{ t("outcomeReview.live.recentProposals") }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ t("outcomeReview.live.traceHint") }}
              </div>
            </div>
          </template>
          <el-table :data="live.recent_proposals" size="small">
            <el-table-column
              :label="t('controlledTradePage.detail.time')"
              width="180"
            >
              <template #default="{ row }">{{
                formatTime(row.created_at)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="proposal_id"
              :label="t('controlledTradePage.table.proposalId')"
              min-width="210"
            />
            <el-table-column
              prop="symbol"
              :label="t('controlledTradePage.table.symbol')"
              width="120"
            />
            <el-table-column
              prop="side"
              :label="t('controlledTradePage.table.side')"
              width="90"
            />
            <el-table-column
              :label="t('controlledTradePage.table.status')"
              width="150"
            >
              <template #default="{ row }">{{
                statusLabel(row.status)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="risk_status"
              :label="t('controlledTradePage.table.risk')"
              width="100"
            />
            <el-table-column
              :label="t('controlledTradePage.table.operation')"
              width="100"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button link type="primary" @click="openLiveDetail(row)">
                  {{ t("controlledTradePage.button.detail") }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-drawer
      v-model="liveDetailVisible"
      :title="t('outcomeReview.live.detailTitle')"
      size="72%"
    >
      <div v-loading="liveDetailLoading">
        <template v-if="liveProposal">
          <el-descriptions :column="3" border class="mb-4">
            <el-descriptions-item
              :label="t('controlledTradePage.table.proposalId')"
            >
              {{ liveProposal.proposal_id }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.table.taskId')"
            >
              {{ liveProposal.source_task_id }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.table.status')"
            >
              {{ statusLabel(liveProposal.status) }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.table.symbol')"
            >
              {{ liveProposal.symbol }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('controlledTradePage.table.side')">
              {{ liveProposal.side }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('controlledTradePage.detail.marketCondition')"
            >
              {{ marketLabel(String(liveProposal.market_condition)) }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="section-title">
            {{ t("controlledTradePage.detail.riskChecks") }}
          </div>
          <el-table :data="liveRisk?.checks || []" size="small" class="mb-4">
            <el-table-column
              prop="name"
              :label="t('controlledTradePage.detail.check')"
              min-width="180"
            />
            <el-table-column
              :label="t('controlledTradePage.detail.result')"
              width="100"
            >
              <template #default="{ row }">{{
                row.passed ? "PASS" : "FAIL"
              }}</template>
            </el-table-column>
            <el-table-column
              prop="message"
              :label="t('controlledTradePage.detail.message')"
              min-width="260"
            />
          </el-table>

          <template v-if="liveDetail?.execution">
            <div class="section-title">
              {{ t("controlledTradePage.detail.execution") }}
            </div>
            <el-descriptions :column="2" border class="mb-4">
              <el-descriptions-item
                :label="t('controlledTradePage.detail.executionStatus')"
              >
                {{ liveDetail.execution.status }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="t('controlledTradePage.detail.clientOrderId')"
              >
                {{ liveDetail.execution.client_order_id }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="t('controlledTradePage.detail.exchangeOrderId')"
              >
                {{ liveDetail.execution.exchange_order_id || "-" }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="t('controlledTradePage.detail.averagePrice')"
              >
                {{ num(liveDetail.execution.average_price, 8) }}
              </el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="liveDetail?.managed_position">
            <div class="section-title">
              {{ t("controlledTradePage.detail.managedLifecycle") }}
            </div>
            <el-descriptions :column="3" border class="mb-4">
              <el-descriptions-item
                :label="t('controlledTradePage.ownership.managedQty')"
              >
                {{ num(liveDetail.managed_position.managed_qty, 8) }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="t('controlledTradePage.table.status')"
              >
                {{ liveDetail.managed_position.status }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="t('controlledTradePage.detail.entryPrice')"
              >
                {{ num(liveDetail.managed_position.entry_price, 8) }}
              </el-descriptions-item>
            </el-descriptions>
          </template>

          <div class="section-title">
            {{ t("controlledTradePage.detail.audit") }}
          </div>
          <el-table :data="liveDetail?.audits || []" size="small">
            <el-table-column
              :label="t('controlledTradePage.detail.time')"
              width="180"
            >
              <template #default="{ row }">{{
                formatTime(row.created_at)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="event"
              :label="t('controlledTradePage.detail.event')"
              min-width="180"
            />
            <el-table-column
              prop="status"
              :label="t('controlledTradePage.table.status')"
              width="120"
            />
            <el-table-column
              prop="actor"
              :label="t('controlledTradePage.detail.actor')"
              width="140"
            />
            <el-table-column
              prop="detail_json"
              :label="t('controlledTradePage.detail.detail')"
              min-width="280"
            />
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.section-title {
  margin: 14px 0 8px;
  font-weight: 600;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metric-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
}
</style>
