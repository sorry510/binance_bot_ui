<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import { getFuturesLiquidationOrders } from "@/api/futuresLiquidationOrder";

defineOptions({ name: "FuturesLiquidationOrders" });

const { t } = useI18n();
const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const grouped = ref(false);

const query = reactive({
  page: 1,
  limit: 20,
  symbol: "",
  side: "",
  min_notional: undefined as number | undefined,
  start_time: undefined as Date | undefined,
  end_time: undefined as Date | undefined
});

const groupedList = computed(() => {
  const groupMap = new Map<string, any>();

  list.value.forEach(row => {
    const symbol = String(row.symbol || "-");
    const side = String(row.side || "-");
    const key = `${symbol}:${side}`;
    const current = groupMap.get(key);

    if (current) {
      current.notionalTotal += Number(row.notional || 0);
      current.count += 1;
      current.latestEventTime = Math.max(
        current.latestEventTime,
        Number(row.event_time || 0)
      );
      current.children.push(row);
      return;
    }

    groupMap.set(key, {
      key,
      symbol,
      side,
      notionalTotal: Number(row.notional || 0),
      count: 1,
      latestEventTime: Number(row.event_time || 0),
      children: [row]
    });
  });

  return Array.from(groupMap.values()).sort((left, right) => {
    const symbolOrder = left.symbol.localeCompare(right.symbol);
    if (symbolOrder !== 0) return symbolOrder;
    return left.side === right.side ? 0 : left.side === "SELL" ? -1 : 1;
  });
});

function formatTime(value?: number | string) {
  if (!value) return "-";
  return dayjs(Number(value)).format("YYYY-MM-DD HH:mm:ss");
}

function formatNumber(value?: number | string, digits = 2) {
  if (value === undefined || value === null || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "-";
}

function displayPrice(row: any) {
  return Number(row.avg_price) > 0 ? row.avg_price : row.price;
}

async function fetchData(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const res = await getFuturesLiquidationOrders({
      page: query.page,
      limit: query.limit,
      symbol: query.symbol.trim() || undefined,
      side: query.side || undefined,
      min_notional: query.min_notional || undefined,
      start_time: query.start_time ? +new Date(query.start_time) : undefined,
      end_time: query.end_time ? +new Date(query.end_time) : undefined
    });
    const data = res?.data || {};
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
    symbol: "",
    side: "",
    min_notional: undefined,
    start_time: undefined,
    end_time: undefined
  });
  grouped.value = false;
  fetchData();
}

onMounted(() => fetchData());
</script>

<template>
  <div class="p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.symbol"
        clearable
        :placeholder="t('liquidationOrderPage.placeholder.symbol')"
        style="width: 140px"
        @keyup.enter="fetchData(true)"
      />
      <el-select
        v-model="query.side"
        clearable
        :placeholder="t('liquidationOrderPage.placeholder.side')"
        style="width: 140px"
      >
        <el-option :label="t('liquidationOrderPage.side.SELL')" value="SELL" />
        <el-option :label="t('liquidationOrderPage.side.BUY')" value="BUY" />
      </el-select>
      <el-input-number
        v-model="query.min_notional"
        :min="0"
        :controls="false"
        :placeholder="t('liquidationOrderPage.placeholder.minNotional')"
        style="width: 180px"
        @keyup.enter="fetchData(true)"
      />
      <el-date-picker
        v-model="query.start_time"
        type="datetime"
        :placeholder="t('liquidationOrderPage.placeholder.startTime')"
      />
      <el-date-picker
        v-model="query.end_time"
        type="datetime"
        :placeholder="t('liquidationOrderPage.placeholder.endTime')"
      />
      <el-button type="primary" :loading="loading" @click="fetchData(true)">
        {{ t("liquidationOrderPage.button.search") }}
      </el-button>
      <el-button :disabled="loading" @click="resetQuery">
        {{ t("liquidationOrderPage.button.reset") }}
      </el-button>
      <el-button
        :type="grouped ? 'primary' : 'default'"
        @click="grouped = !grouped"
      >
        {{
          grouped
            ? t("liquidationOrderPage.button.ungroup")
            : t("liquidationOrderPage.button.group")
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
      <el-table-column
        prop="symbol"
        :label="t('liquidationOrderPage.table.symbol')"
        min-width="120"
        fixed="left"
      />
      <el-table-column
        :label="t('liquidationOrderPage.table.side')"
        min-width="110"
      >
        <template #default="{ row }">
          <el-tag :type="row.side === 'SELL' ? 'danger' : 'success'">
            {{ t(`liquidationOrderPage.side.${row.side}`) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('liquidationOrderPage.table.price')"
        min-width="120"
      >
        <template #default="{ row }">
          {{ formatNumber(displayPrice(row), 8) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="last_filled_qty"
        :label="t('liquidationOrderPage.table.lastFilledQty')"
        min-width="140"
      />
      <el-table-column
        :label="t('liquidationOrderPage.table.notional')"
        min-width="130"
      >
        <template #default="{ row }">
          {{ formatNumber(row.notional) }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t('liquidationOrderPage.table.tradeTime')"
        min-width="170"
      >
        <template #default="{ row }">
          {{ formatTime(row.trade_time) }}
        </template>
      </el-table-column>
    </el-table>

    <el-table
      v-else
      v-loading="loading"
      :data="groupedList"
      border
      size="small"
      row-key="key"
    >
      <el-table-column type="expand" width="60">
        <template #default="{ row }">
          <el-table :data="row.children" border size="small">
            <el-table-column
              prop="symbol"
              :label="t('liquidationOrderPage.table.symbol')"
              min-width="120"
            />
            <el-table-column
              :label="t('liquidationOrderPage.table.side')"
              min-width="110"
            >
              <template #default="{ row: childRow }">
                <el-tag :type="childRow.side === 'SELL' ? 'danger' : 'success'">
                  {{ t(`liquidationOrderPage.side.${childRow.side}`) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('liquidationOrderPage.table.price')"
              min-width="120"
            >
              <template #default="{ row: childRow }">
                {{ formatNumber(displayPrice(childRow), 8) }}
              </template>
            </el-table-column>
            <el-table-column
              :label="t('liquidationOrderPage.table.notional')"
              min-width="130"
            >
              <template #default="{ row: childRow }">
                {{ formatNumber(childRow.notional) }}
              </template>
            </el-table-column>
          </el-table>
        </template>
      </el-table-column>
      <el-table-column
        prop="symbol"
        :label="t('liquidationOrderPage.table.symbol')"
        min-width="140"
      />
      <el-table-column
        :label="t('liquidationOrderPage.table.side')"
        min-width="120"
      >
        <template #default="{ row }">
          <el-tag :type="row.side === 'SELL' ? 'danger' : 'success'">
            {{ t(`liquidationOrderPage.side.${row.side}`) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('liquidationOrderPage.table.notionalTotal')"
        min-width="160"
      >
        <template #default="{ row }">
          {{ formatNumber(row.notionalTotal) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="count"
        :label="t('liquidationOrderPage.table.groupCount')"
        min-width="100"
      />
      <el-table-column
        :label="t('liquidationOrderPage.table.latestTime')"
        min-width="170"
      >
        <template #default="{ row }">
          {{ formatTime(row.latestEventTime) }}
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3 flex justify-end">
      <el-pagination
        :current-page="query.page"
        :page-size="query.limit"
        :page-sizes="[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]"
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
