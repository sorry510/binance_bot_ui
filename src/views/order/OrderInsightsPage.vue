<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import AnomalyPanel from "./AnomalyPanel.vue";
import PerformancePanel from "./PerformancePanel.vue";

defineOptions({ name: "FuturesOrderInsights" });
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const activeTab = ref(
  route.query.tab === "performance" ? "performance" : "anomalies"
);

watch(
  () => route.query.tab,
  tab => {
    activeTab.value = tab === "performance" ? "performance" : "anomalies";
  }
);

function onTabChange(tab: string | number) {
  const next = tab === "performance" ? "performance" : "anomalies";
  void router.replace({
    path: "/futures/order-insights",
    query: { ...route.query, tab: next }
  });
}
function backToOrders() {
  void router.push("/futures/list");
}
</script>

<template>
  <div class="p-4">
    <div class="mb-3">
      <el-button @click="backToOrders">
        {{ t("orderPage.navigation.backToOrders") }}
      </el-button>
    </div>
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane :label="t('orderPage.anomaly.title')" name="anomalies">
        <AnomalyPanel v-if="activeTab === 'anomalies'" standalone />
      </el-tab-pane>
      <el-tab-pane :label="t('orderPage.performance.title')" name="performance">
        <PerformancePanel v-if="activeTab === 'performance'" standalone />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
