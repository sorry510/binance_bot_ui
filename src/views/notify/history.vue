<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
  type WebNotificationItem
} from "@/api/notification";

defineOptions({ name: "NotificationHistory" });

const { t, te } = useI18n();
const loading = ref(false);
const list = ref<WebNotificationItem[]>([]);
const total = ref(0);

const moduleOptions = [
  "futures",
  "futures_test",
  "futures_position_convert",
  "coin_notice",
  "coin_listen",
  "funding_rate",
  "new_coin_rush",
  "futures_market_listen"
];

const query = reactive({
  page: 1,
  limit: 20,
  keyword: "",
  module: "",
  is_read: "",
  start_time: undefined as Date | undefined,
  end_time: undefined as Date | undefined
});

function moduleLabel(module: string) {
  const key = `notifyConfigPage.moduleOptions.${module}`;
  return te(key) ? t(key) : module || "-";
}

function formatTime(timestamp?: number) {
  return timestamp ? dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss") : "-";
}

async function fetchData(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const response = await getNotifications({
      page: query.page,
      limit: query.limit,
      keyword: query.keyword.trim() || undefined,
      module: query.module || undefined,
      is_read: query.is_read === "" ? undefined : query.is_read,
      start_time: query.start_time ? +new Date(query.start_time) : undefined,
      end_time: query.end_time ? +new Date(query.end_time) : undefined
    });
    const data = response?.data || {};
    list.value = data.list || [];
    total.value = Number(data.total || 0);
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  Object.assign(query, {
    page: 1,
    limit: 20,
    keyword: "",
    module: "",
    is_read: "",
    start_time: undefined,
    end_time: undefined
  });
  fetchData();
}

async function markRead(notification: WebNotificationItem) {
  if (notification.is_read) return;
  await readNotification(notification.id);
  notification.is_read = 1;
  notification.read_time = Date.now();
}

async function markAllRead() {
  await readAllNotifications();
  await fetchData();
}

onMounted(() => fetchData());
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.keyword"
        clearable
        :placeholder="t('notificationHistoryPage.placeholder.keyword')"
        style="width: 220px"
        @keyup.enter="fetchData(true)"
      />
      <el-select
        v-model="query.module"
        clearable
        :placeholder="t('notificationHistoryPage.placeholder.module')"
        style="width: 190px"
      >
        <el-option
          v-for="module in moduleOptions"
          :key="module"
          :label="moduleLabel(module)"
          :value="module"
        />
      </el-select>
      <el-select
        v-model="query.is_read"
        clearable
        :placeholder="t('notificationHistoryPage.placeholder.readStatus')"
        style="width: 140px"
      >
        <el-option
          :label="t('notificationHistoryPage.readStatus.unread')"
          :value="0"
        />
        <el-option
          :label="t('notificationHistoryPage.readStatus.read')"
          :value="1"
        />
      </el-select>
      <el-date-picker
        v-model="query.start_time"
        type="datetime"
        :placeholder="t('notificationHistoryPage.placeholder.startTime')"
      />
      <el-date-picker
        v-model="query.end_time"
        type="datetime"
        :placeholder="t('notificationHistoryPage.placeholder.endTime')"
      />
      <el-button type="primary" :loading="loading" @click="fetchData(true)">
        {{ t("notificationHistoryPage.button.search") }}
      </el-button>
      <el-button :disabled="loading" @click="resetQuery">
        {{ t("notificationHistoryPage.button.reset") }}
      </el-button>
      <el-button :disabled="loading" @click="markAllRead">
        {{ t("notificationHistoryPage.button.markAllRead") }}
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border size="small">
      <el-table-column
        prop="title"
        :label="t('notificationHistoryPage.table.title')"
        min-width="180"
        fixed="left"
      />
      <el-table-column
        prop="content"
        :label="t('notificationHistoryPage.table.content')"
        min-width="360"
      >
        <template #default="{ row }">
          <span class="whitespace-pre-line">{{ row.content }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('notificationHistoryPage.table.module')"
        min-width="170"
      >
        <template #default="{ row }">{{ moduleLabel(row.module) }}</template>
      </el-table-column>
      <el-table-column
        :label="t('notificationHistoryPage.table.readStatus')"
        width="100"
      >
        <template #default="{ row }">
          <el-tag :type="row.is_read ? 'info' : 'primary'">
            {{
              row.is_read
                ? t("notificationHistoryPage.readStatus.read")
                : t("notificationHistoryPage.readStatus.unread")
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('notificationHistoryPage.table.createTime')"
        min-width="170"
      >
        <template #default="{ row }">{{
          formatTime(row.create_time)
        }}</template>
      </el-table-column>
      <el-table-column
        :label="t('notificationHistoryPage.table.readTime')"
        min-width="170"
      >
        <template #default="{ row }">{{ formatTime(row.read_time) }}</template>
      </el-table-column>
      <el-table-column
        :label="t('notificationHistoryPage.table.operation')"
        width="120"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            text
            type="primary"
            :disabled="Boolean(row.is_read)"
            @click="markRead(row)"
          >
            {{ t("notificationHistoryPage.button.markRead") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3 flex justify-end">
      <el-pagination
        :current-page="query.page"
        :page-size="query.limit"
        :page-sizes="[20, 50, 100]"
        :total="total"
        background
        layout="total, sizes, prev, pager, next"
        @current-change="
          page => {
            query.page = page;
            fetchData();
          }
        "
        @size-change="
          size => {
            query.limit = size;
            fetchData(true);
          }
        "
      />
    </div>
  </div>
</template>
