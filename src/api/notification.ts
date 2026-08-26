import { http, baseUrlApi } from "@/utils/http";

export interface WebNotificationItem {
  id: number;
  title: string;
  content: string;
  module: string;
  level: string;
  event_type?: string;
  symbol?: string;
  liquidation_side?: "long" | "short" | string;
  aggregate_notional?: number;
  order_count?: number;
  window_start?: number;
  window_end?: number;
  is_read: number;
  create_time: number;
  read_time: number;
}

export interface WebNotificationQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  module?: string;
  is_read?: number | string;
  start_time?: number;
  end_time?: number;
  unread_only?: number;
}

export const getNotifications = (params: WebNotificationQuery = {}) => {
  return http.get<any, WebNotificationQuery>(baseUrlApi("notifications"), {
    params
  });
};

export const readNotification = (id: number) => {
  return http.request<any>("put", baseUrlApi(`notifications/${id}/read`));
};

export const readAllNotifications = () => {
  return http.request<any>("put", baseUrlApi("notifications/read-all"));
};
