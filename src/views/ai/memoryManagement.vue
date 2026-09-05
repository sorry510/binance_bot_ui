<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  approveAgentMemory,
  createAgentMemory,
  deleteAgentMemory,
  disableAgentMemory,
  enableAgentMemory,
  getAgentMemories,
  updateAgentMemory,
  type AgentMemory,
  type AgentMemoryListResult
} from "@/api/agent";

defineOptions({ name: "AgentMemoryManagement" });
const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const list = ref<AgentMemory[]>([]);
const total = ref(0);

const memoryTypes = [
  "user_preference",
  "strategy_fact",
  "market_hypothesis",
  "task_summary",
  "lesson"
];
const statusOptions = ["candidate", "active", "disabled", "expired"];
const query = reactive({
  page: 1,
  limit: 20,
  type: "",
  status: "",
  skill: "",
  symbol: "",
  strategy: "",
  include_expired: 0
});
const form = reactive({
  type: "user_preference",
  user: "local",
  skill: "",
  symbol: "",
  strategy: "",
  confidence: 1,
  content: "",
  expires_at: undefined as number | undefined,
  candidate: false
});

function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    type: "user_preference",
    user: "local",
    skill: "",
    symbol: "",
    strategy: "",
    confidence: 1,
    content: "",
    expires_at: undefined,
    candidate: false
  });
}

function typeLabel(value: string) {
  const key = `agentMemoryPage.type.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
function statusLabel(value: string) {
  const key = `agentMemoryPage.status.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
function statusTag(value: string) {
  if (value === "active") return "success";
  if (value === "candidate") return "warning";
  if (value === "expired") return "info";
  return "danger";
}
function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function scopeText(row: AgentMemory) {
  const parts = [
    row.scope?.user ? `user=${row.scope.user}` : "",
    row.scope?.skill ? `skill=${row.scope.skill}` : "",
    row.scope?.symbol ? `symbol=${row.scope.symbol}` : "",
    row.scope?.strategy ? `strategy=${row.scope.strategy}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t("agentMemoryPage.scope.global");
}

async function fetchData(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const res = await getAgentMemories({ ...query });
    const data = (res?.data || {}) as AgentMemoryListResult;
    list.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  resetForm();
  dialogVisible.value = true;
}
function openEdit(row: AgentMemory) {
  editingId.value = row.id;
  Object.assign(form, {
    type: row.type,
    user: row.scope?.user || "",
    skill: row.scope?.skill || "",
    symbol: row.scope?.symbol || "",
    strategy: row.scope?.strategy || "",
    confidence: Number(row.confidence ?? 1),
    content: row.content,
    expires_at: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
    candidate: row.status === "candidate"
  });
  dialogVisible.value = true;
}
async function save() {
  if (!form.content.trim()) {
    ElMessage.error(t("agentMemoryPage.message.contentRequired"));
    return;
  }
  saving.value = true;
  try {
    const scope = {
      user: form.user.trim(),
      skill: form.skill.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      strategy: form.strategy.trim()
    };
    if (editingId.value === null) {
      await createAgentMemory({
        type: form.type,
        scope,
        confidence: Number(form.confidence),
        content: form.content.trim(),
        expires_at: form.expires_at,
        candidate: form.candidate
      });
    } else {
      await updateAgentMemory(editingId.value, {
        scope,
        confidence: Number(form.confidence),
        content: form.content.trim(),
        expires_at: form.expires_at
      });
    }
    ElMessage.success(t("agentMemoryPage.message.saved"));
    dialogVisible.value = false;
    await fetchData();
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMemoryPage.message.saveFailed"));
  } finally {
    saving.value = false;
  }
}
async function changeStatus(
  row: AgentMemory,
  action: "disable" | "enable" | "approve"
) {
  try {
    if (action === "disable") await disableAgentMemory(row.id);
    else if (action === "enable") await enableAgentMemory(row.id);
    else await approveAgentMemory(row.id);
    ElMessage.success(t("agentMemoryPage.message.statusUpdated"));
    await fetchData();
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentMemoryPage.message.statusFailed")
    );
  }
}
async function remove(row: AgentMemory) {
  try {
    await ElMessageBox.confirm(
      t("agentMemoryPage.confirm.delete"),
      t("agentMemoryPage.confirm.title"),
      { type: "warning" }
    );
    await deleteAgentMemory(row.id);
    ElMessage.success(t("agentMemoryPage.message.deleted"));
    await fetchData();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("agentMemoryPage.message.deleteFailed")
    );
  }
}

onMounted(() => fetchData());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-medium">
              {{ t("agentMemoryPage.title") }}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              {{ t("agentMemoryPage.subtitle") }}
            </div>
          </div>
          <div class="flex gap-2">
            <el-button @click="fetchData()">{{
              t("agentMemoryPage.button.refresh")
            }}</el-button>
            <el-button type="primary" @click="openCreate">{{
              t("agentMemoryPage.button.add")
            }}</el-button>
          </div>
        </div>
      </template>

      <div class="mb-4 flex flex-wrap gap-2">
        <el-select
          v-model="query.type"
          clearable
          :placeholder="t('agentMemoryPage.placeholder.type')"
          style="width: 180px"
        >
          <el-option
            v-for="item in memoryTypes"
            :key="item"
            :label="typeLabel(item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.status"
          clearable
          :placeholder="t('agentMemoryPage.placeholder.status')"
          style="width: 150px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item"
            :label="statusLabel(item)"
            :value="item"
          />
        </el-select>
        <el-input
          v-model="query.skill"
          clearable
          :placeholder="t('agentMemoryPage.placeholder.skill')"
          style="width: 170px"
        />
        <el-input
          v-model="query.symbol"
          clearable
          :placeholder="t('agentMemoryPage.placeholder.symbol')"
          style="width: 150px"
        />
        <el-input
          v-model="query.strategy"
          clearable
          :placeholder="t('agentMemoryPage.placeholder.strategy')"
          style="width: 170px"
        />
        <el-switch
          v-model="query.include_expired"
          :active-value="1"
          :inactive-value="0"
          inline-prompt
          :active-text="t('agentMemoryPage.filter.expired')"
          :inactive-text="t('agentMemoryPage.filter.expired')"
        />
        <el-button type="primary" @click="fetchData(true)">{{
          t("agentMemoryPage.button.search")
        }}</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column :label="t('agentMemoryPage.table.type')" width="160">
          <template #default="{ row }"
            ><el-tag size="small">{{ typeLabel(row.type) }}</el-tag></template
          >
        </el-table-column>
        <el-table-column :label="t('agentMemoryPage.table.status')" width="110">
          <template #default="{ row }"
            ><el-tag :type="statusTag(row.status)" size="small">{{
              statusLabel(row.status)
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          :label="t('agentMemoryPage.table.scope')"
          min-width="250"
        >
          <template #default="{ row }">{{ scopeText(row) }}</template>
        </el-table-column>
        <el-table-column
          prop="content"
          :label="t('agentMemoryPage.table.content')"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('agentMemoryPage.table.confidence')"
          width="105"
        >
          <template #default="{ row }">{{
            Number(row.confidence || 0).toFixed(2)
          }}</template>
        </el-table-column>
        <el-table-column
          prop="source_task_id"
          :label="t('agentMemoryPage.table.sourceTask')"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('agentMemoryPage.table.expiresAt')"
          width="175"
        >
          <template #default="{ row }">{{
            formatTime(row.expires_at)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentMemoryPage.table.updatedAt')"
          width="175"
        >
          <template #default="{ row }">{{
            formatTime(row.updated_at)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="t('agentMemoryPage.table.operation')"
          width="270"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">{{
              t("agentMemoryPage.button.edit")
            }}</el-button>
            <el-button
              v-if="row.status === 'candidate'"
              size="small"
              type="success"
              @click="changeStatus(row, 'approve')"
              >{{ t("agentMemoryPage.button.approve") }}</el-button
            >
            <el-button
              v-else-if="row.status === 'active'"
              size="small"
              type="warning"
              @click="changeStatus(row, 'disable')"
              >{{ t("agentMemoryPage.button.disable") }}</el-button
            >
            <el-button
              v-else-if="row.status === 'disabled'"
              size="small"
              type="success"
              @click="changeStatus(row, 'enable')"
              >{{ t("agentMemoryPage.button.enable") }}</el-button
            >
            <el-button size="small" type="danger" @click="remove(row)">{{
              t("agentMemoryPage.button.delete")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.limit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="fetchData()"
          @size-change="fetchData(true)"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId === null
          ? t('agentMemoryPage.dialog.create')
          : t('agentMemoryPage.dialog.edit')
      "
      width="680px"
    >
      <el-form label-width="130px">
        <el-form-item :label="t('agentMemoryPage.form.type')">
          <el-select
            v-model="form.type"
            :disabled="editingId !== null"
            style="width: 100%"
          >
            <el-option
              v-for="item in memoryTypes"
              :key="item"
              :label="typeLabel(item)"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.content')"
          ><el-input v-model="form.content" type="textarea" :rows="6"
        /></el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.confidence')"
          ><el-slider
            v-model="form.confidence"
            :min="0"
            :max="1"
            :step="0.05"
            show-input
        /></el-form-item>
        <el-divider content-position="left">{{
          t("agentMemoryPage.form.scope")
        }}</el-divider>
        <el-form-item :label="t('agentMemoryPage.form.user')"
          ><el-input v-model="form.user"
        /></el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.skill')"
          ><el-input v-model="form.skill"
        /></el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.symbol')"
          ><el-input v-model="form.symbol"
        /></el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.strategy')"
          ><el-input v-model="form.strategy"
        /></el-form-item>
        <el-form-item :label="t('agentMemoryPage.form.expiresAt')">
          <el-date-picker
            v-model="form.expires_at"
            type="datetime"
            value-format="x"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item
          v-if="editingId === null"
          :label="t('agentMemoryPage.form.candidate')"
          ><el-switch v-model="form.candidate"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{
          t("agentMemoryPage.button.cancel")
        }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{
          t("agentMemoryPage.button.save")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
