import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DidYouKnowCard from './DidYouKnowCard';
import {
  BellIcon,
  BellAlertIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import UserProfileDropdown from './UserProfileDropdown';
import {
  getConversationMessages,
  getHeaderBarData,
  markConversationRead,
  sendConversationReply,
} from '../../services/headerBarService';
import {
  getPushPublicKey,
  savePushSubscription,
} from '../../features/school/services/schoolApi';

const CLICKABLE_CHAT_ROLES = new Set(['student', 'teacher', 'hos']);
const DELIVERED_NOTIFICATION_STORAGE_KEY = 'ndovera.delivered.notifications.v1';

const roleHeaderStats = {
  student: { notifications: 0, chats: 0, auras: 0 },
  parent: { notifications: 0, chats: 0, auras: 0 },
  teacher: { notifications: 0, chats: 0, auras: 0 },
  hos: { notifications: 0, chats: 0, auras: 0 },
  accountant: { notifications: 0, chats: 0, auras: 0 },
  owner: { notifications: 0, chats: 0, auras: 0 },
};

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function formatConversationTimestamp(value) {
  const timestamp = String(value || '').trim();
  if (!timestamp) return '';

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getNotificationPermissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return window.Notification.permission;
}

function readDeliveredNotifications() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DELIVERED_NOTIFICATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDeliveredNotifications(nextState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DELIVERED_NOTIFICATION_STORAGE_KEY, JSON.stringify(nextState));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(Array.from(rawData).map(character => character.charCodeAt(0)));
}

async function syncPushContext(roleKey) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'SET_PUSH_CONTEXT', roleKey });
  return true;
}

async function ensureRolePushSubscription(roleKey) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const pushConfig = await getPushPublicKey().catch(() => ({ available: false }));
  if (!pushConfig?.available || !pushConfig?.publicKey) {
    await syncPushContext(roleKey).catch(() => false);
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) {
    return false;
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
  });

  await syncPushContext(roleKey).catch(() => false);
  await savePushSubscription({
    roleKey,
    subscription: subscription.toJSON(),
    deviceLabel: navigator.platform || 'web-device',
  }).catch(() => null);

  return true;
}

async function registerParentBackgroundFeeReminders() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !('periodicSync' in registration)) {
      return false;
    }

    await registration.periodicSync.register('parent-fee-reminders', {
      minInterval: 12 * 60 * 60 * 1000,
    });

    registration.active?.postMessage({ type: 'SYNC_PARENT_FEE_REMINDERS' });
    return true;
  } catch {
    return false;
  }
}

export default function DashboardTopBar({ authUser = null, onLogout = () => {}, onToggleSidebar = null, isSidebarOpen = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const installPromptRef = useRef(null);
  const [installable, setInstallable] = useState(false);

  const roleKey = location.pathname.startsWith('/roles/')
    ? location.pathname.split('/')[2]
    : 'student';

  const baseStats = useMemo(
    () => roleHeaderStats[roleKey] || { notifications: 0, chats: 0, auras: 0 },
    [roleKey]
  );

  const [chatsCount, setChatsCount] = useState(baseStats.chats);
  const [notificationsCount, setNotificationsCount] = useState(baseStats.notifications);
  const [chatItems, setChatItems] = useState([]);
  const [notificationItems, setNotificationItems] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [activeChatId, setActiveChatId] = useState('');
  const [activeChatMessages, setActiveChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [loadingChatThread, setLoadingChatThread] = useState(false);
  const [sendingChatReply, setSendingChatReply] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermissionState);

  const selfIdentifiers = useMemo(
    () => Array.from(new Set([
      authUser?.id,
      authUser?.email,
      authUser?.displayId,
    ].map(normalizeIdentifier).filter(Boolean))),
    [authUser?.displayId, authUser?.email, authUser?.id],
  );

  const refreshData = useCallback(async () => {
    const data = await getHeaderBarData(roleKey);
    setChatsCount(data.chats ?? baseStats.chats);
    setNotificationsCount(data.notifications ?? baseStats.notifications);
    setChatItems(data.chatItems || []);
    setNotificationItems(data.notificationItems || []);
  }, [baseStats.chats, baseStats.notifications, roleKey]);

  useEffect(() => {
    setChatsCount(baseStats.chats);
    setNotificationsCount(baseStats.notifications);
  }, [baseStats]);

  useEffect(() => {
    let mounted = true;
    let signature = '';

    // Background polls only push new state when something actually changed, so the header
    // bell/chat badges and dropdowns never re-render (blink) on identical refreshes.
    const load = async () => {
      const data = await getHeaderBarData(roleKey);
      if (!mounted) return;
      const chatItems = data.chatItems || [];
      const notificationItems = data.notificationItems || [];
      const nextSignature = JSON.stringify({
        c: data.chats ?? baseStats.chats,
        n: data.notifications ?? baseStats.notifications,
        ci: chatItems.map(item => `${item.id || ''}:${item.updatedAt || item.preview || ''}`),
        ni: notificationItems.map(item => `${item.id || ''}:${item.createdAt || item.preview || ''}`),
      });
      if (nextSignature === signature) return;
      signature = nextSignature;
      setChatsCount(data.chats ?? baseStats.chats);
      setNotificationsCount(data.notifications ?? baseStats.notifications);
      setChatItems(chatItems);
      setNotificationItems(notificationItems);
    };

    load();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, 12000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [roleKey, baseStats]);

  useEffect(() => {
    setActivePanel(null);
    setActiveChatId('');
    setActiveChatMessages([]);
    setChatDraft('');
    setPanelError('');
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      installPromptRef.current = e;
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstallable(false));
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  async function handleInstall() {
    if (!installPromptRef.current) return;
    installPromptRef.current.prompt();
    const { outcome } = await installPromptRef.current.userChoice;
    if (outcome === 'accepted') {
      setInstallable(false);
      installPromptRef.current = null;
    }
  }

  const togglePanel = panel => {
    setPanelError('');
    setActivePanel(prev => (prev === panel ? null : panel));
  };

  const openFullMessaging = () => {
    setActivePanel(null);
    navigate(`/roles/${roleKey}/messaging`, {
      state: activeChatId ? { conversationId: activeChatId } : undefined,
    });
  };

  const openNotificationItem = useCallback((item) => {
    const actionUrl = String(item?.actionUrl || '').trim();
    if (!actionUrl) return;

    setActivePanel(null);
    setPanelError('');

    if (/^https?:\/\//i.test(actionUrl)) {
      window.location.assign(actionUrl);
      return;
    }

    navigate(actionUrl);
  }, [navigate]);

  const loadChatThread = useCallback(async (conversationId, options = {}) => {
    const { markRead = true } = options;
    if (!conversationId) return;

    setLoadingChatThread(true);
    setPanelError('');

    try {
      const payload = await getConversationMessages(conversationId);
      setActiveChatId(conversationId);
      setActiveChatMessages(payload.messages || []);

      if (markRead) {
        await markConversationRead(conversationId).catch(() => null);
        await refreshData();
      }
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not open that conversation.');
    } finally {
      setLoadingChatThread(false);
    }
  }, [refreshData]);

  const openChatItem = useCallback((item) => {
    if (!CLICKABLE_CHAT_ROLES.has(roleKey)) return;
    loadChatThread(item.id, { markRead: true });
  }, [loadChatThread, roleKey]);

  const handleMarkRead = useCallback(async () => {
    if (!activeChatId) return;
    setPanelError('');
    try {
      await markConversationRead(activeChatId);
      await refreshData();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not mark that thread as read.');
    }
  }, [activeChatId, refreshData]);

  const handleSendReply = useCallback(async () => {
    if (!activeChatId || !chatDraft.trim()) return;
    setSendingChatReply(true);
    setPanelError('');
    try {
      await sendConversationReply(activeChatId, chatDraft.trim());
      setChatDraft('');
      await loadChatThread(activeChatId, { markRead: true });
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not send that reply.');
    } finally {
      setSendingChatReply(false);
    }
  }, [activeChatId, chatDraft, loadChatThread]);

  function handleChatDraftKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendReply();
    }
  }

  const activeChatItem = useMemo(
    () => chatItems.find(item => item.id === activeChatId) || null,
    [activeChatId, chatItems],
  );

  const deviceNotificationItems = useMemo(
    () => notificationItems.filter(item => [
      'fee_reminder',
      'fee_payment_claim_pending',
      'fee_payment_claim_verified',
      'fee_payment_claim_rejected',
      'fee_payment_receipt',
      'school_announcement',
    ].includes(item.category)),
    [notificationItems],
  );

  const canRequestDeviceNotifications = notificationPermission !== 'unsupported';

  const panelItems = activePanel === 'chat' ? chatItems : notificationItems;

  const requestDeviceNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (notificationPermission === 'denied') {
      setActivePanel('notifications');
      setPanelError('Device notifications are blocked in this browser. Enable notifications for this site in browser settings to receive closed-app alerts on this device.');
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      await ensureRolePushSubscription(roleKey).catch(() => null);
      if (roleKey === 'parent') {
        await registerParentBackgroundFeeReminders();
      }
    }
  }, [notificationPermission, roleKey]);

  useEffect(() => {
    setNotificationPermission(getNotificationPermissionState());
  }, []);

  useEffect(() => {
    if (notificationPermission !== 'granted' || deviceNotificationItems.length === 0 || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const delivered = readDeliveredNotifications();
    let changed = false;

    deviceNotificationItems.forEach((item) => {
      const deliveryKey = `${item.id}:${item.reminderSlotKey || 'current'}`;
      if (delivered[deliveryKey]) {
        return;
      }

      const popup = new window.Notification(item.title || 'School reminder', {
        body: item.detail || item.preview || '',
        tag: deliveryKey,
      });

      popup.onclick = () => {
        window.focus();
        popup.close();
      };

      delivered[deliveryKey] = new Date().toISOString();
      changed = true;
    });

    if (changed) {
      writeDeliveredNotifications(delivered);
    }
  }, [deviceNotificationItems, notificationPermission]);

  useEffect(() => {
    if (notificationPermission !== 'granted') {
      return;
    }

    ensureRolePushSubscription(roleKey).catch(() => null);
    if (roleKey === 'parent') {
      registerParentBackgroundFeeReminders().catch(() => null);
    }
  }, [notificationPermission, roleKey]);

  return (
    <>
    <header className="sticky top-0 z-40 px-4 md:px-6 py-3 border-b border-slate-200/70 dark:border-cyan-300/20 glass-surface">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4 relative">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden glass-chip p-2 rounded-xl text-slate-700 dark:text-[#f5deb3] hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
          <span className="live-dot" />
          <p className="micro-label neon-subtle truncate">Live Dashboard</p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => togglePanel('chat')}
            className="glass-chip relative p-2 rounded-xl text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
            aria-label="Open chats"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            {chatsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                {chatsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => togglePanel('notifications')}
            className="glass-chip relative p-2 rounded-xl text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
            aria-label="Open notifications"
          >
            <BellIcon className="w-5 h-5" />
            {notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notificationsCount}
              </span>
            )}
          </button>

          {canRequestDeviceNotifications && notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestDeviceNotifications}
              className="glass-chip p-2 rounded-xl text-[#800020] dark:text-[#00ffff] hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
              aria-label="Enable device notifications"
              title="Enable device notifications"
            >
              <BellAlertIcon className="w-5 h-5" />
            </button>
          )}
          {installable && (
            <button
              onClick={handleInstall}
              title="Install NDOVERA app"
              className="glass-chip p-2 rounded-xl text-[#1a5c38] dark:text-[#39ff14] hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
              aria-label="Install app"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
          )}
          <UserProfileDropdown user={authUser} onLogout={onLogout} />
        </div>

      </div>

      {activePanel && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/35 backdrop-blur-[1.5px] transition-opacity duration-300 z-40 opacity-100 pointer-events-auto"
            onClick={() => setActivePanel(null)}
            aria-hidden={false}
          />

          <aside
            className="fixed top-0 right-0 h-screen w-[22rem] max-w-[92vw] z-50 border-l border-slate-200/70 dark:border-cyan-300/20 glass-surface shadow-2xl transition-transform duration-300 translate-x-0"
            aria-hidden={false}
          >
            <div className="h-full flex flex-col pt-[74px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/70">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {activePanel === 'chat' ? 'Messages' : 'Notifications'}
                </p>
                <button
                  onClick={() => setActivePanel(null)}
                  className="glass-chip p-1.5 rounded-lg hover:bg-white/70 dark:hover:bg-slate-700/60"
                >
                  <XMarkIcon className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </button>
              </div>

              {activePanel === 'notifications' && canRequestDeviceNotifications && notificationPermission !== 'granted' && (
                <div className="mx-3 mt-3 rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-[#39ff14]">
                  <p className="font-semibold text-[#800000] dark:text-[#ffffff]">Enable device alerts</p>
                  <p className="mt-1">Allow notifications so NDOVERA can deliver closed-app alerts for unpaid fees, approved payment claims, new receipts, and school announcements on this device.</p>
                  <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">On supported installed browsers, NDOVERA also keeps a real push subscription so alerts can arrive even when the dashboard is closed.</p>
                  <button
                    type="button"
                    onClick={requestDeviceNotifications}
                    className="mt-3 rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]"
                  >
                    Allow Notifications
                  </button>
                </div>
              )}

              {activePanel === 'chat' && activeChatId && CLICKABLE_CHAT_ROLES.has(roleKey) ? (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-slate-200/70 dark:border-slate-700/70">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatId('');
                          setActiveChatMessages([]);
                          setChatDraft('');
                          setPanelError('');
                        }}
                        className="glass-chip p-1.5 rounded-lg hover:bg-white/70 dark:hover:bg-slate-700/60"
                        aria-label="Back to conversation list"
                      >
                        <ArrowLeftIcon className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">{activeChatItem?.sender || 'Conversation'}</p>
                        <p className="text-[10px] micro-label neon-subtle truncate">{activeChatItem?.preview || 'Open thread'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkRead}
                      className="rounded-full border border-emerald-300/30 px-3 py-1 text-[10px] font-semibold text-[#1a5c38] dark:border-cyan-300/30 dark:text-[#00ffff]"
                    >
                      Mark Read
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {panelError ? (
                      <div className="rounded-2xl border border-rose-300/40 bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/30 dark:bg-rose-900/40 dark:text-rose-100">
                        {panelError}
                      </div>
                    ) : null}

                    {loadingChatThread && activeChatMessages.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">Loading conversation...</p>
                    ) : activeChatMessages.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No messages yet in this thread.</p>
                    ) : activeChatMessages.map(message => {
                      const senderId = normalizeIdentifier(message.senderId || message.sender_id);
                      const isOwn = selfIdentifiers.includes(senderId);
                      return (
                        <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[88%] rounded-2xl border px-3 py-2 ${isOwn
                            ? 'border-[#1a5c38]/25 bg-[#1a5c38]/12 text-slate-800 dark:border-[#00ffff]/35 dark:bg-[#00ffff]/10 dark:text-white'
                            : 'border-slate-200/70 bg-white/80 text-slate-800 dark:border-cyan-300/20 dark:bg-slate-800/60 dark:text-slate-100'
                          }`}>
                            <div className="text-[10px] font-semibold text-[#800020] dark:text-[#bf00ff]">
                              {isOwn ? 'You' : (activeChatItem?.sender || 'Contact')}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-xs leading-5">{message.body}</div>
                            <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-300">
                              {formatConversationTimestamp(message.sentAt || message.sent_at || message.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3">
                    <textarea
                      value={chatDraft}
                      onChange={event => setChatDraft(event.target.value)}
                      onKeyDown={handleChatDraftKeyDown}
                      rows={3}
                      placeholder="Reply from the sidebar..."
                      className="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1a5c38] focus:ring-2 focus:ring-[#1a5c38]/20 dark:border-cyan-300/20 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingChatReply || !chatDraft.trim()}
                        className="flex-1 rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition disabled:opacity-50 dark:bg-[#00ffff] dark:text-black"
                      >
                        <span className="inline-flex items-center gap-2">
                          <PaperAirplaneIcon className="w-4 h-4" />
                          {sendingChatReply ? 'Sending...' : 'Reply'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={openFullMessaging}
                        className="rounded-2xl glass-chip px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60"
                      >
                        Full Chat
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {panelItems.map(item => (
                      activePanel === 'chat' && CLICKABLE_CHAT_ROLES.has(roleKey) ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openChatItem(item)}
                          className="glass-chip w-full rounded-2xl border border-slate-200/70 p-3 text-left transition hover:bg-white/70 dark:border-cyan-300/15 dark:hover:bg-slate-700/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.sender || item.title}</p>
                            <p className="text-[10px] micro-label neon-subtle">{item.time}</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.preview || item.detail}</p>
                          {item.unread && <p className="text-[10px] micro-label accent-indigo mt-2">Unread</p>}
                        </button>
                      ) : item.actionUrl ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openNotificationItem(item)}
                          className="glass-chip w-full rounded-2xl border border-slate-200/70 p-3 text-left transition hover:bg-white/70 dark:border-cyan-300/15 dark:hover:bg-slate-700/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.sender || item.title}</p>
                            <p className="text-[10px] micro-label neon-subtle">{item.time}</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.preview || item.detail}</p>
                          {item.unread && <p className="text-[10px] micro-label accent-indigo mt-2">Unread</p>}
                        </button>
                      ) : (
                        <div key={item.id} className="glass-chip rounded-2xl border border-slate-200/70 dark:border-cyan-300/15 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.sender || item.title}</p>
                            <p className="text-[10px] micro-label neon-subtle">{item.time}</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.preview || item.detail}</p>
                          {item.unread && <p className="text-[10px] micro-label accent-indigo mt-2">Unread</p>}
                        </div>
                      )
                    ))}

                    {panelItems.length === 0 && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No new updates right now.</p>
                    )}
                  </div>

                  {activePanel === 'chat' && (
                    <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70">
                      <button
                        onClick={openFullMessaging}
                        className="w-full px-4 py-2 rounded-2xl glass-chip text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60"
                      >
                        Open Full Messaging
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </header>
      {typeof window !== 'undefined' && window.location.pathname.startsWith('/roles/') ? (
        <div className="px-4 md:px-6">
          <div className="mx-auto max-w-7xl pt-3">
            <DidYouKnowCard />
          </div>
        </div>
      ) : null}
    </>
  );
}
