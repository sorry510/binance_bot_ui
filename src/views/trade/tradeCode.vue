<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import {
  getConfig,
  setConfig,
  startService,
  stopService
} from "../../api/trade";
import {
  buildTradeEditorExtensions,
  codeMirrorBasicSetup
} from "../../utils/codemirror";

defineOptions({ name: "TradeCode" });
const { t } = useI18n();

const code = ref("");
const serviceLoading = ref(false);

const editorExtensions = computed(() => buildTradeEditorExtensions());
const basicSetup = codeMirrorBasicSetup;

async function fetchData() {
  serviceLoading.value = true;
  try {
    const res = await getConfig();
    code.value = res?.data?.content || "";
  } finally {
    serviceLoading.value = false;
  }
}

async function save() {
  await ElMessageBox.confirm(
    t("tradeCodePage.confirm.save"),
    t("tradeCodePage.confirm.title")
  );
  await setConfig({ code: code.value });
  ElMessage.success(t("tradeCodePage.message.saveSuccess"));
}

async function start() {
  await ElMessageBox.confirm(
    t("tradeCodePage.confirm.restart"),
    t("tradeCodePage.confirm.title")
  );
  serviceLoading.value = true;
  try {
    await startService();
    ElMessage.success(t("tradeCodePage.message.operateSuccess"));
  } finally {
    serviceLoading.value = false;
  }
}

async function stop() {
  await ElMessageBox.confirm(
    t("tradeCodePage.confirm.stop"),
    t("tradeCodePage.confirm.title")
  );
  serviceLoading.value = true;
  try {
    await stopService();
    ElMessage.success(t("tradeCodePage.message.operateSuccess"));
  } finally {
    serviceLoading.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex gap-2">
        <el-button type="success" :loading="serviceLoading" @click="start">{{
          t("tradeCodePage.button.restart")
        }}</el-button>
        <el-button type="danger" :loading="serviceLoading" @click="stop">{{
          t("tradeCodePage.button.stop")
        }}</el-button>
      </div>
      <el-button type="primary" @click="save">{{
        t("tradeCodePage.button.save")
      }}</el-button>
    </div>
    <Codemirror
      v-model="code"
      :extensions="editorExtensions"
      :basic-setup="basicSetup"
      :style="{ height: '70vh' }"
      :indent-with-tab="true"
      :tab-size="2"
    />
  </div>
</template>
