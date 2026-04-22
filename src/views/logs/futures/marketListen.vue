<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { getMarketNoticeLogs } from "@/api/marketNoticeLog";

defineOptions({ name: "MarketListenLogs" });
const { t } = useI18n();

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const grouped = ref(false);
const hasSearched = ref(false);
const cacheKey = "market-notice-logs-query-cache";

function getDefaultRange() {
  return {
    start_time: dayjs().subtract(7, "day").toDate(),
    end_time: dayjs().toDate()
  };
}

const query = reactive<any>({
  page: 1,
  limit: 20,
  symbol: "",
  notice_type: "",
  direction: "",
  ...getDefaultRange()
});

const noticeTypeOptions = ["fast_move", "price_change"];
const directionOptions = ["up", "down"];

const groupedList = computed(() => {
  const groupMap = new Map<string, any>();
  list.value.forEach(row => {
    const symbol = row.symbol || "-";
    const current = groupMap.get(symbol);
    if (current) {
      current.children.push(row);
      current.count += 1;
      current.latestCreateTime = Math.max(
        Number(current.latestCreateTime || 0),
        Number(row.createTime || 0)
      );
      return;
    }
    groupMap.set(symbol, {
      symbol,
      count: 1,
      latestCreateTime: Number(row.createTime || 0),
      children: [row]
    });
  });
  return Array.from(groupMap.values());
});

function saveQueryCache(hasSearched = false) {
  sessionStorage.setItem(
    cacheKey,
    JSON.stringify({
      hasSearched,
      query: {
        ...query,
        start_time: query.start_time
          ? new Date(query.start_time).toISOString()
          : null,
        end_time: query.end_time ? new Date(query.end_time).toISOString() : null
      }
    })
  );
}

function restoreQueryCache() {
  const raw = sessionStorage.getItem(cacheKey);
  if (!raw) return false;
  try {
    const cached = JSON.parse(raw);
    const cachedQuery = cached?.query || {};
    hasSearched.value = Boolean(cached?.hasSearched);
    Object.assign(query, {
      ...query,
      ...cachedQuery,
      start_time: cachedQuery.start_time
        ? new Date(cachedQuery.start_time)
        : undefined,
      end_time: cachedQuery.end_time
        ? new Date(cachedQuery.end_time)
        : undefined
    });
    return hasSearched.value;
  } catch {
    sessionStorage.removeItem(cacheKey);
    return false;
  }
}

function formatTime(ts?: number | string) {
  if (!ts) return "-";
  return dayjs(Number(ts)).format("YYYY-MM-DD HH:mm:ss");
}

function formatNumber(value?: number | string, digits = 2) {
  if (value === undefined || value === null || value === "") return "-";
  return Number(value).toFixed(digits);
}

async function fetchData(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const res = await getMarketNoticeLogs({
      ...query,
      start_time: query.start_time ? +new Date(query.start_time) : undefined,
      end_time: query.end_time ? +new Date(query.end_time) : undefined
    });
    const data = res?.data || {};
    list.value = data.list || [];
    total.value = Number(data.total || 0);
    hasSearched.value = true;
    saveQueryCache(true);
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  Object.assign(query, {
    page: 1,
    limit: 20,
    symbol: "",
    notice_type: "",
    direction: "",
    ...getDefaultRange()
  });
  grouped.value = false;
  fetchData();
}

watch(
  query,
  () => {
    saveQueryCache(hasSearched.value);
  },
  { deep: true }
);

onMounted(() => {
  if (restoreQueryCache()) {
    fetchData();
  }
});
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.symbol"
        :placeholder="t('marketListenLogPage.placeholder.symbol')"
        clearable
        style="width: 140px"
        @keyup.enter="fetchData(true)"
      />
      <!-- <el-select
        v-model="query.notice_type"
        clearable
        :placeholder="t('marketListenLogPage.placeholder.noticeType')"
        style="width: 150px"
      >
        <el-option
          v-for="item in noticeTypeOptions"
          :key="item"
          :label="t(`marketListenLogPage.noticeType.${item}`)"
          :value="item"
        />
      </el-select> -->
      <el-select
        v-model="query.direction"
        clearable
        :placeholder="t('marketListenLogPage.placeholder.direction')"
        style="width: 120px"
      >
        <el-option
          v-for="item in directionOptions"
          :key="item"
          :label="t(`marketListenLogPage.direction.${item}`)"
          :value="item"
        />
      </el-select>
      <el-date-picker
        v-model="query.start_time"
        type="datetime"
        :placeholder="t('marketListenLogPage.placeholder.startTime')"
      />
      <el-date-picker
        v-model="query.end_time"
        type="datetime"
        :placeholder="t('marketListenLogPage.placeholder.endTime')"
      />
      <el-button type="primary" :loading="loading" @click="fetchData(true)">
        {{ t("marketListenLogPage.button.search") }}
      </el-button>
      <el-button
        :type="grouped ? 'primary' : 'default'"
        @click="grouped = !grouped"
      >
        {{
          grouped
            ? t("marketListenLogPage.button.ungroup")
            : t("marketListenLogPage.button.group")
        }}
      </el-button>
    </div>

    <el-table
      v-if="!grouped"
      v-loading="loading"
      :data="list"
      border
      size="small"
    >
      <!-- <el-table-column
        prop="id"
        :label="t('marketListenLogPage.table.id')"
        width="80"
      /> -->
      <el-table-column
        prop="symbol"
        :label="t('marketListenLogPage.table.symbol')"
        min-width="120"
      />
      <!-- <el-table-column
        :label="t('marketListenLogPage.table.noticeType')"
        min-width="130"
      >
        <template #default="{ row }">
          {{ t(`marketListenLogPage.noticeType.${row.notice_type}`) }}
        </template>
      </el-table-column> -->
      <el-table-column
        prop="window"
        :label="t('marketListenLogPage.table.window')"
        min-width="90"
      />
      <el-table-column
        :label="t('marketListenLogPage.table.direction')"
        min-width="90"
      >
        <template #default="{ row }">
          <el-tag :type="row.direction === 'up' ? 'danger' : 'success'">
            {{ t(`marketListenLogPage.direction.${row.direction}`) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('marketListenLogPage.table.price')"
        min-width="110"
      >
        <template #default="{ row }">{{ formatNumber(row.price, 4) }}</template>
      </el-table-column>
      <!-- <el-table-column
        :label="t('marketListenLogPage.table.basePrice')"
        min-width="110"
      >
        <template #default="{ row }">
          {{ formatNumber(row.base_price, 4) }}
        </template>
      </el-table-column> -->
      <el-table-column
        :label="t('marketListenLogPage.table.changePercent')"
        min-width="120"
      >
        <template #default="{ row }">
          <span
            :class="
              Number(row.change_percent) >= 0
                ? 'text-red-500'
                : 'text-green-500'
            "
          >
            {{ formatNumber(row.change_percent) }}%
          </span>
        </template>
      </el-table-column>
      <!-- <el-table-column
        :label="t('marketListenLogPage.table.thresholdPercent')"
        min-width="110"
      >
        <template #default="{ row }">
          {{ formatNumber(row.threshold_percent) }}%
        </template>
      </el-table-column> -->
      <el-table-column
        prop="content"
        :label="t('marketListenLogPage.table.content')"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        :label="t('marketListenLogPage.table.createTime')"
        min-width="170"
      >
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
    </el-table>

    <el-table
      v-else
      v-loading="loading"
      :data="groupedList"
      border
      size="small"
      row-key="symbol"
    >
      <el-table-column type="expand" width="60">
        <template #default="{ row }">
          <el-table :data="row.children" border size="small">
            <el-table-column
              prop="id"
              :label="t('marketListenLogPage.table.id')"
              width="80"
            />
            <el-table-column
              prop="symbol"
              :label="t('marketListenLogPage.table.symbol')"
              min-width="120"
            />
            <el-table-column
              prop="window"
              :label="t('marketListenLogPage.table.window')"
              min-width="90"
            />
            <el-table-column
              :label="t('marketListenLogPage.table.direction')"
              min-width="90"
            >
              <template #default="{ row: childRow }">
                <el-tag
                  :type="childRow.direction === 'up' ? 'danger' : 'success'"
                >
                  {{ t(`marketListenLogPage.direction.${childRow.direction}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('marketListenLogPage.table.price')"
              min-width="110"
            >
              <template #default="{ row: childRow }">{{
                formatNumber(childRow.price, 4)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="t('marketListenLogPage.table.changePercent')"
              min-width="120"
            >
              <template #default="{ row: childRow }">
                <span
                  :class="
                    Number(childRow.change_percent) >= 0
                      ? 'text-red-500'
                      : 'text-green-500'
                  "
                >
                  {{ formatNumber(childRow.change_percent) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="content"
              :label="t('marketListenLogPage.table.content')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('marketListenLogPage.table.createTime')"
              min-width="170"
            >
              <template #default="{ row: childRow }">{{
                formatTime(childRow.createTime)
              }}</template>
            </el-table-column>
          </el-table>
        </template>
      </el-table-column>
      <el-table-column
        prop="symbol"
        :label="t('marketListenLogPage.table.symbol')"
        min-width="140"
      />
      <el-table-column
        prop="count"
        :label="t('marketListenLogPage.table.groupCount')"
        min-width="100"
      />
      <el-table-column
        :label="t('marketListenLogPage.table.latestCreateTime')"
        min-width="170"
      >
        <template #default="{ row }">{{
          formatTime(row.latestCreateTime)
        }}</template>
      </el-table-column>
    </el-table>

    <div class="mt-3 flex items-center justify-between">
      <span>{{ t("marketListenLogPage.label.total") }}: {{ total }}</span>
      <el-pagination
        :current-page="query.page"
        :page-size="query.limit"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100, 200, 500, 1000, 10000]"
        :total="total"
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
