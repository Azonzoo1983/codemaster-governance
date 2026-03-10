import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Send,
  Trash2,
  Flag,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useRequestStore, useUserStore, useAdminStore } from '../stores';
import { RequestStatus, Role, hasRole } from '../types';

// ────────────────── Bulk Submit Modal ──────────────────
interface BulkSubmitModalProps {
  selectedIds: string[];
  onClose: () => void;
  onSubmit: (priorityId: string, managerId: string, reason: string) => void;
  submitting: boolean;
}

const BulkSubmitModal: React.FC<BulkSubmitModalProps> = ({
  selectedIds,
  onClose,
  onSubmit,
  submitting,
}) => {
  const priorities = useAdminStore((s) => s.priorities);
  const users = useUserStore((s) => s.users);

  const managers = useMemo(
    () => users.filter((u) => u.role === Role.MANAGER || hasRole(u, Role.MANAGER)),
    [users]
  );

  const activePriorities = useMemo(
    () =>
      [...priorities]
        .filter((p) => p.active)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [priorities]
  );

  const [priorityId, setPriorityId] = useState(
    activePriorities.find((p) => p.name === 'Normal')?.id || activePriorities[0]?.id || ''
  );
  const [managerId, setManagerId] = useState('');
  const [reason, setReason] = useState('');

  const selectedPriority = activePriorities.find((p) => p.id === priorityId);
  const isUrgent = selectedPriority && selectedPriority.requiresApproval;

  const canSubmit = priorityId && reason.trim().length > 0 && (!isUrgent || managerId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Send className="text-blue-600 dark:text-blue-400" size={22} />
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Submit {selectedIds.length} Request{selectedIds.length > 1 ? 's' : ''}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All selected items will share the same settings
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              value={priorityId}
              onChange={(e) => setPriorityId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition"
            >
              {activePriorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.requiresApproval ? '(Requires Manager Approval)' : ''}
                </option>
              ))}
            </select>
            {selectedPriority?.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                {selectedPriority.description}
              </p>
            )}
          </div>

          {/* Manager — shown when priority requires approval */}
          {isUrgent && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Manager <span className="text-red-500">*</span>
              </label>
              {managers.length > 0 ? (
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition"
                >
                  <option value="">Select manager...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.department}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No managers found. Ask an admin to add manager users.
                </p>
              )}
            </div>
          )}

          {/* Reason / Justification */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {isUrgent ? 'Urgency Justification' : 'Submission Reason'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                isUrgent
                  ? 'Explain why these requests need urgent processing...'
                  : 'Brief reason for this batch submission...'
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Urgent warning banner */}
          {isUrgent && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <Flag size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Urgent requests will be sent to the selected manager for approval before reaching the coding team.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(priorityId, managerId, reason)}
            disabled={!canSubmit || submitting}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                {isUrgent ? 'Submit as Urgent' : 'Submit to Coding Team'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────── Draft Manager Page ──────────────────
export const DraftManager: React.FC = () => {
  const navigate = useNavigate();
  const requests = useRequestStore((s) => s.requests);
  const updateRequestStatus = useRequestStore((s) => s.updateRequestStatus);
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const currentUser = useUserStore((s) => s.currentUser);
  const users = useUserStore((s) => s.users);
  const priorities = useAdminStore((s) => s.priorities);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sortField, setSortField] = useState<'title' | 'classification' | 'project' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter drafts belonging to current user
  const drafts = useMemo(
    () =>
      requests
        .filter((r) => r.status === RequestStatus.DRAFT && r.requesterId === currentUser.id)
        .sort((a, b) => {
          const aVal = a[sortField] || '';
          const bVal = b[sortField] || '';
          const cmp = String(aVal).localeCompare(String(bVal));
          return sortDir === 'asc' ? cmp : -cmp;
        }),
    [requests, currentUser.id, sortField, sortDir]
  );

  const allSelected = drafts.length > 0 && selectedIds.size === drafts.length;
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon: React.FC<{ field: typeof sortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // Delete a single draft
  const handleDelete = (id: string) => {
    updateRequestStatus(id, RequestStatus.CANCELLED, 'Draft deleted by requester');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleteConfirmId(null);
  };

  // Bulk delete selected drafts
  const handleBulkDelete = () => {
    selectedIds.forEach((id) => {
      updateRequestStatus(id, RequestStatus.CANCELLED, 'Draft deleted by requester (bulk)');
    });
    setSelectedIds(new Set());
  };

  // Bulk submit
  const handleBulkSubmit = async (priorityId: string, managerId: string, reason: string) => {
    setSubmitting(true);

    const selectedPriority = priorities.find((p) => p.id === priorityId);
    const isUrgent = selectedPriority?.requiresApproval;
    const manager = managerId ? users.find((u) => u.id === managerId) : null;

    const targetStatus = isUrgent ? RequestStatus.PENDING_APPROVAL : RequestStatus.SUBMITTED_TO_POC;

    for (const id of Array.from(selectedIds)) {
      // First update fields (priority, manager, justification)
      const fieldUpdates: Partial<typeof requests[0]> = {
        priorityId,
        justification: reason,
      };
      if (manager) {
        fieldUpdates.managerId = manager.id;
        fieldUpdates.managerName = manager.name;
        fieldUpdates.managerEmail = manager.email;
      }
      updateRequest(id, fieldUpdates, 'Bulk submit — fields updated');

      // Then transition status
      updateRequestStatus(
        id,
        targetStatus,
        isUrgent
          ? `Bulk submitted as urgent to manager ${manager?.name || ''}. Reason: ${reason}`
          : `Bulk submitted to coding team. Reason: ${reason}`
      );

      // Small delay to not overwhelm
      await new Promise((r) => setTimeout(r, 80));
    }

    setSubmitting(false);
    setShowModal(false);
    setSelectedIds(new Set());
  };

  const getPriorityName = (id: string) => priorities.find((p) => p.id === id)?.name || '—';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText size={24} className="text-blue-600 dark:text-blue-400" />
            My Drafts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review imported requests, flag urgent ones, and submit them in bulk.
          </p>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">
          {drafts.length} draft{drafts.length !== 1 ? 's' : ''} pending
        </div>
      </div>

      {/* Empty State */}
      {drafts.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No drafts yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Use the <strong>Bulk Upload</strong> feature on the Dashboard to import requests. They'll appear here as drafts.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* Table */}
      {drafts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Bulk Action Bar */}
          {someSelected && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Trash2 size={13} /> Delete Selected
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Send size={13} /> Submit Selected
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-blue-600 transition" aria-label="Select all">
                      {allSelected ? (
                        <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('title')}
                  >
                    <span className="flex items-center gap-1">Title <SortIcon field="title" /></span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('classification')}
                  >
                    <span className="flex items-center gap-1">Classification <SortIcon field="classification" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Sub-Type
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort('project')}
                  >
                    <span className="flex items-center gap-1">Project <SortIcon field="project" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    UOM
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {drafts.map((d) => (
                  <tr
                    key={d.id}
                    className={`transition-colors ${
                      selectedIds.has(d.id)
                        ? 'bg-blue-50/60 dark:bg-blue-900/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleOne(d.id)} className="text-slate-400 hover:text-blue-600 transition" aria-label={`Select ${d.title}`}>
                        {selectedIds.has(d.id) ? (
                          <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/requests/${d.id}`)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-left"
                      >
                        {d.title}
                      </button>
                      <div className="text-[11px] text-slate-400 mt-0.5">{d.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.classification === 'Item'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {d.classification}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {d.materialSubType || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{d.project || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        d.requestType === 'Amendment'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {d.requestType || 'New'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{d.uom || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirmId === d.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded transition"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(d.id)}
                          className="text-slate-400 hover:text-red-500 transition p-1"
                          aria-label={`Delete draft ${d.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Modal */}
      {showModal && (
        <BulkSubmitModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowModal(false)}
          onSubmit={handleBulkSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
};
