import React, { useState, useEffect } from 'react';
import { Mail, Bell, BellOff, CheckCircle, AlertTriangle, UserPlus, MessageSquare, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { getEmailPreferences, setEmailPreferences, type EmailPreferences } from '../lib/emailNotifications';

const notificationTypes = [
  {
    key: 'statusChanges' as keyof EmailPreferences,
    label: 'Status Changes',
    description: 'When a request status is updated (approved, rejected, completed, etc.)',
    icon: <CheckCircle size={16} strokeWidth={1.75} className="text-blue-500" />,
  },
  {
    key: 'assignments' as keyof EmailPreferences,
    label: 'Assignments',
    description: 'When a request is assigned or reassigned to a specialist',
    icon: <UserPlus size={16} strokeWidth={1.75} className="text-violet-500" />,
  },
  {
    key: 'comments' as keyof EmailPreferences,
    label: 'Comments & Clarifications',
    description: 'When someone adds a clarification comment to a request',
    icon: <MessageSquare size={16} strokeWidth={1.75} className="text-emerald-500" />,
  },
  {
    key: 'slaWarnings' as keyof EmailPreferences,
    label: 'SLA Warnings',
    description: 'When a request is approaching or has breached its SLA deadline',
    icon: <Clock size={16} strokeWidth={1.75} className="text-amber-500" />,
  },
  {
    key: 'newRequests' as keyof EmailPreferences,
    label: 'New Requests',
    description: 'When a new request is submitted that requires your action',
    icon: <AlertTriangle size={16} strokeWidth={1.75} className="text-rose-500" />,
  },
];

export const EmailNotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<EmailPreferences>(getEmailPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEmailPreferences(prefs);
  }, [prefs]);

  const toggleEnabled = () => {
    setPrefs(prev => ({ ...prev, enabled: !prev.enabled }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleType = (key: keyof EmailPreferences) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
              <Mail size={20} strokeWidth={1.75} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Email Notifications</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure which events trigger email notifications
              </p>
            </div>
          </div>

          {/* Master Toggle */}
          <button
            onClick={toggleEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              prefs.enabled
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/60'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-600'
            }`}
            aria-label={prefs.enabled ? 'Disable email notifications' : 'Enable email notifications'}
          >
            {prefs.enabled ? (
              <>
                <ToggleRight size={18} className="text-blue-600 dark:text-blue-400" />
                <span>Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft size={18} />
                <span>Disabled</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Setup info banner */}
      <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100/60 dark:border-amber-800/60">
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>
            <strong>Setup required:</strong> Email delivery requires a Supabase Edge Function deployment with either a Resend API key or SMTP credentials configured.
            Without this, notifications are logged but not delivered.
          </span>
        </p>
      </div>

      {/* Notification Types */}
      <div className={`divide-y divide-slate-100 dark:divide-slate-700/60 ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {notificationTypes.map(({ key, label, description, icon }) => (
          <div
            key={key}
            className="flex items-center justify-between p-4 px-5 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">{icon}</div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
              </div>
            </div>
            <button
              onClick={() => toggleType(key)}
              className="flex-shrink-0"
              aria-label={`Toggle ${label} notifications`}
            >
              {prefs[key] ? (
                <Bell size={18} className="text-blue-600 dark:text-blue-400" />
              ) : (
                <BellOff size={18} className="text-slate-300 dark:text-slate-600" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Save confirmation */}
      {saved && (
        <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-100/60 dark:border-emerald-800/60 flex items-center gap-2 animate-fadeIn">
          <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Preferences saved</span>
        </div>
      )}
    </div>
  );
};
