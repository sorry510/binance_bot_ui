<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  addNotifyConfig,
  delNotifyConfig,
  getNotifyConfigs,
  setNotifyConfig
} from "../../api/notifyConfig";

defineOptions({ name: "NotifyConfig" });
const { t } = useI18n();

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<any>({ channel: "dingding", module: "futures" });

async function fetchData() {
  const res = await getNotifyConfigs();
  list.value = (res?.data || []).map((item: any) => ({
    ...item,
    enable: item.enable > 0
  }));
}

function openDialog(row?: any) {
  editingId.value = row?.id ?? null;
  Object.assign(form, row || { channel: "dingding", module: "futures" });
  dialogVisible.value = true;
}

async function save() {
  const data = { ...form, enable: form.enable ? 1 : 0 };
  if (editingId.value) {
    await setNotifyConfig(editingId.value, data);
  } else {
    await addNotifyConfig(data);
  }
  ElMessage.success(t("notifyConfigPage.message.saveSuccess"));
  dialogVisible.value = false;
  await fetchData();
}

async function onEnable(row: any) {
  await setNotifyConfig(row.id, { ...row, enable: row.enable ? 1 : 0 });
  ElMessage.success(t("notifyConfigPage.message.updateSuccess"));
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(
    t("notifyConfigPage.confirm.delete"),
    t("notifyConfigPage.confirm.title"),
    { type: "warning" }
  );
  await delNotifyConfig(row.id);
  ElMessage.success(t("notifyConfigPage.message.deleteSuccess"));
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <div class="mb-3">
      <el-button type="primary" @click="openDialog()">{{
        t("notifyConfigPage.button.add")
      }}</el-button>
    </div>
    <el-table :data="list" border size="small">
      <el-table-column
        prop="channel"
        :label="t('notifyConfigPage.table.channel')"
        min-width="100"
      />
      <el-table-column
        prop="module"
        :label="t('notifyConfigPage.table.module')"
        min-width="160"
      />
      <el-table-column :label="t('notifyConfigPage.table.enable')" width="90">
        <template #default="{ row }"
          ><el-switch v-model="row.enable" @change="onEnable(row)"
        /></template>
      </el-table-column>
      <el-table-column
        :label="t('notifyConfigPage.table.operation')"
        width="180"
      >
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="openDialog(row)">{{
            t("notifyConfigPage.button.edit")
          }}</el-button>
          <el-button type="danger" size="small" @click="onDelete(row)">{{
            t("notifyConfigPage.button.delete")
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId
          ? t('notifyConfigPage.dialog.editTitle')
          : t('notifyConfigPage.dialog.addTitle')
      "
      width="640px"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <el-select
          v-model="form.channel"
          :placeholder="t('notifyConfigPage.placeholder.channel')"
        >
          <el-option label="dingding" value="dingding" />
          <el-option label="slack" value="slack" />
        </el-select>
        <el-select
          v-model="form.module"
          :placeholder="t('notifyConfigPage.placeholder.module')"
        >
          <el-option
            v-for="item in [
              'futures',
              'futures_test',
              'futures_position_convert',
              'coin_notice',
              'coin_listen',
              'funding_rate',
              'new_coin_rush'
            ]"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-input
          v-if="form.channel === 'dingding'"
          v-model="form.dingding_token"
          placeholder="dingding token"
          class="md:col-span-2"
        />
        <el-input
          v-if="form.channel === 'dingding'"
          v-model="form.dingding_word"
          placeholder="dingding keyword"
        />
        <el-input
          v-if="form.channel === 'slack'"
          v-model="form.slack_token"
          placeholder="slack token"
          class="md:col-span-2"
        />
        <el-input
          v-if="form.channel === 'slack'"
          v-model="form.slack_channel_id"
          placeholder="slack channel id"
        />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">{{
          t("notifyConfigPage.button.cancel")
        }}</el-button>
        <el-button type="primary" @click="save">{{
          t("notifyConfigPage.button.save")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
