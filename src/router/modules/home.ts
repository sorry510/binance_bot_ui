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
    redirect: "/ai/symbol-analysis",
    meta: {
      icon: RobotIcon,
      title: "menus.ai",
      rank: 1.1
    },
    children: [
      {
        path: "/ai/symbol-analysis",
        name: "SymbolAnalysis",
        component: () => import("@/views/ai/symbolAnalysis.vue"),
        meta: {
          title: "menus.symbolAnalysis",
          showLink: true,
          showParent: true
        }
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
