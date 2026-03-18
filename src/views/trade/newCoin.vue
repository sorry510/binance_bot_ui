<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  addFeature,
  delFeature,
  getFeatures,
  setFeature
} from "../../api/rushtrade";

defineOptions({ name: "RushNewCoin" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive<any>({ symbol: "" });

async function fetchData() {
  const res = await getFeatures();
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

async function saveRow(row: any) {
  await setFeature(row.id, { ...row, enable: row.enable ? 1 : 0 });
  ElMessage.success(t("newCoinPage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("newCoinPage.confirm.delete", { symbol: row.symbol }),
    t("newCoinPage.confirm.title"),
    { type: "warning" }
  );
  await delFeature(row.id);
  ElMessage.success(t("newCoinPage.message.deleteSuccess"));
  await fetchData();
}

async function onAdd() {
  await addFeature({
    symbol: form.symbol,
    quantity: 20,
    percentChange: 0,
    close: 0,
    open: 0,
    low: 0,
    enable: 1,
    updateTime: Date.now()
  });
  form.symbol = "";
  dialogVisible.value = false;
  ElMessage.success(t("newCoinPage.message.addSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="dialogVisible = true">{{
        t("newCoinPage.button.add")
      }}</el-button
      ><el-button @click="fetchData">{{
        t("newCoinPage.button.refresh")
      }}</el-button>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="symbol"
        :label="t('newCoinPage.table.symbol')"
        min-width="120"
      />
      <el-table-column :label="t('newCoinPage.table.side')" width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.side" @change="saveRow(row)"
            ><el-option label="buy" value="buy" /><el-option
              label="sell"
              value="sell" /></el-select></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.coinType')" width="120"
        ><template #default="{ row }"
          ><el-select v-model="row.type" @change="saveRow(row)"
            ><el-option label="spot" :value="1" /><el-option
              label="futures"
              :value="2" /></el-select></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.marginType')" width="140"
        ><template #default="{ row }"
          ><el-select v-model="row.marginType" @change="saveRow(row)"
            ><el-option label="ISOLATED" value="ISOLATED" /><el-option
              label="CROSSED"
              value="CROSSED" /></el-select></template
      ></el-table-column>
      <el-table-column label="USDT" width="110"
        ><template #default="{ row }"
          ><el-input v-model="row.usdt" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.leverage')" width="100"
        ><template #default="{ row }"
          ><el-input v-model="row.leverage" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column label="tickSize" width="120"
        ><template #default="{ row }"
          ><el-input v-model="row.tickSize" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column label="stepSize" width="120"
        ><template #default="{ row }"
          ><el-input v-model="row.stepSize" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.quantity')" width="110"
        ><template #default="{ row }"
          ><el-input v-model="row.quantity" @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.expectPrice')" width="120"
        ><template #default="{ row }"
          ><el-input
            v-model="row.expect_price"
            @blur="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.enable')" width="90"
        ><template #default="{ row }"
          ><el-switch v-model="row.enable" @change="saveRow(row)" /></template
      ></el-table-column>
      <el-table-column :label="t('newCoinPage.table.operation')" width="90"
        ><template #default="{ row }"
          ><el-button type="danger" size="small" @click="onDelete(row)">{{
            t("newCoinPage.button.delete")
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="t('newCoinPage.dialog.addTitle')"
      width="520px"
      ><el-input
        v-model="form.symbol"
        :placeholder="t('newCoinPage.placeholder.symbol')"
      /><template #footer
        ><el-button @click="dialogVisible = false">{{
          t("buttons.pureClose")
        }}</el-button
        ><el-button type="primary" @click="onAdd">{{
          t("newCoinPage.button.save")
        }}</el-button></template
      ></el-dialog
    >
  </div>
</template>
