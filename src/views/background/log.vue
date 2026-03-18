<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { getLog } from "../../api/service";

defineOptions({ name: "logs" });

const logs = ref<string[]>([]);
const timer = ref<number | null>(null);

async function fetchLog() {
  const res = await getLog();
  const text = typeof res === "string" ? res : res?.data || "";
  logs.value = String(text).split("\n");
}

onMounted(async () => {
  await fetchLog();
  timer.value = window.setInterval(fetchLog, 5000);
});

onBeforeUnmount(() => {
  if (timer.value) window.clearInterval(timer.value);
});
</script>

<template>
  <div class="p-4">
    <div class="logs-panel">
      <div v-for="(log, index) in logs" :key="index" class="log-line">
        {{ log }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-panel {
  height: calc(100vh - 140px);
  padding: 12px;
  overflow: auto;
  font-family: monospace;
  color: #fff;
  background: #000;
}

.log-line {
  line-height: 1.55;
  white-space: pre-wrap;
}
</style>
