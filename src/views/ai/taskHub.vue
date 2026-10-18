<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

defineOptions({ name: "AgentTaskHub" });
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const tabNames = ["tasks", "scheduler", "alerts"] as const;
type TabName = (typeof tabNames)[number];
const tab = ref<TabName>("tasks");
const TaskCenter = defineAsyncComponent(() => import("./taskCenter.vue"));
const AlertPipelineHistory = defineAsyncComponent(
  () => import("./alertPipelineHistory.vue")
);
const currentPanel = computed(() =>
  tab.value === "alerts" ? AlertPipelineHistory : TaskCenter
);
watch(
  () => route.query.tab,
  value => {
    const requested = String(value || "");
    tab.value = tabNames.includes(requested as TabName)
      ? (requested as TabName)
      : "tasks";
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
      <el-tab-pane :label="t('aiHub.tasks')" name="tasks" />
      <el-tab-pane :label="t('aiHub.scheduler')" name="scheduler" />
      <el-tab-pane :label="t('aiHub.alerts')" name="alerts" />
    </el-tabs>
    <component
      :is="currentPanel"
      v-bind="tab === 'alerts' ? {} : { mode: tab }"
    />
  </div>
</template>

<style scoped>
.ai-hub-tabs {
  padding: 12px 16px 0;
}
</style>
