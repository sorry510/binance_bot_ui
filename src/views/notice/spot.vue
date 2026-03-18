<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  addNoticeCoin,
  delNoticeCoin,
  getNoticeCoins,
  setNoticeCoin
} from "../../api/noticeCoin";

defineOptions({ name: "noticeSpot" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive<any>({ symbol: "", notice_price: "" });

async function fetchData() {
  const res = await getNoticeCoins({ type: 1 });
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

async function saveRow(row: any) {
  await setNoticeCoin(row.id, { ...row, enable: row.enable ? 1 : 0 });
  ElMessage.success(t("noticeSpotPage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("noticeSpotPage.confirm.delete", { symbol: row.symbol }),
    t("noticeSpotPage.confirm.title"),
    { type: "warning" }
  );
  await delNoticeCoin(row.id);
  ElMessage.success(t("noticeSpotPage.message.deleteSuccess"));
  await fetchData();
}

async function onAdd() {
  await addNoticeCoin({
    ...form,
    type: 1,
    createTime: Date.now(),
    updateTime: Date.now()
  });
  dialogVisible.value = false;
  form.symbol = "";
  form.notice_price = "";
  ElMessage.success(t("noticeSpotPage.message.addSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="dialogVisible = true">{{
        t("noticeSpotPage.button.add")
      }}</el-button>
      <el-button @click="fetchData">{{
        t("noticeSpotPage.button.refresh")
      }}</el-button>
      <span class="text-red-500">{{ t("noticeSpotPage.tip") }}</span>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('noticeSpotPage.table.symbol')"
        min-width="120"
      />
      <el-table-column :label="t('noticeSpotPage.table.side')" width="120">
        <template #default="{ row }"
          ><el-select v-model="row.side" @change="saveRow(row)"
            ><el-option label="buy" value="buy" /><el-option
              label="sell"
              value="sell" /></el-select
        ></template>
      </el-table-column>
      <el-table-column
        :label="t('noticeSpotPage.table.noticePrice')"
        width="140"
      >
        <template #default="{ row }"
          ><el-input v-model="row.notice_price" @blur="saveRow(row)"
        /></template>
      </el-table-column>
      <el-table-column
        prop="has_notice"
        :label="t('noticeSpotPage.table.noticed')"
        width="100"
      />
      <el-table-column :label="t('noticeSpotPage.table.autoOrder')" width="120">
        <template #default="{ row }"
          ><el-select v-model="row.auto_order" @change="saveRow(row)"
            ><el-option
              :label="t('noticeSpotPage.state.yes')"
              :value="1" /><el-option
              :label="t('noticeSpotPage.state.no')"
              :value="0" /></el-select
        ></template>
      </el-table-column>
      <el-table-column label="USDT" width="120"
        ><template #default="{ row }"
          ><el-input v-model="row.usdt" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('noticeSpotPage.table.quantity')" width="120"
        ><template #default="{ row }"
          ><el-input v-model="row.quantity" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('noticeSpotPage.table.enable')" width="90"
        ><template #default="{ row }"
          ><el-switch v-model="row.enable" @change="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('noticeSpotPage.table.operation')" width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("noticeSpotPage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="t('noticeSpotPage.dialog.addTitle')"
      width="520px"
    >
      <div class="grid gap-4">
        <el-input
          v-model="form.symbol"
          :placeholder="t('noticeSpotPage.placeholder.symbol')"
        /><el-input
          v-model="form.notice_price"
          :placeholder="t('noticeSpotPage.placeholder.noticePrice')"
        />
      </div>
      <template #footer
        ><el-button @click="dialogVisible = false">{{
          t("buttons.pureClose")
        }}</el-button
        ><el-button type="primary" @click="onAdd">{{
          t("noticeSpotPage.button.save")
        }}</el-button></template
      >
    </el-dialog>
  </div>
</template>
