<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  cancelAgentTask,
  getAgentGovernanceStatus,
  getAgentTask,
  getAgentTasks,
  getSchedulerStatus,
  resumeAgentTask,
  triggerSchedulerJob,
  type AgentGovernanceStatus,
  type AgentTask,
  type AgentTaskListResult,
  type SchedulerJobStatus
} from "@/api/agent";

defineOptions({ name: "AgentTaskCenter" });

const { t } = useI18n();
const loading = ref(false);
const schedulerLoading = ref(false);
const tasks = ref<AgentTask[]>([]);
const total = ref(0);
const schedulerJobs = ref<SchedulerJobStatus[]>([]);
const governance = ref<AgentGovernanceStatus | null>(null);
const governanceLoading = ref(false);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<AgentTask | null>(null);
const actionTaskId = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;

const query = reactive({
  skill: "",
  status: "",
  page: 1,
  limit: 20
});

const skillOptions = [
  "symbol_analysis",
  "alert_analysis",
  "market_regime",
  "strategy_builder"
];
const statusOptions = [
  "queued",
  "running",
  "waiting_llm",
  "waiting_tool",
  "validating",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted"
];

function statusType(status?: string) {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "interrupted") return "danger";
  if (status === "cancelled") return "info";
  if (
    ["running", "waiting_llm", "waiting_tool", "validating"].includes(
      status || ""
    )
  ) {
    return "warning";
  }
  return "info";
}

function freshnessType(value?: string) {
  if (value === "fresh") return "success";
  if (value === "stale") return "warning";
  if (value === "missing") return "danger";
  return "info";
}

function formatTime(value?: string | number) {
  if (!value) return "-";
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

function prettyJSON(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  try {
    const decoded = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(decoded, null, 2);
  } catch {
    return String(value);
  }
}

function formatRate(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function translateDynamic(prefix: string, value?: string) {
  if (!value) return "-";
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function canCancelTask(row?: AgentTask | null) {
  return [
    "queued",
    "running",
    "waiting_llm",
    "waiting_tool",
    "validating"
  ].includes(row?.status || "");
}

function canResumeTask(row?: AgentTask | null) {
  if (!row?.runtime_version?.startsWith("2.")) return false;
  if (row.status === "cancelled" || row.status === "interrupted") return true;
  return row.status === "failed" && row.stage === "timeout";
}

async function fetchTasks(reset = false, showLoading = true) {
  if (reset) query.page = 1;
  if (showLoading) loading.value = true;
  try {
    const res = await getAgentTasks({ ...query });
    const data = (res?.data || {}) as AgentTaskListResult;
    tasks.value = data.list || [];
    total.value = Number(data.total || 0);
  } finally {
    if (showLoading) loading.value = false;
  }
}

async function fetchGovernance(showLoading = true) {
  if (showLoading) governanceLoading.value = true;
  try {
    const res = await getAgentGovernanceStatus();
    governance.value = (res?.data || null) as AgentGovernanceStatus | null;
  } finally {
    if (showLoading) governanceLoading.value = false;
  }
}

async function fetchScheduler(showLoading = true) {
  if (showLoading) schedulerLoading.value = true;
  try {
    const res = await getSchedulerStatus();
    schedulerJobs.value = (res?.data || []) as SchedulerJobStatus[];
  } finally {
    if (showLoading) schedulerLoading.value = false;
  }
}

async function triggerJob(row: SchedulerJobStatus) {
  try {
    await triggerSchedulerJob(row.name);
    ElMessage.success(t("agentTaskCenter.message.triggered"));
    await Promise.all([fetchScheduler(), fetchTasks(true)]);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentTaskCenter.message.triggerFailed")
    );
  }
}

async function openDetail(row: AgentTask) {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await getAgentTask(row.id);
    detail.value = (res?.data || null) as AgentTask | null;
  } finally {
    detailLoading.value = false;
  }
}

async function refreshTaskAfterAction(taskId: string) {
  await fetchTasks(false, false);
  if (detailVisible.value && detail.value?.id === taskId) {
    const res = await getAgentTask(taskId);
    detail.value = (res?.data || null) as AgentTask | null;
  }
}

async function cancelTask(row: AgentTask) {
  try {
    await ElMessageBox.confirm(
      t("agentTaskCenter.message.cancelConfirm"),
      t("agentTaskCenter.message.cancelTitle"),
      { type: "warning" }
    );
    actionTaskId.value = row.id;
    await cancelAgentTask(row.id);
    ElMessage.success(t("agentTaskCenter.message.cancelAccepted"));
    await refreshTaskAfterAction(row.id);
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("agentTaskCenter.message.cancelFailed")
    );
  } finally {
    actionTaskId.value = "";
  }
}

async function resumeTask(row: AgentTask) {
  actionTaskId.value = row.id;
  try {
    await resumeAgentTask(row.id);
    ElMessage.success(t("agentTaskCenter.message.resumeAccepted"));
    await refreshTaskAfterAction(row.id);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentTaskCenter.message.resumeFailed")
    );
  } finally {
    actionTaskId.value = "";
  }
}

function scheduleRefresh() {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      // Periodic refresh is intentionally silent so current data stays visible.
      await Promise.all([
        fetchGovernance(false),
        fetchScheduler(false),
        fetchTasks(false, false)
      ]);
    } finally {
      scheduleRefresh();
    }
  }, 5000);
}

onMounted(async () => {
  await Promise.all([fetchTasks(), fetchScheduler(), fetchGovernance()]);
  scheduleRefresh();
});

onBeforeUnmount(() => {
  if (timer !== undefined) clearTimeout(timer);
});
</script>

<template>
  <div class="task-center p-4">
    <el-card v-loading="governanceLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("agentTaskCenter.governance.title") }}</span>
          <el-button size="small" @click="fetchGovernance()">{{
            t("agentTaskCenter.button.refresh")
          }}</el-button>
        </div>
      </template>
      <div class="mb-3 flex flex-wrap gap-2">
        <el-tag
          v-for="(enabled, skill) in governance?.governance?.skills || {}"
          :key="skill"
          :type="enabled ? 'success' : 'info'"
          >{{ skill }}:
          {{
            enabled
              ? t("agentTaskCenter.state.yes")
              : t("agentTaskCenter.state.no")
          }}</el-tag
        >
        <el-tag type="danger">
          {{ t("agentTaskCenter.governance.trade") }}:
          {{
            governance?.governance?.trade_enabled
              ? t("dashboard.state.on")
              : t("dashboard.state.off")
          }}
        </el-tag>
      </div>
      <el-descriptions :column="4" border size="small">
        <el-descriptions-item :label="t('agentTaskCenter.governance.minute')">
          {{ governance?.governance?.admission?.recent_minute || 0 }}/{{
            governance?.governance?.admission?.limits?.per_minute || 0
          }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('agentTaskCenter.governance.hour')">
          {{ governance?.governance?.admission?.recent_hour || 0 }}/{{
            governance?.governance?.admission?.limits?.per_hour || 0
          }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.accepted')"
          >{{
            governance?.governance?.admission?.accepted || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.rejected')"
          >{{
            governance?.governance?.admission?.rejected || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item :label="t('agentTaskCenter.governance.tasks')">{{
          governance?.metrics?.global?.tasks_started || 0
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.success')"
          >{{
            governance?.metrics?.global?.tasks_succeeded || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item :label="t('agentTaskCenter.governance.failed')">{{
          governance?.metrics?.global?.tasks_failed || 0
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('agentTaskCenter.governance.active')">{{
          governance?.metrics?.global?.active_tasks || 0
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('agentTaskCenter.governance.llmErrors')"
          >{{ governance?.metrics?.global?.llm_errors || 0 }}/{{
            governance?.metrics?.global?.llm_calls || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.toolErrors')"
          >{{ governance?.metrics?.global?.tool_errors || 0 }}/{{
            governance?.metrics?.global?.tool_calls || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.repairs')"
          >{{ governance?.metrics?.global?.repairs || 0 }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.validationErrors')"
          >{{
            governance?.metrics?.global?.validation_errors || 0
          }}</el-descriptions-item
        >
        <el-descriptions-item :label="t('agentTaskCenter.governance.tokens')">{{
          governance?.metrics?.global?.total_tokens || 0
        }}</el-descriptions-item>
        <el-descriptions-item label="P50"
          >{{ governance?.metrics?.global?.p50_duration_ms || 0 }}
          {{ t("agentTaskCenter.unit.millisecond") }}</el-descriptions-item
        >
        <el-descriptions-item label="P95"
          >{{ governance?.metrics?.global?.p95_duration_ms || 0 }}
          {{ t("agentTaskCenter.unit.millisecond") }}</el-descriptions-item
        >
        <el-descriptions-item :label="t('agentTaskCenter.governance.rounds')">{{
          Number(governance?.metrics?.global?.average_rounds || 0).toFixed(2)
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.successRate')"
          >{{
            formatRate(governance?.metrics?.global?.task_success_rate)
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.llmErrorRate')"
          >{{
            formatRate(governance?.metrics?.global?.llm_error_rate)
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.toolErrorRate')"
          >{{
            formatRate(governance?.metrics?.global?.tool_error_rate)
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.alertNotifyRate')"
          >{{
            formatRate(governance?.alert_pipeline?.signal_notify_rate)
          }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('agentTaskCenter.governance.alertFallbackRate')"
          >{{
            formatRate(governance?.alert_pipeline?.ai_fallback_rate)
          }}</el-descriptions-item
        >
      </el-descriptions>

      <div class="detail-title mt-4">
        {{ t("agentTaskCenter.governance.perSkill") }}
      </div>
      <el-table
        :data="
          Object.entries(governance?.metrics?.skills || {}).map(
            ([skill, metrics]) => ({ skill, ...metrics })
          )
        "
        size="small"
        class="mt-2"
      >
        <el-table-column
          prop="skill"
          :label="t('agentTaskCenter.table.skill')"
          min-width="150"
        />
        <el-table-column
          :label="t('agentTaskCenter.governance.tasks')"
          width="90"
        >
          <template #default="{ row }">{{ row.tasks_started || 0 }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.governance.successRate')"
          width="110"
        >
          <template #default="{ row }">{{
            formatRate(row.task_success_rate)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.governance.llmErrorRate')"
          width="110"
        >
          <template #default="{ row }">{{
            formatRate(row.llm_error_rate)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.governance.toolErrorRate')"
          width="110"
        >
          <template #default="{ row }">{{
            formatRate(row.tool_error_rate)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.governance.tokens')"
          width="120"
        >
          <template #default="{ row }">{{ row.total_tokens || 0 }}</template>
        </el-table-column>
        <el-table-column label="P95" width="110">
          <template #default="{ row }"
            >{{ row.p95_duration_ms || 0 }}
            {{ t("agentTaskCenter.unit.millisecond") }}</template
          >
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-loading="schedulerLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("agentTaskCenter.scheduler.title") }}</span>
          <el-button size="small" @click="fetchScheduler()">
            {{ t("agentTaskCenter.button.refresh") }}
          </el-button>
        </div>
      </template>
      <el-table :data="schedulerJobs" size="small">
        <el-table-column
          prop="name"
          :label="t('agentTaskCenter.scheduler.name')"
          min-width="150"
        />
        <el-table-column
          prop="skill"
          :label="t('agentTaskCenter.scheduler.skill')"
          min-width="150"
        />
        <el-table-column
          :label="t('agentTaskCenter.scheduler.enabled')"
          width="90"
        >
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{
                row.enabled
                  ? t("agentTaskCenter.state.yes")
                  : t("agentTaskCenter.state.no")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.scheduler.interval')"
          width="120"
        >
          <template #default="{ row }"
            >{{ Math.round(row.interval_seconds / 60) }}
            {{ t("agentTaskCenter.unit.minute") }}</template
          >
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.scheduler.running')"
          width="90"
        >
          <template #default="{ row }">
            <el-tag :type="row.running ? 'warning' : 'info'" size="small">
              {{
                row.running
                  ? t("agentTaskCenter.state.yes")
                  : t("agentTaskCenter.state.no")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="run_count"
          :label="t('agentTaskCenter.scheduler.runs')"
          width="90"
        />
        <el-table-column
          prop="skip_count"
          :label="t('agentTaskCenter.scheduler.skips')"
          width="90"
        />
        <el-table-column
          :label="t('agentTaskCenter.scheduler.nextRun')"
          min-width="170"
        >
          <template #default="{ row }">{{
            formatTime(row.next_run_at)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.scheduler.lastStatus')"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.last_status"
              :type="statusType(row.last_status)"
              size="small"
            >
              {{
                translateDynamic(
                  "agentTaskCenter.schedulerStatus",
                  row.last_status
                )
              }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.table.operation')"
          width="100"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :disabled="!row.enabled || row.running"
              @click="triggerJob(row)"
            >
              {{ t("agentTaskCenter.button.trigger") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("agentTaskCenter.tasks.title") }}</span>
          <span>{{ t("agentTaskCenter.tasks.total", { total }) }}</span>
        </div>
      </template>

      <div class="mb-3 flex flex-wrap gap-2">
        <el-select
          v-model="query.skill"
          clearable
          :placeholder="t('agentTaskCenter.placeholder.skill')"
          style="width: 180px"
        >
          <el-option
            v-for="item in skillOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.status"
          clearable
          :placeholder="t('agentTaskCenter.placeholder.status')"
          style="width: 160px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item"
            :label="t(`agentTaskCenter.status.${item}`)"
            :value="item"
          />
        </el-select>
        <el-button type="primary" @click="fetchTasks(true)">{{
          t("agentTaskCenter.button.search")
        }}</el-button>
        <el-button
          @click="
            query.skill = '';
            query.status = '';
            fetchTasks(true);
          "
          >{{ t("agentTaskCenter.button.reset") }}</el-button
        >
      </div>

      <el-table v-loading="loading" :data="tasks" size="small">
        <el-table-column
          :label="t('agentTaskCenter.table.time')"
          min-width="170"
        >
          <template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template>
        </el-table-column>
        <el-table-column
          prop="skill"
          :label="t('agentTaskCenter.table.skill')"
          min-width="150"
        />
        <el-table-column :label="t('agentTaskCenter.table.status')" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{
              t(`agentTaskCenter.status.${row.status}`)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentTaskCenter.table.stage')"
          min-width="150"
        >
          <template #default="{ row }">
            {{ translateDynamic("agentTaskCenter.stage", row.stage) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="progress"
          :label="t('agentTaskCenter.table.progress')"
          width="90"
        />
        <el-table-column
          prop="provider"
          :label="t('agentTaskCenter.table.provider')"
          width="100"
        />
        <el-table-column
          prop="model"
          :label="t('agentTaskCenter.table.model')"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column :label="t('agentTaskCenter.table.tokens')" width="100">
          <template #default="{ row }">{{
            row.usage?.total_tokens || 0
          }}</template>
        </el-table-column>
        <el-table-column
          prop="conversation_id"
          :label="t('agentTaskCenter.table.conversation')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('agentTaskCenter.table.operation')"
          width="210"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">{{
              t("agentTaskCenter.button.view")
            }}</el-button>
            <el-button
              v-if="canCancelTask(row)"
              size="small"
              type="danger"
              plain
              :loading="actionTaskId === row.id"
              @click="cancelTask(row)"
            >
              {{ t("agentTaskCenter.button.cancel") }}
            </el-button>
            <el-button
              v-else-if="canResumeTask(row)"
              size="small"
              type="primary"
              plain
              :loading="actionTaskId === row.id"
              @click="resumeTask(row)"
            >
              {{ t("agentTaskCenter.button.resume") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.limit"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchTasks()"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      :title="t('agentTaskCenter.detail.title')"
      width="900px"
    >
      <div v-loading="detailLoading">
        <el-descriptions v-if="detail" :column="2" border class="mb-4">
          <el-descriptions-item :label="t('agentTaskCenter.table.taskId')">{{
            detail.id
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.skill')">{{
            detail.skill
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.status')">{{
            translateDynamic("agentTaskCenter.status", detail.status)
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.stage')">{{
            translateDynamic("agentTaskCenter.stage", detail.stage)
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.provider')">{{
            detail.provider || "-"
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.model')">{{
            detail.model || "-"
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="t('agentTaskCenter.detail.runtimeVersion')"
            >{{ detail.runtime_version || "-" }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('agentTaskCenter.detail.executionMode')"
            >{{ detail.execution_mode || "-" }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('agentTaskCenter.detail.resumeCount')"
            >{{ detail.resume_count || 0 }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="t('agentTaskCenter.detail.modelConfigId')"
            >{{ detail.model_config_id || "-" }}</el-descriptions-item
          >
        </el-descriptions>
        <div
          v-if="detail && (canCancelTask(detail) || canResumeTask(detail))"
          class="mb-4"
        >
          <el-button
            v-if="canCancelTask(detail)"
            type="danger"
            plain
            :loading="actionTaskId === detail.id"
            @click="cancelTask(detail)"
          >
            {{ t("agentTaskCenter.button.cancel") }}
          </el-button>
          <el-button
            v-else-if="canResumeTask(detail)"
            type="primary"
            plain
            :loading="actionTaskId === detail.id"
            @click="resumeTask(detail)"
          >
            {{ t("agentTaskCenter.button.resume") }}
          </el-button>
        </div>
        <div class="detail-title">{{ t("agentTaskCenter.detail.input") }}</div>
        <pre class="json-box">{{ prettyJSON(detail?.input) }}</pre>
        <div class="detail-title">{{ t("agentTaskCenter.detail.result") }}</div>
        <pre class="json-box">{{ prettyJSON(detail?.result) }}</pre>
        <div v-if="detail?.error" class="detail-error">{{ detail.error }}</div>
        <template v-if="detail?.plan">
          <div class="detail-title">{{ t("agentTaskCenter.detail.plan") }}</div>
          <pre class="json-box">{{ prettyJSON(detail.plan) }}</pre>
        </template>
        <div class="detail-title">{{ t("agentTaskCenter.detail.steps") }}</div>
        <el-table
          :data="detail?.steps || []"
          size="small"
          max-height="300"
          class="mb-4"
        >
          <el-table-column type="expand" width="48">
            <template #default="{ row }">
              <div class="step-audit-box">
                <template v-if="row.context_trace">
                  <div class="detail-title mb-2">
                    {{ t("agentTaskCenter.detail.contextTrace") }}
                  </div>
                  <el-descriptions :column="4" border size="small" class="mb-3">
                    <el-descriptions-item
                      :label="t('agentTaskCenter.detail.contextBudget')"
                    >
                      {{ row.context_trace.selected_tokens || 0 }}/{{
                        row.context_trace.budget_tokens || 0
                      }}
                    </el-descriptions-item>
                    <el-descriptions-item
                      :label="t('agentTaskCenter.detail.contextBlocks')"
                    >
                      {{ row.context_trace.selected_blocks || 0 }}/{{
                        row.context_trace.input_blocks || 0
                      }}
                    </el-descriptions-item>
                    <el-descriptions-item
                      :label="t('agentTaskCenter.detail.trimmedBlocks')"
                    >
                      {{ row.context_trace.trimmed_blocks || 0 }}
                    </el-descriptions-item>
                    <el-descriptions-item
                      :label="t('agentTaskCenter.detail.staleEvidence')"
                    >
                      {{ row.context_trace.stale_evidence_ids?.length || 0 }}
                    </el-descriptions-item>
                  </el-descriptions>
                  <pre
                    v-if="row.context_trace.trimmed?.length"
                    class="json-box compact-json"
                    >{{ prettyJSON(row.context_trace.trimmed) }}</pre
                  >
                </template>
                <template v-if="row.evidence?.length">
                  <div class="detail-title mb-2">
                    {{ t("agentTaskCenter.detail.evidence") }}
                  </div>
                  <el-table :data="row.evidence" size="small" border>
                    <el-table-column
                      prop="id"
                      :label="t('agentTaskCenter.detail.evidenceId')"
                      min-width="190"
                    />
                    <el-table-column
                      prop="source"
                      :label="t('agentTaskCenter.detail.evidenceSource')"
                      min-width="180"
                    />
                    <el-table-column
                      :label="t('agentTaskCenter.detail.freshness')"
                      width="110"
                    >
                      <template #default="scope">
                        <el-tag
                          :type="freshnessType(scope.row.freshness)"
                          size="small"
                          >{{ scope.row.freshness }}</el-tag
                        >
                      </template>
                    </el-table-column>
                    <el-table-column
                      :label="t('agentTaskCenter.detail.asOf')"
                      width="175"
                    >
                      <template #default="scope">{{
                        formatTime(scope.row.as_of)
                      }}</template>
                    </el-table-column>
                    <el-table-column
                      prop="content_hash"
                      :label="t('agentTaskCenter.detail.contentHash')"
                      min-width="220"
                      show-overflow-tooltip
                    />
                  </el-table>
                </template>
                <span v-if="!row.context_trace && !row.evidence?.length"
                  >-</span
                >
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="step_id"
            :label="t('agentTaskCenter.detail.stepId')"
            width="105"
          />
          <el-table-column
            prop="type"
            :label="t('agentTaskCenter.detail.stepType')"
            width="120"
          />
          <el-table-column
            prop="status"
            :label="t('agentTaskCenter.table.status')"
            width="105"
          />
          <el-table-column
            prop="attempt"
            :label="t('agentTaskCenter.detail.attempt')"
            width="75"
          />
          <el-table-column
            :label="t('agentTaskCenter.detail.checkpoint')"
            width="95"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.checkpoint ? 'success' : 'info'"
                size="small"
                >{{
                  row.checkpoint
                    ? t("agentTaskCenter.state.yes")
                    : t("agentTaskCenter.state.no")
                }}</el-tag
              >
            </template>
          </el-table-column>
          <el-table-column
            prop="output_summary"
            :label="t('agentTaskCenter.detail.output')"
            min-width="200"
            show-overflow-tooltip
          />
        </el-table>
        <div class="detail-title">{{ t("agentTaskCenter.detail.events") }}</div>
        <el-table :data="detail?.events || []" size="small" max-height="360">
          <el-table-column :label="t('agentTaskCenter.table.time')" width="170">
            <template #default="{ row }">{{ formatTime(row.time) }}</template>
          </el-table-column>
          <el-table-column
            prop="step_id"
            :label="t('agentTaskCenter.detail.stepId')"
            width="105"
          />
          <el-table-column
            prop="step_type"
            :label="t('agentTaskCenter.detail.stepType')"
            width="120"
          />
          <el-table-column
            :label="t('agentTaskCenter.table.stage')"
            width="160"
          >
            <template #default="{ row }">
              {{ translateDynamic("agentTaskCenter.stage", row.stage) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="round"
            :label="t('agentTaskCenter.detail.round')"
            width="70"
          />
          <el-table-column
            prop="tool"
            :label="t('agentTaskCenter.detail.tool')"
            width="160"
          />
          <el-table-column
            prop="message"
            :label="t('agentTaskCenter.detail.message')"
            min-width="240"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.json-box {
  max-height: 280px;
  padding: 12px;
  margin: 8px 0 16px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.detail-title {
  font-weight: 600;
}

.step-audit-box {
  padding: 12px 18px;
}

.compact-json {
  max-height: 180px;
}

.detail-error {
  margin-bottom: 16px;
  color: var(--el-color-danger);
}
</style>
