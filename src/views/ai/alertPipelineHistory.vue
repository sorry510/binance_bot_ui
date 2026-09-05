<script setup lang="ts">
import { reactive, ref } from "vue";
import { onMounted } from "vue";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import {
  getAlertPipelineTraces,
  type AlertPipelineAuditItem,
  type AlertPipelineAuditResult
} from "@/api/agent";

defineOptions({ name: "AlertPipelineHistory" });
const { t } = useI18n();
const loading = ref(false);
const rows = ref<AlertPipelineAuditItem[]>([]);
const total = ref(0);
const timeRange = ref<[Date, Date] | null>(null);
const query = reactive({
  page: 1,
  limit: 20,
  symbol: "",
  type: "",
  severity: "",
  status: "",
  fallback: "",
  has_notification: ""
});

const signalTypes = [
  "fast_move",
  "volume_spike",
  "oi_spike",
  "liquidation_spike",
  "funding_extreme",
  "breakout",
  "breakdown",
  "short_squeeze_candidate",
  "long_squeeze_candidate"
];
const severities = ["low", "medium", "high", "critical"];
const statuses = [
  "received",
  "shadow",
  "below_severity",
  "cooldown",
  "ai_running",
  "ai_notify",
  "ai_ignore",
  "fallback_notify",
  "notify_failed",
  "fallback_notified",
  "notified"
];

function formatTime(value?: number) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";
}
function translate(prefix: string, value?: string) {
  if (!value) return "-";
  const key = `${prefix}.${value}`;
  const result = t(key);
  return result === key ? value : result;
}
function statusType(value?: string) {
  if (["notified", "fallback_notified"].includes(value || "")) return "success";
  if (["notify_failed"].includes(value || "")) return "danger";
  if (["ai_running", "fallback_notify"].includes(value || "")) return "warning";
  return "info";
}
async function fetchData(reset = false) {
  if (reset) query.page = 1;
  loading.value = true;
  try {
    const params: Record<string, any> = { ...query };
    if (timeRange.value?.length === 2) {
      params.start_time = dayjs(timeRange.value[0]).startOf("second").valueOf();
      params.end_time = dayjs(timeRange.value[1]).endOf("second").valueOf();
    }
    Object.keys(params).forEach(
      key => params[key] === "" && delete params[key]
    );
    const res = await getAlertPipelineTraces(params);
    const data = (res?.data || {}) as AlertPipelineAuditResult;
    rows.value = data.list || [];
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}
function reset() {
  Object.assign(query, {
    page: 1,
    limit: 20,
    symbol: "",
    type: "",
    severity: "",
    status: "",
    fallback: "",
    has_notification: ""
  });
  timeRange.value = null;
  void fetchData(true);
}
onMounted(() => fetchData());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-base font-medium">
              {{ t("alertPipelineHistory.title") }}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              {{ t("alertPipelineHistory.subtitle") }}
            </div>
          </div>
          <span>{{ t("alertPipelineHistory.total", { total }) }}</span>
        </div>
      </template>
      <el-alert
        :title="t('alertPipelineHistory.hint.delivery')"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <div class="mb-4 flex flex-wrap gap-2">
        <el-input
          v-model="query.symbol"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.symbol')"
          style="width: 140px"
        />
        <el-select
          v-model="query.type"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.type')"
          style="width: 170px"
        >
          <el-option
            v-for="item in signalTypes"
            :key="item"
            :label="translate('dashboard.signalType', item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.severity"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.severity')"
          style="width: 130px"
        >
          <el-option
            v-for="item in severities"
            :key="item"
            :label="translate('dashboard.alertSeverity', item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.status"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.status')"
          style="width: 170px"
        >
          <el-option
            v-for="item in statuses"
            :key="item"
            :label="translate('dashboard.traceStatus', item)"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.fallback"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.fallback')"
          style="width: 140px"
        >
          <el-option :label="t('alertPipelineHistory.state.yes')" value="1" />
          <el-option :label="t('alertPipelineHistory.state.no')" value="0" />
        </el-select>
        <el-select
          v-model="query.has_notification"
          clearable
          :placeholder="t('alertPipelineHistory.placeholder.notification')"
          style="width: 150px"
        >
          <el-option
            :label="t('alertPipelineHistory.state.hasNotification')"
            value="1"
          />
          <el-option
            :label="t('alertPipelineHistory.state.noNotification')"
            value="0"
          />
        </el-select>
        <el-date-picker
          v-model="timeRange"
          type="datetimerange"
          :start-placeholder="t('alertPipelineHistory.placeholder.startTime')"
          :end-placeholder="t('alertPipelineHistory.placeholder.endTime')"
        />
        <el-button type="primary" @click="fetchData(true)">{{
          t("alertPipelineHistory.button.search")
        }}</el-button>
        <el-button @click="reset">{{
          t("alertPipelineHistory.button.reset")
        }}</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" size="small">
        <el-table-column
          :label="t('alertPipelineHistory.table.time')"
          width="170"
          ><template #default="{ row }">{{
            formatTime(row.created_at)
          }}</template></el-table-column
        >
        <el-table-column
          prop="symbol"
          :label="t('alertPipelineHistory.table.symbol')"
          width="110"
        />
        <el-table-column
          :label="t('alertPipelineHistory.table.signal')"
          min-width="150"
          ><template #default="{ row }">{{
            translate("dashboard.signalType", row.type)
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('alertPipelineHistory.table.severity')"
          width="100"
          ><template #default="{ row }">{{
            translate("dashboard.alertSeverity", row.severity)
          }}</template></el-table-column
        >
        <el-table-column
          :label="t('alertPipelineHistory.table.status')"
          width="145"
          ><template #default="{ row }"
            ><el-tag :type="statusType(row.status)" size="small">{{
              translate("dashboard.traceStatus", row.status)
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          :label="t('alertPipelineHistory.table.fallback')"
          width="90"
          ><template #default="{ row }">{{
            row.fallback
              ? t("alertPipelineHistory.state.yes")
              : t("alertPipelineHistory.state.no")
          }}</template></el-table-column
        >
        <el-table-column
          prop="event_id"
          :label="t('alertPipelineHistory.table.eventId')"
          min-width="210"
          show-overflow-tooltip
        />
        <el-table-column
          prop="signal_id"
          :label="t('alertPipelineHistory.table.signalId')"
          min-width="210"
          show-overflow-tooltip
        />
        <el-table-column
          prop="task_id"
          :label="t('alertPipelineHistory.table.taskId')"
          min-width="210"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('alertPipelineHistory.table.taskStatus')"
          width="130"
          ><template #default="{ row }">{{
            row.task_status
              ? `${row.task_status}/${row.task_stage || "-"}`
              : "-"
          }}</template></el-table-column
        >
        <el-table-column
          prop="notification_id"
          :label="t('alertPipelineHistory.table.notificationId')"
          width="120"
        />
        <el-table-column
          :label="t('alertPipelineHistory.table.notification')"
          min-width="320"
        >
          <template #default="{ row }"
            ><div v-if="row.notification">
              <div class="font-medium">{{ row.notification.title }}</div>
              <div class="text-xs text-gray-500 whitespace-pre-wrap">
                {{ row.notification.content }}
              </div>
            </div>
            <span v-else>-</span></template
          >
        </el-table-column>
        <el-table-column
          :label="t('alertPipelineHistory.table.error')"
          min-width="220"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            row.error || row.task_error || "-"
          }}</template></el-table-column
        >
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.limit"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="fetchData()"
          @size-change="fetchData(true)"
        />
      </div>
    </el-card>
  </div>
</template>
