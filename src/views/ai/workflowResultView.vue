<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  workflow: string;
  result?: Record<string, any> | null;
}>();

const { t } = useI18n();
const value = computed<Record<string, any>>(() => props.result || {});
const hasResult = computed(() => Object.keys(value.value).length > 0);

function list(input: any): any[] {
  return Array.isArray(input) ? input : [];
}
function text(input: any) {
  if (input === null || input === undefined || input === "") return "-";
  return String(input);
}
function percent(input: any) {
  const n = Number(input);
  return Number.isFinite(n) ? `${(n * 100).toFixed(0)}%` : "-";
}
function score(input: any) {
  const n = Number(input);
  return Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 1) : "-";
}
function marketLabel(input: any) {
  if (input === null || input === undefined)
    return t("workflowPage.result.unknown");
  const key = `dashboard.market.${input}`;
  const translated = t(key);
  return translated === key ? String(input) : translated;
}
function directionType(direction: string) {
  if (direction === "long") return "success";
  if (direction === "short") return "danger";
  if (direction === "watch") return "warning";
  return "info";
}
function directionLabel(direction: string) {
  const key = `workflowPage.result.direction.${direction}`;
  const translated = t(key);
  return translated === key ? direction : translated;
}
function verdictType(verdict: string) {
  if (["keep", "promising"].includes(verdict)) return "success";
  if (["revise", "needs_more_data"].includes(verdict)) return "warning";
  if (["retire", "reject"].includes(verdict)) return "danger";
  return "info";
}
function verdictLabel(verdict: string) {
  const key = `workflowPage.result.verdict.${verdict}`;
  const translated = t(key);
  return translated === key ? verdict : translated;
}
function actionType(action: string) {
  if (action === "notify") return "danger";
  if (action === "monitor") return "warning";
  return "info";
}
function actionLabel(action: string) {
  const key = `workflowPage.result.action.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}
function severityType(severity: string) {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "info";
}
function severityLabel(severity: string) {
  const key = `workflowPage.result.severity.${severity}`;
  const translated = t(key);
  return translated === key ? severity : translated;
}
function prettyJSON(input: any) {
  return JSON.stringify(input ?? {}, null, 2);
}
</script>

<template>
  <div class="workflow-result-view">
    <el-empty v-if="!hasResult" :description="t('workflowPage.result.empty')" />

    <template v-else-if="workflow === 'market_scan'">
      <el-descriptions :column="3" border class="summary-block">
        <el-descriptions-item :label="t('workflowPage.result.asOf')">{{
          text(value.as_of)
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="t('workflowPage.result.marketCondition')"
          >{{ marketLabel(value.market_condition) }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="t('workflowPage.result.opportunityCount')"
          >{{ list(value.opportunities).length }}</el-descriptions-item
        >
      </el-descriptions>
      <div v-if="list(value.opportunities).length" class="result-grid">
        <el-card
          v-for="item in list(value.opportunities)"
          :key="`${item.rank}-${item.symbol}`"
          shadow="never"
          class="result-card"
        >
          <template #header>
            <div class="card-header">
              <div class="card-title">
                <span class="rank">#{{ item.rank }}</span
                >{{ item.symbol }}
              </div>
              <div class="tag-row">
                <el-tag :type="directionType(item.direction)" size="small">{{
                  directionLabel(item.direction)
                }}</el-tag>
                <el-tag type="info" size="small"
                  >{{ t("workflowPage.result.score") }}
                  {{ score(item.score) }}</el-tag
                >
                <el-tag size="small"
                  >{{ t("workflowPage.result.confidence") }}
                  {{ percent(item.confidence) }}</el-tag
                >
              </div>
            </div>
          </template>
          <div class="thesis">{{ item.thesis || "-" }}</div>
          <div class="mini-section">
            <div class="mini-title">
              {{ t("workflowPage.result.evidence") }}
            </div>
            <ul>
              <li v-for="(entry, index) in list(item.evidence)" :key="index">
                {{ entry }}
              </li>
            </ul>
          </div>
          <div class="mini-section risk-section">
            <div class="mini-title">{{ t("workflowPage.result.risks") }}</div>
            <ul>
              <li v-for="(entry, index) in list(item.risks)" :key="index">
                {{ entry }}
              </li>
            </ul>
          </div>
        </el-card>
      </div>
      <div v-if="list(value.data_missing).length" class="notice-block">
        <div class="mini-title">{{ t("workflowPage.result.dataMissing") }}</div>
        <div class="tag-list">
          <el-tag
            v-for="(item, index) in list(value.data_missing)"
            :key="index"
            type="warning"
            effect="plain"
            >{{ item }}</el-tag
          >
        </div>
      </div>
    </template>

    <template v-else-if="workflow === 'strategy_review'">
      <el-descriptions :column="3" border class="summary-block">
        <el-descriptions-item :label="t('workflowPage.result.verdictLabel')"
          ><el-tag :type="verdictType(value.verdict)">{{
            verdictLabel(value.verdict)
          }}</el-tag></el-descriptions-item
        >
        <el-descriptions-item :label="t('workflowPage.result.confidence')">{{
          percent(value.confidence)
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="t('workflowPage.result.marketCondition')"
          >{{ marketLabel(value.market_condition) }}</el-descriptions-item
        >
      </el-descriptions>
      <el-alert
        :title="value.summary || '-'"
        type="info"
        :closable="false"
        show-icon
        class="summary-alert"
      />
      <div class="two-column">
        <el-card shadow="never"
          ><template #header>{{
            t("workflowPage.result.failureModes")
          }}</template>
          <ul>
            <li v-for="(item, index) in list(value.failure_modes)" :key="index">
              {{ item }}
            </li>
          </ul></el-card
        >
        <el-card shadow="never"
          ><template #header>{{ t("workflowPage.result.proposals") }}</template>
          <ul>
            <li v-for="(item, index) in list(value.proposals)" :key="index">
              {{ item }}
            </li>
          </ul></el-card
        >
      </div>
      <div class="mini-section">
        <div class="mini-title">
          {{ t("workflowPage.result.suitableEnvironments") }}
        </div>
        <div class="tag-list">
          <el-tag
            v-for="item in list(value.suitable_environments)"
            :key="item"
            effect="plain"
            >{{ marketLabel(item) }}</el-tag
          >
        </div>
      </div>
      <div class="mini-section">
        <div class="mini-title">{{ t("workflowPage.result.evidence") }}</div>
        <ul>
          <li v-for="(item, index) in list(value.evidence)" :key="index">
            {{ item }}
          </li>
        </ul>
      </div>
    </template>

    <template v-else-if="workflow === 'strategy_experiment'">
      <el-descriptions :column="2" border class="summary-block">
        <el-descriptions-item :label="t('workflowPage.result.candidate')">{{
          text(value.candidate_name)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workflowPage.result.verdictLabel')"
          ><el-tag :type="verdictType(value.verdict)">{{
            verdictLabel(value.verdict)
          }}</el-tag></el-descriptions-item
        >
      </el-descriptions>
      <el-alert
        :title="value.summary || '-'"
        type="info"
        :closable="false"
        show-icon
        class="summary-alert"
      />
      <el-card v-if="value.test" shadow="never" class="test-card">
        <template #header
          ><div class="card-header">
            <span>{{ t("workflowPage.result.deterministicTest") }}</span
            ><el-tag :type="value.test.valid ? 'success' : 'danger'">{{
              value.test.valid
                ? t("workflowPage.result.passed")
                : t("workflowPage.result.failed")
            }}</el-tag>
          </div></template
        >
        <div class="metric-grid">
          <div class="metric">
            <span>{{ t("workflowPage.result.ruleCount") }}</span
            ><strong>{{ value.test.rule_count ?? 0 }}</strong>
          </div>
          <div class="metric">
            <span>{{ t("workflowPage.result.enabledRules") }}</span
            ><strong>{{ value.test.enabled_rule_count ?? 0 }}</strong>
          </div>
          <div class="metric">
            <span>{{ t("workflowPage.result.compiledRules") }}</span
            ><strong>{{ value.test.compiled_rules ?? 0 }}</strong>
          </div>
          <div class="metric">
            <span>{{ t("workflowPage.result.scenarioPasses") }}</span
            ><strong
              >{{ value.test.scenario_passes ?? 0 }}/{{
                value.test.scenario_runs ?? 0
              }}</strong
            >
          </div>
        </div>
        <ul v-if="list(value.test.errors).length" class="error-list">
          <li v-for="(item, index) in list(value.test.errors)" :key="index">
            {{ item }}
          </li>
        </ul>
      </el-card>
      <div class="two-column">
        <el-card shadow="never"
          ><template #header>{{
            t("workflowPage.result.proposedChanges")
          }}</template>
          <ul>
            <li
              v-for="(item, index) in list(value.proposed_changes)"
              :key="index"
            >
              {{ item }}
            </li>
          </ul></el-card
        >
        <el-card shadow="never"
          ><template #header>{{ t("workflowPage.result.risks") }}</template>
          <ul>
            <li v-for="(item, index) in list(value.risks)" :key="index">
              {{ item }}
            </li>
          </ul></el-card
        >
      </div>
    </template>

    <template v-else-if="workflow === 'alert_triage'">
      <el-descriptions :column="2" border class="summary-block">
        <el-descriptions-item :label="t('workflowPage.result.asOf')">{{
          text(value.as_of)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workflowPage.result.incidentCount')">{{
          list(value.incidents).length
        }}</el-descriptions-item>
      </el-descriptions>
      <div class="result-grid">
        <el-card
          v-for="incident in list(value.incidents)"
          :key="incident.incident_id"
          shadow="never"
          class="result-card"
        >
          <template #header
            ><div class="card-header">
              <div class="card-title">
                {{ incident.symbols?.join(", ") || incident.incident_id }}
              </div>
              <div class="tag-row">
                <el-tag :type="severityType(incident.severity)" size="small">{{
                  severityLabel(incident.severity)
                }}</el-tag
                ><el-tag :type="actionType(incident.action)" size="small">{{
                  actionLabel(incident.action)
                }}</el-tag>
              </div>
            </div></template
          >
          <div class="thesis">{{ incident.summary || "-" }}</div>
          <div v-if="incident.rationale" class="mini-section">
            <div class="mini-title">
              {{ t("workflowPage.result.rationale") }}
            </div>
            <div>{{ incident.rationale }}</div>
          </div>
          <div class="mini-section">
            <div class="mini-title">Signal IDs</div>
            <div class="tag-list">
              <el-tag
                v-for="id in list(incident.signal_ids)"
                :key="id"
                type="info"
                effect="plain"
                >{{ id }}</el-tag
              >
            </div>
          </div>
        </el-card>
      </div>
    </template>

    <template v-else-if="workflow === 'daily_market_brief'">
      <div class="brief-headline">{{ value.headline || "-" }}</div>
      <el-descriptions :column="2" border class="summary-block">
        <el-descriptions-item :label="t('workflowPage.result.asOf')">{{
          text(value.as_of)
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="t('workflowPage.result.marketCondition')"
          >{{ marketLabel(value.market_condition) }}</el-descriptions-item
        >
      </el-descriptions>
      <el-alert
        :title="value.regime_summary || '-'"
        type="info"
        :closable="false"
        class="summary-alert"
      />
      <div class="two-column">
        <el-card shadow="never"
          ><template #header>{{
            t("workflowPage.result.opportunities")
          }}</template>
          <div
            v-for="(item, index) in list(value.opportunities)"
            :key="index"
            class="brief-item"
          >
            <strong>{{ item.symbol }}</strong
            ><span>{{ item.why }}</span>
          </div></el-card
        >
        <el-card shadow="never"
          ><template #header>{{ t("workflowPage.result.watchlist") }}</template>
          <div class="tag-list">
            <el-tag
              v-for="(item, index) in list(value.watchlist)"
              :key="index"
              effect="plain"
              >{{ item }}</el-tag
            >
          </div></el-card
        >
      </div>
      <div class="two-column">
        <el-card shadow="never"
          ><template #header>{{ t("workflowPage.result.incidents") }}</template>
          <ul>
            <li v-for="(item, index) in list(value.incidents)" :key="index">
              {{ item }}
            </li>
          </ul></el-card
        >
        <el-card shadow="never"
          ><template #header>{{ t("workflowPage.result.risks") }}</template>
          <ul>
            <li v-for="(item, index) in list(value.risks)" :key="index">
              {{ item }}
            </li>
          </ul></el-card
        >
      </div>
      <div v-if="list(value.data_missing).length" class="notice-block">
        <div class="mini-title">{{ t("workflowPage.result.dataMissing") }}</div>
        <div class="tag-list">
          <el-tag
            v-for="(item, index) in list(value.data_missing)"
            :key="index"
            type="warning"
            effect="plain"
            >{{ item }}</el-tag
          >
        </div>
      </div>
    </template>

    <pre v-else class="json-box">{{ prettyJSON(value) }}</pre>

    <el-collapse class="raw-collapse">
      <el-collapse-item name="raw" :title="t('workflowPage.result.rawJson')">
        <pre class="json-box">{{ prettyJSON(value) }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.workflow-result-view {
  min-width: 0;
}

.summary-block {
  margin-bottom: 16px;
}

.summary-alert {
  margin-bottom: 16px;
}

.result-grid {
  display: grid;
  gap: 12px;
}

.result-card {
  border-color: var(--el-border-color-light);
}

.card-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.rank {
  color: var(--el-color-primary);
}

.tag-row,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thesis {
  padding: 10px 12px;
  line-height: 1.7;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.mini-section {
  margin-top: 14px;
  line-height: 1.7;
}

.mini-title {
  margin-bottom: 6px;
  font-weight: 600;
}

.risk-section {
  color: var(--el-color-danger);
}

ul {
  padding-left: 20px;
  margin: 0;
  line-height: 1.8;
}

.notice-block {
  padding: 12px;
  margin-top: 16px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 6px;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.metric span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric strong {
  font-size: 18px;
}

.error-list {
  margin-top: 12px;
  color: var(--el-color-danger);
}

.test-card {
  margin-bottom: 12px;
}

.brief-headline {
  margin-bottom: 14px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
}

.brief-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.brief-item:last-child {
  border-bottom: 0;
}

.raw-collapse {
  margin-top: 20px;
}

.json-box {
  max-height: 460px;
  padding: 12px;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

@media (width <= 900px) {
  .two-column,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
