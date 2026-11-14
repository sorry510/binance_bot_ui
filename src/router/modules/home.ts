import { $t } from "@/plugins/i18n";
import RobotIcon from "~icons/ri/robot-2-line";
const Layout = () => import("@/layout/index.vue");

const legacyMeta = (title: string) => ({
  title,
  showLink: false,
  showParent: true
});

export default [
  {
    path: "/",
    name: "Home",
    component: Layout,
    redirect: "/dashboard",
    meta: { title: $t("menus.pureHome"), rank: 0, showLink: false }
  },
  {
    path: "/system-dashboard",
    name: "SystemDashboard",
    component: Layout,
    redirect: "/system-dashboard/overview",
    meta: { icon: "ep/monitor", title: "menus.systemDashboard", rank: 0.1 },
    children: [
      {
        path: "/system-dashboard/overview",
        name: "SystemDashboardOverview",
        component: () => import("@/views/ai/observability.vue"),
        meta: {
          title: "menus.systemDashboard",
          showLink: true,
          fixedTag: true
        }
      }
    ]
  },
  {
    path: "/config-center",
    name: "ConfigCenter",
    component: Layout,
    redirect: "/dashboard",
    meta: { icon: "ep/setting", title: "menus.dashboard", rank: 1 },
    children: [
      {
        path: "/dashboard",
        name: "Dashboard",
        component: () => import("@/views/dashboard/configShow.vue"),
        meta: { title: "menus.dashboard", showLink: true }
      }
    ]
  },
  {
    path: "/ai",
    name: "AI",
    component: Layout,
    redirect: "/ai/chat",
    meta: { icon: RobotIcon, title: "menus.ai", rank: 4.1 },
    children: [
      {
        path: "/ai/chat",
        name: "AgentChat",
        component: () => import("@/views/ai/chat/index.vue"),
        meta: { title: "menus.agentChat", showLink: true, showParent: true }
      },
      {
        path: "/ai/market-analysis",
        name: "AgentMarketAnalysis",
        component: () => import("@/views/ai/marketAnalysis.vue"),
        meta: {
          title: "menus.agentMarketAnalysis",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/workflows",
        name: "AgentWorkflows",
        component: () => import("@/views/ai/workflows.vue"),
        meta: {
          title: "menus.agentWorkflows",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/task-center",
        name: "AgentTaskCenter",
        component: () => import("@/views/ai/taskHub.vue"),
        meta: {
          title: "menus.agentTaskCenter",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/settings",
        name: "AgentSettings",
        component: () => import("@/views/ai/aiSettings.vue"),
        meta: { title: "menus.agentSettings", showLink: true, showParent: true }
      },
      // Keep old URLs and route names usable without exposing duplicate menu items.
      {
        path: "/ai/symbol-analysis",
        name: "SymbolAnalysis",
        redirect: to => ({
          path: "/ai/market-analysis",
          query: { ...to.query, tab: "symbol" }
        }),
        meta: legacyMeta("menus.symbolAnalysis")
      },
      {
        path: "/ai/opportunities",
        name: "AgentOpportunities",
        redirect: to => ({
          path: "/ai/market-analysis",
          query: { ...to.query, tab: "opportunities" }
        }),
        meta: legacyMeta("menus.agentOpportunities")
      },
      {
        path: "/ai/config",
        name: "AgentAIConfig",
        redirect: to => ({
          path: "/ai/settings",
          query: { ...to.query, tab: "automation" }
        }),
        meta: legacyMeta("menus.agentAIConfig")
      },
      {
        path: "/ai/llm-config",
        name: "LLMConfigManagement",
        redirect: to => ({
          path: "/ai/settings",
          query: { ...to.query, tab: "models" }
        }),
        meta: legacyMeta("menus.llmConfig")
      },
      {
        path: "/ai/skills",
        name: "AgentSkillManagement",
        redirect: to => ({
          path: "/ai/settings",
          query: { ...to.query, tab: "skills" }
        }),
        meta: legacyMeta("menus.agentSkillManagement")
      },
      {
        path: "/ai/mcp",
        name: "AgentMCPManagement",
        redirect: to => ({
          path: "/ai/settings",
          query: { ...to.query, tab: "mcp" }
        }),
        meta: legacyMeta("menus.agentMCPManagement")
      },
      {
        path: "/ai/memory",
        name: "AgentMemoryManagement",
        redirect: to => ({
          path: "/ai/settings",
          query: { ...to.query, tab: "memory" }
        }),
        meta: legacyMeta("menus.agentMemoryManagement")
      },
      {
        path: "/ai/alert-pipeline-history",
        name: "AlertPipelineHistory",
        redirect: to => ({
          path: "/ai/task-center",
          query: { ...to.query, tab: "alerts" }
        }),
        meta: legacyMeta("menus.alertPipelineHistory")
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
