<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { getFeaturesOptions } from "@/api/trade";
import {
  addAgentConversationSkill,
  createAgentChatConversation,
  deleteAgentChatConversation,
  getAgentChatConversations,
  getAgentChatMessages,
  getAgentChatSkills,
  getAgentConversationSkills,
  getAgentTask,
  removeAgentConversationSkill,
  sendAgentChatMessage,
  updateAgentChatConversation,
  updateAgentConversationModel,
  type AgentChatConversation,
  type AgentChatConversationList,
  type AgentChatMessage,
  type AgentChatSkill,
  type AgentTask
} from "@/api/agent";
import { getLLMConfigs, type LLMConfigItem } from "@/api/llm";
import ConversationList from "./conversationList.vue";
import MessageList from "./messageList.vue";
import ChatComposer from "./chatComposer.vue";

defineOptions({ name: "AgentChat" });

const router = useRouter();
const { t } = useI18n();
const conversations = ref<AgentChatConversation[]>([]);
const messages = ref<AgentChatMessage[]>([]);
const skills = ref<AgentChatSkill[]>([]);
const models = ref<LLMConfigItem[]>([]);
const symbols = ref<string[]>([]);
const activeId = ref("");
const listLoading = ref(false);
const messageLoading = ref(false);
const creating = ref(false);
const deletingId = ref("");
const runningTasks = reactive<Record<string, string>>({});
const selectedSymbols = reactive<Record<string, string>>({});
const attachedSkills = reactive<Record<string, string[]>>({});
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const selectedSymbol = computed({
  get: () => selectedSymbols[activeId.value] || "",
  set: value => {
    if (!activeId.value) return;
    selectedSymbols[activeId.value] = value;
  }
});
const currentRunning = computed(() => Boolean(runningTasks[activeId.value]));
const currentConversation = computed(() =>
  conversations.value.find(item => item.id === activeId.value)
);
const selectableModels = computed(() =>
  models.value.filter(item => item.enabled === 1 || item.router_candidate === 1)
);

function assertBusinessSuccess(res: any, fallback: string) {
  if (res && Number(res.code) !== 200) {
    throw new Error(res.msg || fallback);
  }
}

async function loadSymbols() {
  const res = await getFeaturesOptions();
  assertBusinessSuccess(res, "加载合约列表失败");
  const items: unknown[] = Array.isArray(res?.data) ? res.data : [];
  const normalized = items
    .map(item =>
      String(item || "")
        .trim()
        .toUpperCase()
    )
    .filter(item => item.endsWith("USDT"));
  symbols.value = Array.from(new Set<string>(normalized)).sort((left, right) =>
    left.localeCompare(right)
  );
}

async function loadSkills() {
  const res = await getAgentChatSkills();
  assertBusinessSuccess(res, "加载 Skill 失败");
  skills.value = (res?.data || []) as AgentChatSkill[];
}

async function loadModels() {
  const res = await getLLMConfigs();
  assertBusinessSuccess(res, "加载模型失败");
  models.value = (res?.data || []) as LLMConfigItem[];
}

async function loadConversationSkills(conversationId: string) {
  const res = await getAgentConversationSkills(conversationId);
  assertBusinessSuccess(res, "加载对话 Skill 失败");
  const names = Array.isArray(res?.data)
    ? res.data.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : [];
  if (!names.includes("general_chat")) names.unshift("general_chat");
  attachedSkills[conversationId] = Array.from(new Set(names));
}

async function loadConversations(selectFirst = false, showLoading = true) {
  if (showLoading) listLoading.value = true;
  try {
    const res = await getAgentChatConversations({ page: 1, limit: 100 });
    const data = (res?.data || {}) as AgentChatConversationList;
    conversations.value = data.list || [];
    if (selectFirst && !activeId.value && conversations.value.length > 0) {
      await selectConversation(conversations.value[0].id);
    }
  } finally {
    if (showLoading) listLoading.value = false;
  }
}

async function createConversation() {
  if (creating.value) return;
  creating.value = true;
  try {
    const res = await createAgentChatConversation();
    const item = res?.data as AgentChatConversation;
    await loadConversations(false, false);
    if (item?.id) await selectConversation(item.id);
  } finally {
    creating.value = false;
  }
}

async function loadMessages(conversationId: string, showLoading = true) {
  if (!conversationId) return;
  if (showLoading) messageLoading.value = true;
  try {
    const res = await getAgentChatMessages(conversationId);
    if (activeId.value !== conversationId) return;
    messages.value = (res?.data || []) as AgentChatMessage[];
    const running = [...messages.value]
      .reverse()
      .find(item => isRunningStatus(item.task_status) && item.task_id);
    if (running?.task_id) {
      runningTasks[conversationId] = running.task_id;
      schedulePoll(conversationId, running.task_id, 300);
    } else {
      delete runningTasks[conversationId];
      clearPoll(conversationId);
    }
  } finally {
    if (showLoading && activeId.value === conversationId)
      messageLoading.value = false;
  }
}

function isRunningStatus(status?: string) {
  return [
    "queued",
    "running",
    "waiting_llm",
    "waiting_tool",
    "validating"
  ].includes(status || "");
}

async function selectConversation(id: string) {
  activeId.value = id;
  messages.value = [];
  await Promise.all([loadMessages(id), loadConversationSkills(id)]);
}

function clearPoll(conversationId: string) {
  const timer = timers.get(conversationId);
  if (timer) clearTimeout(timer);
  timers.delete(conversationId);
}

function schedulePoll(conversationId: string, taskId: string, delay = 1200) {
  clearPoll(conversationId);
  const timer = setTimeout(() => pollTask(conversationId, taskId), delay);
  timers.set(conversationId, timer);
}

async function pollTask(conversationId: string, taskId: string) {
  try {
    const res = await getAgentTask(taskId);
    const item = res?.data as AgentTask;
    if (activeId.value === conversationId)
      await loadMessages(conversationId, false);
    if (item && isRunningStatus(item.status)) {
      runningTasks[conversationId] = taskId;
      schedulePoll(conversationId, taskId);
      return;
    }
    delete runningTasks[conversationId];
    clearPoll(conversationId);
    setTimeout(async () => {
      if (activeId.value === conversationId)
        await loadMessages(conversationId, false);
      await loadConversations(false, false);
    }, 250);
  } catch {
    schedulePoll(conversationId, taskId, 2000);
  }
}

async function sendMessage(content: string) {
  const conversationId = activeId.value;
  const symbol = selectedSymbol.value;
  if (!conversationId || currentRunning.value) return;
  try {
    const res = await sendAgentChatMessage(conversationId, {
      skill_mode: "auto",
      content,
      symbol: symbol || undefined
    });
    assertBusinessSuccess(res, "发送失败");
    const taskId = String(res?.data?.task_id || "");
    if (!taskId) throw new Error(res?.msg || "task id is missing");
    runningTasks[conversationId] = taskId;
    await Promise.all([
      loadMessages(conversationId, false),
      loadConversations(false, false)
    ]);
    schedulePoll(conversationId, taskId, 300);
  } catch (error: any) {
    ElMessage.error(error?.message || "发送失败");
  }
}

async function selectChatSkill(skill: AgentChatSkill) {
  const conversationId = activeId.value;
  if (!conversationId || currentRunning.value) return;
  const name = String(skill?.name || "").trim();
  if (!name) return;

  const current = attachedSkills[conversationId] || ["general_chat"];
  try {
    if (!current.includes(name)) {
      const res = await addAgentConversationSkill(conversationId, name);
      assertBusinessSuccess(res, t("agentChat.message.skillUpdateFailed"));
      attachedSkills[conversationId] = Array.from(new Set([...current, name]));
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentChat.message.skillUpdateFailed"));
  }
}

async function removeChatSkill(name: string) {
  const conversationId = activeId.value;
  name = String(name || "").trim();
  if (
    !conversationId ||
    !name ||
    name === "general_chat" ||
    currentRunning.value
  )
    return;
  try {
    const res = await removeAgentConversationSkill(conversationId, name);
    assertBusinessSuccess(res, t("agentChat.message.skillUpdateFailed"));
    attachedSkills[conversationId] = (
      attachedSkills[conversationId] || ["general_chat"]
    ).filter(item => item !== name);
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentChat.message.skillUpdateFailed"));
  }
}

async function changeConversationModel(value: number | string) {
  const conversationId = activeId.value;
  if (!conversationId || currentRunning.value) return;
  const modelId = Number(value || 0);
  try {
    const res = await updateAgentConversationModel(conversationId, modelId);
    assertBusinessSuccess(res, t("agentChat.message.modelUpdateFailed"));
    const item = conversations.value.find(row => row.id === conversationId);
    if (item) item.model_config_id = modelId;
  } catch (error: any) {
    ElMessage.error(error?.message || t("agentChat.message.modelUpdateFailed"));
  }
}

async function renameConversation(item: AgentChatConversation) {
  try {
    const result = await ElMessageBox.prompt(
      t("agentChat.message.renamePrompt"),
      t("agentChat.message.renameTitle"),
      {
        inputValue: item.title || "",
        inputPlaceholder: t("agentChat.placeholder.title"),
        inputValidator: value =>
          Boolean(String(value || "").trim()) ||
          t("agentChat.message.titleRequired")
      }
    );
    const title = String(result.value || "").trim();
    if (!title || title === item.title) return;
    const res = await updateAgentChatConversation(item.id, title);
    assertBusinessSuccess(res, t("agentChat.message.renameFailed"));
    await loadConversations(false, false);
    ElMessage.success(t("agentChat.message.renamed"));
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("agentChat.message.renameFailed"));
  }
}

async function deleteConversation(item: AgentChatConversation) {
  try {
    await ElMessageBox.confirm(
      t("agentChat.message.deleteConfirm", {
        title: item.title || t("agentChat.newConversation")
      }),
      t("agentChat.message.deleteTitle"),
      { type: "warning" }
    );
    deletingId.value = item.id;
    const res = await deleteAgentChatConversation(item.id);
    if (Number(res?.code) === 409) {
      throw new Error(t("agentChat.message.deleteRunning"));
    }
    assertBusinessSuccess(res, t("agentChat.message.deleteFailed"));

    const wasActive = activeId.value === item.id;
    clearPoll(item.id);
    delete runningTasks[item.id];
    delete selectedSymbols[item.id];
    delete attachedSkills[item.id];
    if (wasActive) {
      activeId.value = "";
      messages.value = [];
    }
    await loadConversations(false, false);
    if (wasActive) {
      if (conversations.value.length > 0) {
        await selectConversation(conversations.value[0].id);
      } else {
        await createConversation();
      }
    }
    ElMessage.success(t("agentChat.message.deleted"));
  } catch (error: any) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error?.message || t("agentChat.message.deleteFailed"));
  } finally {
    if (deletingId.value === item.id) deletingId.value = "";
  }
}

function openTask(taskId: string) {
  router.push({ path: "/ai/task-center", query: { taskId } });
}

onMounted(async () => {
  await Promise.all([
    loadSkills(),
    loadModels(),
    loadSymbols(),
    loadConversations(false)
  ]);
  if (conversations.value.length === 0) await createConversation();
  else await selectConversation(conversations.value[0].id);
});

onBeforeUnmount(() => {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
});
</script>

<template>
  <div class="agent-chat-page p-4">
    <el-card shadow="never" class="chat-shell">
      <div class="chat-layout">
        <aside class="chat-sidebar">
          <ConversationList
            :conversations="conversations"
            :active-id="activeId"
            :loading="listLoading || creating"
            :deleting-id="deletingId"
            @select="selectConversation"
            @create="createConversation"
            @rename="renameConversation"
            @delete="deleteConversation"
          />
        </aside>
        <section class="chat-main">
          <div class="chat-header">
            <div>
              <div class="chat-title">
                {{
                  conversations.find(item => item.id === activeId)?.title ||
                  $t("agentChat.newConversation")
                }}
              </div>
              <div class="chat-subtitle">{{ $t("agentChat.subtitle") }}</div>
            </div>
            <el-tag v-if="currentRunning" type="warning" effect="plain">
              {{ $t("agentChat.status.running") }}
            </el-tag>
          </div>
          <div class="chat-messages">
            <MessageList
              :messages="messages"
              :loading="messageLoading"
              @task="openTask"
            />
          </div>
          <div class="chat-composer">
            <ChatComposer
              v-model:selected-symbol="selectedSymbol"
              :skills="skills"
              :attached-skill-names="
                attachedSkills[activeId] || ['general_chat']
              "
              :models="selectableModels"
              :model-id="currentConversation?.model_config_id || 0"
              :symbols="symbols"
              :disabled="!activeId || currentRunning"
              @select-skill="selectChatSkill"
              @remove-skill="removeChatSkill"
              @model-change="changeConversationModel"
              @send="sendMessage"
            />
          </div>
        </section>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.agent-chat-page {
  height: calc(100vh - 108px);
  min-height: 620px;
}

.chat-shell {
  height: 100%;
}

.chat-shell :deep(.el-card__body) {
  height: 100%;
  padding: 0;
}

.chat-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

.chat-sidebar {
  flex: 0 0 280px;
  width: 280px;
  min-height: 0;
  padding: 16px;
  border-right: 1px solid var(--el-border-color-light);
}

.chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 66px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.chat-title {
  font-size: 16px;
  font-weight: 600;
}

.chat-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chat-messages {
  flex: 1;
  min-height: 0;
}

.chat-composer {
  display: flex;
  justify-content: center;
  padding: 12px 24px 22px;
  background: var(--el-bg-color);
}

.chat-composer :deep(.composer-wrap) {
  width: min(920px, 100%);
}

@media (width <= 900px) {
  .chat-sidebar {
    flex-basis: 220px;
    width: 220px;
  }
}
</style>
