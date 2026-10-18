<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

defineOptions({ name: "AgentSettings" });
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const tabNames = ["automation", "models", "skills", "mcp", "memory"] as const;
type TabName = (typeof tabNames)[number];
const tab = ref<TabName>("automation");
const panels: Record<TabName, Component> = {
  automation: defineAsyncComponent(() => import("./aiConfig.vue")),
  models: defineAsyncComponent(() => import("./llmConfig.vue")),
  skills: defineAsyncComponent(() => import("./skillManagement.vue")),
  mcp: defineAsyncComponent(() => import("./mcpManagement.vue")),
  memory: defineAsyncComponent(() => import("./memoryManagement.vue"))
};
const currentPanel = computed(() => panels[tab.value]);
watch(
  () => route.query.tab,
  value => {
    const requested = String(value || "");
    tab.value = tabNames.includes(requested as TabName)
      ? (requested as TabName)
      : "automation";
  },
  { immediate: true }
);
function selectTab(value: string | number) {
  void router.replace({
    path: route.path,
    query: { ...route.query, tab: String(value) }
  });
}
</script>

<template>
  <div class="ai-hub">
    <el-tabs v-model="tab" class="ai-hub-tabs" @tab-change="selectTab">
      <el-tab-pane :label="t('aiHub.automation')" name="automation" />
      <el-tab-pane :label="t('aiHub.models')" name="models" />
      <el-tab-pane :label="t('aiHub.skills')" name="skills" />
      <el-tab-pane :label="t('aiHub.mcp')" name="mcp" />
      <el-tab-pane :label="t('aiHub.memory')" name="memory" />
    </el-tabs>
    <component :is="currentPanel" />
  </div>
</template>

<style scoped>
.ai-hub-tabs {
  padding: 12px 16px 0;
}
</style>
