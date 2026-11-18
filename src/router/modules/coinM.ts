import { $t } from "@/plugins/i18n";
const Layout = () => import("@/layout/index.vue");

// CM-3: independent COIN-M top-level menu between USD-M and Spot.
// Four pages share the existing futures/spot visual language, never their APIs.
export default [
  {
    path: "/coin-m",
    name: "CoinM",
    component: Layout,
    redirect: "/coin-m/symbols",
    meta: {
      title: $t("menus.coinMTrading"),
      icon: "crypto/ae",
      rank: 2.05,
      showLink: true
    },
    children: [
      {
        path: "/coin-m/symbols",
        name: "CoinMSymbols",
        component: () => import("@/views/coinM/symbol.vue"),
        meta: { title: "menus.coinMTrading", showLink: true }
      },
      {
        path: "/coin-m/account",
        name: "CoinMAccount",
        component: () => import("@/views/coinM/account.vue"),
        meta: { title: "menus.coinMAccount", showLink: true }
      },
      {
        path: "/coin-m/strategy-templates",
        name: "CoinMTemplates",
        component: () => import("@/views/coinM/strategyTemplate.vue"),
        meta: { title: "menus.coinMTemplates", showLink: true }
      },
      {
        path: "/coin-m/controlled-trade",
        name: "CoinMControlledTrade",
        component: () => import("@/views/coinM/controlledTrade.vue"),
        meta: { title: "menus.coinMControlledTrade", showLink: true }
      }
    ]
  }
];
