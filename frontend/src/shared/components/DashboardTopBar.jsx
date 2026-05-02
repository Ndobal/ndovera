import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import RoleSwitcher from './RoleSwitcher';
import ThemeToggle from './ThemeToggle';
import UserProfileDropdown from './UserProfileDropdown';
import { getHeaderBarData } from '../../services/headerBarService';

const roleHeaderStats = {
  student: { notifications: 4, chats: 3, auras: 320 },
  parent: { notifications: 5, chats: 2, auras: 580 },
  teacher: { notifications: 7, chats: 8, auras: 1240 },
  hos: { notifications: 6, chats: 5, auras: 2640 },
  accountant: { notifications: 3, chats: 1, auras: 910 },
  owner: { notifications: 9, chats: 4, auras: 5210 },
};

export default function DashboardTopBar({ authUser = null, onLogout = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();

  const roleKey = location.pathname.startsWith('/roles/')
    ? location.pathname.split('/')[2]
    : 'student';

  const baseStats = useMemo(
    () => roleHeaderStats[roleKey] || { notifications: 2, chats: 1, auras: 450 },
    [roleKey]
  );

  const [auras, setAuras] = useState(baseStats.auras);
  const [chatsCount, setChatsCount] = useState(baseStats.chats);
  const [notificationsCount, setNotificationsCount] = useState(baseStats.notifications);
  const [chatItems, setChatItems] = useState([]);
  const [notificationItems, setNotificationItems] = useState([]);
  const [activePanel, setActivePanel] = useState(null);

  useEffect(() => {
    setAuras(baseStats.auras);
    setChatsCount(baseStats.chats);
    setNotificationsCount(baseStats.notifications);
  }, [baseStats]);

  useEffect(() => {
    let mounted = true;

    const refreshData = async () => {
      const data = await getHeaderBarData(roleKey);
      if (!mounted) return;
      setAuras(data.auras ?? baseStats.auras);
      setChatsCount(data.chats ?? baseStats.chats);
      setNotificationsCount(data.notifications ?? baseStats.notifications);
      setChatItems(data.chatItems || []);
      setNotificationItems(data.notificationItems || []);
    };

    refreshData();
    const timer = setInterval(refreshData, 12000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [roleKey, baseStats]);

  useEffect(() => {
    setActivePanel(null);
  }, [location.pathname]);

  const togglePanel = panel => {
    setActivePanel(prev => (prev === panel ? null : panel));
  };

  const openFullMessaging = () => {
    setActivePanel(null);
    navigate(`/roles/${roleKey}/messaging`);
  };

  const panelItems = activePanel === 'chat' ? chatItems : notificationItems;

  return (
    <header className="sticky top-0 z-40 px-4 md:px-6 py-3 border-b border-slate-200/70 dark:border-cyan-300/20 glass-surface">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4 relative">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="live-dot" />
          <p className="micro-label neon-subtle truncate">Live Dashboard</p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="glass-chip flex items-center gap-2 rounded-full px-2.5 md:px-3 py-1">
            <SparklesIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-300" />
            <span className="micro-label text-emerald-600 dark:text-emerald-300">Auras</span>
            <span className="micro-label text-emerald-600 dark:text-emerald-300">{auras.toLocaleString()}</span>
          </div>

          <button
            onClick={() => togglePanel('chat')}
            className="glass-chip relative p-2 rounded-xl text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
            aria-label="Open chats"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
              {chatsCount}
            </span>
          </button>

          <button
            onClick={() => togglePanel('notifications')}
            className="glass-chip relative p-2 rounded-xl text-slate-700 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
            aria-label="Open notifications"
          >
            <BellIcon className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {notificationsCount}
            </span>
          </button>

          <RoleSwitcher authUser={authUser} />
          <ThemeToggle />
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

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {panelItems.map(item => (
                  <div key={item.id} className="glass-chip rounded-2xl border border-slate-200/70 dark:border-cyan-300/15 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.sender || item.title}</p>
                      <p className="text-[10px] micro-label neon-subtle">{item.time}</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.preview || item.detail}</p>
                    {item.unread && <p className="text-[10px] micro-label accent-indigo mt-2">Unread</p>}
                  </div>
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
            </div>
          </aside>
        </>
      )}
    </header>
  );
}