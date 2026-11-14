import type { FunctionalComponent } from "vue";
// The system dashboard is the permanent first tab; Configuration Center is closable.
export const routerArrays: Array<RouteConfigs> = [
  {
    path: "/system-dashboard/overview",
    name: "SystemDashboardOverview",
    meta: {
      title: "menus.systemDashboard",
      icon: "ep/monitor",
      fixedTag: true
    }
  }
];

/** Merge fixed routes without adding the dashboard twice. */
export function getFixedTags(routes: RouteConfigs[] = []): RouteConfigs[] {
  return [
    ...routerArrays,
    ...routes.filter(
      route =>
        route?.meta?.fixedTag &&
        !routerArrays.some(tag => tag.path === route.path)
    )
  ];
}

export type routeMetaType = {
  title?: string;
  icon?: string | FunctionalComponent;
  showLink?: boolean;
  savedPosition?: boolean;
  auths?: Array<string>;
  fixedTag?: boolean;
};

export type RouteConfigs = {
  path?: string;
  query?: object;
  params?: object;
  meta?: routeMetaType;
  children?: RouteConfigs[];
  name?: string;
};

export type multiTagsType = {
  tags: Array<RouteConfigs>;
};

export type tagsViewsType = {
  icon: string | FunctionalComponent;
  text: string;
  divided: boolean;
  disabled: boolean;
  show: boolean;
};

export interface setType {
  sidebar: {
    opened: boolean;
    withoutAnimation: boolean;
    isClickCollapse: boolean;
  };
  device: string;
  fixedHeader: boolean;
  classes: {
    hideSidebar: boolean;
    openSidebar: boolean;
    withoutAnimation: boolean;
    mobile: boolean;
  };
  hideTabs: boolean;
}

export type menuType = {
  id?: number;
  name?: string;
  path?: string;
  noShowingChildren?: boolean;
  children?: menuType[];
  value: unknown;
  meta?: {
    icon?: string;
    title?: string;
    rank?: number;
    showParent?: boolean;
    extraIcon?: string;
  };
  showTooltip?: boolean;
  parentId?: number;
  pathList?: number[];
  redirect?: string;
};

export type themeColorsType = {
  color: string;
  themeColor: string;
};

export interface scrollbarDomType extends HTMLElement {
  wrap?: {
    offsetWidth: number;
  };
}
