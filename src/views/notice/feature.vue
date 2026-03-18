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

defineOptions({ name: "noticeFeature" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive<any>({ symbol: "", notice_price: "" });

async function fetchData() {
  const res = await getNoticeCoins({ type: 2 });
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

async function saveRow(row: any) {
  await setNoticeCoin(row.id, { ...row, enable: row.enable ? 1 : 0 });
  ElMessage.success(t("noticeFeaturePage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("noticeFeaturePage.confirm.delete", { symbol: row.symbol }),
    t("noticeFeaturePage.confirm.title"),
    { type: "warning" }
  );
  await delNoticeCoin(row.id);
  ElMessage.success(t("noticeFeaturePage.message.deleteSuccess"));
  await fetchData();
}

async function onAdd() {
  await addNoticeCoin({
    ...form,
    type: 2,
    createTime: Date.now(),
    updateTime: Date.now()
  });
  dialogVisible.value = false;
  form.symbol = "";
  form.notice_price = "";
  ElMessage.success(t("noticeFeaturePage.message.addSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="dialogVisible = true">{{
        t("noticeFeaturePage.button.add")
      }}</el-button>
      <el-button @click="fetchData">{{
        t("noticeFeaturePage.button.refresh")
      }}</el-button>
      <span class="text-red-500">{{ t("noticeFeaturePage.tip") }}</span>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('noticeFeaturePage.table.symbol')"
        min-width="120"
      />
      <el-table-column :label="t('noticeFeaturePage.table.side')" width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.side" @change="saveRow(row)"
            ><el-option label="buy" value="buy" /><el-option
              label="sell"
              value="sell" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.noticePrice')"
        width="130"
        ><template #default="{ row }"
          ><el-input
            v-model="row.notice_price"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.profitPrice')"
        width="130"
        ><template #default="{ row }"
          ><el-input
            v-model="row.profit_price"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.lossPrice')"
        width="130"
        ><template #default="{ row }"
          ><el-input v-model="row.loss_price" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.marginType')"
        width="140"
        ><template #default="{ row }"
          ><el-select v-model="row.marginType" @change="saveRow(row)"
            ><el-option label="ISOLATED" value="ISOLATED" /><el-option
              label="CROSSED"
              value="CROSSED" /></el-select></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.autoOrder')"
        width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.auto_order" @change="saveRow(row)"
            ><el-option
              :label="t('noticeFeaturePage.state.yes')"
              :value="1" /><el-option
              :label="t('noticeFeaturePage.state.no')"
              :value="0" /></el-select></template
      ></el-table-column>
      <el-table-column label="USDT" width="100"
        ><template #default="{ row }"
          ><el-input v-model="row.usdt" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.leverage')"
        width="100"
        ><template #default="{ row }"
          ><el-input v-model="row.leverage" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('noticeFeaturePage.table.enable')" width="90"
        ><template #default="{ row }"
          ><el-switch v-model="row.enable" @change="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column
        :label="t('noticeFeaturePage.table.operation')"
        width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("noticeFeaturePage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="t('noticeFeaturePage.dialog.addTitle')"
      width="520px"
    >
      <div class="grid gap-4">
        <el-input
          v-model="form.symbol"
          :placeholder="t('noticeFeaturePage.placeholder.symbol')"
        /><el-input
          v-model="form.notice_price"
          :placeholder="t('noticeFeaturePage.placeholder.noticePrice')"
        />
      </div>
      <template #footer
        ><el-button @click="dialogVisible = false">{{
          t("buttons.pureClose")
        }}</el-button
        ><el-button type="primary" @click="onAdd">{{
          t("noticeFeaturePage.button.save")
        }}</el-button></template
      >
    </el-dialog>
  </div>
</template>
