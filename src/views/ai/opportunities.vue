<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  createProposalFromOpportunity,
  getAgentOpportunities,
  getAgentOpportunity,
  getAgentTask,
  reviewAgentOpportunity,
  type AgentOpportunity,
  type AgentOpportunityDetail,
  type AgentTask,
  type TradingPlanV1
} from "@/api/agent";

defineOptions({ name: "AgentOpportunities" });
const { t } = useI18n();
const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const rows = ref<AgentOpportunity[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const detail = ref<AgentOpportunityDetail | null>(null);
const analysisTask = ref<AgentTask<TradingPlanV1> | null>(null);
const query = reactive({
  page: 1,
  limit: 20,
  status: "",
  analysis_status: "",
  symbol: "",
  source_type: ""
});

const sourceOptions = [
  "fast_move",
  "liquidation_spike",
  "market_scan",
  "market_event"
];
const statusOptions = ["new", "reviewed", "expired"];
const analysisStatusOptions = [
  "pending",
  "succeeded",
  "partial",
  "data_missing",
  "failed"
];

const opportunity = computed(() => detail.value?.opportunity || null);
const plan = computed(() => analysisTask.value?.result || null);
const hasProposal = computed(() => Boolean(detail.value?.trade_proposal));

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function directionType(value?: string) {
  if (value === "long") return "success";
  if (value === "short") return "danger";
  return "info";
}

function statusType(value?: string) {
  if (value === "expired") return "info";
  if (value === "reviewed") return "success";
  return "primary";
}

function analysisStatusType(value?: string) {
  if (value === "succeeded") return "success";
  if (["failed", "data_missing", "partial"].includes(value || ""))
    return "danger";
  if (value === "pending") return "warning";
  return "info";
}

function label(prefix: string, value?: string) {
  if (!value) return "-";
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function marketConditionLabel(value?: number) {
  if (!value) return "-";
  return `${value} - ${t(`dashboard.market.${value}`)}`;
}
async function fetchRows(showLoading = false) {
  if (showLoading) loading.value = true;
  try {
    const res = await getAgentOpportunities({ ...query });
    rows.value = (res?.data?.list || []) as AgentOpportunity[];
    total.value = Number(res?.data?.total || 0);
  } catch (error: any) {
    ElMessage.error(error?.message || t("opportunityPage.message.loadFailed"));
  } finally {
    if (showLoading) loading.value = false;
  }
}

async function loadDetail(opportunityId: string) {
  const res = await getAgentOpportunity(opportunityId);
  detail.value = (res?.data || null) as AgentOpportunityDetail | null;
  analysisTask.value = null;
  const taskId = detail.value?.opportunity?.analysis_task_id;
  if (taskId) {
    const taskRes = await getAgentTask(taskId);
    analysisTask.value = (taskRes?.data ||
      null) as AgentTask<TradingPlanV1> | null;
  }
}

async function openDetail(row: AgentOpportunity) {
  detailLoading.value = true;
  try {
    await loadDetail(row.opportunity_id);
    if (row.status === "new") {
      await reviewAgentOpportunity(row.opportunity_id);
      await loadDetail(row.opportunity_id);
      await fetchRows(false);
    }
    detailVisible.value = true;
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("opportunityPage.message.detailFailed")
    );
  } finally {
    detailLoading.value = false;
  }
}
async function createProposal() {
  const row = opportunity.value;
  if (!row || hasProposal.value || !detail.value?.proposal_eligible) return;
  actionLoading.value = true;
  try {
    const res = await createProposalFromOpportunity(row.opportunity_id);
    if (Number(res?.code) !== 200) {
      throw new Error(res?.msg || t("opportunityPage.message.proposalFailed"));
    }
    ElMessage.success(t("opportunityPage.message.proposalCreated"));
    await loadDetail(row.opportunity_id);
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.msg ||
        error?.message ||
        t("opportunityPage.message.proposalFailed")
    );
  } finally {
    actionLoading.value = false;
  }
}

function reanalyze(row?: AgentOpportunity | null) {
  if (!row) return;
  router.push({
    name: "SymbolAnalysis",
    query: {
      symbol: row.symbol,
      prompt: t("opportunityPage.reanalysisPrompt", {
        source: label("opportunityPage.source", row.source_type)
      })
    }
  });
}

function openControlledTrade() {
  router.push({ name: "AgentControlledTrade" });
}

function changePage(page: number) {
  query.page = page;
  void fetchRows(true);
}

onMounted(() => void fetchRows(true));
</script>
<template>
  <div class="opportunity-page p-4">
    <el-card shadow="never" class="mb-4">
      <div class="text-lg font-medium">{{ t("opportunityPage.title") }}</div>
      <div class="mt-1 text-sm text-gray-500">
        {{ t("opportunityPage.subtitle") }}
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="filter-row mb-4">
        <el-input
          v-model="query.symbol"
          clearable
          class="filter-item"
          :placeholder="t('opportunityPage.filter.symbol')"
          @keyup.enter="fetchRows(true)"
        />
        <el-select
          v-model="query.status"
          clearable
          class="filter-item"
          :placeholder="t('opportunityPage.filter.status')"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item"
            :label="label('opportunityPage.status', item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.analysis_status"
          clearable
          class="filter-item"
          :placeholder="t('opportunityPage.filter.analysisStatus')"
        >
          <el-option
            v-for="item in analysisStatusOptions"
            :key="item"
            :label="label('opportunityPage.analysisStatus', item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.source_type"
          clearable
          class="filter-item"
          :placeholder="t('opportunityPage.filter.source')"
        >
          <el-option
            v-for="item in sourceOptions"
            :key="item"
            :label="label('opportunityPage.source', item)"
            :value="item"
          />
        </el-select>
        <el-button type="primary" @click="fetchRows(true)">
          {{ t("opportunityPage.button.search") }}
        </el-button>
      </div>

      <el-table v-loading="loading" :data="rows" border>
        <el-table-column
          prop="symbol"
          :label="t('opportunityPage.table.symbol')"
          width="130"
        />
        <el-table-column
          :label="t('opportunityPage.table.direction')"
          width="110"
        >
          <template #default="{ row }">
            <el-tag :type="directionType(row.direction)">
              {{ label("opportunityPage.direction", row.direction) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('opportunityPage.table.confidence')"
          width="120"
        >
          <template #default="{ row }">
            {{ `${Math.round(Number(row.confidence || 0) * 100)}%` }}
          </template>
        </el-table-column>
        <el-table-column :label="t('opportunityPage.table.source')" width="150">
          <template #default="{ row }">
            {{ label("opportunityPage.source", row.source_type) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('opportunityPage.table.marketCondition')"
          width="170"
        >
          <template #default="{ row }">
            {{ marketConditionLabel(row.market_condition) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="summary"
          :label="t('opportunityPage.table.summary')"
          min-width="280"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('opportunityPage.table.analysisStatus')"
          width="140"
        >
          <template #default="{ row }">
            <el-tag :type="analysisStatusType(row.analysis_status)">
              {{ label("opportunityPage.analysisStatus", row.analysis_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('opportunityPage.table.status')" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ label("opportunityPage.status", row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('opportunityPage.table.createdAt')"
          width="180"
        >
          <template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('opportunityPage.table.operation')"
          width="210"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              {{ t("opportunityPage.button.detail") }}
            </el-button>
            <el-button link type="primary" @click="reanalyze(row)">
              {{ t("opportunityPage.button.reanalyze") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :page-size="query.limit"
          :current-page="query.page"
          @current-change="changePage"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      :title="t('opportunityPage.detail.title')"
      width="900px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <el-descriptions v-if="opportunity" :column="2" border>
          <el-descriptions-item :label="t('opportunityPage.table.symbol')">
            {{ opportunity.symbol }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('opportunityPage.table.direction')">
            <el-tag :type="directionType(opportunity.direction)">
              {{ label("opportunityPage.direction", opportunity.direction) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('opportunityPage.table.confidence')">
            {{ `${Math.round(Number(opportunity.confidence || 0) * 100)}%` }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('opportunityPage.table.source')">
            {{ label("opportunityPage.source", opportunity.source_type) }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('opportunityPage.table.marketCondition')"
          >
            {{ marketConditionLabel(opportunity.market_condition) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('opportunityPage.detail.expiresAt')">
            {{ formatTime(opportunity.expires_at) }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('opportunityPage.table.analysisStatus')"
          >
            {{
              label(
                "opportunityPage.analysisStatus",
                opportunity.analysis_status
              )
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('opportunityPage.table.status')">
            {{ label("opportunityPage.status", opportunity.status) }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('opportunityPage.table.summary')"
            :span="2"
          >
            {{ opportunity.summary || "-" }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="opportunity.analysis_error"
            :label="t('opportunityPage.detail.error')"
            :span="2"
          >
            {{ opportunity.analysis_error }}
          </el-descriptions-item>
        </el-descriptions>
        <template v-if="plan">
          <el-divider content-position="left">
            {{ t("opportunityPage.detail.tradingPlan") }}
          </el-divider>
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('symbolAnalysisPage.plan.asOf')">
              {{ plan.as_of }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('symbolAnalysisPage.plan.stopLoss')"
            >
              {{ plan.stop_loss ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('symbolAnalysisPage.plan.entryZones')"
              :span="2"
            >
              <pre class="json-block">{{
                JSON.stringify(plan.entry_zones, null, 2)
              }}</pre>
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('symbolAnalysisPage.plan.takeProfits')"
              :span="2"
            >
              <pre class="json-block">{{
                JSON.stringify(plan.take_profits, null, 2)
              }}</pre>
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('symbolAnalysisPage.plan.longTrigger')"
              :span="2"
            >
              {{ plan.long_trigger || "-" }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="t('symbolAnalysisPage.plan.shortTrigger')"
              :span="2"
            >
              {{ plan.short_trigger || "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <el-alert
          v-if="detail?.trade_proposal"
          class="mt-4"
          type="success"
          :closable="false"
          :title="
            t('opportunityPage.detail.proposalExists', {
              id: detail.trade_proposal.proposal_id
            })
          "
        />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="reanalyze(opportunity)">
            {{ t("opportunityPage.button.reanalyze") }}
          </el-button>
          <el-button
            v-if="hasProposal"
            type="success"
            @click="openControlledTrade"
          >
            {{ t("opportunityPage.button.openControlledTrade") }}
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="actionLoading"
            :disabled="!detail?.proposal_eligible"
            @click="createProposal"
          >
            {{ t("opportunityPage.button.createProposal") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-item {
  width: 180px;
}

.json-block {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
