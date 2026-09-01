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
  enabled: 1
});

const availableImplementations = computed(() => {
  if (editingId.value !== null) return implementations.value;
  const configured = new Set(skills.value.map(item => item.name));
  return implementations.value.filter(item => !configured.has(item.name));
});

function implementationText(
  name: string,
  field: "displayName" | "description",
  fallback: string
) {
  const key = `agentSkillPage.implementation.${name}.${field}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

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
    enabled: 1
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
    enabled: row.enabled
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
        <el-table-column
          prop="name"
          :label="t('agentSkillPage.table.skill')"
          min-width="180"
        />
        <el-table-column
          :label="t('agentSkillPage.table.displayName')"
          min-width="140"
        >
          <template #default="{ row }">
            {{ implementationText(row.name, "displayName", row.display_name) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentSkillPage.table.description')"
          min-width="260"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ implementationText(row.name, "description", row.description) }}
          </template>
        </el-table-column>
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
        <el-form-item :label="t('agentSkillPage.field.implementation')">
          <el-select
            v-model="form.name"
            class="w-full"
            :disabled="editingId !== null"
            @change="onImplementationChange"
          >
            <el-option
              v-for="item in availableImplementations"
              :key="item.name"
              :label="`${implementationText(
                item.name,
                'displayName',
                item.display_name
              )} (${item.name})`"
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
