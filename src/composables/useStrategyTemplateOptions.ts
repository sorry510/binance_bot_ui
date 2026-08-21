import { computed, ref } from "vue";
import { getList as getStrategyTemplateList } from "@/api/strategyTemplate";

export interface StrategyTemplateOption {
  id: number;
  name: string;
  strategy: string;
  technology: string;
}

interface PopupScrollData {
  scrollTop: number;
  scrollLeft: number;
}

const PAGE_SIZE = 20;
export const strategyTemplatePopperClass = "strategy-template-select-dropdown";

export function useStrategyTemplateOptions() {
  const options = ref<StrategyTemplateOption[]>([]);
  const total = ref(0);
  const currentPage = ref(0);
  const keyword = ref("");
  const loading = ref(false);
  let requestVersion = 0;

  const hasMore = computed(() => options.value.length < total.value);
  const selectLoading = computed(
    () => loading.value && options.value.length === 0
  );

  function mergeOptions(rows: StrategyTemplateOption[]) {
    const merged = new Map<number, StrategyTemplateOption>();
    [...options.value, ...rows].forEach(item => merged.set(item.id, item));
    options.value = Array.from(merged.values());
  }

  async function fetchPage(page: number, reset: boolean) {
    const version = reset ? ++requestVersion : requestVersion;
    if (!reset && loading.value) return;

    if (reset) {
      options.value = [];
      total.value = 0;
      currentPage.value = 0;
    }

    loading.value = true;
    try {
      const res = await getStrategyTemplateList({
        page,
        limit: PAGE_SIZE,
        ...(keyword.value ? { name: keyword.value } : {})
      });
      if (version !== requestVersion) return;

      const data = res?.data;
      const rows = Array.isArray(data?.list)
        ? (data.list as StrategyTemplateOption[])
        : Array.isArray(data)
          ? (data as StrategyTemplateOption[])
          : [];

      if (reset) {
        options.value = rows;
      } else {
        mergeOptions(rows);
      }
      total.value = Array.isArray(data)
        ? rows.length
        : Number(data?.total || 0);
      currentPage.value = page;
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  async function loadFirstPage() {
    keyword.value = "";
    await fetchPage(1, true);
  }

  async function search(searchKeyword: string) {
    keyword.value = searchKeyword.trim();
    await fetchPage(1, true);
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    await fetchPage(currentPage.value + 1, false);
  }

  function onPopupScroll(data: PopupScrollData) {
    const dropdowns = Array.from(
      document.querySelectorAll<HTMLElement>(
        `.${strategyTemplatePopperClass} .el-select-dropdown__wrap`
      )
    );
    const scrollContainer = dropdowns.find(
      item =>
        item.offsetParent !== null &&
        Math.abs(item.scrollTop - data.scrollTop) < 1
    );
    if (!scrollContainer) return;

    const remaining =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    if (remaining <= 40) void loadMore();
  }

  return {
    options,
    loading,
    selectLoading,
    hasMore,
    loadFirstPage,
    search,
    loadMore,
    onPopupScroll
  };
}
