<script setup lang="ts">
import dayjs from "dayjs";
import type { AgentChatMessage } from "@/api/agent";

defineProps<{ messages: AgentChatMessage[]; loading?: boolean }>();
const emit = defineEmits<{ task: [taskId: string] }>();

type InlinePart = { text: string; bold?: boolean; code?: boolean };
type MarkdownBlock = {
  type: "heading" | "list" | "quote" | "paragraph" | "space";
  level?: number;
  parts?: InlinePart[];
  items?: InlinePart[][];
};

function formatTime(value?: number) {
  return value ? dayjs(value).format("HH:mm:ss") : "";
}

function isRunning(status?: string) {
  return [
    "queued",
    "running",
    "waiting_llm",
    "waiting_tool",
    "validating"
  ].includes(status || "");
}
function parseInline(value: string): InlinePart[] {
  const result: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) result.push({ text: value.slice(last, index) });
    const token = match[0];
    if (token.startsWith("**")) {
      result.push({ text: token.slice(2, -2), bold: true });
    } else {
      result.push({ text: token.slice(1, -1), code: true });
    }
    last = index + token.length;
  }
  if (last < value.length) result.push({ text: value.slice(last) });
  return result.length > 0 ? result : [{ text: value }];
}

function parseMarkdown(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let listItems: InlinePart[][] = [];
  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };
  const lines = String(value || "").split("\n");
  for (const source of lines) {
    const line = source.trim();
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      listItems.push(parseInline(bullet[1]));
      continue;
    }
    flushList();
    if (!line) {
      blocks.push({ type: "space" });
      continue;
    }
    let headingLevel = 0;
    if (line.startsWith("#### ")) headingLevel = 4;
    else if (line.startsWith("### ")) headingLevel = 3;
    else if (line.startsWith("## ")) headingLevel = 2;
    else if (line.startsWith("# ")) headingLevel = 1;
    if (headingLevel > 0) {
      blocks.push({
        type: "heading",
        level: headingLevel,
        parts: parseInline(line.slice(headingLevel + 1))
      });
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push({ type: "quote", parts: parseInline(line.slice(2)) });
      continue;
    }
    blocks.push({ type: "paragraph", parts: parseInline(line) });
  }
  flushList();
  return blocks;
}
</script>

<template>
  <el-scrollbar v-loading="loading" class="message-scroll">
    <div class="message-inner">
      <el-empty
        v-if="!loading && messages.length === 0"
        :description="$t('agentChat.empty.message')"
      />
      <div
        v-for="item in messages"
        :key="item.id"
        class="message-row"
        :class="item.role"
      >
        <div class="message-bubble">
          <div class="message-meta">
            <el-tag v-if="item.skill" size="small" effect="plain">
              {{ item.skill }}
            </el-tag>
            <span>
              {{
                item.role === "user"
                  ? $t("agentChat.role.user")
                  : $t("agentChat.role.assistant")
              }}
            </span>
            <span>{{ formatTime(item.created_at) }}</span>
          </div>

          <div
            v-if="item.role === 'assistant'"
            class="message-content markdown-content"
          >
            <template
              v-for="(block, blockIndex) in parseMarkdown(item.content)"
              :key="blockIndex"
            >
              <div v-if="block.type === 'space'" class="md-gap" />
              <div
                v-else-if="block.type === 'heading'"
                class="md-heading"
                :class="`level-${block.level}`"
              >
                <template
                  v-for="(part, partIndex) in block.parts"
                  :key="partIndex"
                >
                  <strong v-if="part.bold">{{ part.text }}</strong>
                  <code v-else-if="part.code">{{ part.text }}</code>
                  <span v-else>{{ part.text }}</span>
                </template>
              </div>
              <ul v-else-if="block.type === 'list'" class="md-list">
                <li v-for="(parts, itemIndex) in block.items" :key="itemIndex">
                  <template v-for="(part, partIndex) in parts" :key="partIndex">
                    <strong v-if="part.bold">{{ part.text }}</strong>
                    <code v-else-if="part.code">{{ part.text }}</code>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </li>
              </ul>
              <blockquote v-else-if="block.type === 'quote'" class="md-quote">
                <template
                  v-for="(part, partIndex) in block.parts"
                  :key="partIndex"
                >
                  <strong v-if="part.bold">{{ part.text }}</strong>
                  <code v-else-if="part.code">{{ part.text }}</code>
                  <span v-else>{{ part.text }}</span>
                </template>
              </blockquote>
              <p v-else class="md-paragraph">
                <template
                  v-for="(part, partIndex) in block.parts"
                  :key="partIndex"
                >
                  <strong v-if="part.bold">{{ part.text }}</strong>
                  <code v-else-if="part.code">{{ part.text }}</code>
                  <span v-else>{{ part.text }}</span>
                </template>
              </p>
            </template>
          </div>
          <div v-else class="message-content">{{ item.content }}</div>

          <div v-if="item.role === 'user' && item.task_id" class="task-state">
            <span v-if="isRunning(item.task_status)">
              {{ $t(`agentChat.status.${item.task_status}`) }}
              <span v-if="item.task_stage"> · {{ item.task_stage }}</span>
            </span>
            <span v-else-if="item.task_status === 'failed'" class="error-text">
              {{ item.task_error || $t("agentChat.status.failed") }}
            </span>
            <el-button
              link
              type="primary"
              size="small"
              @click="emit('task', item.task_id)"
            >
              {{ $t("agentChat.button.taskDetail") }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>
<style scoped>
.message-scroll {
  height: 100%;
}

.message-inner {
  min-height: 100%;
  padding: 20px;
}

.message-row {
  display: flex;
  margin-bottom: 18px;
}

.message-row.user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: min(78%, 900px);
  padding: 12px 14px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
}

.message-row.user .message-bubble {
  background: var(--el-color-primary-light-9);
}

.message-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.message-content {
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.markdown-content {
  white-space: normal;
}

.md-heading {
  margin: 14px 0 8px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.md-heading.level-1,
.md-heading.level-2 {
  font-size: 20px;
}

.md-heading.level-3 {
  font-size: 16px;
}

.md-heading.level-4 {
  font-size: 14px;
}

.md-paragraph {
  margin: 6px 0;
}

.md-list {
  padding-left: 22px;
  margin: 6px 0;
}

.md-list li {
  margin: 5px 0;
}

.md-quote {
  padding: 6px 10px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-left: 3px solid var(--el-border-color);
}

.markdown-content code {
  padding: 1px 5px;
  font-family: monospace;
  background: var(--el-fill-color-darker);
  border-radius: 4px;
}

.md-gap {
  height: 4px;
}

.task-state {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.error-text {
  color: var(--el-color-danger);
}
</style>
