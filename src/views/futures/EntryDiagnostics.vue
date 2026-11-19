<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  getFuturesEntryDiagnostics,
  type FuturesEntryDiagnosticsSnapshot
} from "@/api/trade";

const { t } = useI18n();
const tr = (key: string) => t("futuresSymbolPage.entryDiagnostics." + key);
const expanded = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const snapshot = ref<FuturesEntryDiagnosticsSnapshot | null>(null);
const query = reactive({ symbol: "", position_side: "" });
const refreshedAt = ref(0);
let poll: number | undefined;
let serial = 0;

function localTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}
function label(reason?: string) {
  if (!reason) return "-";
  const key = "futuresSymbolPage.entryDiagnostics.reasons." + reason;
  const translated = t(key);
  return translated === key ? reason : translated;
}
const stale = computed(
  () =>
    !!snapshot.value?.observed_at &&
    Date.now() - snapshot.value.observed_at > 30000
);

async function fetchSnapshot() {
  if (!expanded.value || loading.value) return;
  const current = ++serial;
  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await getFuturesEntryDiagnostics({
      symbol: query.symbol.trim().toUpperCase() || undefined,
      position_side: query.position_side || undefined
    });
    if (current !== serial || !expanded.value) return;
    if (response?.code !== 200 || !response?.data) {
      throw new Error(tr("requestFailed"));
    }
    snapshot.value = response.data;
    refreshedAt.value = Date.now();
  } catch (error: any) {
    if (current !== serial || !expanded.value) return;
    snapshot.value = null;
    errorMessage.value = error?.message || tr("requestFailed");
  } finally {
    if (current === serial) loading.value = false;
  }
}
function stopPolling() {
  if (poll !== undefined) window.clearInterval(poll);
  poll = undefined;
  serial++;
}
function toggle() {
  expanded.value = !expanded.value;
  if (!expanded.value) {
    stopPolling();
    loading.value = false;
    return;
  }
  void fetchSnapshot();
  poll = window.setInterval(() => void fetchSnapshot(), 15000);
}
onBeforeUnmount(stopPolling);
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <strong>{{ tr("title") }}</strong>
        <el-button @click="toggle">
          {{ expanded ? tr("collapse") : tr("expand") }}
        </el-button>
      </div>
    </template>
    <template v-if="expanded">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        :title="tr('scope')"
      />
      <el-form inline>
        <el-form-item :label="tr('symbol')">
          <el-input
            v-model="query.symbol"
            clearable
            style="width: 150px"
            :placeholder="tr('symbolPlaceholder')"
            @keyup.enter="fetchSnapshot"
          />
        </el-form-item>
        <el-form-item :label="tr('side')">
          <el-select v-model="query.position_side" style="width: 140px">
            <el-option :label="tr('all')" value="" />
            <el-option label="LONG" value="LONG" />
            <el-option label="SHORT" value="SHORT" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="fetchSnapshot">
            {{ tr("refresh") }}
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="errorMessage"
        type="warning"
        :closable="false"
        :title="tr('requestFailed')"
        :description="errorMessage"
        class="mb-3"
        show-icon
      />
      <template v-if="snapshot">
        <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            {{ tr("globalStatus") }}:
            <el-tag
              :type="
                snapshot.global_reason === 'running' ? 'success' : 'warning'
              "
              size="small"
            >
              {{ label(snapshot.global_reason) }}
            </el-tag>
          </span>
          <span
            >{{ tr("lastCycle") }}: {{ localTime(snapshot.observed_at) }}</span
          >
          <span>{{ tr("results") }}: {{ snapshot.total }}</span>
          <el-tag v-if="stale" type="warning">{{ tr("stale") }}</el-tag>
        </div>
        <el-table
          v-loading="loading"
          :data="snapshot.list"
          border
          size="small"
          :row-key="row => row.symbol + '/' + row.position_side"
          max-height="440"
        >
          <el-table-column
            prop="symbol"
            :label="tr('symbol')"
            min-width="115"
          />
          <el-table-column
            prop="position_side"
            :label="tr('side')"
            width="105"
          />
          <el-table-column :label="tr('reason')" min-width="210">
            <template #default="{ row }">
              <el-tag
                :type="
                  row.reason_code === 'order_submitted'
                    ? 'success'
                    : row.reason_code === 'not_evaluated' ||
                        row.reason_code === 'no_candidate' ||
                        row.reason_code === 'strategy_not_matched'
                      ? 'info'
                      : 'warning'
                "
                size="small"
              >
                {{ label(row.reason_code) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="tr('observedAt')" min-width="175">
            <template #default="{ row }">{{
              localTime(row.observed_at)
            }}</template>
          </el-table-column>
          <el-table-column :label="tr('lastSubmittedAt')" min-width="185">
            <template #default="{ row }">
              {{ localTime(row.last_order_submitted_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-if="!loading && !snapshot.list.length"
          :image-size="65"
          :description="tr('empty')"
        />
        <div class="mt-2 text-xs text-gray-500">
          {{ tr("lastLoad") }}: {{ localTime(refreshedAt) }}
        </div>
      </template>
    </template>
  </el-card>
</template>
