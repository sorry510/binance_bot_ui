import { $t } from "@/plugins/i18n";
import NotificationIcon from "~icons/ri/notification-3-line";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/notifications",
  name: "Notifications",
  component: Layout,
  redirect: "/notifications/history",
  meta: {
    icon: NotificationIcon,
    title: $t("menus.notification"),
    rank: 1
  },
  children: [
    {
      path: "/notifications/history",
      name: "NotificationHistory",
      component: () => import("@/views/notify/history.vue"),
      meta: {
        title: "menus.notificationHistory",
        showLink: true
      }
    },
    {
      path: "/notifications/config",
      name: "NotifyConfig",
      component: () => import("@/views/notify/config.vue"),
      meta: {
        title: "menus.notifyConfig",
        showLink: true
      }
    }
  ]
} satisfies RouteConfigsTable;
