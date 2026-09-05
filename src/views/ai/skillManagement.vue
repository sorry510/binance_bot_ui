<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type UploadFile } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  activateAgentSkillVersion,
  createAgentSkill,
  deleteAgentSkill,
  getAgentSkillImplementations,
  getAgentSkills,
  getAgentSkillVersionDetail,
  getAgentSkillVersionFile,
  getAgentSkillVersions,
  importAgentSkillDirectory,
  importAgentSkillFile,
  updateAgentSkill,
  updateAgentSkillPermission,
  type AgentSkillConfig,
  type AgentSkillImplementation,
  type AgentSkillVersion,
  type AgentSkillVersionDetail
} from "@/api/agent";

defineOptions({ name: "AgentSkillManagement" });
const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const chatSavingId = ref<number | null>(null);
const activeTab = ref<"native" | "portable">("native");
const keyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const configuredSkillNames = ref<Set<string>>(new Set());
const dialogVisible = ref(false);
const importVisible = ref(false);
const importing = ref(false);
const versionsVisible = ref(false);
const versionLoading = ref(false);
const fileVisible = ref(false);
const fileLoading = ref(false);
const editingId = ref<number | null>(null);
const skills = ref<AgentSkillConfig[]>([]);
const implementations = ref<AgentSkillImplementation[]>([]);
const currentSkill = ref<AgentSkillConfig | null>(null);
const versions = ref<AgentSkillVersion[]>([]);
const versionDetail = ref<AgentSkillVersionDetail | null>(null);
const selectedFile = ref("");
const selectedFileContent = ref("");
const uploadFile = ref<File | null>(null);
const form = reactive({
  name: "",
  display_name: "",
  description: "",
  enabled: 1,
  chat_enabled: 1
});
const importForm = reactive({ mode: "upload", directory: "", activate: true });

const availableImplementations = computed(() => {
  if (editingId.value !== null) return implementations.value;
  return implementations.value.filter(
    item => !configuredSkillNames.value.has(item.name)
  );
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
function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}…` : "-";
}
function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
async function fetchData() {
  loading.value = true;
  try {
    const [skillRes, implementationRes] = await Promise.all([
      getAgentSkills({
        type: activeTab.value,
        keyword: keyword.value.trim(),
        page: page.value,
        limit: pageSize.value
      }),
      getAgentSkillImplementations()
    ]);
    const data = skillRes?.data;
    if (Array.isArray(data)) {
      skills.value = data.filter(
        (item: AgentSkillConfig) => item.type === activeTab.value
      );
      total.value = skills.value.length;
    } else {
      skills.value = (data?.list || []) as AgentSkillConfig[];
      total.value = Number(data?.total || 0);
    }
    implementations.value = (implementationRes?.data ||
      []) as AgentSkillImplementation[];
  } finally {
    loading.value = false;
  }
}
async function refreshConfiguredSkillNames() {
  const res = await getAgentSkills();
  const items = Array.isArray(res?.data)
    ? (res.data as AgentSkillConfig[])
    : ((res?.data?.list || []) as AgentSkillConfig[]);
  configuredSkillNames.value = new Set(items.map(item => item.name));
}
function searchSkills() {
  page.value = 1;
  fetchData();
}
function onTabChange() {
  page.value = 1;
  keyword.value = "";
  fetchData();
}
function onPageChange(value: number) {
  page.value = value;
  fetchData();
}
function onPageSizeChange(value: number) {
  pageSize.value = value;
  page.value = 1;
  fetchData();
}
function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    name: "",
    display_name: "",
    description: "",
    enabled: 1,
    chat_enabled: 1
  });
}
async function openCreate() {
  resetForm();
  try {
    await refreshConfiguredSkillNames();
  } catch {
    configuredSkillNames.value = new Set();
  }
  dialogVisible.value = true;
}
function openEdit(row: AgentSkillConfig) {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    enabled: row.enabled,
    chat_enabled: row.chat_enabled
  });
  dialogVisible.value = true;
}
function onImplementationChange(name: string) {
  const item = implementations.value.find(value => value.name === name);
  if (item) {
    form.display_name = item.display_name;
    form.description = item.description;
    form.chat_enabled = item.chat_default;
  }
}
async function save() {
  if (!form.name) {
    ElMessage.error(t("agentSkillPage.message.nameRequired"));
    return;
  }
  saving.value = true;
  try {
    if (editingId.value === null) await createAgentSkill({ ...form });
    else await updateAgentSkill(editingId.value, { ...form });
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
async function changeChatEnabled(row: AgentSkillConfig, value: number) {
  chatSavingId.value = row.id;
  try {
    const res = await updateAgentSkill(row.id, {
      display_name: row.display_name,
      description: row.description,
      enabled: row.enabled,
      chat_enabled: value
    });
    assertBusinessSuccess(res, t("agentSkillPage.message.chatUpdateFailed"));
    row.chat_enabled = value;
    ElMessage.success(t("agentSkillPage.message.chatUpdated"));
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillPage.message.chatUpdateFailed")
    );
    await fetchData();
  } finally {
    chatSavingId.value = null;
  }
}

function assertBusinessSuccess(res: any, fallback: string) {
  if (res && Number(res.code) !== 200) {
    throw new Error(res.msg || fallback);
  }
}

function openImport() {
  Object.assign(importForm, { mode: "upload", directory: "", activate: true });
  uploadFile.value = null;
  importVisible.value = true;
}
function onUploadChange(file: UploadFile) {
  uploadFile.value = file.raw || null;
}
async function importPortable() {
  importing.value = true;
  try {
    if (importForm.mode === "upload") {
      if (!uploadFile.value)
        throw new Error(t("agentSkillPage.message.fileRequired"));
      const res = await importAgentSkillFile(
        uploadFile.value,
        importForm.activate
      );
      assertBusinessSuccess(res, t("agentSkillPage.message.importFailed"));
    } else {
      if (!importForm.directory.trim())
        throw new Error(t("agentSkillPage.message.directoryRequired"));
      const res = await importAgentSkillDirectory(
        importForm.directory.trim(),
        importForm.activate
      );
      assertBusinessSuccess(res, t("agentSkillPage.message.importFailed"));
    }
    ElMessage.success(t("agentSkillPage.message.imported"));
    importVisible.value = false;
    activeTab.value = "portable";
    page.value = 1;
    keyword.value = "";
    await fetchData();
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentSkillPage.message.importFailed"));
  } finally {
    importing.value = false;
  }
}
async function openVersions(row: AgentSkillConfig) {
  currentSkill.value = row;
  versionsVisible.value = true;
  versionDetail.value = null;
  versionLoading.value = true;
  try {
    const res = await getAgentSkillVersions(row.id);
    versions.value = (res?.data || []) as AgentSkillVersion[];
    if (versions.value.length) await selectVersion(versions.value[0]);
  } finally {
    versionLoading.value = false;
  }
}
async function selectVersion(row: AgentSkillVersion) {
  versionLoading.value = true;
  try {
    const res = await getAgentSkillVersionDetail(row.id);
    versionDetail.value = (res?.data || null) as AgentSkillVersionDetail | null;
  } finally {
    versionLoading.value = false;
  }
}
async function activateVersion(row: AgentSkillVersion) {
  try {
    await activateAgentSkillVersion(row.id);
    ElMessage.success(t("agentSkillPage.message.activated"));
    await fetchData();
    if (currentSkill.value) {
      const latest = skills.value.find(x => x.id === currentSkill.value?.id);
      if (latest) currentSkill.value = latest;
    }
    await openVersions(currentSkill.value!);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillPage.message.activateFailed")
    );
  }
}
async function changeGrant(id: number, granted: number) {
  try {
    await updateAgentSkillPermission(id, granted);
    if (versionDetail.value) await selectVersion(versionDetail.value.version);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillPage.message.permissionFailed")
    );
    if (versionDetail.value) await selectVersion(versionDetail.value.version);
  }
}
async function viewFile(path: string) {
  if (!versionDetail.value) return;
  fileVisible.value = true;
  fileLoading.value = true;
  selectedFile.value = path;
  selectedFileContent.value = "";
  try {
    const res = await getAgentSkillVersionFile(
      versionDetail.value.version.id,
      path
    );
    selectedFileContent.value = res?.data?.content || "";
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillPage.message.fileLoadFailed")
    );
  } finally {
    fileLoading.value = false;
  }
}
onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header
        ><div class="flex items-center justify-between">
          <span>{{ t("agentSkillPage.title") }}</span>
          <div class="flex gap-2">
            <el-button @click="openImport">{{
              t("agentSkillPage.button.import")
            }}</el-button
            ><el-button type="primary" @click="openCreate">{{
              t("agentSkillPage.button.add")
            }}</el-button>
          </div>
        </div></template
      >
      <el-alert
        :title="t('agentSkillPage.hint.implementation')"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-tabs v-model="activeTab" class="skill-tabs" @tab-change="onTabChange">
        <el-tab-pane :label="t('agentSkillPage.type.native')" name="native" />
        <el-tab-pane
          :label="t('agentSkillPage.type.portable')"
          name="portable"
        />
      </el-tabs>
      <div class="skill-toolbar">
        <el-input
          v-model="keyword"
          clearable
          :placeholder="t('agentSkillPage.placeholder.search')"
          class="skill-search"
          @keyup.enter="searchSkills"
          @clear="searchSkills"
        />
        <el-button type="primary" @click="searchSkills">{{
          t("agentSkillPage.button.search")
        }}</el-button>
      </div>
      <el-table v-loading="loading" :data="skills" size="small">
        <el-table-column
          prop="name"
          :label="t('agentSkillPage.table.skill')"
          min-width="170"
        />
        <el-table-column :label="t('agentSkillPage.table.type')" width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.type === 'portable' ? 'warning' : 'info'">{{
              t(`agentSkillPage.type.${row.type || "native"}`)
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          :label="t('agentSkillPage.table.displayName')"
          min-width="140"
          ><template #default="{ row }">{{
            implementationText(row.name, "displayName", row.display_name)
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('agentSkillPage.table.description')"
          min-width="260"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            implementationText(row.name, "description", row.description)
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('agentSkillPage.table.activeRevision')"
          width="150"
          ><template #default="{ row }"
            ><span v-if="row.type === 'portable'"
              >#{{ row.active_version_id || "-" }}</span
            ><span v-else>-</span></template
          ></el-table-column
        >
        <el-table-column :label="t('agentSkillPage.table.enabled')" width="90"
          ><template #default="{ row }"
            ><el-tag
              :type="row.enabled === 1 ? 'success' : 'info'"
              size="small"
              >{{
                row.enabled === 1
                  ? t("dashboard.state.on")
                  : t("dashboard.state.off")
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column
          :label="t('agentSkillPage.table.chatEnabled')"
          width="110"
          align="center"
          ><template #default="{ row }"
            ><el-switch
              :model-value="row.chat_enabled"
              :active-value="1"
              :inactive-value="0"
              :loading="chatSavingId === row.id"
              @change="
                value => changeChatEnabled(row, Number(value))
              " /></template
        ></el-table-column>
        <el-table-column
          :label="t('agentSkillPage.table.operation')"
          width="245"
          fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-if="row.type === 'portable'"
              size="small"
              type="warning"
              plain
              @click="openVersions(row)"
              >{{ t("agentSkillPage.button.versions") }}</el-button
            ><el-button size="small" @click="openEdit(row)">{{
              t("agentSkillPage.button.edit")
            }}</el-button
            ><el-button size="small" type="danger" @click="remove(row)">{{
              t("agentSkillPage.button.delete")
            }}</el-button></template
          ></el-table-column
        >
      </el-table>
      <div class="skill-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
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
      <el-form label-width="150px"
        ><el-form-item :label="t('agentSkillPage.field.implementation')"
          ><el-select
            v-model="form.name"
            class="w-full"
            :disabled="editingId !== null"
            @change="onImplementationChange"
            ><el-option
              v-for="item in availableImplementations"
              :key="item.name"
              :label="`${implementationText(item.name, 'displayName', item.display_name)} (${item.name})`"
              :value="item.name" /></el-select></el-form-item
        ><el-form-item :label="t('agentSkillPage.table.displayName')"
          ><el-input v-model="form.display_name" /></el-form-item
        ><el-form-item :label="t('agentSkillPage.table.description')"
          ><el-input
            v-model="form.description"
            type="textarea"
            :rows="3" /></el-form-item
        ><el-form-item :label="t('agentSkillPage.table.enabled')"
          ><el-switch
            v-model="form.enabled"
            :active-value="1"
            :inactive-value="0" /></el-form-item
        ><el-form-item :label="t('agentSkillPage.table.chatEnabled')"
          ><el-switch
            v-model="form.chat_enabled"
            :active-value="1"
            :inactive-value="0"
          />
          <span class="chat-switch-hint">{{
            t("agentSkillPage.hint.chatEnabled")
          }}</span></el-form-item
        ></el-form
      >
      <template #footer
        ><el-button @click="dialogVisible = false">{{
          t("agentSkillPage.button.cancel")
        }}</el-button
        ><el-button type="primary" :loading="saving" @click="save">{{
          t("agentSkillPage.button.save")
        }}</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="importVisible"
      :title="t('agentSkillPage.dialog.import')"
      width="680px"
    >
      <el-alert
        :title="t('agentSkillPage.hint.portable')"
        type="warning"
        :closable="false"
        class="mb-4"
      />
      <el-form label-width="150px"
        ><el-form-item :label="t('agentSkillPage.field.importMode')"
          ><el-radio-group v-model="importForm.mode"
            ><el-radio value="upload">{{
              t("agentSkillPage.importMode.upload")
            }}</el-radio
            ><el-radio value="directory">{{
              t("agentSkillPage.importMode.directory")
            }}</el-radio></el-radio-group
          ></el-form-item
        ><el-form-item
          v-if="importForm.mode === 'upload'"
          :label="t('agentSkillPage.field.file')"
          ><el-upload
            :auto-upload="false"
            :limit="1"
            accept=".zip,.md"
            :on-change="onUploadChange"
            ><el-button>{{ t("agentSkillPage.button.chooseFile") }}</el-button
            ><template #tip
              ><div class="el-upload__tip">
                {{ t("agentSkillPage.hint.file") }}
              </div></template
            ></el-upload
          ></el-form-item
        ><el-form-item v-else :label="t('agentSkillPage.field.directory')"
          ><el-input
            v-model="importForm.directory"
            :placeholder="t('agentSkillPage.placeholder.directory')"
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ t("agentSkillPage.hint.directory") }}
          </div></el-form-item
        ><el-form-item :label="t('agentSkillPage.field.activate')"
          ><el-switch v-model="importForm.activate" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="importVisible = false">{{
          t("agentSkillPage.button.cancel")
        }}</el-button
        ><el-button
          type="primary"
          :loading="importing"
          @click="importPortable"
          >{{ t("agentSkillPage.button.import") }}</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="versionsVisible"
      :title="
        t('agentSkillPage.dialog.versions', { name: currentSkill?.name || '' })
      "
      width="1100px"
    >
      <div v-loading="versionLoading">
        <el-table
          :data="versions"
          size="small"
          highlight-current-row
          @current-change="row => row && selectVersion(row)"
          ><el-table-column prop="id" label="ID" width="70" /><el-table-column
            prop="version"
            :label="t('agentSkillPage.table.version')"
            width="110"
          /><el-table-column
            :label="t('agentSkillPage.table.packageHash')"
            min-width="180"
            ><template #default="{ row }"
              ><span :title="row.package_hash">{{
                shortHash(row.package_hash)
              }}</span></template
            ></el-table-column
          ><el-table-column
            prop="validation_status"
            :label="t('agentSkillPage.table.validation')"
            width="110"
          /><el-table-column
            prop="source"
            :label="t('agentSkillPage.table.source')"
            width="130"
          /><el-table-column :label="t('agentSkillPage.table.size')" width="100"
            ><template #default="{ row }">{{
              formatBytes(row.total_bytes)
            }}</template></el-table-column
          ><el-table-column
            :label="t('agentSkillPage.table.operation')"
            width="120"
            ><template #default="{ row }"
              ><el-tag
                v-if="currentSkill?.active_version_id === row.id"
                type="success"
                >{{ t("agentSkillPage.state.active") }}</el-tag
              ><el-button
                v-else
                size="small"
                @click.stop="activateVersion(row)"
                >{{ t("agentSkillPage.button.activate") }}</el-button
              ></template
            ></el-table-column
          ></el-table
        >
        <template v-if="versionDetail"
          ><el-divider content-position="left">{{
            t("agentSkillPage.section.permissions")
          }}</el-divider
          ><el-alert
            :title="t('agentSkillPage.hint.allowedTools')"
            type="info"
            :closable="false"
            class="mb-3"
          /><el-table :data="versionDetail.permissions" size="small"
            ><el-table-column
              prop="requested_name"
              :label="t('agentSkillPage.table.requestedTool')"
              min-width="180" /><el-table-column
              prop="resolved_name"
              :label="t('agentSkillPage.table.resolvedTool')"
              min-width="220" /><el-table-column
              prop="risk"
              label="Risk"
              width="90" /><el-table-column
              prop="status"
              :label="t('agentSkillPage.table.status')"
              width="130" /><el-table-column
              prop="reason"
              :label="t('agentSkillPage.table.reason')"
              min-width="220"
              show-overflow-tooltip /><el-table-column
              :label="t('agentSkillPage.table.granted')"
              width="100"
              ><template #default="{ row }"
                ><el-switch
                  :model-value="row.granted"
                  :active-value="1"
                  :inactive-value="0"
                  :disabled="!row.resolved_name"
                  @change="
                    value => changeGrant(row.id, Number(value))
                  " /></template></el-table-column></el-table
          ><el-divider content-position="left">{{
            t("agentSkillPage.section.files")
          }}</el-divider
          ><el-table
            :data="versionDetail.files.map(path => ({ path }))"
            size="small"
            max-height="260"
            ><el-table-column
              prop="path"
              :label="t('agentSkillPage.table.file')"
              min-width="420"
            /><el-table-column
              :label="t('agentSkillPage.table.operation')"
              width="100"
              ><template #default="{ row }"
                ><el-button size="small" @click="viewFile(row.path)">{{
                  t("agentSkillPage.button.view")
                }}</el-button></template
              ></el-table-column
            ></el-table
          ></template
        >
      </div>
    </el-dialog>
    <el-dialog v-model="fileVisible" :title="selectedFile" width="900px"
      ><div v-loading="fileLoading">
        <pre class="file-preview">{{ selectedFileContent }}</pre>
      </div></el-dialog
    >
  </div>
</template>

<style scoped>
.skill-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.skill-search {
  max-width: 420px;
}

.skill-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.chat-switch-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-preview {
  max-height: 65vh;
  padding: 12px;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
