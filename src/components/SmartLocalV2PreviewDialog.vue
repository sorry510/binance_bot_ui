<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { getSmartLocalV2Preview, type SmartLocalV2Result } from "@/api/service";

defineOptions({ name: "SmartLocalV2PreviewDialog" });

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    mode?: "trade" | "test";
  }>(),
  { mode: "trade" }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const { t } = useI18n();
const loading = ref(false);
const preview = ref<SmartLocalV2Result | null>(null);

const title = computed(() =>
  t("dashboard.selectorPreview.titleWithMode", {
    mode:
      props.mode === "test"
        ? t("dashboard.selectorPreview.modeTest")
        : t("dashboard.selectorPreview.modeTrade")
  })
);

async function loadPreview() {
  loading.value = true;
  try {
    const res = await getSmartLocalV2Preview(60, props.mode);
    if (res?.code !== 200 || !res?.data) {
      throw new Error(res?.msg || t("dashboard.selectorPreview.loadFailed"));
    }
    preview.value = res.data as SmartLocalV2Result;
  } catch (error: any) {
    preview.value = null;
    ElMessage.error(
      error?.message || t("dashboard.selectorPreview.loadFailed")
    );
  } finally {
    loading.value = false;
  }
}

function formatCompactNumber(value: number) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function isNextBatch(symbol: string) {
  return Boolean(preview.value?.rotation?.batch_symbols?.includes(symbol));
}

function batchRanks() {
  const ranks = preview.value?.rotation?.batch_ranks || [];
  return ranks.length ? ranks.join(", ") : "-";
}

watch(
  () => [props.modelValue, props.mode] as const,
  ([visible]) => {
    if (visible) void loadPreview();
  }
);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="92%"
    top="5vh"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div v-loading="loading" class="selector-preview">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        :title="t('dashboard.selectorPreview.localOnly')"
      />
      <div v-if="preview" class="selector-preview-meta">
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.source") }}: {{ preview.source }}
        </el-tag>
        <el-tag type="success" effect="plain">
          REST: {{ preview.meta?.rest_api_used ? "yes" : "no" }}
        </el-tag>
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.mode") }}:
          {{
            preview.meta?.mode === "test"
              ? t("dashboard.selectorPreview.modeTest")
              : t("dashboard.selectorPreview.modeTrade")
          }}
        </el-tag>
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.cooldown") }}:
          {{ preview.meta?.cooldown_minute }}m
        </el-tag>
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.freshness") }}:
          {{ Number(preview.meta?.max_data_age_ms || 0) / 1000 }}s
        </el-tag>
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.minVolume") }}:
          {{ formatCompactNumber(Number(preview.meta?.min_quote_volume || 0)) }}
        </el-tag>
        <el-tag type="primary" effect="plain">
          {{ t("dashboard.selectorPreview.pool") }}:
          {{ preview.rotation?.pool_size || 0 }}/{{
            preview.meta?.pool_limit || 60
          }}
        </el-tag>
        <el-tag type="primary" effect="plain">
          {{ t("dashboard.selectorPreview.batch") }}:
          {{ preview.rotation?.batch_size || 5 }}
        </el-tag>
        <el-tag effect="plain">
          {{ t("dashboard.selectorPreview.sequence") }}:
          {{ preview.rotation?.sequence || 0 }}
        </el-tag>
        <el-tag type="warning" effect="plain">
          {{ t("dashboard.selectorPreview.nextRanks") }}:
          {{ batchRanks() }}
        </el-tag>
      </div>

      <div v-if="preview?.next_batch?.length" class="selector-next-batch">
        <span>{{ t("dashboard.selectorPreview.nextBatch") }}:</span>
        <el-tag
          v-for="item in preview.next_batch"
          :key="item.symbol"
          type="warning"
          effect="plain"
        >
          #{{ item.rank }} {{ item.symbol }}
        </el-tag>
      </div>

      <el-table
        v-if="preview"
        :data="preview.candidates"
        size="small"
        border
        class="selector-candidate-table"
      >
        <el-table-column prop="rank" label="#" width="56" />
        <el-table-column
          :label="t('dashboard.selectorPreview.rotation')"
          width="86"
        >
          <template #default="{ row }">
            <el-tag
              v-if="isNextBatch(row.symbol)"
              size="small"
              type="warning"
              effect="dark"
            >
              {{ t("dashboard.selectorPreview.next") }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="symbol"
          :label="t('dashboard.selectorPreview.symbol')"
          width="130"
        />
        <el-table-column
          prop="score"
          :label="t('dashboard.selectorPreview.score')"
          width="85"
        />
        <el-table-column
          :label="t('dashboard.selectorPreview.volume')"
          width="110"
        >
          <template #default="{ row }">
            {{ formatCompactNumber(row.quote_volume_24h) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dashboard.selectorPreview.trades')"
          width="105"
        >
          <template #default="{ row }">
            {{ formatCompactNumber(row.trade_count_24h) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dashboard.selectorPreview.change')"
          width="95"
        >
          <template #default="{ row }">
            {{ Number(row.percent_change_24h).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dashboard.selectorPreview.momentum')"
          width="100"
        >
          <template #default="{ row }">
            {{ Number(row.local_momentum_pct).toFixed(3) }}%
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dashboard.selectorPreview.reasons')"
          min-width="260"
        >
          <template #default="{ row }">
            <div class="selector-reason-list">
              <el-tag
                v-for="reason in row.reasons"
                :key="reason"
                size="small"
                type="success"
                effect="plain"
              >
                {{ reason }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dashboard.selectorPreview.risks')"
          min-width="220"
        >
          <template #default="{ row }">
            <div class="selector-reason-list">
              <el-tag
                v-for="risk in row.risks"
                :key="risk"
                size="small"
                type="warning"
                effect="plain"
              >
                {{ risk }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-collapse v-if="preview" class="selector-excluded">
        <el-collapse-item name="excluded">
          <template #title>
            {{
              t("dashboard.selectorPreview.excluded", {
                count: preview.excluded?.length || 0
              })
            }}
          </template>
          <el-table :data="preview.excluded" size="small" max-height="300">
            <el-table-column prop="symbol" label="Symbol" width="160" />
            <el-table-column
              prop="reason"
              :label="t('dashboard.selectorPreview.excludedReason')"
            />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-dialog>
</template>

<style scoped>
.selector-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.selector-next-batch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.selector-candidate-table {
  margin-top: 12px;
}

.selector-reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.selector-excluded {
  margin-top: 14px;
}
</style>
