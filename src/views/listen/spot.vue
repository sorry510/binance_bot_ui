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

defineOptions({ name: "listenSpot" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive<any>({ symbol: "" });
const intervals = [
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

function formatTime(ts: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleString();
}

function typeText(type: string) {
  return type === "up"
    ? t("listenSpotPage.type.up")
    : type === "down"
      ? t("listenSpotPage.type.down")
      : "";
}

async function fetchData() {
  const res = await getListenCoins({ type: 1 });
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

async function saveRow(row: any) {
  await setListenCoin(row.id, {
    kline_interval: row.kline_interval,
    notice_limit_min: Number(row.notice_limit_min),
    change_percent: row.change_percent,
    enable: row.enable ? 1 : 0
  });
  ElMessage.success(t("listenSpotPage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("listenSpotPage.confirm.delete", { symbol: row.symbol }),
    t("listenSpotPage.confirm.title"),
    { type: "warning" }
  );
  await delListenCoin(row.id);
  ElMessage.success(t("listenSpotPage.message.deleteSuccess"));
  await fetchData();
}

async function onAdd() {
  await addListenCoin({
    ...form,
    type: 1,
    createTime: Date.now(),
    updateTime: Date.now()
  });
  dialogVisible.value = false;
  form.symbol = "";
  ElMessage.success(t("listenSpotPage.message.addSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="dialogVisible = true">{{
        t("listenSpotPage.button.add")
      }}</el-button
      ><el-button @click="fetchData">{{
        t("listenSpotPage.button.refresh")
      }}</el-button>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('listenSpotPage.table.symbol')"
        min-width="120"
      />
      <el-table-column
        :label="t('listenSpotPage.table.klineInterval')"
        width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.kline_interval" @change="saveRow(row)"
            ><el-option
              v-for="item in intervals"
              :key="item"
              :label="item"
              :value="item" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('listenSpotPage.table.changePercent')"
        width="140"
        ><template #default="{ row }"
          ><el-input
            v-model="row.change_percent"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('listenSpotPage.table.noticeLimit')"
        width="140"
        ><template #default="{ row }"
          ><el-input
            v-model="row.notice_limit_min"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('listenSpotPage.table.lastNotice')"
        min-width="220"
        ><template #default="{ row }"
          >{{ row.last_notice_time ? formatTime(row.last_notice_time) : "" }}
          {{ typeText(row.last_notice_type) }}</template
        ></el-table-column
      >
      <el-table-column :label="t('listenSpotPage.table.enable')" width="90"
        ><template #default="{ row }"
          ><el-switch v-model="row.enable" @change="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('listenSpotPage.table.operation')" width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("listenSpotPage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="t('listenSpotPage.dialog.addTitle')"
      width="520px"
      ><el-input
        v-model="form.symbol"
        :placeholder="t('listenSpotPage.placeholder.symbol')"
      /><template #footer
        ><el-button @click="dialogVisible = false">{{
          t("buttons.pureClose")
        }}</el-button
        ><el-button type="primary" @click="onAdd">{{
          t("listenSpotPage.button.save")
        }}</el-button></template
      ></el-dialog
    >
  </div>
</template>
