<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { Codemirror } from "vue-codemirror";
import { getConfig, setConfig, restartService } from "../../api/trade";
import {
  buildTradeEditorExtensions,
  codeMirrorBasicSetup
} from "../../utils/codemirror";

defineOptions({ name: "TradeCode" });
const { t } = useI18n();

const code = ref("");
const savedCode = ref("");
const restartRequired = ref(false);
const restarting = ref(false);
const serviceLoading = ref(false);

const hasUnsavedChanges = computed(() => code.value !== savedCode.value);

const editorExtensions = computed(() => buildTradeEditorExtensions());
const basicSetup = codeMirrorBasicSetup;

async function fetchData() {
  serviceLoading.value = true;
  try {
    const res = await getConfig();
    if (res?.code !== 200) throw new Error(res?.msg || "Load config failed");
    code.value = res?.data?.content || "";
    savedCode.value = code.value;
    restartRequired.value = Boolean(res?.data?.restart_required);
  } finally {
    serviceLoading.value = false;
  }
}

async function save() {
  if (!hasUnsavedChanges.value) {
    ElMessage.info(t("tradeCodePage.message.noChanges"));
    return;
  }
  await ElMessageBox.confirm(
    t("tradeCodePage.confirm.save"),
    t("tradeCodePage.confirm.title")
  );
  serviceLoading.value = true;
  try {
    const res = await setConfig({ code: code.value });
    if (res?.code !== 200)
      throw new Error(res?.msg || t("tradeCodePage.message.saveFailed"));
    savedCode.value = code.value;
    restartRequired.value = Boolean(res?.data?.restart_required);
    ElMessage.success(
      restartRequired.value
        ? t("tradeCodePage.message.savedRestartNeeded")
        : t("tradeCodePage.message.saveSuccess")
    );
  } finally {
    serviceLoading.value = false;
  }
}

async function restart() {
  if (hasUnsavedChanges.value) {
    ElMessage.warning(t("tradeCodePage.message.saveFirst"));
    return;
  }
  if (!restartRequired.value || restarting.value) return;
  await ElMessageBox.confirm(
    t("tradeCodePage.confirm.restart"),
    t("tradeCodePage.confirm.title"),
    { type: "warning" }
  );
  restarting.value = true;
  try {
    const res = await restartService();
    if (res?.code !== 200)
      throw new Error(res?.msg || t("tradeCodePage.message.restartFailed"));
    if (res?.data?.restarted === false) {
      restartRequired.value = false;
      restarting.value = false;
      ElMessage.info(t("tradeCodePage.message.noChanges"));
      return;
    }
    ElMessage.info(t("tradeCodePage.message.restartRequested"));
  } catch (error) {
    restarting.value = false;
    throw error;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center justify-end gap-3">
      <el-tag v-if="hasUnsavedChanges" type="warning">
        {{ t("tradeCodePage.message.unsaved") }}
      </el-tag>
      <el-tag v-else-if="restartRequired" type="warning">
        {{ t("tradeCodePage.message.restartRequired") }}
      </el-tag>
      <el-button
        type="warning"
        :disabled="!restartRequired || hasUnsavedChanges || restarting"
        :loading="restarting"
        @click="restart"
        >{{ t("tradeCodePage.button.restart") }}</el-button
      >
      <el-button
        type="primary"
        :disabled="restarting || !hasUnsavedChanges"
        :loading="serviceLoading"
        @click="save"
        >{{ t("tradeCodePage.button.save") }}</el-button
      >
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
