<script setup lang="ts">
import { computed, ref } from "vue";
import type { AgentChatSkill } from "@/api/agent";
import SkillCommandMenu from "./skillCommandMenu.vue";

const props = defineProps<{
  skills: AgentChatSkill[];
  selectedSkill?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:selectedSkill": [name: string];
  send: [content: string];
}>();

const content = ref("");
const showMenu = computed(() => content.value.trimStart().startsWith("/"));
const selected = computed(() =>
  props.skills.find(item => item.name === props.selectedSkill)
);

function chooseSkill(skill: AgentChatSkill) {
  emit("update:selectedSkill", skill.name);
  content.value = "";
}

function submit() {
  const value = content.value.trim();
  if (!value || !props.selectedSkill || props.disabled || showMenu.value)
    return;
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
      :query="content"
      @select="chooseSkill"
    />
    <div v-if="selected" class="selected-skill">
      <el-tag closable type="primary" @close="emit('update:selectedSkill', '')">
        / {{ selected.display_name || selected.name }}
      </el-tag>
    </div>
    <el-input
      v-model="content"
      type="textarea"
      :rows="3"
      resize="none"
      :disabled="disabled"
      :placeholder="$t('agentChat.placeholder.message')"
      @keydown="onKeydown"
    />
    <div class="composer-footer">
      <span class="hint">{{ $t("agentChat.hint.slash") }}</span>
      <el-button
        type="primary"
        :disabled="!content.trim() || !selectedSkill || disabled || showMenu"
        @click="submit"
      >
        {{ $t("agentChat.button.send") }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.composer-wrap {
  position: relative;
}

.selected-skill {
  margin-bottom: 8px;
}

.composer-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
