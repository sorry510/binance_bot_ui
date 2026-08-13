<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElNotification } from "element-plus";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getToken } from "@/utils/auth";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
  type WebNotificationItem
} from "@/api/notification";
import BellIcon from "~icons/ep/bell";

const { t } = useI18n();
const router = useRouter();
const popoverVisible = ref(false);
const notifications = ref<WebNotificationItem[]>([]);
const unreadCount = ref(0);
const loading = ref(false);
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let destroyed = false;

const badgeValue = computed(() =>
  unreadCount.value > 0 ? unreadCount.value : ""
);

async function loadNotifications() {
  loading.value = true;
  try {
    const response = await getNotifications({ page: 1, limit: 50 });
    notifications.value = response?.data?.list || [];
    unreadCount.value = Number(response?.data?.unread_count || 0);
  } catch {
    notifications.value = [];
    unreadCount.value = 0;
  } finally {
    loading.value = false;
  }
}

function websocketURL(token: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/notifications?token=${encodeURIComponent(token)}`;
}

function connectWebSocket() {
  if (destroyed || socket?.readyState === WebSocket.OPEN) return;
  const token = getToken()?.accessToken;
  if (!token) return;

  socket = new WebSocket(websocketURL(token));
  socket.onopen = () => {
    reconnectAttempts = 0;
  };
  socket.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      if (message?.type !== "notification" || !message?.data) return;
      const notification = message.data as WebNotificationItem;
      const existing = notifications.value.find(
        item => item.id === notification.id
      );
      notifications.value = [
        notification,
        ...notifications.value.filter(item => item.id !== notification.id)
      ].slice(0, 50);
      if (!existing && !notification.is_read) unreadCount.value += 1;
      ElNotification({
        title: notification.title || t("webNotification.title"),
        message: notification.content,
        type: "info",
        duration: 6000
      });
    } catch {
      // Ignore malformed WebSocket messages.
    }
  };
  socket.onclose = () => {
    socket = null;
    if (destroyed) return;
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(connectWebSocket, delay);
  };
  socket.onerror = () => socket?.close();
}

async function markRead(notification: WebNotificationItem) {
  if (notification.is_read) return;
  await readNotification(notification.id);
  notification.is_read = 1;
  notification.read_time = Date.now();
  unreadCount.value = Math.max(0, unreadCount.value - 1);
}

async function markAllRead() {
  if (!unreadCount.value) return;
  await readAllNotifications();
  const now = Date.now();
  notifications.value.forEach(notification => {
    notification.is_read = 1;
    notification.read_time = now;
  });
  unreadCount.value = 0;
}

function formatTime(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : "";
}

function openHistory() {
  popoverVisible.value = false;
  router.push({ name: "NotificationHistory" });
}

onMounted(async () => {
  await loadNotifications();
  connectWebSocket();
});

onBeforeUnmount(() => {
  destroyed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
});
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-end"
    :width="380"
    trigger="click"
  >
    <template #reference>
      <span class="dropdown-badge navbar-bg-hover select-none">
        <el-badge :value="badgeValue" :max="99">
          <span class="header-notice-icon">
            <IconifyIconOffline :icon="BellIcon" />
          </span>
        </el-badge>
      </span>
    </template>

    <div class="notification-header">
      <strong>{{ t("webNotification.title") }}</strong>
      <div>
        <el-button text type="primary" @click="openHistory">
          {{ t("webNotification.viewHistory") }}
        </el-button>
        <el-button
          text
          type="primary"
          :disabled="unreadCount === 0"
          @click="markAllRead"
        >
          {{ t("webNotification.markAllRead") }}
        </el-button>
      </div>
    </div>
    <el-scrollbar v-loading="loading" max-height="420px">
      <div v-if="notifications.length" class="notification-list">
        <button
          v-for="notification in notifications"
          :key="notification.id"
          type="button"
          :class="['notification-item', { unread: !notification.is_read }]"
          @click="markRead(notification)"
        >
          <span class="notification-title">{{ notification.title }}</span>
          <span class="notification-content">{{ notification.content }}</span>
          <span class="notification-meta">
            {{ notification.module }} ·
            {{ formatTime(notification.create_time) }}
          </span>
        </button>
      </div>
      <el-empty
        v-else
        :description="t('webNotification.empty')"
        :image-size="60"
      />
    </el-scrollbar>
  </el-popover>
</template>

<style lang="scss" scoped>
.dropdown-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 48px;
  cursor: pointer;

  .header-notice-icon {
    font-size: 18px;
  }
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.notification-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  padding: 12px 10px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.unread {
    background: var(--el-color-primary-light-9);

    .notification-title {
      font-weight: 600;
    }
  }
}

.notification-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.notification-content {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-line;
  -webkit-box-orient: vertical;
}

.notification-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
