import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, AppNotification } from '../hooks/useRealtimeNotifications';
import { Bell, Check, CheckCheck, Trash2, X, MessageSquare, UserPlus, AlertTriangle, Info, Zap } from 'lucide-react';

const typeIcons: Record<AppNotification['type'], React.ReactNode> = {
  status_change: <Zap size={14} className="text-blue-500" />,
  assignment: <UserPlus size={14} className="text-indigo-500" />,
  comment: <MessageSquare size={14} className="text-emerald-500" />,
  sla_warning: <AlertTriangle size={14} className="text-amber-500" />,
  info: <Info size={14} className="text-slate-400" />,
};

const typeColors: Record<AppNotification['type'], string> = {
  status_change: 'border-l-blue-500',
  assignment: 'border-l-indigo-500',
  comment: 'border-l-emerald-500',
  sla_warning: 'border-l-amber-500',
  info: 'border-l-slate-400',
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationStore(s => s.notifications);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const clearAll = useNotificationStore(s => s.clearAll);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleNotificationClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.requestId) {
      navigate(`/requests/${notif.requestId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-fadeIn shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-premium-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden z-50 animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  aria-label="Mark all as read"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition ml-1"
                  aria-label="Clear all notifications"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 dark:text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-l-3 cursor-pointer transition-colors ${typeColors[notif.type]} ${
                    notif.read
                      ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                      : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  } border-b border-slate-100 dark:border-slate-700/50`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{typeIcons[notif.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{notif.title}</span>
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">{timeAgo(notif.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
