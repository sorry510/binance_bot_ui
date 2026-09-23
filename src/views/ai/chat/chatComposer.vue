<script setup lang="ts">
import { computed, ref } from "vue";
import type { AgentChatSkill } from "@/api/agent";
import type { LLMConfigItem } from "@/api/llm";
import SkillCommandMenu from "./skillCommandMenu.vue";

const props = defineProps<{
  skills: AgentChatSkill[];
  attachedSkillNames: string[];
  models: LLMConfigItem[];
  modelId?: number;
  symbols: string[];
  selectedSymbol?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedSymbol": [symbol: string];
  selectSkill: [skill: AgentChatSkill];
  removeSkill: [skillName: string];
  modelChange: [modelId: number];
  send: [content: string];
}>();

const content = ref("");
const showMenu = computed(() => content.value.trimStart().startsWith("/"));
const attachedSet = computed(
  () => new Set((props.attachedSkillNames || []).map(item => String(item)))
);
const attachedSkills = computed(() =>
  props.skills.filter(
    item => item.name !== "general_chat" && attachedSet.value.has(item.name)
  )
);

function chooseSkill(skill: AgentChatSkill) {
  emit("selectSkill", skill);
  content.value = "";
}

function changeModel(value: number | string) {
  emit("modelChange", Number(value || 0));
}

function submit() {
  const value = content.value.trim();
  if (!value || props.disabled || showMenu.value) return;
  emit("send", value);
  content.value = "";
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  submit();
}
</script>

<template>
  <div class="composer-wrap">
    <SkillCommandMenu
      v-if="showMenu"
      :skills="skills"
      :attached-skill-names="attachedSkillNames"
      :query="content"
      @select="chooseSkill"
    />

    <div class="composer-box">
      <div v-if="attachedSkills.length" class="attached-skills">
        <el-tag
          v-for="skill in attachedSkills"
          :key="skill.name"
          closable
          type="primary"
          effect="plain"
          @close="emit('removeSkill', skill.name)"
        >
          / {{ skill.display_name || skill.name }}
        </el-tag>
      </div>

      <el-input
        v-model="content"
        class="composer-input"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 8 }"
        resize="none"
        :disabled="disabled"
        :placeholder="$t('agentChat.placeholder.message')"
        @keydown="onKeydown"
      />

      <div class="composer-footer">
        <div class="composer-footer-left">
          <span class="slash-hint">{{ $t("agentChat.hint.slash") }}</span>
          <el-select
            :model-value="selectedSymbol || ''"
            class="symbol-select"
            size="small"
            clearable
            filterable
            :disabled="disabled"
            :placeholder="$t('agentChat.placeholder.symbol')"
            @update:model-value="
              value => emit('update:selectedSymbol', String(value || ''))
            "
          >
            <el-option
              v-for="symbol in symbols"
              :key="symbol"
              :label="symbol"
              :value="symbol"
            />
          </el-select>
        </div>

        <div class="composer-footer-right">
          <el-select
            :model-value="modelId || 0"
            class="model-select"
            size="small"
            :disabled="disabled"
            :placeholder="$t('agentChat.placeholder.model')"
            @change="changeModel"
          >
            <el-option
              :label="$t('agentChat.workspace.autoModel')"
              :value="0"
            />
            <el-option
              v-for="item in models"
              :key="item.id"
              :label="`${item.name} · ${item.model}`"
              :value="item.id"
            />
          </el-select>
          <el-button
            type="primary"
            :disabled="!content.trim() || disabled || showMenu"
            @click="submit"
          >
            {{ $t("agentChat.button.send") }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-wrap {
  position: relative;
}

.composer-box {
  padding: 12px 14px 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 20px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.attached-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 6px 2px;
}

.composer-input :deep(.el-textarea__inner) {
  min-height: 52px !important;
  padding: 6px 2px 10px;
  line-height: 1.6;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none !important;
}

.composer-input :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
}

.composer-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.composer-footer-left,
.composer-footer-right {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.slash-hint {
  padding-left: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.symbol-select {
  width: 176px;
}

.model-select {
  width: 220px;
}

@media (width <= 900px) {
  .composer-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .composer-footer-left,
  .composer-footer-right {
    width: 100%;
  }

  .composer-footer-right {
    justify-content: flex-end;
  }

  .slash-hint {
    display: none;
  }
}
</style>
