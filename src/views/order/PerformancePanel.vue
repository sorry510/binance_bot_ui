<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  getVerifiedFuturesPerformance,
  type VerifiedPerformanceReport,
  type VerifiedPerformanceFilter
} from "@/api/order";

const { t, te } = useI18n();
const tr = (key: string) => t("orderPage.performance." + key);
const open = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const report = ref<VerifiedPerformanceReport | null>(null);
const filters = reactive({
  days: 30 as 7 | 30,
  symbol: "",
  position_side: "",
  rule_hash: ""
});
let requestNumber = 0;

const excluded = computed(() =>
  Object.entries(report.value?.excluded_reasons ?? {})
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => ({ reason, count }))
);
function reasonLabel(reason: string) {
  const key = "orderPage.performance.reasons." + reason;
  return te(key) ? t(key) : reason;
}
function timestamp(value: number) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}
function signed(value: string) {
  return Number(value) > 0
    ? "text-green-600"
    : Number(value) < 0
      ? "text-red-500"
      : "";
}
function failure(error: any) {
  return error?.response?.data?.msg || error?.message || tr("loadFailed");
}
async function load() {
  if (!open.value || loading.value) return;
  const current = ++requestNumber;
  loading.value = true;
  errorMessage.value = "";
  try {
    const params: VerifiedPerformanceFilter = {
      days: filters.days,
      symbol: filters.symbol.trim().toUpperCase() || undefined,
      position_side: filters.position_side || undefined,
      rule_hash: filters.rule_hash.trim().toLowerCase() || undefined
    };
    const response = await getVerifiedFuturesPerformance(params);
    if (current !== requestNumber || !open.value) return;
    if (!response || response.code !== 200 || !response.data) {
      throw new Error(tr("loadFailed"));
    }
    report.value = response.data;
  } catch (error) {
    if (current !== requestNumber || !open.value) return;
    report.value = null;
    errorMessage.value = failure(error);
  } finally {
    if (current === requestNumber) loading.value = false;
  }
}
function toggle() {
  open.value = !open.value;
  if (open.value) {
    void load();
  } else {
    requestNumber++;
    loading.value = false;
  }
}
onBeforeUnmount(() => requestNumber++);

function formatRule(value: string) {
  return value === "unknown" ? tr("ruleUnknown") : value;
}
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <strong>{{ tr("title") }}</strong>
        <el-button @click="toggle">
          {{ open ? tr("collapse") : tr("expand") }}
        </el-button>
      </div>
    </template>
    <template v-if="open">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        :title="tr('scope')"
      />
      <el-form :inline="true">
        <el-form-item :label="tr('period')">
          <el-select v-model="filters.days" style="width: 120px">
            <el-option :label="tr('days7')" :value="7" />
            <el-option :label="tr('days30')" :value="30" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tr('symbol')">
          <el-input
            v-model="filters.symbol"
            clearable
            style="width: 145px"
            :placeholder="tr('symbolPlaceholder')"
            @keyup.enter="load"
          />
        </el-form-item>
        <el-form-item :label="tr('side')">
          <el-select v-model="filters.position_side" style="width: 115px">
            <el-option :label="tr('all')" value="" />
            <el-option label="LONG" value="LONG" />
            <el-option label="SHORT" value="SHORT" />
          </el-select>
        </el-form-item>
        <el-form-item :label="tr('ruleHash')">
          <el-input
            v-model="filters.rule_hash"
            clearable
            style="width: 245px"
            :placeholder="tr('rulePlaceholder')"
            @keyup.enter="load"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="load">
            {{ tr("refresh") }}
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="errorMessage"
        type="warning"
        show-icon
        :closable="false"
        :title="tr('loadFailed')"
        :description="errorMessage"
        class="mb-3"
      />
      <div v-loading="loading">
        <template v-if="report">
          <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <el-tag type="info">Main / auto_strategy</el-tag>
            <span
              >{{ tr("closedWindow") }}:
              {{ timestamp(report.start_closed_at) }} –
              {{ timestamp(report.end_closed_at) }}
            </span>
            <span
              >{{ tr("verified") }}:
              <strong>{{ report.verified_cycles }}</strong></span
            >
            <span
              >{{ tr("excluded") }}:
              <strong>{{ report.excluded_cycles }}</strong></span
            >
            <span>{{ tr("candidates") }}: {{ report.candidate_cycles }}</span>
          </div>
          <el-empty
            v-if="!report.assets.length"
            :description="tr('empty')"
            :image-size="60"
          />

          <div v-for="asset in report.assets" :key="asset.asset" class="mb-4">
            <div class="mb-2 flex items-center gap-2">
              <el-tag size="small" type="info">{{ asset.asset }}</el-tag>
              <strong>{{ tr("settledPerformance") }}</strong>
              <span class="text-xs text-gray-500">{{
                tr("currencySeparation")
              }}</span>
            </div>
            <el-descriptions :column="3" border size="small">
              <el-descriptions-item :label="tr('trades')">{{
                asset.trades
              }}</el-descriptions-item>
              <el-descriptions-item :label="tr('winRate')">
                {{ asset.win_rate_pct }}% ({{ tr("wins") }} {{ asset.wins }} /
                {{ tr("losses") }} {{ asset.losses }} / {{ tr("zero") }}
                {{ asset.zero }})
              </el-descriptions-item>
              <el-descriptions-item :label="tr('profitFactor')">
                {{ asset.profit_factor ?? tr("noLossSample") }}
              </el-descriptions-item>
              <el-descriptions-item :label="tr('grossPnL')">
                {{ asset.gross_pnl }} {{ asset.asset }}
              </el-descriptions-item>
              <el-descriptions-item :label="tr('commission')">
                {{ asset.commission }} {{ asset.asset }}
              </el-descriptions-item>
              <el-descriptions-item :label="tr('netPnL')">
                <strong :class="signed(asset.net_pnl)"
                  >{{ asset.net_pnl }} {{ asset.asset }}</strong
                >
              </el-descriptions-item>
              <el-descriptions-item :label="tr('avgNet')">
                <span :class="signed(asset.average_net_pnl)">
                  {{ asset.average_net_pnl }} {{ asset.asset }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item :label="tr('settledDrawdown')" :span="2">
                {{ asset.settled_net_pnl_drawdown }} {{ asset.asset }}
                <el-tooltip
                  :content="tr('drawdownExplanation')"
                  placement="top"
                >
                  <el-tag type="info" size="small">{{
                    tr("notEquityDrawdown")
                  }}</el-tag>
                </el-tooltip>
              </el-descriptions-item>
            </el-descriptions>

            <el-collapse class="mt-2">
              <el-collapse-item :title="tr('bySymbol')" name="symbol">
                <el-table :data="asset.by_symbol" border size="small">
                  <el-table-column
                    prop="name"
                    :label="tr('symbol')"
                    min-width="145"
                  />
                  <el-table-column
                    prop="trades"
                    :label="tr('trades')"
                    width="85"
                  />
                  <el-table-column prop="wins" :label="tr('wins')" width="85" />
                  <el-table-column
                    prop="losses"
                    :label="tr('losses')"
                    width="85"
                  />
                  <el-table-column prop="zero" :label="tr('zero')" width="85" />
                  <el-table-column :label="tr('netPnL')" min-width="160">
                    <template #default="{ row }">
                      <span :class="signed(row.net_pnl)"
                        >{{ row.net_pnl }} {{ asset.asset }}</span
                      >
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
              <el-collapse-item :title="tr('bySide')" name="side">
                <el-table :data="asset.by_side" border size="small">
                  <el-table-column
                    prop="name"
                    :label="tr('side')"
                    min-width="120"
                  />
                  <el-table-column
                    prop="trades"
                    :label="tr('trades')"
                    width="85"
                  />
                  <el-table-column prop="wins" :label="tr('wins')" width="85" />
                  <el-table-column
                    prop="losses"
                    :label="tr('losses')"
                    width="85"
                  />
                  <el-table-column prop="zero" :label="tr('zero')" width="85" />
                  <el-table-column :label="tr('netPnL')" min-width="160">
                    <template #default="{ row }">
                      <span :class="signed(row.net_pnl)"
                        >{{ row.net_pnl }} {{ asset.asset }}</span
                      >
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
              <el-collapse-item :title="tr('byRule')" name="rule">
                <el-table :data="asset.by_rule" border size="small">
                  <el-table-column
                    :label="tr('ruleHash')"
                    min-width="280"
                    show-overflow-tooltip
                  >
                    <template #default="{ row }">{{
                      formatRule(row.name)
                    }}</template>
                  </el-table-column>
                  <el-table-column
                    prop="trades"
                    :label="tr('trades')"
                    width="85"
                  />
                  <el-table-column prop="wins" :label="tr('wins')" width="85" />
                  <el-table-column
                    prop="losses"
                    :label="tr('losses')"
                    width="85"
                  />
                  <el-table-column prop="zero" :label="tr('zero')" width="85" />
                  <el-table-column :label="tr('netPnL')" min-width="160">
                    <template #default="{ row }">
                      <span :class="signed(row.net_pnl)"
                        >{{ row.net_pnl }} {{ asset.asset }}</span
                      >
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
            </el-collapse>
          </div>

          <div v-if="excluded.length" class="mt-2">
            <strong>{{ tr("exclusionDetails") }}</strong>
            <el-table :data="excluded" border size="small" class="mt-2">
              <el-table-column :label="tr('exclusionReason')" min-width="240">
                <template #default="{ row }">{{
                  reasonLabel(row.reason)
                }}</template>
              </el-table-column>
              <el-table-column
                prop="count"
                :label="tr('exclusionCount')"
                width="115"
              />
            </el-table>
          </div>
          <div class="mt-3 text-xs text-gray-500">
            {{ tr("readOnlyDisclaimer") }}
            {{ tr("calculatedAt") }}: {{ timestamp(report.observed_at) }}
          </div>
        </template>
      </div>
    </template>
  </el-card>
</template>
