import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequestStore, useUserStore, useAdminStore } from '../stores';
import { RequestStatus, RequestItem } from '../types';
import { getSLADeadline } from '../lib/businessHours';
import {
  PlusCircle,
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit3,
  Copy,
  Inbox,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

// --- Helpers ---

/** Ordered workflow stages for progress calculation */
const WORKFLOW_ORDER: RequestStatus[] = [
  RequestStatus.DRAFT,
  RequestStatus.PENDING_APPROVAL,
  RequestStatus.SUBMITTED_TO_POC,
  RequestStatus.ASSIGNED,
  RequestStatus.UNDER_SPECIALIST_REVIEW,
  RequestStatus.UNDER_TECHNICAL_VALIDATION,
  RequestStatus.PENDING_ORACLE_CREATION,
  RequestStatus.COMPLETED,
];

const PROGRESS_MAP: Record<string, number> = {
  [RequestStatus.DRAFT]: 10,
  [RequestStatus.PENDING_APPROVAL]: 20,
  [RequestStatus.SUBMITTED_TO_POC]: 30,
  [RequestStatus.ASSIGNED]: 40,
  [RequestStatus.UNDER_SPECIALIST_REVIEW]: 60,
  [RequestStatus.UNDER_TECHNICAL_VALIDATION]: 70,
  [RequestStatus.PENDING_ORACLE_CREATION]: 85,
  [RequestStatus.COMPLETED]: 100,
};

function getProgressPercent(request: RequestItem): number {
  if (request.status === RequestStatus.COMPLETED) return 100;
  if (request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION) {
    // Find the last active stage from timestamps
    const stageTimestamps = request.stageTimestamps ?? [];
    for (let i = stageTimestamps.length - 1; i >= 0; i--) {
      const ts = stageTimestamps[i];
      if (ts.status !== RequestStatus.REJECTED && ts.status !== RequestStatus.RETURNED_FOR_CLARIFICATION) {
        return PROGRESS_MAP[ts.status] ?? 10;
      }
    }
    return 10;
  }
  return PROGRESS_MAP[request.status] ?? 10;
}

function getProgressColor(percent: number): string {
  if (percent === 100) return 'bg-emerald-500 dark:bg-emerald-400';
  if (percent >= 70) return 'bg-blue-500 dark:bg-blue-400';
  if (percent >= 40) return 'bg-indigo-500 dark:bg-indigo-400';
  return 'bg-slate-400 dark:bg-slate-500';
}

function getStatusColor(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.COMPLETED:
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/20';
    case RequestStatus.REJECTED:
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-500/20';
    case RequestStatus.RETURNED_FOR_CLARIFICATION:
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-500/20';
    case RequestStatus.PENDING_APPROVAL:
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/10 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-500/20';
    case RequestStatus.SUBMITTED_TO_POC:
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-500/20';
    case RequestStatus.UNDER_SPECIALIST_REVIEW:
      return 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/10 dark:bg-violet-950 dark:text-violet-400 dark:ring-violet-500/20';
    case RequestStatus.UNDER_TECHNICAL_VALIDATION:
      return 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/10 dark:bg-cyan-950 dark:text-cyan-400 dark:ring-cyan-500/20';
    case RequestStatus.PENDING_ORACLE_CREATION:
      return 'bg-teal-50 text-teal-700 ring-1 ring-teal-600/10 dark:bg-teal-950 dark:text-teal-400 dark:ring-teal-500/20';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/20';
  }
}

function getPriorityBadge(priorityId: string, priorities: { id: string; name: string }[]): { name: string; className: string } {
  const p = priorities.find(pr => pr.id === priorityId);
  if (!p) return { name: 'Unknown', className: 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-400' };
  const ln = p.name.toLowerCase();
  if (ln.includes('critical')) return { name: p.name, className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10 dark:bg-rose-950 dark:text-rose-400' };
  if (ln.includes('urgent')) return { name: p.name, className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 dark:bg-amber-950 dark:text-amber-400' };
  return { name: p.name, className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10 dark:bg-blue-950 dark:text-blue-400' };
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type FilterTab = 'all' | 'active' | 'completed' | 'needs_action';

const ACTIVE_STATUSES = new Set<RequestStatus>([
  RequestStatus.DRAFT,
  RequestStatus.PENDING_APPROVAL,
  RequestStatus.SUBMITTED_TO_POC,
  RequestStatus.ASSIGNED,
  RequestStatus.UNDER_SPECIALIST_REVIEW,
  RequestStatus.UNDER_TECHNICAL_VALIDATION,
  RequestStatus.PENDING_ORACLE_CREATION,
]);

const NEEDS_ACTION_STATUSES = new Set<RequestStatus>([
  RequestStatus.RETURNED_FOR_CLARIFICATION,
  RequestStatus.REJECTED,
]);

const IN_PROGRESS_STATUSES = new Set<RequestStatus>([
  RequestStatus.PENDING_APPROVAL,
  RequestStatus.SUBMITTED_TO_POC,
  RequestStatus.ASSIGNED,
  RequestStatus.UNDER_SPECIALIST_REVIEW,
  RequestStatus.UNDER_TECHNICAL_VALIDATION,
  RequestStatus.PENDING_ORACLE_CREATION,
]);

// --- Component ---

export const MyRequests: React.FC = () => {
  const navigate = useNavigate();
  const requests = useRequestStore((s) => s.requests);
  const currentUser = useUserStore((s) => s.currentUser);
  const priorities = useAdminStore((s) => s.priorities);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Only requests belonging to the current user
  const myRequests = useMemo(
    () => requests.filter((r) => r.requesterId === currentUser.id),
    [requests, currentUser.id],
  );

  // Summary counts
  const summary = useMemo(() => {
    let total = 0;
    let inProgress = 0;
    let completed = 0;
    let needsAction = 0;

    for (const r of myRequests) {
      total++;
      if (r.status === RequestStatus.COMPLETED) completed++;
      else if (NEEDS_ACTION_STATUSES.has(r.status)) needsAction++;
      if (IN_PROGRESS_STATUSES.has(r.status)) inProgress++;
    }

    return { total, inProgress, completed, needsAction };
  }, [myRequests]);

  // Filtered + searched requests
  const filteredRequests = useMemo(() => {
    let list = myRequests;

    // Tab filter
    if (activeTab === 'active') {
      list = list.filter((r) => ACTIVE_STATUSES.has(r.status));
    } else if (activeTab === 'completed') {
      list = list.filter((r) => r.status === RequestStatus.COMPLETED);
    } else if (activeTab === 'needs_action') {
      list = list.filter((r) => NEEDS_ACTION_STATUSES.has(r.status));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }

    // Sort newest first
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myRequests, activeTab, searchQuery]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: myRequests.length },
    { key: 'active', label: 'Active', count: summary.inProgress + myRequests.filter(r => r.status === RequestStatus.DRAFT).length },
    { key: 'completed', label: 'Completed', count: summary.completed },
    { key: 'needs_action', label: 'Needs Action', count: summary.needsAction },
  ];

  // --- Render ---

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">My Requests</h1>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {myRequests.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/requests/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          <PlusCircle size={18} strokeWidth={1.75} />
          New Request
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<FileText size={20} strokeWidth={1.75} />}
          iconBg="bg-blue-100 dark:bg-blue-900/50"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Total Submitted"
          value={summary.total}
        />
        <SummaryCard
          icon={<TrendingUp size={20} strokeWidth={1.75} />}
          iconBg="bg-indigo-100 dark:bg-indigo-900/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
          label="In Progress"
          value={summary.inProgress}
        />
        <SummaryCard
          icon={<CheckCircle size={20} strokeWidth={1.75} />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Completed"
          value={summary.completed}
        />
        <SummaryCard
          icon={<AlertCircle size={20} strokeWidth={1.75} />}
          iconBg="bg-amber-100 dark:bg-amber-900/50"
          iconColor="text-amber-600 dark:text-amber-400"
          label="Needs Your Action"
          value={summary.needsAction}
        />
      </div>

      {/* Filters: Search + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, ID, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Request Cards or Empty State */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          hasAnyRequests={myRequests.length > 0}
          onCreateFirst={() => navigate('/requests/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              priorities={priorities}
              onViewDetails={() => navigate(`/requests/${req.id}`)}
              onModify={() => navigate(`/requests/${req.id}/edit`)}
              onClone={() => navigate('/requests/new')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Sub-components ---

interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, iconBg, iconColor, label, value }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium dark:shadow-none border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-4 transition-colors">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  </div>
);

interface RequestCardProps {
  request: RequestItem;
  priorities: { id: string; name: string; slaHours?: number }[];
  onViewDetails: () => void;
  onModify: () => void;
  onClone: () => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, priorities, onViewDetails, onModify, onClone }) => {
  const progress = getProgressPercent(request);
  const progressColor = getProgressColor(progress);
  const statusClasses = getStatusColor(request.status);
  const priority = getPriorityBadge(request.priorityId, priorities);
  const canModify = request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION;

  // SLA estimated completion
  const slaInfo = useMemo(() => {
    const p = priorities.find(pr => pr.id === request.priorityId);
    if (!p?.slaHours) return null;
    if (request.status === RequestStatus.COMPLETED || request.status === RequestStatus.REJECTED) return null;
    const deadline = getSLADeadline(request.createdAt, p.slaHours);
    const now = new Date();
    const isOverdue = deadline.getTime() < now.getTime();
    return { deadline, isOverdue };
  }, [request, priorities]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium dark:shadow-none border border-slate-100 dark:border-slate-700 hover:shadow-lg dark:hover:border-slate-600 transition-all duration-200 flex flex-col">
      {/* Card Header */}
      <div className="p-4 pb-3 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-sm font-semibold text-slate-800 dark:text-white leading-snug line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={onViewDetails}
            title={request.title}
          >
            {request.title}
          </h3>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap mt-0.5">
            {request.id.slice(0, 8)}
          </span>
        </div>

        {/* Status + Priority badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusClasses}`}>
            {request.status}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${priority.className}`}>
            {priority.name}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Progress</span>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock size={12} strokeWidth={1.75} />
            <span>Created {formatRelativeDate(request.createdAt)}</span>
            <span className="text-slate-300 dark:text-slate-600 mx-0.5">&middot;</span>
            <span>{formatDate(request.createdAt)}</span>
          </div>
          {slaInfo && (
            <div className={`flex items-center gap-1.5 text-[11px] ${slaInfo.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {slaInfo.isOverdue ? (
                <AlertCircle size={12} strokeWidth={1.75} />
              ) : (
                <ArrowRight size={12} strokeWidth={1.75} />
              )}
              <span>
                {slaInfo.isOverdue ? 'Overdue — was due ' : 'Est. completion: '}
                {slaInfo.deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5 flex items-center gap-2">
        <button
          onClick={onViewDetails}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
        >
          <Eye size={13} strokeWidth={1.75} />
          View Details
        </button>
        {canModify && (
          <button
            onClick={onModify}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
          >
            <Edit3 size={13} strokeWidth={1.75} />
            Modify & Resubmit
          </button>
        )}
        <button
          onClick={onClone}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ml-auto"
          title="Clone this request"
        >
          <Copy size={13} strokeWidth={1.75} />
          Clone
        </button>
      </div>
    </div>
  );
};

interface EmptyStateProps {
  hasAnyRequests: boolean;
  onCreateFirst: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasAnyRequests, onCreateFirst }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4">
    <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
      <Inbox size={36} strokeWidth={1.25} className="text-slate-400 dark:text-slate-500" />
    </div>
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
      {hasAnyRequests ? 'No matching requests' : 'No requests yet'}
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-6">
      {hasAnyRequests
        ? 'Try adjusting your search or filter criteria to find what you are looking for.'
        : 'You have not submitted any requests yet. Create your first request to get started with the governance workflow.'}
    </p>
    {!hasAnyRequests && (
      <button
        onClick={onCreateFirst}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
      >
        <PlusCircle size={18} strokeWidth={1.75} />
        Create Your First Request
      </button>
    )}
  </div>
);
