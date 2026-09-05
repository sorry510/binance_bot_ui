<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getAgentWorkflow,
  getAgentWorkflows,
  startAgentWorkflow,
  type AgentWorkflowName,
  type AgentWorkflowRun
} from "@/api/agent";

defineOptions({ name: "AgentWorkflows" });
const { t } = useI18n();
const loading = ref(false);
const starting = ref(false);
const runs = ref<AgentWorkflowRun[]>([]);
const total = ref(0);
const detail = ref<AgentWorkflowRun | null>(null);
const detailVisible = ref(false);
const query = reactive({ page: 1, limit: 20, workflow: "", status: "" });
const form = reactive({
  workflow: "market_scan" as AgentWorkflowName,
  analyze: 8,
  template_id: undefined as number | undefined,
  template_name: "",
  days: 30,
  goal: "",
  window_minutes: 15,
  max_signals: 100,
  window_hours: 24
});
let timer: ReturnType<typeof setTimeout> | undefined;

const needsTemplate = computed(() =>
  ["strategy_review", "strategy_experiment"].includes(form.workflow)
);
const workflowOptions: AgentWorkflowName[] = [
  "market_scan",
  "strategy_review",
  "strategy_experiment",
  "alert_triage",
  "daily_market_brief"
];
const statuses = ["queued", "running", "succeeded", "failed"];

function workflowLabel(value: string) {
  const key = `workflowPage.workflow.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
function statusType(status: string) {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "info";
}
function formatTime(value?: number) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
function prettyJSON(value: any) {
  return JSON.stringify(value ?? {}, null, 2);
}
function buildInput() {
  switch (form.workflow) {
    case "market_scan":
      return { analyze: Number(form.analyze || 8) };
    case "strategy_review":
      return {
        template_id: Number(form.template_id || 0),
        template_name: form.template_name.trim(),
        days: Number(form.days || 30)
      };
    case "strategy_experiment":
      return {
        template_id: Number(form.template_id || 0),
        template_name: form.template_name.trim(),
        goal: form.goal.trim()
      };
    case "alert_triage":
      return {
        window_minutes: Number(form.window_minutes || 15),
        max_signals: Number(form.max_signals || 100)
      };
    case "daily_market_brief":
      return { window_hours: Number(form.window_hours || 24) };
  }
}
async function fetchRuns(showLoading = false) {
  if (showLoading) loading.value = true;
  try {
    const res = await getAgentWorkflows({ ...query });
    runs.value = (res?.data?.list || []) as AgentWorkflowRun[];
    total.value = Number(res?.data?.total || 0);
  } finally {
    if (showLoading) loading.value = false;
  }
}
async function startWorkflow() {
  if (needsTemplate.value && !form.template_id && !form.template_name.trim()) {
    ElMessage.error(t("workflowPage.message.templateRequired"));
    return;
  }
  if (form.workflow === "strategy_experiment" && !form.goal.trim()) {
    ElMessage.error(t("workflowPage.message.goalRequired"));
    return;
  }
  starting.value = true;
  try {
    const res = await startAgentWorkflow({
      workflow: form.workflow,
      input: buildInput()
    });
    if (Number(res?.code) !== 200) throw new Error(res?.msg || "start failed");
    ElMessage.success(t("workflowPage.message.started"));
    await fetchRuns();
    if (res?.data?.id) await openDetail(res.data as AgentWorkflowRun);
  } catch (error: any) {
    ElMessage.error(error?.message || t("workflowPage.message.startFailed"));
  } finally {
    starting.value = false;
  }
}
async function openDetail(row: AgentWorkflowRun) {
  try {
    const res = await getAgentWorkflow(row.id);
    detail.value = (res?.data || row) as AgentWorkflowRun;
    detailVisible.value = true;
  } catch {
    detail.value = row;
    detailVisible.value = true;
  }
}
async function refreshDetail() {
  if (!detail.value) return;
  const res = await getAgentWorkflow(detail.value.id);
  detail.value = (res?.data || detail.value) as AgentWorkflowRun;
}
function scheduleRefresh() {
  timer = setTimeout(async () => {
    if (
      runs.value.some(
        item => item.status === "queued" || item.status === "running"
      )
    ) {
      await fetchRuns(false);
      if (
        detailVisible.value &&
        detail.value &&
        ["queued", "running"].includes(detail.value.status)
      ) {
        await refreshDetail();
      }
    }
    scheduleRefresh();
  }, 3000);
}
onMounted(async () => {
  await fetchRuns(true);
  scheduleRefresh();
});
onBeforeUnmount(() => timer && clearTimeout(timer));
</script>

<template>
  <div class="workflow-page p-4">
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div>
          <div class="text-lg font-medium">{{ t("workflowPage.title") }}</div>
          <div class="mt-1 text-sm text-gray-500">
            {{ t("workflowPage.subtitle") }}
          </div>
        </div>
      </template>
      <el-form label-width="150px" class="workflow-form">
        <el-form-item :label="t('workflowPage.form.workflow')">
          <el-select v-model="form.workflow" style="width: 320px">
            <el-option
              v-for="item in workflowOptions"
              :key="item"
              :label="workflowLabel(item)"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="form.workflow === 'market_scan'"
          :label="t('workflowPage.form.analyze')"
        >
          <el-input-number v-model="form.analyze" :min="1" :max="10" />
        </el-form-item>
        <template v-if="needsTemplate">
          <el-form-item :label="t('workflowPage.form.templateId')">
            <el-input-number
              v-model="form.template_id"
              :min="1"
              controls-position="right"
            />
            <span class="mx-3 text-gray-400">{{
              t("workflowPage.form.or")
            }}</span>
            <el-input
              v-model="form.template_name"
              :placeholder="t('workflowPage.form.templateName')"
              style="width: 280px"
            />
          </el-form-item>
        </template>
        <el-form-item
          v-if="form.workflow === 'strategy_review'"
          :label="t('workflowPage.form.days')"
        >
          <el-input-number v-model="form.days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item
          v-if="form.workflow === 'strategy_experiment'"
          :label="t('workflowPage.form.goal')"
        >
          <el-input
            v-model="form.goal"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            style="max-width: 720px"
          />
        </el-form-item>
        <template v-if="form.workflow === 'alert_triage'">
          <el-form-item :label="t('workflowPage.form.windowMinutes')"
            ><el-input-number v-model="form.window_minutes" :min="1" :max="120"
          /></el-form-item>
          <el-form-item :label="t('workflowPage.form.maxSignals')"
            ><el-input-number v-model="form.max_signals" :min="1" :max="100"
          /></el-form-item>
        </template>
        <el-form-item
          v-if="form.workflow === 'daily_market_brief'"
          :label="t('workflowPage.form.windowHours')"
        >
          <el-input-number v-model="form.window_hours" :min="1" :max="168" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="starting"
            @click="startWorkflow"
            >{{ t("workflowPage.button.start") }}</el-button
          >
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("workflowPage.history") }}</span>
          <el-button size="small" @click="fetchRuns(true)">{{
            t("workflowPage.button.refresh")
          }}</el-button>
        </div>
      </template>
      <div class="mb-3 flex gap-2">
        <el-select
          v-model="query.workflow"
          clearable
          :placeholder="t('workflowPage.form.workflow')"
          style="width: 220px"
          @change="fetchRuns(true)"
        >
          <el-option
            v-for="item in workflowOptions"
            :key="item"
            :label="workflowLabel(item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.status"
          clearable
          :placeholder="t('workflowPage.table.status')"
          style="width: 160px"
          @change="fetchRuns(true)"
        >
          <el-option
            v-for="item in statuses"
            :key="item"
            :label="t(`workflowPage.status.${item}`)"
            :value="item"
          />
        </el-select>
      </div>
      <el-table :data="runs" size="small">
        <el-table-column prop="id" label="ID" min-width="220" />
        <el-table-column
          :label="t('workflowPage.table.workflow')"
          min-width="180"
          ><template #default="{ row }">{{
            workflowLabel(row.workflow)
          }}</template></el-table-column
        >
        <el-table-column
          prop="schema_version"
          :label="t('workflowPage.table.schema')"
          min-width="190"
        />
        <el-table-column :label="t('workflowPage.table.status')" width="120"
          ><template #default="{ row }"
            ><el-tag :type="statusType(row.status)" size="small">{{
              t(`workflowPage.status.${row.status}`)
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          prop="stage"
          :label="t('workflowPage.table.stage')"
          min-width="150"
        />
        <el-table-column :label="t('workflowPage.table.tasks')" width="90"
          ><template #default="{ row }">{{
            row.child_task_ids?.length || 0
          }}</template></el-table-column
        >
        <el-table-column :label="t('workflowPage.table.createdAt')" width="180"
          ><template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('workflowPage.table.operation')"
          width="100"
          fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)">{{
              t("workflowPage.button.detail")
            }}</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="query.page"
        class="mt-3 justify-end"
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.limit"
        @current-change="fetchRuns(true)"
      />
    </el-card>

    <el-drawer
      v-model="detailVisible"
      :title="t('workflowPage.detail.title')"
      size="65%"
    >
      <template v-if="detail">
        <el-descriptions :column="2" border class="mb-4">
          <el-descriptions-item label="ID">{{
            detail.id
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('workflowPage.table.workflow')">{{
            workflowLabel(detail.workflow)
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('workflowPage.table.status')">{{
            detail.status
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('workflowPage.table.stage')">{{
            detail.stage
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="t('workflowPage.detail.tasks')"
            :span="2"
            >{{
              detail.child_task_ids?.join(", ") || "-"
            }}</el-descriptions-item
          >
          <el-descriptions-item
            v-if="detail.error"
            :label="t('workflowPage.detail.error')"
            :span="2"
            >{{ detail.error }}</el-descriptions-item
          >
        </el-descriptions>
        <div class="section-title">{{ t("workflowPage.detail.input") }}</div>
        <pre class="json-box">{{ prettyJSON(detail.input) }}</pre>
        <div class="section-title mt-4">
          {{ t("workflowPage.detail.result") }}
        </div>
        <pre class="json-box">{{ prettyJSON(detail.result) }}</pre>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.workflow-page {
  min-width: 0;
}

.workflow-form {
  max-width: 920px;
}

.section-title {
  margin-bottom: 8px;
  font-weight: 600;
}

.json-box {
  max-height: 460px;
  padding: 12px;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
