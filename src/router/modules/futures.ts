import { $t } from "@/plugins/i18n";
const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/futures",
    name: "futures",
    component: Layout,
    redirect: "/futures/symbols",
    meta: {
      icon: "crypto/ae",
      title: $t("menus.futuresTrade"),
      rank: 1
    },
    children: [
      {
        path: "/futures/symbols",
        name: "FuturesSymbol",
        component: () => import("@/views/futures/symbol.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.futuresTrade",
          showLink: true
        }
      },
      {
        path: "/futures/list",
        name: "OrderList",
        component: () => import("@/views/order/index.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.futuresTradeOrder",
          showLink: true
        }
      },
      {
        path: "/futures/account",
        name: "futuresAccount",
        component: () => import("@/views/futures/account.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.futuresAccount",
          showLink: true
        }
      },
      {
        path: "/futures/account2",
        name: "futuresAccount2",
        component: () => import("@/views/futures/account2.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.futuresAccount2",
          showLink: true
        }
      },
      {
        path: "/futures/strategy-template",
        name: "strategyTemplate",
        component: () => import("@/views/futures/strategyTemplate.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.strategyTemplate",
          showLink: true
        }
      },
      {
        path: "/futures/test-strategy-results",
        name: "testStrategyResult",
        component: () => import("@/views/order/testOrder.vue"),
        meta: {
          icon: "crypto/ae",
          title: "menus.testStrategyResult",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/notice",
    name: "notice",
    component: Layout,
    redirect: "/notice/spot",
    meta: {
      icon: "ri/information-line",
      title: "menus.coinNotice",
      rank: 2
    },
    children: [
      {
        path: "/notice/spot",
        name: "noticeSpot",
        component: () => import("@/views/notice/spot.vue"),
        meta: {
          icon: "ri/information-line",
          title: "menus.spotNotice",
          showLink: true
        }
      },
      {
        path: "/notice/feature",
        name: "noticeFeature",
        component: () => import("@/views/notice/feature.vue"),
        meta: {
          icon: "ri/information-line",
          title: "menus.futuresNotice",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/listen",
    name: "listen",
    component: Layout,
    redirect: "/listen/spot",
    meta: {
      icon: "ri/search-line",
      title: "menus.marketListen",
      rank: 3
    },
    children: [
      {
        path: "/listen/spot",
        name: "listenSpot",
        component: () => import("@/views/listen/spot.vue"),
        meta: {
          icon: "ri/search-line",
          title: "menus.spotListen",
          showLink: true
        }
      },
      {
        path: "/listen/feature",
        name: "listenFeature",
        component: () => import("@/views/listen/feature.vue"),
        meta: {
          icon: "ri/search-line",
          title: "menus.futuresListen",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/funding-rate",
    name: "fundingRate",
    component: Layout,
    redirect: "/funding-rate/funding-rate",
    meta: {
      icon: "ri/search-line",
      title: "menus.fundingRate",
      rank: 4
    },
    children: [
      {
        path: "/funding-rate/funding-rate",
        name: "fundingRates",
        component: () => import("@/views/listen/fundingRate.vue"),
        meta: {
          icon: "ri/search-line",
          title: "menus.fundingRate",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/rush",
    name: "rush",
    component: Layout,
    redirect: "/rush/new-coin",
    meta: {
      icon: "crypto/agi",
      title: "menus.newCoinRush",
      rank: 5
    },
    children: [
      {
        path: "/rush/new-coin",
        name: "RushNewCoin",
        component: () => import("@/views/trade/newCoin.vue"),
        meta: {
          icon: "crypto/agi",
          title: "menus.newCoinRush",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/trade",
    name: "trade",
    component: Layout,
    redirect: "/trade/code",
    meta: {
      icon: "crypto/ilk",
      title: "menus.systemConfig",
      rank: 6
    },
    children: [
      {
        path: "/trade/code",
        name: "TradeCode",
        component: () => import("@/views/trade/tradeCode.vue"),
        meta: {
          icon: "crypto/ilk",
          title: "menus.systemConfig",
          showLink: true
        }
      }
    ]
  },
  {
    path: "/log",
    name: "log",
    component: Layout,
    redirect: "/log/log",
    meta: {
      icon: "ri/information-line",
      title: "menus.logs",
      rank: 7
    },
    children: [
      {
        path: "/log/log",
        name: "logs",
        component: () => import("@/views/background/log.vue"),
        meta: {
          icon: "ri/information-line",
          title: "menus.logs",
          showLink: true
        }
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
