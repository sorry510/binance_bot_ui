<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

defineOptions({ name: "AgentMarketAnalysis" });
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const tabNames = ["symbol", "opportunities"] as const;
type TabName = (typeof tabNames)[number];
const tab = ref<TabName>("symbol");
const panels: Record<TabName, Component> = {
  symbol: defineAsyncComponent(() => import("./symbolAnalysis.vue")),
  opportunities: defineAsyncComponent(() => import("./opportunities.vue"))
};
const currentPanel = computed(() => panels[tab.value]);
watch(
  () => route.query.tab,
  value => {
    const requested = String(value || "");
    tab.value = tabNames.includes(requested as TabName)
      ? (requested as TabName)
      : "symbol";
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
      <el-tab-pane :label="t('aiHub.symbol')" name="symbol" />
      <el-tab-pane :label="t('aiHub.opportunities')" name="opportunities" />
    </el-tabs>
    <component :is="currentPanel" />
  </div>
</template>

<style scoped>
.ai-hub-tabs {
  padding: 12px 16px 0;
}
</style>
