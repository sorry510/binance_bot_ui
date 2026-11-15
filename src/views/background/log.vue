<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getLog } from "@/api/service";

defineOptions({ name: "logs" });
const { t } = useI18n();
const lines = ref<string[]>([]);
const loading = ref(false);
const errorText = ref("");
const keyword = ref("");
const level = ref("ALL");
const limit = ref(200);
const autoRefresh = ref(true);
const hasEarlier = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

async function fetchLog() {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await getLog({
      limit: limit.value,
      level: level.value,
      keyword: keyword.value.trim()
    });
    if (res?.code !== 200)
      throw new Error(res?.msg || t("systemLogPage.fetchError"));
    lines.value = res.data?.lines || [];
    hasEarlier.value = Boolean(res.data?.has_earlier);
    errorText.value = "";
  } catch (error: any) {
    errorText.value = error?.message || t("systemLogPage.fetchError");
  } finally {
    loading.value = false;
  }
}

function lineClass(line: string) {
  if (/\[(E|C|A|M)\]/.test(line)) return "log-error";
  if (line.includes("[W]")) return "log-warning";
  return "";
}

onMounted(() => {
  void fetchLog();
  timer = setInterval(() => {
    if (autoRefresh.value) void fetchLog();
  }, 5000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <el-input
          v-model="keyword"
          clearable
          :placeholder="t('systemLogPage.search')"
          style="width: 240px"
          @keyup.enter="fetchLog"
          @clear="fetchLog"
        />
        <el-select v-model="level" style="width: 125px" @change="fetchLog">
          <el-option :label="t('systemLogPage.all')" value="ALL" />
          <el-option label="ERROR" value="ERROR" />
          <el-option label="WARN" value="WARN" />
          <el-option label="INFO" value="INFO" />
          <el-option label="DEBUG" value="DEBUG" />
        </el-select>
        <el-select v-model="limit" style="width: 115px" @change="fetchLog">
          <el-option
            :label="t('systemLogPage.lines', { count: 200 })"
            :value="200"
          />
          <el-option
            :label="t('systemLogPage.lines', { count: 500 })"
            :value="500"
          />
          <el-option
            :label="t('systemLogPage.lines', { count: 1000 })"
            :value="1000"
          />
        </el-select>
        <el-switch
          v-model="autoRefresh"
          :active-text="t('systemLogPage.autoRefresh')"
        />
        <el-button :loading="loading" @click="fetchLog">
          {{ t("systemLogPage.refresh") }}
        </el-button>
      </div>
      <el-alert
        v-if="errorText"
        type="error"
        :title="errorText"
        :closable="false"
        class="mb-3"
      />
      <div v-if="hasEarlier" class="mb-2 text-xs text-gray-500">
        {{ t("systemLogPage.recentOnly") }}
      </div>
      <div class="logs-panel">
        <div v-if="!lines.length" class="text-gray-400">
          {{ t("systemLogPage.empty") }}
        </div>
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="log-line"
          :class="lineClass(line)"
        >
          {{ line }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.logs-panel {
  height: calc(100vh - 260px);
  min-height: 320px;
  padding: 12px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e2e8f0;
  background: #111827;
}

.log-line {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.log-error {
  color: #fca5a5;
}

.log-warning {
  color: #fcd34d;
}
</style>
