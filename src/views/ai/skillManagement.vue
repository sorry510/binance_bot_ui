<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  createAgentSkill,
  deleteAgentSkill,
  getAgentSkillImplementations,
  getAgentSkills,
  updateAgentSkill,
  type AgentSkillConfig,
  type AgentSkillImplementation
} from "@/api/agent";

defineOptions({ name: "AgentSkillManagement" });
const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const skills = ref<AgentSkillConfig[]>([]);
const implementations = ref<AgentSkillImplementation[]>([]);
const form = reactive({
  name: "",
  display_name: "",
  description: "",
  enabled: 1,
  max_tool_calls: 0,
  max_tokens: 0
});

const availableImplementations = computed(() => {
  if (editingId.value !== null) return implementations.value;
  const configured = new Set(skills.value.map(item => item.name));
  return implementations.value.filter(item => !configured.has(item.name));
});

async function fetchData() {
  loading.value = true;
  try {
    const [skillRes, implementationRes] = await Promise.all([
      getAgentSkills(),
      getAgentSkillImplementations()
    ]);
    skills.value = (skillRes?.data || []) as AgentSkillConfig[];
    implementations.value = (implementationRes?.data ||
      []) as AgentSkillImplementation[];
  } finally {
    loading.value = false;
  }
}
function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    name: "",
    display_name: "",
    description: "",
    enabled: 1,
    max_tool_calls: 0,
    max_tokens: 0
  });
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AgentSkillConfig) {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    enabled: row.enabled,
    max_tool_calls: row.max_tool_calls,
    max_tokens: row.max_tokens
  });
  dialogVisible.value = true;
}
function onImplementationChange(name: string) {
  const item = implementations.value.find(value => value.name === name);
  if (!item) return;
  form.display_name = item.display_name;
  form.description = item.description;
}

async function save() {
  if (!form.name) {
    ElMessage.error(t("agentSkillPage.message.nameRequired"));
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form };
    if (editingId.value === null) {
      await createAgentSkill(payload);
    } else {
      await updateAgentSkill(editingId.value, payload);
    }
    ElMessage.success(t("agentSkillPage.message.saved"));
    dialogVisible.value = false;
    await fetchData();
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentSkillPage.message.saveFailed"));
  } finally {
    saving.value = false;
  }
}
async function remove(row: AgentSkillConfig) {
  try {
    await ElMessageBox.confirm(
      t("agentSkillPage.confirm.delete", { name: row.name }),
      t("agentSkillPage.confirm.title"),
      { type: "warning" }
    );
    await deleteAgentSkill(row.id);
    ElMessage.success(t("agentSkillPage.message.deleted"));
    await fetchData();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("agentSkillPage.message.deleteFailed"));
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ t("agentSkillPage.title") }}</span>
          <el-button type="primary" @click="openCreate">{{
            t("agentSkillPage.button.add")
          }}</el-button>
        </div>
      </template>
      <el-alert
        :title="t('agentSkillPage.hint.implementation')"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-table v-loading="loading" :data="skills" size="small">
        <el-table-column prop="name" label="Skill" min-width="180" />
        <el-table-column
          prop="display_name"
          :label="t('agentSkillPage.table.displayName')"
          min-width="140"
        />
        <el-table-column
          prop="description"
          :label="t('agentSkillPage.table.description')"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column :label="t('agentSkillPage.table.enabled')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{
                row.enabled === 1
                  ? t("dashboard.state.on")
                  : t("dashboard.state.off")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="max_tool_calls"
          :label="t('agentSkillPage.table.maxToolCalls')"
          width="120"
        />
        <el-table-column
          prop="max_tokens"
          :label="t('agentSkillPage.table.maxTokens')"
          width="120"
        />
        <el-table-column
          :label="t('agentSkillPage.table.operation')"
          width="150"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">{{
              t("agentSkillPage.button.edit")
            }}</el-button>
            <el-button size="small" type="danger" @click="remove(row)">{{
              t("agentSkillPage.button.delete")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId === null
          ? t('agentSkillPage.dialog.add')
          : t('agentSkillPage.dialog.edit')
      "
      width="620px"
    >
      <el-form label-width="150px">
        <el-form-item label="Skill implementation">
          <el-select
            v-model="form.name"
            class="w-full"
            :disabled="editingId !== null"
            @change="onImplementationChange"
          >
            <el-option
              v-for="item in availableImplementations"
              :key="item.name"
              :label="`${item.display_name} (${item.name})`"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('agentSkillPage.table.displayName')">
          <el-input v-model="form.display_name" />
        </el-form-item>
        <el-form-item :label="t('agentSkillPage.table.description')">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('agentSkillPage.table.enabled')">
          <el-switch
            v-model="form.enabled"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('agentSkillPage.table.maxToolCalls')">
          <el-input-number v-model="form.max_tool_calls" :min="0" :max="1000" />
          <span class="ml-2 text-xs">{{
            t("agentSkillPage.hint.zeroUsesGlobal")
          }}</span>
        </el-form-item>
        <el-form-item :label="t('agentSkillPage.table.maxTokens')">
          <el-input-number v-model="form.max_tokens" :min="0" :step="1000" />
          <span class="ml-2 text-xs">{{
            t("agentSkillPage.hint.zeroUsesGlobal")
          }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{
          t("agentSkillPage.button.cancel")
        }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{
          t("agentSkillPage.button.save")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
