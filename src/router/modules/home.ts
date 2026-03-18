import { $t } from "@/plugins/i18n";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/dashboard",
  meta: {
    icon: "ep/home-filled",
    title: $t("menus.pureHome"),
    rank: 0
  },
  children: [
    {
      path: "/dashboard",
      name: "Dashboard",
      component: () => import("@/views/dashboard/configShow.vue"),
      meta: {
        icon: "ep/home-filled",
        title: "menus.dashboard",
        showLink: true
      }
    },
    {
      path: "/notify-config",
      name: "NotifyConfig",
      component: () => import("@/views/notify/config.vue"),
      meta: {
        title: "menus.notifyConfig",
        showLink: false
      }
    }
  ]
} satisfies RouteConfigsTable;
