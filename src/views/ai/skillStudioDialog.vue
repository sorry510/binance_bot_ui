<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import {
  deleteAgentSkillDraftFile,
  getAgentSkillDraft,
  getAgentSkillDraftFile,
  publishAgentSkillDraft,
  saveAgentSkillDraftFile,
  uploadAgentSkillDraftFile,
  validateAgentSkillDraft,
  type AgentSkillDraftDetail,
  type AgentSkillDraftValidation
} from "@/api/agent";
import { codeMirrorBasicSetup } from "@/utils/codemirror";

defineOptions({ name: "SkillStudioDialog" });

const props = defineProps<{
  modelValue: boolean;
  draftId: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  published: [];
}>();

const { t } = useI18n();
const loading = ref(false);
const saving = ref(false);
const validating = ref(false);
const publishing = ref(false);
const draft = ref<AgentSkillDraftDetail | null>(null);
const validation = ref<AgentSkillDraftValidation | null>(null);
const selectedFile = ref("");
const content = ref("");
const savedContent = ref("");
const editorMode = ref<"edit" | "preview">("edit");
const uploadInput = ref<HTMLInputElement>();
const editorExtensions = [keymap.of([indentWithTab])];
const dirty = computed(() => content.value !== savedContent.value);

interface FileTreeNode {
  key: string;
  label: string;
  path?: string;
  children?: FileTreeNode[];
}

const treeData = computed<FileTreeNode[]>(() =>
  buildFileTree(draft.value?.files || [])
);

function assertSuccess(res: any, fallback: string) {
  if (res && Number(res.code) !== 200) throw new Error(res.msg || fallback);
}

function buildFileTree(files: string[]): FileTreeNode[] {
  const root: FileTreeNode = { key: "__root__", label: "", children: [] };
  const sorted = [...files].sort((a, b) => {
    if (a === "SKILL.md") return -1;
    if (b === "SKILL.md") return 1;
    return a.localeCompare(b);
  });
  for (const path of sorted) {
    const parts = path.split("/").filter(Boolean);
    let current = root;
    parts.forEach((part, index) => {
      const key = parts.slice(0, index + 1).join("/");
      current.children ||= [];
      let node = current.children.find(item => item.key === key);
      if (!node) {
        node = {
          key,
          label: part,
          children: index < parts.length - 1 ? [] : undefined
        };
        if (index === parts.length - 1) node.path = path;
        current.children.push(node);
      }
      current = node;
    });
  }
  return root.children || [];
}

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}…` : "-";
}
async function loadDraft() {
  if (!props.draftId) return;
  loading.value = true;
  validation.value = null;
  try {
    const res = await getAgentSkillDraft(props.draftId);
    assertSuccess(res, t("agentSkillStudio.message.loadFailed"));
    draft.value = res?.data as AgentSkillDraftDetail;
    const nextFile =
      selectedFile.value && draft.value.files.includes(selectedFile.value)
        ? selectedFile.value
        : draft.value.files.includes("SKILL.md")
          ? "SKILL.md"
          : draft.value.files[0] || "";
    if (nextFile) await readFile(nextFile, true);
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentSkillStudio.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}

async function readFile(path: string, force = false) {
  if (!props.draftId || !path) return;
  if (!force && dirty.value) {
    try {
      await ElMessageBox.confirm(
        t("agentSkillStudio.confirm.discard"),
        t("agentSkillStudio.confirm.title"),
        { type: "warning" }
      );
    } catch {
      return;
    }
  }
  try {
    const res = await getAgentSkillDraftFile(props.draftId, path);
    assertSuccess(res, t("agentSkillStudio.message.fileLoadFailed"));
    selectedFile.value = path;
    content.value = String(res?.data?.content || "");
    savedContent.value = content.value;
    editorMode.value = "edit";
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillStudio.message.fileLoadFailed")
    );
  }
}

async function handleTreeClick(node: FileTreeNode) {
  if (node.path) await readFile(node.path);
}

async function saveCurrent(showMessage = true) {
  if (!props.draftId || !selectedFile.value || !dirty.value) return true;
  saving.value = true;
  try {
    const res = await saveAgentSkillDraftFile(
      props.draftId,
      selectedFile.value,
      content.value
    );
    assertSuccess(res, t("agentSkillStudio.message.saveFailed"));
    draft.value = res?.data as AgentSkillDraftDetail;
    savedContent.value = content.value;
    validation.value = null;
    if (showMessage) ElMessage.success(t("agentSkillStudio.message.saved"));
    return true;
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentSkillStudio.message.saveFailed"));
    return false;
  } finally {
    saving.value = false;
  }
}

async function createTextFile() {
  if (!props.draftId) return;
  try {
    const result = await ElMessageBox.prompt(
      t("agentSkillStudio.prompt.filePath"),
      t("agentSkillStudio.button.newFile"),
      {
        inputPlaceholder: "references/guide.md",
        inputValidator: value =>
          Boolean(String(value || "").trim()) ||
          t("agentSkillStudio.message.pathRequired")
      }
    );
    const path = String(result.value || "").trim();
    const res = await saveAgentSkillDraftFile(props.draftId, path, "");
    assertSuccess(res, t("agentSkillStudio.message.saveFailed"));
    draft.value = res?.data as AgentSkillDraftDetail;
    validation.value = null;
    await readFile(path, true);
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("agentSkillStudio.message.saveFailed"));
  }
}
async function deleteCurrentFile() {
  if (
    !props.draftId ||
    !selectedFile.value ||
    selectedFile.value === "SKILL.md"
  )
    return;
  try {
    await ElMessageBox.confirm(
      t("agentSkillStudio.confirm.deleteFile", { path: selectedFile.value }),
      t("agentSkillStudio.confirm.title"),
      { type: "warning" }
    );
    const res = await deleteAgentSkillDraftFile(
      props.draftId,
      selectedFile.value
    );
    assertSuccess(res, t("agentSkillStudio.message.deleteFileFailed"));
    draft.value = res?.data as AgentSkillDraftDetail;
    validation.value = null;
    selectedFile.value = "";
    content.value = "";
    savedContent.value = "";
    if (draft.value.files.includes("SKILL.md"))
      await readFile("SKILL.md", true);
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("agentSkillStudio.message.deleteFileFailed")
    );
  }
}

function chooseAsset() {
  uploadInput.value?.click();
}

async function onAssetSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !props.draftId) return;
  try {
    const result = await ElMessageBox.prompt(
      t("agentSkillStudio.prompt.uploadPath"),
      t("agentSkillStudio.button.uploadAsset"),
      { inputValue: `assets/${file.name}` }
    );
    const path = String(result.value || "").trim();
    if (!path) throw new Error(t("agentSkillStudio.message.pathRequired"));
    const res = await uploadAgentSkillDraftFile(props.draftId, file, path);
    assertSuccess(res, t("agentSkillStudio.message.uploadFailed"));
    draft.value = res?.data as AgentSkillDraftDetail;
    validation.value = null;
    ElMessage.success(t("agentSkillStudio.message.uploaded"));
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(
      error?.message || t("agentSkillStudio.message.uploadFailed")
    );
  }
}

async function validateDraft(showMessage = true) {
  if (!props.draftId) return false;
  if (!(await saveCurrent(false))) return false;
  validating.value = true;
  try {
    const res = await validateAgentSkillDraft(props.draftId);
    assertSuccess(res, t("agentSkillStudio.message.validateFailed"));
    validation.value = res?.data as AgentSkillDraftValidation;
    if (validation.value.valid) {
      if (showMessage) ElMessage.success(t("agentSkillStudio.message.valid"));
      return true;
    }
    if (showMessage)
      ElMessage.error(
        validation.value.error || t("agentSkillStudio.message.invalid")
      );
    return false;
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillStudio.message.validateFailed")
    );
    return false;
  } finally {
    validating.value = false;
  }
}

async function publish(activate: boolean) {
  if (!props.draftId || publishing.value) return;
  if (!(await validateDraft(false))) {
    ElMessage.error(
      validation.value?.error || t("agentSkillStudio.message.invalid")
    );
    return;
  }
  publishing.value = true;
  try {
    const res = await publishAgentSkillDraft(props.draftId, { activate });
    assertSuccess(res, t("agentSkillStudio.message.publishFailed"));
    ElMessage.success(
      activate
        ? t("agentSkillStudio.message.publishedActivated")
        : t("agentSkillStudio.message.published")
    );
    emit("published");
    emit("update:modelValue", false);
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentSkillStudio.message.publishFailed")
    );
  } finally {
    publishing.value = false;
  }
}
watch(
  () => [props.modelValue, props.draftId] as const,
  ([visible, id]) => {
    if (visible && id) void loadDraft();
  }
);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="$t('agentSkillStudio.title', { name: draft?.skill_name || '-' })"
    width="94%"
    top="3vh"
    destroy-on-close
    class="skill-studio-dialog"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div v-loading="loading" class="studio-shell">
      <div class="studio-toolbar">
        <div class="studio-meta">
          <el-tag type="warning" effect="plain">Draft</el-tag>
          <span>{{ draft?.skill_name }}</span>
          <span v-if="draft?.source_version_id" class="muted">
            {{
              $t("agentSkillStudio.sourceVersion", {
                id: draft.source_version_id
              })
            }}
          </span>
        </div>
        <div class="studio-actions">
          <input
            ref="uploadInput"
            type="file"
            class="hidden-upload"
            @change="onAssetSelected"
          />
          <el-button @click="createTextFile">{{
            $t("agentSkillStudio.button.newFile")
          }}</el-button>
          <el-button @click="chooseAsset">{{
            $t("agentSkillStudio.button.uploadAsset")
          }}</el-button>
          <el-button
            :disabled="!selectedFile || !dirty"
            :loading="saving"
            @click="saveCurrent()"
          >
            {{ $t("agentSkillStudio.button.save") }}
          </el-button>
          <el-button :loading="validating" @click="validateDraft()">
            {{ $t("agentSkillStudio.button.validate") }}
          </el-button>
          <el-button :loading="publishing" @click="publish(false)">
            {{ $t("agentSkillStudio.button.publish") }}
          </el-button>
          <el-button
            type="primary"
            :loading="publishing"
            @click="publish(true)"
          >
            {{ $t("agentSkillStudio.button.publishActivate") }}
          </el-button>
        </div>
      </div>

      <div class="studio-grid">
        <aside class="file-panel">
          <div class="panel-title">{{ $t("agentSkillStudio.files") }}</div>
          <el-tree
            :data="treeData"
            node-key="key"
            default-expand-all
            highlight-current
            :current-node-key="selectedFile"
            @node-click="handleTreeClick"
          />
        </aside>
        <main class="editor-panel">
          <div class="editor-header">
            <div>
              <strong>{{ selectedFile || "-" }}</strong>
              <el-tag
                v-if="dirty"
                size="small"
                type="warning"
                class="dirty-tag"
              >
                {{ $t("agentSkillStudio.unsaved") }}
              </el-tag>
            </div>
            <div class="editor-header-actions">
              <el-radio-group v-model="editorMode" size="small">
                <el-radio-button value="edit">{{
                  $t("agentSkillStudio.mode.edit")
                }}</el-radio-button>
                <el-radio-button value="preview">{{
                  $t("agentSkillStudio.mode.preview")
                }}</el-radio-button>
              </el-radio-group>
              <el-button
                size="small"
                type="danger"
                plain
                :disabled="!selectedFile || selectedFile === 'SKILL.md'"
                @click="deleteCurrentFile"
              >
                {{ $t("agentSkillStudio.button.deleteFile") }}
              </el-button>
            </div>
          </div>
          <Codemirror
            v-if="editorMode === 'edit' && selectedFile"
            v-model="content"
            :basic-setup="codeMirrorBasicSetup"
            :extensions="editorExtensions"
            class="studio-editor"
          />
          <pre v-else-if="selectedFile" class="raw-preview">{{ content }}</pre>
          <el-empty v-else :description="$t('agentSkillStudio.emptyFile')" />
        </main>

        <aside class="validation-panel">
          <div class="panel-title">
            {{ $t("agentSkillStudio.validation.title") }}
          </div>
          <template v-if="validation">
            <el-alert
              :type="validation.valid ? 'success' : 'error'"
              :title="
                validation.valid
                  ? $t('agentSkillStudio.validation.valid')
                  : validation.error
              "
              :closable="false"
              show-icon
            />
            <el-descriptions
              :column="1"
              size="small"
              border
              class="validation-meta"
            >
              <el-descriptions-item
                :label="$t('agentSkillStudio.validation.version')"
              >
                {{ validation.version || "-" }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="$t('agentSkillStudio.validation.hash')"
              >
                {{ shortHash(validation.package_hash) }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="$t('agentSkillStudio.validation.files')"
              >
                {{ validation.file_count }}
              </el-descriptions-item>
              <el-descriptions-item
                :label="$t('agentSkillStudio.validation.size')"
              >
                {{ formatBytes(validation.total_bytes) }}
              </el-descriptions-item>
            </el-descriptions>
            <div class="validation-section">
              <div class="section-label">
                {{ $t("agentSkillStudio.validation.tools") }}
              </div>
              <div v-if="validation.requested_tools?.length" class="tag-list">
                <el-tag
                  v-for="tool in validation.requested_tools"
                  :key="tool"
                  size="small"
                >
                  {{ tool }}
                </el-tag>
              </div>
              <span v-else class="muted">-</span>
            </div>
            <div class="validation-section">
              <div class="section-label">
                {{ $t("agentSkillStudio.validation.diagnostics") }}
              </div>
              <el-alert
                v-for="item in validation.diagnostics"
                :key="`${item.code}-${item.path || ''}`"
                :type="item.level === 'warning' ? 'warning' : 'info'"
                :title="item.message"
                :description="item.path"
                :closable="false"
                class="diagnostic-item"
              />
              <span v-if="!validation.diagnostics?.length" class="muted"
                >-</span
              >
            </div>
          </template>
          <el-empty
            v-else
            :description="$t('agentSkillStudio.validation.empty')"
          />
        </aside>
      </div>
    </div>
  </el-dialog>
</template>
<style scoped>
.studio-shell {
  min-height: 76vh;
}

.studio-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.studio-meta,
.studio-actions,
.editor-header,
.editor-header-actions,
.tag-list {
  display: flex;
  gap: 8px;
  align-items: center;
}

.studio-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.studio-grid {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 70vh;
}

.file-panel,
.editor-panel,
.validation-panel {
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.file-panel,
.validation-panel {
  padding: 12px;
  overflow: auto;
}

.panel-title {
  margin-bottom: 10px;
  font-weight: 600;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  justify-content: space-between;
  min-height: 46px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dirty-tag {
  margin-left: 8px;
}

.studio-editor {
  flex: 1;
  min-height: 0;
}

.studio-editor :deep(.cm-editor) {
  height: 64vh;
}

.studio-editor :deep(.cm-scroller) {
  overflow: auto;
}

.raw-preview {
  height: 64vh;
  padding: 14px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-lighter);
}

.validation-meta {
  margin-top: 12px;
}

.validation-section {
  margin-top: 14px;
}

.section-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.tag-list {
  flex-wrap: wrap;
}

.diagnostic-item {
  margin-bottom: 8px;
}

.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.hidden-upload {
  display: none;
}

@media (width <= 1200px) {
  .studio-grid {
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .validation-panel {
    grid-column: 1 / -1;
    max-height: 260px;
  }
}
</style>
