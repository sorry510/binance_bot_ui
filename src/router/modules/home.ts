import { $t } from "@/plugins/i18n";
import RobotIcon from "~icons/ri/robot-2-line";
const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/",
    name: "Home",
    component: Layout,
    redirect: "/dashboard",
    meta: {
      title: $t("menus.pureHome"),
      rank: 0,
      showLink: false
    }
  },
  {
    path: "/config-center",
    name: "ConfigCenter",
    component: Layout,
    redirect: "/dashboard",
    meta: {
      icon: "ep/setting",
      title: "menus.dashboard",
      rank: 1
    },
    children: [
      {
        path: "/dashboard",
        name: "Dashboard",
        component: () => import("@/views/dashboard/configShow.vue"),
        meta: {
          title: "menus.dashboard",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/ai",
    name: "AI",
    component: Layout,
    redirect: "/ai/chat",
    meta: {
      icon: RobotIcon,
      title: "menus.ai",
      rank: 1.1
    },
    children: [
      {
        path: "/ai/chat",
        name: "AgentChat",
        component: () => import("@/views/ai/chat/index.vue"),
        meta: { title: "menus.agentChat", showLink: true, showParent: true }
      },
      {
        path: "/ai/symbol-analysis",
        name: "SymbolAnalysis",
        component: () => import("@/views/ai/symbolAnalysis.vue"),
        meta: {
          title: "menus.symbolAnalysis",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/llm-config",
        name: "LLMConfigManagement",
        component: () => import("@/views/ai/llmConfig.vue"),
        meta: { title: "menus.llmConfig", showLink: true, showParent: true }
      },
      {
        path: "/ai/skills",
        name: "AgentSkillManagement",
        component: () => import("@/views/ai/skillManagement.vue"),
        meta: {
          title: "menus.agentSkillManagement",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/mcp",
        name: "AgentMCPManagement",
        component: () => import("@/views/ai/mcpManagement.vue"),
        meta: {
          title: "menus.agentMCPManagement",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/memory",
        name: "AgentMemoryManagement",
        component: () => import("@/views/ai/memoryManagement.vue"),
        meta: {
          title: "menus.agentMemoryManagement",
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
        path: "/ai/controlled-trade",
        name: "AgentControlledTrade",
        component: () => import("@/views/ai/controlledTrade.vue"),
        meta: {
          title: "menus.agentControlledTrade",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/task-center",
        name: "AgentTaskCenter",
        component: () => import("@/views/ai/taskCenter.vue"),
        meta: {
          title: "menus.agentTaskCenter",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/observability",
        name: "AgentObservability",
        component: () => import("@/views/ai/observability.vue"),
        meta: {
          title: "menus.agentObservability",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/alert-pipeline-history",
        name: "AlertPipelineHistory",
        component: () => import("@/views/ai/alertPipelineHistory.vue"),
        meta: {
          title: "menus.alertPipelineHistory",
          showLink: true,
          showParent: true
        }
      },
      {
        path: "/ai/config",
        name: "AgentAIConfig",
        component: () => import("@/views/ai/aiConfig.vue"),
        meta: { title: "menus.agentAIConfig", showLink: true, showParent: true }
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
