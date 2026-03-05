import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequestStore, useUserStore } from '../stores';
import { Activity, Clock, ArrowLeft, CheckCircle, XCircle, UserPlus, AlertTriangle, FileText, RefreshCw, Filter } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

// --- Types ---
interface FeedEntry {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
  changedFields?: { field: string; oldValue: string; newValue: string }[];
  requestId: string;
  requestTitle: string;
}

type ActionFilter = 'All' | 'Created' | 'Status Change' | 'Assignment' | 'Comments';
type TimeRange = 'Today' | 'Last 7 days' | 'Last 30 days' | 'All';

// --- Helpers ---
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

function getDotColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('completed') || lower.includes('approved') || lower.includes('validated')) {
    return 'bg-emerald-500';
  }
  if (lower.includes('rejected')) {
    return 'bg-red-500';
  }
  if (lower.includes('returned') || lower.includes('clarification')) {
    return 'bg-amber-500';
  }
  if (lower.includes('created') || lower.includes('submitted')) {
    return 'bg-blue-500';
  }
  return 'bg-slate-400';
}

function getActionIcon(action: string): React.ReactNode {
  const lower = action.toLowerCase();
  if (lower.includes('completed') || lower.includes('approved') || lower.includes('validated')) {
    return <CheckCircle size={14} strokeWidth={1.75} className="text-emerald-500" />;
  }
  if (lower.includes('rejected')) {
    return <XCircle size={14} strokeWidth={1.75} className="text-red-500" />;
  }
  if (lower.includes('returned') || lower.includes('clarification')) {
    return <AlertTriangle size={14} strokeWidth={1.75} className="text-amber-500" />;
  }
  if (lower.includes('assigned')) {
    return <UserPlus size={14} strokeWidth={1.75} className="text-violet-500" />;
  }
  if (lower.includes('created')) {
    return <FileText size={14} strokeWidth={1.75} className="text-blue-500" />;
  }
  if (lower.includes('updated') || lower.includes('modified')) {
    return <RefreshCw size={14} strokeWidth={1.75} className="text-slate-500" />;
  }
  return <Activity size={14} strokeWidth={1.75} className="text-slate-400" />;
}

function matchesActionFilter(action: string, filter: ActionFilter): boolean {
  if (filter === 'All') return true;
  const lower = action.toLowerCase();
  switch (filter) {
    case 'Created':
      return lower.includes('created');
    case 'Status Change':
      return lower.includes('status') || lower.includes('approved') || lower.includes('rejected') ||
        lower.includes('completed') || lower.includes('submitted') || lower.includes('validated') ||
        lower.includes('returned') || lower.includes('started reviewing');
    case 'Assignment':
      return lower.includes('assigned') || lower.includes('assignment');
    case 'Comments':
      return lower.includes('comment') || lower.includes('clarification') || lower.includes('note');
    default:
      return true;
  }
}

function matchesTimeRange(timestamp: string, range: TimeRange): boolean {
  if (range === 'All') return true;
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (range) {
    case 'Today':
      return now.toDateString() === then.toDateString();
    case 'Last 7 days':
      return diffDays <= 7;
    case 'Last 30 days':
      return diffDays <= 30;
    default:
      return true;
  }
}

const PAGE_SIZE = 25;

// --- Component ---
export const ActivityFeed: React.FC = () => {
  const navigate = useNavigate();
  const requests = useRequestStore((s) => s.requests);
  const users = useUserStore((s) => s.users);

  const [actionFilter, setActionFilter] = useState<ActionFilter>('All');
  const [timeRange, setTimeRange] = useState<TimeRange>('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Collect all history entries from all requests into a flat array
  const allEntries = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = [];
    for (const req of requests) {
      for (const log of req.history) {
        entries.push({
          timestamp: log.timestamp,
          user: log.user,
          action: log.action,
          details: log.details,
          changedFields: log.changedFields,
          requestId: req.id,
          requestTitle: req.title,
        });
      }
    }
    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return entries;
  }, [requests]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return allEntries.filter(
      (entry) => matchesActionFilter(entry.action, actionFilter) && matchesTimeRange(entry.timestamp, timeRange)
    );
  }, [allEntries, actionFilter, timeRange]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEntries.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  // Reset pagination when filters change
  const handleActionFilterChange = (val: ActionFilter) => {
    setActionFilter(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleTimeRangeChange = (val: TimeRange) => {
    setTimeRange(val);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
              <Activity size={20} strokeWidth={1.75} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Activity Feed</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Global timeline of all request actions</p>
            </div>
          </div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <Clock size={14} strokeWidth={1.75} className="inline mr-1" />
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Filter size={16} strokeWidth={1.75} className="text-slate-400" />
          <span className="font-medium">Filters:</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="action-filter" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Action
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => handleActionFilterChange(e.target.value as ActionFilter)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
          >
            <option value="All">All</option>
            <option value="Created">Created</option>
            <option value="Status Change">Status Change</option>
            <option value="Assignment">Assignment</option>
            <option value="Comments">Comments</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="time-filter" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Time
          </label>
          <select
            id="time-filter"
            value={timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
          >
            <option value="All">All</option>
            <option value="Today">Today</option>
            <option value="Last 7 days">Last 7 days</option>
            <option value="Last 30 days">Last 30 days</option>
          </select>
        </div>
        {(actionFilter !== 'All' || timeRange !== 'All') && (
          <button
            onClick={() => { handleActionFilterChange('All'); handleTimeRangeChange('All'); }}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        {visibleEntries.length === 0 ? (
          <EmptyState
            icon={<Activity size={40} strokeWidth={1.5} />}
            title="No activity found"
            description={
              actionFilter !== 'All' || timeRange !== 'All'
                ? 'Try adjusting your filters to see more results.'
                : 'Activity will appear here as requests are created and updated.'
            }
            size="md"
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {visibleEntries.map((entry, idx) => (
              <div
                key={`${entry.requestId}-${entry.timestamp}-${idx}`}
                className="flex gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-750 dark:hover:bg-slate-700/30 transition-colors"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3 h-3 rounded-full ${getDotColor(entry.action)} ring-2 ring-white dark:ring-slate-800 shadow-sm flex-shrink-0`} />
                  {idx < visibleEntries.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Request link */}
                      <button
                        onClick={() => navigate(`/requests/${entry.requestId}`)}
                        className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition"
                      >
                        {entry.requestId}
                      </button>
                      <span className="text-xs text-slate-400 dark:text-slate-500 mx-1.5">&middot;</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.requestTitle}</span>

                      {/* Action description */}
                      <div className="flex items-center gap-2 mt-1">
                        {getActionIcon(entry.action)}
                        <p className="text-sm text-slate-800 dark:text-slate-200">{entry.action}</p>
                      </div>

                      {/* Details */}
                      {entry.details && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-6">{entry.details}</p>
                      )}

                      {/* Changed fields */}
                      {entry.changedFields && entry.changedFields.length > 0 && (
                        <div className="mt-2 pl-6 space-y-1">
                          {entry.changedFields.map((cf, cfIdx) => (
                            <div key={cfIdx} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-600 dark:text-slate-300">{cf.field}:</span>
                              {cf.oldValue && (
                                <>
                                  <span className="line-through text-slate-400 dark:text-slate-500 max-w-[150px] truncate inline-block align-bottom">{cf.oldValue}</span>
                                  <span className="text-slate-300 dark:text-slate-600">&rarr;</span>
                                </>
                              )}
                              <span className="text-slate-700 dark:text-slate-300 max-w-[200px] truncate inline-block align-bottom">{cf.newValue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp and user */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 flex-shrink-0 sm:text-right">
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap" title={new Date(entry.timestamp).toLocaleString()}>
                        {getRelativeTime(entry.timestamp)}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {entry.user}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 text-center">
            <button
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition"
            >
              <RefreshCw size={14} strokeWidth={1.75} />
              Load More ({filteredEntries.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
