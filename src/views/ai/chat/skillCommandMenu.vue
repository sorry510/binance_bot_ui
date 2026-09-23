<script setup lang="ts">
import { computed } from "vue";
import type { AgentChatSkill } from "@/api/agent";

const props = defineProps<{
  skills: AgentChatSkill[];
  attachedSkillNames: string[];
  query: string;
}>();
const emit = defineEmits<{ select: [skill: AgentChatSkill] }>();

const attached = computed(
  () => new Set((props.attachedSkillNames || []).map(item => String(item)))
);

const filtered = computed(() => {
  const keyword = props.query.trim().replace(/^\//, "").toLowerCase();
  const candidates = props.skills.filter(item => item.name !== "general_chat");
  if (!keyword) return candidates;
  return candidates.filter(item =>
    [item.name, item.display_name, item.description]
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  );
});
</script>

<template>
  <div class="skill-menu">
    <div class="skill-menu-title">{{ $t("agentChat.skillMenu.title") }}</div>
    <el-scrollbar max-height="260px">
      <button
        v-for="item in filtered"
        :key="item.name"
        type="button"
        class="skill-option"
        @mousedown.prevent="emit('select', item)"
      >
        <div class="skill-option-head">
          <strong>{{ item.display_name || item.name }}</strong>
          <div class="skill-option-tags">
            <el-tag
              v-if="attached.has(item.name)"
              size="small"
              type="success"
              effect="plain"
            >
              {{ $t("agentChat.skillMenu.attached") }}
            </el-tag>
            <el-tag size="small" effect="plain">{{ item.type }}</el-tag>
          </div>
        </div>
        <div class="skill-name">/{{ item.name }}</div>
        <div class="skill-description">{{ item.description }}</div>
      </button>
      <el-empty
        v-if="filtered.length === 0"
        :description="$t('agentChat.empty.skill')"
        :image-size="48"
      />
    </el-scrollbar>
  </div>
</template>

<style scoped>
.skill-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 20;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
}

.skill-menu-title {
  padding: 6px 8px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.skill-option {
  width: 100%;
  padding: 9px 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 7px;
}

.skill-option:hover {
  background: var(--el-fill-color-light);
}

.skill-option-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.skill-option-tags {
  display: flex;
  gap: 6px;
  align-items: center;
}

.skill-name,
.skill-description {
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.skill-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
