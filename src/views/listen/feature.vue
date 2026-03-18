<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  addListenCoin,
  delListenCoin,
  getListenCoins,
  setListenCoin
} from "../../api/listenCoin";

defineOptions({ name: "listenFeature" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive<any>({ symbol: "", listen_type: "kline_base" });
const baseIntervals = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M"
];
const kcIntervals = ["15m", "1h", "4h", "1d", "3d", "1w"];

function formatTime(ts: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleString();
}

function typeText(type: string) {
  return type === "up"
    ? t("listenFeaturePage.type.up")
    : type === "down"
      ? t("listenFeaturePage.type.down")
      : "";
}

async function fetchData() {
  const res = await getListenCoins({ type: 2 });
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

async function saveRow(row: any) {
  await setListenCoin(row.id, {
    ...row,
    notice_limit_min: Number(row.notice_limit_min || 0),
    enable: row.enable ? 1 : 0
  });
  ElMessage.success(t("listenFeaturePage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("listenFeaturePage.confirm.delete", { symbol: row.symbol }),
    t("listenFeaturePage.confirm.title"),
    { type: "warning" }
  );
  await delListenCoin(row.id);
  ElMessage.success(t("listenFeaturePage.message.deleteSuccess"));
  await fetchData();
}

async function onAdd() {
  await addListenCoin({
    ...form,
    type: 2,
    createTime: Date.now(),
    updateTime: Date.now()
  });
  dialogVisible.value = false;
  form.symbol = "";
  form.listen_type = "kline_base";
  ElMessage.success(t("listenFeaturePage.message.addSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="dialogVisible = true">{{
        t("listenFeaturePage.button.add")
      }}</el-button
      ><el-button @click="fetchData">{{
        t("listenFeaturePage.button.refresh")
      }}</el-button>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('listenFeaturePage.table.symbol')"
        min-width="120"
      />
      <el-table-column
        :label="t('listenFeaturePage.table.listenType')"
        width="140"
        ><template #default="{ row }"
          ><el-select v-model="row.listen_type" @change="saveRow(row)"
            ><el-option label="kline_base" value="kline_base" /><el-option
              label="kline_kc"
              value="kline_kc" /><el-option
              label="custom"
              value="custom" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.klineInterval')"
        width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.kline_interval" @change="saveRow(row)"
            ><el-option
              v-for="item in row.listen_type === 'kline_kc'
                ? kcIntervals
                : baseIntervals"
              :key="item"
              :label="item"
              :value="item" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.changePercent')"
        width="140"
        ><template #default="{ row }"
          ><el-input
            v-model="row.change_percent"
            :disabled="row.listen_type !== 'kline_base'"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.noticeLimit')"
        width="140"
        ><template #default="{ row }"
          ><el-input
            v-model="row.notice_limit_min"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.lastNotice')"
        min-width="220"
        ><template #default="{ row }"
          >{{ row.last_notice_time ? formatTime(row.last_notice_time) : "" }}
          {{ typeText(row.last_notice_type) }}</template
        ></el-table-column
      >
      <el-table-column :label="t('listenFeaturePage.table.enable')" width="90"
        ><template #default="{ row }"
          ><el-switch v-model="row.enable" @change="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('listenFeaturePage.table.operation')"
        width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("listenFeaturePage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="t('listenFeaturePage.dialog.addTitle')"
      width="520px"
      ><div class="grid gap-4">
        <el-input
          v-model="form.symbol"
          :placeholder="t('listenFeaturePage.placeholder.symbol')"
        /><el-select v-model="form.listen_type"
          ><el-option label="kline_base" value="kline_base" /><el-option
            label="kline_kc"
            value="kline_kc" /><el-option label="custom" value="custom"
        /></el-select>
      </div>
      <template #footer
        ><el-button @click="dialogVisible = false">{{
          t("buttons.pureClose")
        }}</el-button
        ><el-button type="primary" @click="onAdd">{{
          t("listenFeaturePage.button.save")
        }}</el-button></template
      ></el-dialog
    >
  </div>
</template>
