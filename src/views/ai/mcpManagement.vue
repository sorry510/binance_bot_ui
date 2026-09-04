<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  createAgentMCPServer,
  deleteAgentMCPServer,
  getAgentMCPCatalog,
  getAgentMCPServers,
  getAgentSkills,
  refreshAgentMCPCatalog,
  saveAgentMCPPermission,
  startAgentMCPOAuth,
  testAgentMCPServer,
  updateAgentMCPServer,
  updateAgentMCPTool,
  type AgentMCPCatalog,
  type AgentMCPServer,
  type AgentMCPTool,
  type AgentSkillConfig
} from "@/api/agent";

defineOptions({ name: "AgentMCPManagement" });
const { t } = useI18n();
const loading = ref(false);
const catalogLoading = ref(false);
const saving = ref(false);
const servers = ref<AgentMCPServer[]>([]);
const skills = ref<AgentSkillConfig[]>([]);
const selectedServerId = ref<number | null>(null);
const catalog = ref<AgentMCPCatalog | null>(null);
const activeTab = ref("tools");
const serverDialog = ref(false);
const editingServerId = ref<number | null>(null);
const oauthWindow = ref<Window | null>(null);
const oauthStartingId = ref<number | null>(null);
let oauthPollTimer: number | null = null;
const serverForm = reactive({
  name: "",
  endpoint: "",
  enabled: 1,
  auth_type: "none",
  secret_ref: "",
  custom_header: "",
  allow_private: 0
});

const permissionDialog = ref(false);
const permissionTarget = reactive({
  server_id: 0,
  capability_type: "tool",
  capability_id: 0,
  name: ""
});
const permissionState = reactive<
  Record<string, { enabled: number; auto_load: number }>
>({});

const selectedServer = computed(() =>
  servers.value.find(item => item.id === selectedServerId.value)
);
async function fetchServers() {
  loading.value = true;
  try {
    const [serverRes, skillRes] = await Promise.all([
      getAgentMCPServers(),
      getAgentSkills()
    ]);
    servers.value = (serverRes?.data || []) as AgentMCPServer[];
    skills.value = (skillRes?.data || []) as AgentSkillConfig[];
    if (
      selectedServerId.value !== null &&
      !servers.value.some(item => item.id === selectedServerId.value)
    ) {
      selectedServerId.value = null;
      catalog.value = null;
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}

async function loadCatalog(serverId: number) {
  selectedServerId.value = serverId;
  catalogLoading.value = true;
  try {
    const res = await getAgentMCPCatalog(serverId);
    catalog.value = res?.data as AgentMCPCatalog;
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.catalogFailed"));
  } finally {
    catalogLoading.value = false;
  }
}
function resetServerForm() {
  editingServerId.value = null;
  Object.assign(serverForm, {
    name: "",
    endpoint: "",
    enabled: 1,
    auth_type: "none",
    secret_ref: "",
    custom_header: "",
    allow_private: 0
  });
}

function openCreateServer() {
  resetServerForm();
  serverDialog.value = true;
}

function openEditServer(row: AgentMCPServer) {
  editingServerId.value = row.id;
  Object.assign(serverForm, {
    name: row.name,
    endpoint: row.endpoint,
    enabled: row.enabled,
    auth_type: row.auth_type || "none",
    secret_ref: "",
    custom_header: row.custom_header || "",
    allow_private: row.allow_private
  });
  serverDialog.value = true;
}

async function saveServer() {
  if (!serverForm.name || !serverForm.endpoint) {
    ElMessage.error(t("agentMCPPage.message.required"));
    return;
  }
  saving.value = true;
  try {
    const payload = { ...serverForm };
    if (editingServerId.value === null) {
      await createAgentMCPServer(payload);
    } else {
      await updateAgentMCPServer(editingServerId.value, payload);
    }
    ElMessage.success(t("agentMCPPage.message.saved"));
    serverDialog.value = false;
    await fetchServers();
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.saveFailed"));
  } finally {
    saving.value = false;
  }
}
async function removeServer(row: AgentMCPServer) {
  try {
    await ElMessageBox.confirm(
      t("agentMCPPage.confirm.delete", { name: row.name }),
      t("agentMCPPage.confirm.title"),
      { type: "warning" }
    );
    await deleteAgentMCPServer(row.id);
    ElMessage.success(t("agentMCPPage.message.deleted"));
    await fetchServers();
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("agentMCPPage.message.deleteFailed"));
  }
}

async function authorizeServer(row: AgentMCPServer) {
  const popup = window.open(
    "about:blank",
    "mcp-oauth",
    "popup=yes,width=720,height=760"
  );
  if (!popup) {
    ElMessage.error(t("agentMCPPage.message.popupBlocked"));
    return;
  }
  popup.opener = null;
  oauthWindow.value = popup;
  oauthStartingId.value = row.id;
  try {
    const res = await startAgentMCPOAuth(row.id);
    const authorizationUrl = res?.data?.authorization_url as string | undefined;
    if (!authorizationUrl) {
      throw new Error(t("agentMCPPage.message.oauthStartFailed"));
    }
    popup.location.href = authorizationUrl;
    if (oauthPollTimer !== null) window.clearInterval(oauthPollTimer);
    oauthPollTimer = window.setInterval(async () => {
      if (!popup.closed) return;
      if (oauthPollTimer !== null) window.clearInterval(oauthPollTimer);
      oauthPollTimer = null;
      oauthWindow.value = null;
      await fetchServers();
      const updated = servers.value.find(item => item.id === row.id);
      if (updated?.oauth_status === "authorized") {
        ElMessage.success(t("agentMCPPage.message.oauthCompleted"));
        if (selectedServerId.value === row.id) await loadCatalog(row.id);
      } else if (updated?.oauth_status !== "authorization_pending") {
        ElMessage.error(t("agentMCPPage.message.oauthFailed"));
      }
    }, 700);
  } catch (error: any) {
    popup.close();
    oauthWindow.value = null;
    ElMessage.error(
      error?.message || t("agentMCPPage.message.oauthStartFailed")
    );
  } finally {
    oauthStartingId.value = null;
  }
}

function oauthStatusText(status?: string) {
  switch (status) {
    case "authorized":
      return t("agentMCPPage.state.oauthAuthorized");
    case "authorization_pending":
      return t("agentMCPPage.state.oauthPending");
    case "authorization_required":
      return t("agentMCPPage.state.oauthRequired");
    case "configured":
      return t("agentMCPPage.state.oauthConfigured");
    default:
      return t("agentMCPPage.state.none");
  }
}

async function testServer(row: AgentMCPServer) {
  try {
    await testAgentMCPServer(row.id);
    ElMessage.success(t("agentMCPPage.message.testSuccess"));
    await fetchServers();
    await loadCatalog(row.id);
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.testFailed"));
  }
}

async function refreshCatalog(row: AgentMCPServer) {
  try {
    await refreshAgentMCPCatalog(row.id);
    ElMessage.success(t("agentMCPPage.message.refreshed"));
    await fetchServers();
    await loadCatalog(row.id);
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.refreshFailed"));
  }
}
async function saveTool(row: AgentMCPTool) {
  try {
    await updateAgentMCPTool(row.id, {
      risk: row.risk,
      enabled: row.enabled,
      idempotent: row.idempotent,
      timeout_ms: row.timeout_ms,
      cache_ttl_ms: row.cache_ttl_ms,
      max_result_bytes: row.max_result_bytes
    });
    ElMessage.success(t("agentMCPPage.message.toolSaved"));
    if (selectedServerId.value !== null) {
      await loadCatalog(selectedServerId.value);
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentMCPPage.message.toolSaveFailed"));
  }
}

function openPermissions(
  capabilityType: "tool" | "resource" | "prompt",
  capabilityId: number,
  name: string
) {
  if (!catalog.value) return;
  Object.assign(permissionTarget, {
    server_id: catalog.value.server.id,
    capability_type: capabilityType,
    capability_id: capabilityId,
    name
  });
  for (const skill of skills.value) {
    const existing = catalog.value.permissions.find(
      item =>
        item.skill_name === skill.name &&
        item.capability_type === capabilityType &&
        item.capability_id === capabilityId
    );
    permissionState[skill.name] = {
      enabled: existing?.enabled || 0,
      auto_load: existing?.auto_load || 0
    };
  }
  permissionDialog.value = true;
}
async function savePermission(skillName: string) {
  const state = permissionState[skillName];
  if (!state) return;
  try {
    await saveAgentMCPPermission({
      server_id: permissionTarget.server_id,
      skill_name: skillName,
      capability_type: permissionTarget.capability_type,
      capability_id: permissionTarget.capability_id,
      enabled: state.enabled,
      auto_load:
        permissionTarget.capability_type === "tool" ? 0 : state.auto_load
    });
    if (selectedServerId.value !== null) {
      const res = await getAgentMCPCatalog(selectedServerId.value);
      catalog.value = res?.data as AgentMCPCatalog;
    }
  } catch (error: any) {
    ElMessage.error(
      error?.message || t("agentMCPPage.message.permissionSaveFailed")
    );
  }
}

function statusType(status: string) {
  if (status === "healthy" || status === "granted") return "success";
  if (status === "error" || status === "needs_review") return "danger";
  if (status === "unclassified") return "warning";
  return "info";
}

onMounted(fetchServers);
onBeforeUnmount(() => {
  if (oauthPollTimer !== null) window.clearInterval(oauthPollTimer);
});
</script>
<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <div>{{ t("agentMCPPage.title") }}</div>
            <div class="text-xs text-gray-400 mt-1">
              {{ t("agentMCPPage.subtitle") }}
            </div>
          </div>
          <el-button type="primary" @click="openCreateServer">
            {{ t("agentMCPPage.button.add") }}
          </el-button>
        </div>
      </template>
      <el-alert
        :title="t('agentMCPPage.hint.security')"
        type="warning"
        :closable="false"
        class="mb-4"
      />
      <el-table v-loading="loading" :data="servers" size="small">
        <el-table-column
          prop="name"
          :label="t('agentMCPPage.table.name')"
          min-width="140"
        />
        <el-table-column
          prop="endpoint"
          :label="t('agentMCPPage.table.endpoint')"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column :label="t('agentMCPPage.table.status')" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{
              row.status
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('agentMCPPage.table.enabled')" width="90">
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
          prop="protocol_version"
          :label="t('agentMCPPage.table.protocol')"
          min-width="130"
        />
        <el-table-column
          prop="server_version"
          :label="t('agentMCPPage.table.serverVersion')"
          min-width="120"
        />
        <el-table-column :label="t('agentMCPPage.table.secret')" width="100">
          <template #default="{ row }">
            {{
              row.has_secret
                ? t("agentMCPPage.state.configured")
                : t("agentMCPPage.state.none")
            }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentMCPPage.table.oauthStatus')"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.auth_type === 'oauth2'"
              :type="row.oauth_status === 'authorized' ? 'success' : 'warning'"
              size="small"
            >
              {{ oauthStatusText(row.oauth_status) }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('agentMCPPage.table.operation')"
          width="450"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" @click="loadCatalog(row.id)">{{
              t("agentMCPPage.button.catalog")
            }}</el-button>
            <el-button size="small" @click="testServer(row)">{{
              t("agentMCPPage.button.test")
            }}</el-button>
            <el-button size="small" @click="refreshCatalog(row)">{{
              t("agentMCPPage.button.refresh")
            }}</el-button>
            <el-button
              v-if="row.auth_type === 'oauth2'"
              size="small"
              type="warning"
              :loading="oauthStartingId === row.id"
              @click="authorizeServer(row)"
              >{{
                row.oauth_status === "authorized"
                  ? t("agentMCPPage.button.reauthorize")
                  : t("agentMCPPage.button.authorize")
              }}</el-button
            >
            <el-button size="small" @click="openEditServer(row)">{{
              t("agentMCPPage.button.edit")
            }}</el-button>
            <el-button size="small" type="danger" @click="removeServer(row)">{{
              t("agentMCPPage.button.delete")
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card v-if="selectedServerId !== null" shadow="never" class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{
            t("agentMCPPage.catalog.title", {
              name: selectedServer?.name || "-"
            })
          }}</span>
          <span class="text-xs text-gray-400 break-all">{{
            selectedServer?.catalog_hash || "-"
          }}</span>
        </div>
      </template>
      <el-tabs v-model="activeTab" v-loading="catalogLoading">
        <el-tab-pane :label="t('agentMCPPage.catalog.tools')" name="tools">
          <el-table :data="catalog?.tools || []" size="small">
            <el-table-column
              prop="canonical_name"
              :label="t('agentMCPPage.tool.name')"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column :label="t('agentMCPPage.tool.status')" width="130">
              <template #default="{ row }"
                ><el-tag :type="statusType(row.status)" size="small">{{
                  row.status
                }}</el-tag></template
              >
            </el-table-column>
            <el-table-column :label="t('agentMCPPage.tool.risk')" width="120">
              <template #default="{ row }">
                <el-select v-model="row.risk" size="small">
                  <el-option label="read" value="read" /><el-option
                    label="write"
                    value="write"
                  /><el-option label="trade" value="trade" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="t('agentMCPPage.tool.enabled')" width="90">
              <template #default="{ row }"
                ><el-switch
                  v-model="row.enabled"
                  :active-value="1"
                  :inactive-value="0"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('agentMCPPage.tool.idempotent')"
              width="110"
            >
              <template #default="{ row }">
                <el-switch v-model="row.idempotent" />
              </template>
            </el-table-column>
            <el-table-column
              :label="t('agentMCPPage.tool.timeout')"
              width="120"
            >
              <template #default="{ row }"
                ><el-input-number
                  v-model="row.timeout_ms"
                  :min="0"
                  :controls="false"
                  size="small"
                  class="w-full"
              /></template>
            </el-table-column>
            <el-table-column :label="t('agentMCPPage.tool.cache')" width="120">
              <template #default="{ row }"
                ><el-input-number
                  v-model="row.cache_ttl_ms"
                  :min="0"
                  :controls="false"
                  size="small"
                  class="w-full"
              /></template>
            </el-table-column>
            <el-table-column
              :label="t('agentMCPPage.tool.maxResultBytes')"
              width="145"
            >
              <template #default="{ row }">
                <el-input-number
                  v-model="row.max_result_bytes"
                  :min="0"
                  :controls="false"
                  size="small"
                  class="w-full"
                />
              </template>
            </el-table-column>
            <el-table-column
              :label="t('agentMCPPage.tool.operation')"
              width="180"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="saveTool(row)">{{
                  t("agentMCPPage.button.save")
                }}</el-button>
                <el-button
                  size="small"
                  @click="openPermissions('tool', row.id, row.canonical_name)"
                  >{{ t("agentMCPPage.button.permission") }}</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane
          :label="t('agentMCPPage.catalog.resources')"
          name="resources"
        >
          <el-table :data="catalog?.resources || []" size="small">
            <el-table-column
              prop="name"
              :label="t('agentMCPPage.resource.name')"
              min-width="160"
            />
            <el-table-column
              prop="uri"
              :label="t('agentMCPPage.resource.uri')"
              min-width="280"
              show-overflow-tooltip
            />
            <el-table-column
              prop="mime_type"
              :label="t('agentMCPPage.resource.mime')"
              width="140"
            />
            <el-table-column
              :label="t('agentMCPPage.table.operation')"
              width="120"
            >
              <template #default="{ row }"
                ><el-button
                  size="small"
                  @click="
                    openPermissions('resource', row.id, row.name || row.uri)
                  "
                  >{{ t("agentMCPPage.button.permission") }}</el-button
                ></template
              >
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="t('agentMCPPage.catalog.prompts')" name="prompts">
          <el-table :data="catalog?.prompts || []" size="small">
            <el-table-column
              prop="remote_name"
              :label="t('agentMCPPage.prompt.name')"
              min-width="180"
            />
            <el-table-column
              prop="description"
              :label="t('agentMCPPage.prompt.description')"
              min-width="280"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('agentMCPPage.table.operation')"
              width="120"
            >
              <template #default="{ row }"
                ><el-button
                  size="small"
                  @click="openPermissions('prompt', row.id, row.remote_name)"
                  >{{ t("agentMCPPage.button.permission") }}</el-button
                ></template
              >
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="serverDialog"
      :title="
        editingServerId === null
          ? t('agentMCPPage.dialog.add')
          : t('agentMCPPage.dialog.edit')
      "
      width="680px"
    >
      <el-form label-width="150px">
        <el-form-item :label="t('agentMCPPage.field.name')"
          ><el-input v-model="serverForm.name"
        /></el-form-item>
        <el-form-item :label="t('agentMCPPage.field.endpoint')"
          ><el-input
            v-model="serverForm.endpoint"
            placeholder="https://example.com/mcp"
        /></el-form-item>
        <el-form-item :label="t('agentMCPPage.field.authType')">
          <el-select v-model="serverForm.auth_type" class="w-full">
            <el-option label="none" value="none" /><el-option
              label="bearer"
              value="bearer"
            />
            <el-option label="oauth2" value="oauth2" /><el-option
              label="custom_header"
              value="custom_header"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="
            serverForm.auth_type === 'bearer' ||
            serverForm.auth_type === 'custom_header'
          "
          :label="t('agentMCPPage.field.secretRef')"
        >
          <el-input
            v-model="serverForm.secret_ref"
            :placeholder="t('agentMCPPage.placeholder.secretRef')"
          />
          <div class="text-xs text-gray-400 mt-1">
            {{ t("agentMCPPage.hint.secretRef") }}
          </div>
        </el-form-item>
        <el-alert
          v-if="serverForm.auth_type === 'oauth2'"
          :title="t('agentMCPPage.hint.oauth2')"
          type="info"
          :closable="false"
          class="mb-4"
        />
        <el-form-item
          v-if="serverForm.auth_type === 'custom_header'"
          :label="t('agentMCPPage.field.customHeader')"
        >
          <el-input
            v-model="serverForm.custom_header"
            placeholder="X-API-Key"
          />
        </el-form-item>
        <el-form-item :label="t('agentMCPPage.field.enabled')">
          <el-switch
            v-model="serverForm.enabled"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item :label="t('agentMCPPage.field.allowPrivate')">
          <el-switch
            v-model="serverForm.allow_private"
            :active-value="1"
            :inactive-value="0"
          />
          <div class="text-xs text-orange-500 ml-3">
            {{ t("agentMCPPage.hint.allowPrivate") }}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serverDialog = false">{{
          t("agentMCPPage.button.cancel")
        }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveServer">{{
          t("agentMCPPage.button.save")
        }}</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="permissionDialog"
      :title="
        t('agentMCPPage.permission.title', { name: permissionTarget.name })
      "
      width="620px"
    >
      <el-alert
        :title="t('agentMCPPage.permission.hint')"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-table :data="skills" size="small">
        <el-table-column
          prop="name"
          :label="t('agentMCPPage.permission.skill')"
          min-width="180"
        />
        <el-table-column
          :label="t('agentMCPPage.permission.enabled')"
          width="110"
        >
          <template #default="{ row }">
            <el-switch
              v-model="permissionState[row.name].enabled"
              :active-value="1"
              :inactive-value="0"
              @change="savePermission(row.name)"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-if="permissionTarget.capability_type !== 'tool'"
          :label="t('agentMCPPage.permission.autoLoad')"
          width="120"
        >
          <template #default="{ row }">
            <el-switch
              v-model="permissionState[row.name].auto_load"
              :active-value="1"
              :inactive-value="0"
              @change="savePermission(row.name)"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer
        ><el-button @click="permissionDialog = false">{{
          t("agentMCPPage.button.close")
        }}</el-button></template
      >
    </el-dialog>
  </div>
</template>
