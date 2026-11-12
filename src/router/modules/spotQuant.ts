import { $t } from "@/plugins/i18n";
const Layout = () => import("@/layout/index.vue");

// 06-5: mirror the four core Futures page types, but only Spot BUY/SELL.
// Order mutation is intentionally not exposed until the 06-6 release gate.
export default [
  {
    path: "/spot-quant",
    name: "SpotQuant",
    component: Layout,
    redirect: "/spot-quant/symbols",
    meta: {
      title: $t("menus.spotQuantTrading"),
      icon: "crypto/ae",
      rank: 2.1,
      showLink: true
    },
    children: [
      {
        path: "/spot-quant/symbols",
        name: "SpotQuantSymbols",
        component: () => import("@/views/spotQuant/symbol.vue"),
        meta: { title: "menus.spotQuantTrading", showLink: true }
      },
      {
        path: "/spot-quant/account",
        name: "SpotQuantAccount",
        component: () => import("@/views/spotQuant/account.vue"),
        meta: { title: "menus.spotQuantAccount", showLink: true }
      },
      {
        path: "/spot-quant/strategy-templates",
        name: "SpotQuantTemplates",
        component: () => import("@/views/spotQuant/strategyTemplate.vue"),
        meta: { title: "menus.spotQuantTemplates", showLink: true }
      },
      {
        path: "/spot-quant/controlled-trade",
        name: "SpotQuantControlledTrade",
        component: () => import("@/views/spotQuant/controlledTrade.vue"),
        meta: { title: "menus.spotQuantControlledTrade", showLink: true }
      }
    ]
  }
];
