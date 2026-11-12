<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getSpotPositionDetail,
  type SpotPositionDetail
} from "@/api/spotQuant";
import { formatSpotDecimal, formatSpotTime, hasPreciseSpotPnL } from "./format";

defineOptions({ name: "SpotQuantPositionDetail" });
const props = defineProps<{ visible: boolean; positionId: number | null }>();
const emit = defineEmits<{
  (event: "update:visible", visible: boolean): void;
}>();
const { t } = useI18n();
const loading = ref(false);
const detail = ref<SpotPositionDetail | null>(null);

async function refresh() {
  if (!props.positionId) return;
  loading.value = true;
  try {
    const res = await getSpotPositionDetail(props.positionId);
    if (res?.code !== 200)
      throw new Error(res?.msg || "Spot detail unavailable");
    detail.value = res.data;
  } catch (error: any) {
    detail.value = null;
    ElMessage.error(error?.message || t("spotQuantPage.message.loadFailed"));
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.visible, props.positionId] as const,
  ([visible]) => {
    if (visible) void refresh();
    else detail.value = null;
  }
);
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="t('spotQuantPage.detail.title')"
    size="min(880px, 95%)"
    @update:model-value="value => emit('update:visible', value)"
  >
    <div v-loading="loading">
      <template v-if="detail">
        <el-alert
          v-if="detail.view.needs_review || detail.review_issues?.length"
          type="warning"
          show-icon
          :closable="false"
          :title="t('spotQuantPage.message.needsReview')"
          :description="
            detail.view.review_reason || detail.review_issues.join('; ')
          "
          class="mb-4"
        />
        <el-alert
          v-if="!detail.view.fully_priced"
          type="warning"
          show-icon
          :closable="false"
          :title="t('spotQuantPage.message.unpriced')"
          :description="
            Object.entries(detail.view.unpriced_fees || {})
              .map(
                ([asset, amount]) => `${asset}: ${formatSpotDecimal(amount)}`
              )
              .join(', ')
          "
          class="mb-4"
        />
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('spotQuantPage.table.symbol')">
            {{ detail.view.position.symbol }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.status')">
            {{ t("spotQuantPage.status." + detail.view.position.status) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.remaining')">
            {{
              detail.view.needs_review
                ? "-"
                : formatSpotDecimal(detail.view.position.remaining_qty)
            }}
            {{ detail.view.position.base_asset }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.average')">
            {{
              detail.view.needs_review
                ? "-"
                : formatSpotDecimal(detail.view.position.avg_cost_quote)
            }}
            {{ detail.view.position.quote_asset }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.price')">
            {{
              detail.view.has_mark_price
                ? formatSpotDecimal(detail.view.mark_price)
                : t("spotQuantPage.message.priceMissing")
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.realized')">
            {{
              detail.view.needs_review
                ? "-"
                : formatSpotDecimal(detail.view.realized_pnl)
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.unrealized')">
            {{
              !detail.view.needs_review && detail.view.has_mark_price
                ? formatSpotDecimal(detail.view.unrealized_pnl)
                : "-"
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.totalPnl')">
            {{
              hasPreciseSpotPnL(detail.view)
                ? formatSpotDecimal(detail.view.total_pnl)
                : "-"
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.created')">
            {{ formatSpotTime(detail.view.position.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('spotQuantPage.table.closed')">
            {{ formatSpotTime(detail.view.position.closed_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="mt-5 mb-3 font-semibold">
          {{ t("spotQuantPage.detail.orders") }}
        </div>
        <el-table
          :data="detail.orders || []"
          border
          size="small"
          max-height="260"
        >
          <el-table-column prop="id" label="ID" width="76" />
          <el-table-column :label="t('spotQuantPage.table.side')" width="95">
            <template #default="{ row }">
              <el-tag
                :type="row.side === 'BUY' ? 'success' : 'warning'"
                size="small"
              >
                {{ row.side }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="status"
            :label="t('spotQuantPage.table.status')"
            min-width="128"
          />
          <el-table-column
            :label="t('spotQuantPage.table.requested')"
            min-width="130"
          >
            <template #default="{ row }">{{
              formatSpotDecimal(row.requested_qty)
            }}</template>
          </el-table-column>
          <el-table-column
            :label="t('spotQuantPage.table.filled')"
            min-width="130"
          >
            <template #default="{ row }">{{
              formatSpotDecimal(row.filled_qty)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="client_order_id"
            :label="t('spotQuantPage.table.clientId')"
            min-width="180"
            show-overflow-tooltip
          />
        </el-table>

        <div class="mt-5 mb-3 font-semibold">
          {{ t("spotQuantPage.detail.fills") }}
        </div>
        <el-table
          :data="detail.fills || []"
          border
          size="small"
          max-height="260"
        >
          <el-table-column
            prop="trade_id"
            :label="t('spotQuantPage.table.tradeId')"
            min-width="120"
          />
          <el-table-column
            prop="side"
            :label="t('spotQuantPage.table.side')"
            width="90"
          />
          <el-table-column
            :label="t('spotQuantPage.table.quantity')"
            min-width="115"
          >
            <template #default="{ row }">{{
              formatSpotDecimal(row.qty)
            }}</template>
          </el-table-column>
          <el-table-column
            :label="t('spotQuantPage.table.price')"
            min-width="115"
          >
            <template #default="{ row }">{{
              formatSpotDecimal(row.price)
            }}</template>
          </el-table-column>
          <el-table-column
            :label="t('spotQuantPage.table.fee')"
            min-width="145"
          >
            <template #default="{ row }">
              {{ formatSpotDecimal(row.commission) }} {{ row.commission_asset }}
            </template>
          </el-table-column>
          <el-table-column
            :label="t('spotQuantPage.table.created')"
            min-width="155"
          >
            <template #default="{ row }">{{
              formatSpotTime(row.trade_time)
            }}</template>
          </el-table-column>
        </el-table>
      </template>
      <el-empty
        v-else-if="!loading"
        :description="t('spotQuantPage.message.noData')"
      />
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">
        {{ t("spotQuantPage.actions.close") }}
      </el-button>
      <el-button :loading="loading" @click="refresh">
        {{ t("spotQuantPage.actions.refresh") }}
      </el-button>
    </template>
  </el-drawer>
</template>
