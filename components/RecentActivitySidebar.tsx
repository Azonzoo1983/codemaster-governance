import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequestStore } from '../stores';
import {
  Clock,
  X,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  UserPlus,
  MessageSquare,
  RefreshCw,
  XCircle,
  Send,
  Eye,
} from 'lucide-react';

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return then.toLocaleDateString();
}

function getActionIcon(action: string): React.ReactNode {
  const lower = action.toLowerCase();
  if (lower.includes('created') || lower.includes('new')) return <FileText size={14} className="text-blue-500" />;
  if (lower.includes('completed')) return <CheckCircle size={14} className="text-green-500" />;
  if (lower.includes('rejected')) return <XCircle size={14} className="text-red-500" />;
  if (lower.includes('assigned')) return <UserPlus size={14} className="text-indigo-500" />;
  if (lower.includes('returned') || lower.includes('clarification')) return <MessageSquare size={14} className="text-orange-500" />;
  if (lower.includes('submitted') || lower.includes('approved')) return <Send size={14} className="text-cyan-500" />;
  if (lower.includes('review') || lower.includes('validation')) return <Eye size={14} className="text-purple-500" />;
  if (lower.includes('updated') || lower.includes('modified')) return <RefreshCw size={14} className="text-yellow-500" />;
  return <AlertCircle size={14} className="text-slate-400" />;
}

export const RecentActivitySidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const requests = useRequestStore((s) => s.requests);

  // Collect the 5 most recent audit log entries across all requests
  const recentEntries = useMemo(() => {
    const entries: { requestId: string; requestTitle: string; action: string; user: string; timestamp: string }[] = [];
    for (const req of requests) {
      for (const log of req.history) {
        entries.push({
          requestId: req.id,
          requestTitle: req.title,
          action: log.action,
          user: log.user,
          timestamp: log.timestamp,
        });
      }
    }
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return entries.slice(0, 5);
  }, [requests]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleNavigate = useCallback((requestId: string) => {
    navigate('/requests/' + requestId);
    setIsOpen(false);
  }, [navigate]);

  return (
    <div ref={panelRef}>
      {/* Floating pill button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-full px-3 py-3 shadow-lg hover:shadow-xl transition-all hover:px-4 group"
          aria-label="Open recent activity"
          style={{ animation: 'slideInPill 300ms ease-out' }}
        >
          <Clock size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-500 transition-colors" />
        </button>
      )}

      {/* Sliding panel */}
      <div
        className={'fixed right-0 top-0 h-full z-30 transition-transform duration-300 ease-in-out ' +
          (isOpen ? 'translate-x-0' : 'translate-x-full')
        }
        style={{ width: 280 }}
      >
        <div className="h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              aria-label="Close recent activity"
            >
              <X size={16} />
            </button>
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto">
            {recentEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Clock size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {recentEntries.map((entry, idx) => (
                  <button
                    key={entry.requestId + '-' + idx}
                    onClick={() => handleNavigate(entry.requestId)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        {getActionIcon(entry.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white leading-snug">
                          {entry.action}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {entry.requestTitle}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {entry.user} · {getRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                      <ArrowRight size={14} className="shrink-0 mt-1 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS animation */}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes slideInPill { from { opacity: 0; transform: translateX(100%) translateY(-50%); } to { opacity: 1; transform: translateX(0) translateY(-50%); } }' }} />
    </div>
  );
};
