<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { getCoinMRuntimeStatus, type CoinMRuntimeStatus } from "@/api/coinM";
import CoinMAccount from "./account.vue";

defineOptions({ name: "CoinMControlledTrade" });
const { t } = useI18n();
const status = ref<CoinMRuntimeStatus | null>(null);
const loading = ref(false);
const failure = ref("");

async function refreshStatus() {
  loading.value = true;
  failure.value = "";
  status.value = null;
  try {
    const response = await getCoinMRuntimeStatus();
    if (!response || response.code !== 200 || !response.data) {
      throw new Error(
        response?.msg || t("coinMPage.controlled.statusUnavailable")
      );
    }
    status.value = response.data;
  } catch (error: any) {
    failure.value =
      error?.response?.data?.msg ||
      error?.message ||
      t("coinMPage.controlled.statusUnavailable");
    ElMessage.warning(t("coinMPage.controlled.statusUnavailable"));
  } finally {
    loading.value = false;
  }
}
onMounted(() => void refreshStatus());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <strong>{{ t("coinMPage.controlled.statusTitle") }}</strong>
          <el-button :loading="loading" @click="refreshStatus">
            {{ t("coinMPage.account.refresh") }}
          </el-button>
        </div>
      </template>
      <el-alert
        v-if="failure"
        type="warning"
        show-icon
        :closable="false"
        :title="t('coinMPage.controlled.statusUnavailable')"
        :description="failure"
      />
      <template v-if="status">
        <el-descriptions border :column="2" size="small">
          <el-descriptions-item :label="t('coinMPage.account.environment')">
            {{ status.environment || t("coinMPage.controlled.notConfigured") }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('coinMPage.controlled.entrySwitch')">
            <el-tag :type="status.global_entry_enabled ? 'warning' : 'info'">
              {{
                status.global_entry_enabled
                  ? t("coinMPage.controlled.enabled")
                  : t("coinMPage.controlled.disabled")
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('coinMPage.controlled.enabledSymbols')"
          >
            {{ status.enabled_perpetual_symbols }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('coinMPage.controlled.managedCycles')"
          >
            {{ status.managed_cycles_needing_work }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('coinMPage.controlled.unsettledOrders')"
          >
            {{ status.orders_needing_reconciliation }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('coinMPage.controlled.tradeActions')">
            <el-tag type="info">{{
              t("coinMPage.controlled.notAvailable")
            }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-alert
        class="mt-4"
        type="info"
        :closable="false"
        show-icon
        :title="t('coinMPage.controlled.runtimeNote')"
      />
    </el-card>
    <CoinMAccount controlled />
  </div>
</template>
