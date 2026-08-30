<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getAgentTask,
  getAgentTasks,
  getSchedulerStatus,
  triggerSchedulerJob,
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
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<AgentTask | null>(null);
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

async function fetchTasks(reset = false) {
  if (reset) query.page = 1;
  loading.value = true;
  try {
    const res = await getAgentTasks({ ...query });
    const data = (res?.data || {}) as AgentTaskListResult;
    tasks.value = data.list || [];
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}

async function fetchScheduler() {
  schedulerLoading.value = true;
  try {
    const res = await getSchedulerStatus();
    schedulerJobs.value = (res?.data || []) as SchedulerJobStatus[];
  } finally {
    schedulerLoading.value = false;
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

function scheduleRefresh() {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await Promise.all([fetchScheduler(), fetchTasks()]);
    } finally {
      scheduleRefresh();
    }
  }, 5000);
}

onMounted(async () => {
  await Promise.all([fetchTasks(), fetchScheduler()]);
  scheduleRefresh();
});

onBeforeUnmount(() => {
  if (timer !== undefined) clearTimeout(timer);
});
</script>

<template>
  <div class="task-center p-4">
    <el-card v-loading="schedulerLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("agentTaskCenter.scheduler.title") }}</span>
          <el-button size="small" @click="fetchScheduler">
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
            >{{ Math.round(row.interval_seconds / 60) }} min</template
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
              {{ row.last_status }}
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
          prop="stage"
          :label="t('agentTaskCenter.table.stage')"
          min-width="150"
        />
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
          width="90"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">{{
              t("agentTaskCenter.button.view")
            }}</el-button>
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
          <el-descriptions-item label="Task ID">{{
            detail.id
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.skill')">{{
            detail.skill
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.status')">{{
            detail.status
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.stage')">{{
            detail.stage
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.provider')">{{
            detail.provider || "-"
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('agentTaskCenter.table.model')">{{
            detail.model || "-"
          }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-title">{{ t("agentTaskCenter.detail.input") }}</div>
        <pre class="json-box">{{ prettyJSON(detail?.input) }}</pre>
        <div class="detail-title">{{ t("agentTaskCenter.detail.result") }}</div>
        <pre class="json-box">{{ prettyJSON(detail?.result) }}</pre>
        <div v-if="detail?.error" class="detail-error">{{ detail.error }}</div>
        <div class="detail-title">{{ t("agentTaskCenter.detail.events") }}</div>
        <el-table :data="detail?.events || []" size="small" max-height="360">
          <el-table-column :label="t('agentTaskCenter.table.time')" width="170">
            <template #default="{ row }">{{ formatTime(row.time) }}</template>
          </el-table-column>
          <el-table-column
            prop="stage"
            :label="t('agentTaskCenter.table.stage')"
            width="160"
          />
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

.detail-error {
  margin-bottom: 16px;
  color: var(--el-color-danger);
}
</style>
