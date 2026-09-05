<script setup lang="ts">
import dayjs from "dayjs";
import type { AgentChatConversation } from "@/api/agent";

defineProps<{
  conversations: AgentChatConversation[];
  activeId: string;
  loading?: boolean;
  deletingId?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  rename: [item: AgentChatConversation];
  delete: [item: AgentChatConversation];
}>();

function formatTime(value?: string) {
  if (!value) return "";
  return dayjs(value).format("MM-DD HH:mm");
}
</script>

<template>
  <div class="conversation-list">
    <el-button type="primary" class="new-chat" @click="emit('create')">
      + {{ $t("agentChat.button.newConversation") }}
    </el-button>
    <el-scrollbar v-loading="loading" class="conversation-scroll">
      <div
        v-for="item in conversations"
        :key="item.id"
        class="conversation-item"
        :class="{ active: item.id === activeId }"
        @click="emit('select', item.id)"
      >
        <div class="conversation-title-row">
          <div class="conversation-title">
            {{ item.title || $t("agentChat.newConversation") }}
          </div>
          <div class="conversation-actions">
            <el-tooltip
              :content="$t('agentChat.button.rename')"
              placement="top"
            >
              <el-button
                text
                circle
                size="small"
                class="action-button"
                :aria-label="$t('agentChat.button.rename')"
                @click.stop="emit('rename', item)"
              >
                <svg viewBox="0 0 24 24" class="action-icon" aria-hidden="true">
                  <path
                    d="M4 20h4l10.5-10.5-4-4L4 16v4Zm12.4-16.4 4 4 1.2-1.2a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0l-1.2 1.2Z"
                  />
                </svg>
              </el-button>
            </el-tooltip>
            <el-tooltip
              :content="$t('agentChat.button.delete')"
              placement="top"
            >
              <el-button
                text
                circle
                type="danger"
                size="small"
                class="action-button"
                :aria-label="$t('agentChat.button.delete')"
                :loading="deletingId === item.id"
                @click.stop="emit('delete', item)"
              >
                <svg
                  v-if="deletingId !== item.id"
                  viewBox="0 0 24 24"
                  class="action-icon"
                  aria-hidden="true"
                >
                  <path
                    d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7Zm3-11v8h2v-8h-2Zm4 0v8h2v-8h-2ZM4 4h5l1-1h4l1 1h5v2H4V4Z"
                  />
                </svg>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="conversation-time">{{ formatTime(item.updated_at) }}</div>
      </div>
      <el-empty
        v-if="!loading && conversations.length === 0"
        :description="$t('agentChat.empty.conversation')"
        :image-size="70"
      />
    </el-scrollbar>
  </div>
</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.new-chat {
  width: 100%;
}

.conversation-scroll {
  flex: 1;
  min-height: 0;
}

.conversation-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.conversation-item:hover,
.conversation-item.active {
  background: var(--el-fill-color-light);
}

.conversation-title-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.conversation-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  white-space: nowrap;
}

.conversation-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  opacity: 0;
}

.action-button {
  width: 26px;
  height: 26px;
  padding: 0;
}

.action-icon {
  width: 15px;
  height: 15px;
  fill: currentcolor;
}

.conversation-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.conversation-item:hover .conversation-actions,
.conversation-item.active .conversation-actions {
  opacity: 1;
}

.conversation-time {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
