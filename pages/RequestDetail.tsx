import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequestStore, useUserStore, useAdminStore, useToastStore } from '../stores';
import { RequestStatus, Role, Classification, ClarificationComment, hasRole } from '../types';
import { DynamicForm } from '../components/DynamicForm';
import { calculateBusinessHours, formatBusinessHours } from '../lib/businessHours';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, AlertTriangle, FileCheck, Mail, Edit3, RotateCcw, CornerUpLeft, Paperclip, Download, User as UserIcon, MessageSquare, Send, Clock, RefreshCw, FileDown, Eye, Info, ListChecks, Ban } from 'lucide-react';
import { exportRequestPdf } from '../lib/exportRequestPdf';
import { SLACountdown } from '../components/SLACountdown';
import { RequestTimeline } from '../components/RequestTimeline';
import { AttachmentThumbnail } from '../components/AttachmentThumbnail';

export const RequestDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const requests = useRequestStore((s) => s.requests);
  const currentUser = useUserStore((s) => s.currentUser);
  const updateRequestStatus = useRequestStore((s) => s.updateRequestStatus);
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const users = useUserStore((s) => s.users);
  const priorities = useAdminStore((s) => s.priorities);
  const attributes = useAdminStore((s) => s.attributes);
  const addToast = useToastStore((s) => s.addToast);
  const request = requests.find(r => r.id === id);

  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [oracleCode, setOracleCode] = useState('');
  const [finalDesc, setFinalDesc] = useState('');
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [editableUom, setEditableUom] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [shortDesc, setShortDesc] = useState(request?.shortDescription || request?.generatedDescription?.slice(0, 240) || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const commonUomValues = ['Each', 'Meter', 'Kilogram', 'Liter', 'Piece', 'Set', 'Box', 'Roll', 'Pair', 'Pack', 'Sheet', 'Ton', 'Bag', 'Drum', 'Bundle', 'Feet', 'Inches', 'mm', 'cm', 'm'];

  useEffect(() => {
    if (request) {
      setFinalDesc(request.finalDescription || request.generatedDescription || '');
      setEditableUom(request.uom || '');
      setShortDesc(request.shortDescription || request.generatedDescription?.slice(0, 240) || '');
    }
  }, [request]);

  // Auto-scroll to bottom when clarification thread changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [requests.find(r => r.id === id)?.clarificationThread?.length]);

  // Format relative timestamps
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return then.toLocaleDateString();
  };

  // Check if two messages should be grouped (same user, within 2 minutes)
  const shouldGroupMessages = (a: ClarificationComment, b: ClarificationComment): boolean => {
    if (a.userId !== b.userId) return false;
    const diff = Math.abs(new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return diff < 2 * 60 * 1000; // 2 minutes
  };

  // Render message content with @mention highlighting
  const renderMessageWithMentions = (text: string): React.ReactNode => {
    const parts = text.split(/(@\w[\w\s]*?\w(?=\s|$|@)|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1 rounded font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Handle chat textarea changes with @mention detection
  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setClarificationMessage(val);
    setMentionCursorPos(cursorPos);

    // Detect @mention trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }

    // Auto-grow textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 4;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  // Insert @mention into textarea
  const insertMention = (userName: string) => {
    const textBeforeCursor = clarificationMessage.slice(0, mentionCursorPos);
    const textAfterCursor = clarificationMessage.slice(mentionCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, atIndex) + `@${userName} ` + textAfterCursor;
    setClarificationMessage(newText);
    setShowMentions(false);
    setMentionQuery('');
    chatTextareaRef.current?.focus();
  };

  // Filtered users for @mention dropdown
  const mentionUsers = users.filter(u =>
    u.name.toLowerCase().includes(mentionQuery) && u.id !== currentUser.id
  ).slice(0, 5);

  if (!request) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Request not found</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">The request may have been deleted or the ID is invalid.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm">Back to Dashboard</button>
      </div>
    );
  }

  const priority = priorities.find(p => p.id === request.priorityId);
  const assignedSpecialist = users.find(u => u.id === request.assignedSpecialistId);

  // SLA calculation (business hours)
  const getSLAInfo = () => {
    if (!priority?.slaHours) return null;
    const elapsed = calculateBusinessHours(request.createdAt, new Date());
    const remaining = priority.slaHours - elapsed;
    const ratio = elapsed / priority.slaHours;
    return {
      elapsed: Math.round(elapsed * 10) / 10,
      remaining: Math.round(remaining * 10) / 10,
      ratio,
      breached: ratio >= 1,
      elapsedFormatted: formatBusinessHours(elapsed),
      remainingFormatted: remaining > 0 ? formatBusinessHours(remaining) : 'Overdue',
    };
  };
  const slaInfo = getSLAInfo();

  // Manager validation
  const isRequestManager = currentUser.role === Role.MANAGER && (
    request.managerId === currentUser.id ||
    request.managerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    (!request.managerId && !request.managerEmail)
  );


  // Feature #15: Helper to get the most recent specialist remark from history when returned
  // History is stored newest-first, so [0] is the most recent entry
  const getSpecialistReturnRemarks = () => {
    if (!request.history || request.history.length === 0) return null;
    const returnEntries = request.history.filter(h =>
      h.action.toLowerCase().includes('returned') || h.action.toLowerCase().includes('return')
    );
    if (returnEntries.length === 0) return null;
    return returnEntries[0]; // newest-first: [0] is the most recent return remark
  };

  // Feature #22: Comprehensive Summary Panel for Tech Reviewer & Oracle Creation
  const renderComprehensiveSummary = () => (
    <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 mb-3">
      <h4 className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5 tracking-wide">
        <ListChecks size={14} /> Request Summary
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {request.unspscCode && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">UNSPSC Commodity Code</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{request.unspscCode}</p>
          </div>
        )}
        {request.generatedDescription && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-700/60 sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">Auto-Generated Description</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 text-xs">{request.generatedDescription}</p>
          </div>
        )}
        {request.existingCode && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">Item Code (Amendment)</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{request.existingCode}</p>
          </div>
        )}
        {(request.finalDescription || finalDesc) && (
          <div className={`bg-white dark:bg-slate-800 rounded-lg p-2.5 sm:col-span-2 ${
            request.specialistDescription && request.finalDescription && request.specialistDescription !== request.finalDescription
              ? 'border border-amber-300/60 dark:border-amber-600/60 bg-amber-50 dark:bg-amber-950/30'
              : 'border border-emerald-200/60 dark:border-emerald-700/60'
          }`}>
            <span className={`text-[10px] uppercase font-bold tracking-wide ${
              request.specialistDescription && request.finalDescription && request.specialistDescription !== request.finalDescription
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>Final Description {request.specialistDescription && request.finalDescription && request.specialistDescription !== request.finalDescription ? '(Amended)' : ''}</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 text-xs">{request.finalDescription || finalDesc}</p>
          </div>
        )}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-700/60">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">UOM</span>
          <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{request.uom || editableUom || '-'}</p>
        </div>
      </div>
    </div>
  );

  // Workflow Action Handlers
  const handleManagerApprove = () => {
    updateRequestStatus(request.id, RequestStatus.SUBMITTED_TO_POC, comment || 'Approved by Manager');
  };

  const handlePOCAssign = () => {
    if (!assigneeId) {
      addToast('Please select a specialist before assigning.', 'warning');
      return;
    }
    const specialist = users.find(u => u.id === assigneeId);
    updateRequestStatus(request.id, RequestStatus.ASSIGNED, comment || `Assigned to ${specialist?.name}`, { assignedSpecialistId: assigneeId });
  };

  const handleReassign = () => {
    if (!reassignId) {
      addToast('Please select a specialist.', 'warning');
      return;
    }
    const specialist = users.find(u => u.id === reassignId);
    updateRequest(request.id, { assignedSpecialistId: reassignId }, `Reassigned to ${specialist?.name}`);
    setShowReassign(false);
    setReassignId('');
  };

  // Feature #13: Updated to require technical reviewer selection & Feature #20: include UOM
  const handleSpecialistReview = () => {
    if (!finalDesc.trim()) {
      addToast('A description is required before sending for validation.', 'warning');
      return;
    }
    if (!selectedReviewerId) {
      addToast('Please select a technical reviewer.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.UNDER_TECHNICAL_VALIDATION, comment || 'Sent for technical validation', { finalDescription: finalDesc, technicalReviewerId: selectedReviewerId, uom: editableUom, specialistDescription: finalDesc || request.generatedDescription, shortDescription: shortDesc });
  };

  const handleTechValidation = () => {
    if (!finalDesc.trim()) {
      addToast('Final description cannot be empty.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.PENDING_ORACLE_CREATION, comment || 'Description validated', { finalDescription: finalDesc });
  };

  const handleCreateCode = () => {
    if (!oracleCode.trim()) {
      addToast('Please enter the Oracle Code before completing.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.COMPLETED, comment || 'Oracle code created', { oracleCode: oracleCode.trim(), finalDescription: request.finalDescription || request.generatedDescription });
  };

  // Feature #19: Amend & Return to Technical Review handler
  const handleAmendAndReturn = () => {
    if (!finalDesc.trim()) {
      addToast('Final description cannot be empty for amendment.', 'warning');
      return;
    }
    updateRequestStatus(
      request.id,
      RequestStatus.UNDER_TECHNICAL_VALIDATION,
      comment || 'Description amended by coding team, sent back for technical review',
      { finalDescription: finalDesc, uom: editableUom }
    );
    addToast('Request amended and returned to technical review.', 'success');
  };

  const handleReject = () => {
    if (!comment.trim()) {
      addToast('A comment is required for rejection.', 'warning');
      return;
    }
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    updateRequestStatus(request.id, RequestStatus.REJECTED, comment, { rejectionReason: comment });
    setConfirmReject(false);
  };

  const handleReturn = () => {
    if (!comment.trim()) {
      addToast('A comment is required when returning a request.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.RETURNED_FOR_CLARIFICATION, comment);
  };

  const handleAddClarification = () => {
    if (!clarificationMessage.trim() || isSendingChat) return;
    setIsSendingChat(true);
    const newComment: ClarificationComment = {
      id: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
      userId: currentUser.id,
      userName: currentUser.name,
      message: clarificationMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedThread = [...(request.clarificationThread || []), newComment];
    updateRequest(request.id, { clarificationThread: updatedThread }, `Added discussion comment`);
    setClarificationMessage('');
    setShowMentions(false);
    // Reset textarea height
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }
    // Simulate brief sending delay for UX feedback
    setTimeout(() => setIsSendingChat(false), 300);
  };

  const handleCancelRequest = () => {
    if (!cancellationReason.trim()) {
      addToast('Please provide a reason for cancellation.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.CANCELLED, cancellationReason, {
      cancelledAt: new Date().toISOString(),
      cancelledBy: currentUser.id,
      cancellationReason: cancellationReason,
    });
    setShowCancelModal(false);
    setCancellationReason('');
  };

  const renderActions = () => {
    // Requester Actions
    if (currentUser.id === request.requesterId && (request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION)) {
      const returnRemarks = getSpecialistReturnRemarks();
      return (
        <div className="space-y-3">
          {/* Feature #15: Specialist Remarks Visible to Requesters */}
          {request.status === RequestStatus.RETURNED_FOR_CLARIFICATION && (
            <>
              {returnRemarks && returnRemarks.details && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200/60 dark:border-amber-700/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Specialist Remarks</span>
                  </div>
                  <p className="text-sm text-amber-900 dark:text-amber-300">&ldquo;{returnRemarks.details}&rdquo;</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    &mdash; {returnRemarks.user}, {new Date(returnRemarks.timestamp).toLocaleString()}
                  </p>
                </div>
              )}
              {request.rejectionReason && (!returnRemarks || !returnRemarks.details) && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200/60 dark:border-amber-700/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Specialist Remarks</span>
                  </div>
                  <p className="text-sm text-amber-900 dark:text-amber-300">&ldquo;{request.rejectionReason}&rdquo;</p>
                </div>
              )}
              {request.clarificationThread && request.clarificationThread.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/50 border border-amber-200/40 dark:border-amber-700/40 rounded-xl p-3">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide">Latest Clarification Comments</span>
                  <div className="mt-1 space-y-1">
                    {request.clarificationThread.slice(-3).map(c => (
                      <p key={c.id} className="text-xs text-amber-800 dark:text-amber-400">
                        <span className="font-medium">{c.userName}:</span> {c.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => navigate(`/requests/${request.id}/edit`)} aria-label={`Modify and resubmit request ${request.title}`} className="btn-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <RotateCcw size={16} strokeWidth={1.75} /> Modify & Resubmit
            </button>
          </div>
        </div>
      );
    }

    // Manager Actions
    if (isRequestManager && request.status === RequestStatus.PENDING_APPROVAL) {
      return (
        <div className="flex flex-wrap gap-2">
          <button onClick={handleManagerApprove} aria-label={`Approve request ${request.title}`} className="btn-success text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
            <CheckCircle size={16} strokeWidth={1.75} /> Approve
          </button>
          <button onClick={handleReturn} aria-label={`Return request ${request.title} for clarification`} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 dark:hover:bg-amber-500 transition">
            <CornerUpLeft size={16} strokeWidth={1.75} /> Return
          </button>
          <button onClick={handleReject} aria-label={`Reject request ${request.title}`} className={`${confirmReject ? 'bg-rose-800' : 'bg-rose-600'} text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-rose-700 dark:hover:bg-rose-500 transition`}>
            <XCircle size={16} strokeWidth={1.75} /> {confirmReject ? 'Confirm Reject' : 'Reject'}
          </button>
        </div>
      );
    }

    // POC Actions
    if (currentUser.role === Role.POC && request.status === RequestStatus.SUBMITTED_TO_POC) {
      const specialists = users.filter(u => u.role === Role.SPECIALIST);
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <select aria-label="Select specialist to assign" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">Select Specialist...</option>
            {specialists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handlePOCAssign} aria-label={`Assign request ${request.title} to specialist`} className="btn-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
            <UserPlus size={16} strokeWidth={1.75} /> Assign
          </button>
        </div>
      );
    }

    // POC Reassignment
    if (currentUser.role === Role.POC && request.status === RequestStatus.ASSIGNED) {
      const specialists = users.filter(u => u.role === Role.SPECIALIST);
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">Currently assigned to <strong>{assignedSpecialist?.name}</strong></p>
          {!showReassign ? (
            <button onClick={() => setShowReassign(true)} aria-label={`Reassign request ${request.title}`} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 dark:hover:bg-amber-500 transition text-sm">
              <RefreshCw size={14} strokeWidth={1.75} /> Reassign
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <select aria-label="Select new specialist for reassignment" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200" value={reassignId} onChange={e => setReassignId(e.target.value)}>
                <option value="">Select New Specialist...</option>
                {specialists.filter(s => s.id !== request.assignedSpecialistId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleReassign} aria-label="Confirm specialist reassignment" className="btn-primary text-white px-3 py-2 rounded-lg text-sm transition">Confirm</button>
              <button onClick={() => setShowReassign(false)} className="text-slate-500 dark:text-slate-400 text-sm hover:text-slate-700 dark:hover:text-slate-300 transition">Cancel</button>
            </div>
          )}
        </div>
      );
    }

    // Specialist Actions
    if (currentUser.role === Role.SPECIALIST && request.assignedSpecialistId === currentUser.id && request.status === RequestStatus.ASSIGNED) {
      return (
        <button onClick={() => updateRequestStatus(request.id, RequestStatus.UNDER_SPECIALIST_REVIEW, 'Started review')} aria-label={`Start review of request ${request.title}`} className="btn-primary text-white px-4 py-2 rounded-lg transition">
          Start Review
        </button>
      );
    }

    if (currentUser.role === Role.SPECIALIST && request.assignedSpecialistId === currentUser.id && request.status === RequestStatus.UNDER_SPECIALIST_REVIEW) {
      const technicalReviewers = users.filter(u => u.role === Role.TECHNICAL_REVIEWER);
      return (
        <div className="space-y-3">
          {/* Feature #20: UOM Editable by Coding Team */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Unit of Measure (UOM)</label>
            <input
              type="text"
              list="uom-options"
              aria-label="Edit unit of measure"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200"
              value={editableUom}
              onChange={e => setEditableUom(e.target.value)}
              placeholder="Select or type UOM..."
            />
            <datalist id="uom-options">
              {commonUomValues.map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Draft Final Description</label>
            <textarea aria-label="Draft final description" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm font-mono focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200" rows={2} value={finalDesc} onChange={e => setFinalDesc(e.target.value)} placeholder="Edit the auto-generated description if needed..." />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Short Description (240 chars max)</label>
            <input
              type="text"
              maxLength={240}
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Short description for Oracle..."
            />
            <div className="text-xs text-slate-400 text-right mt-1">{shortDesc.length}/240</div>
          </div>
          {/* Feature #13: Technical Reviewer Selection Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Technical Reviewer</label>
            <select
              aria-label="Select technical reviewer"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200"
              value={selectedReviewerId}
              onChange={e => setSelectedReviewerId(e.target.value)}
            >
              <option value="">Select Technical Reviewer...</option>
              {technicalReviewers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSpecialistReview} aria-label={`Send request ${request.title} for technical validation`} className="btn-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition">
              <CheckCircle size={14} strokeWidth={1.75} /> Send for Technical Validation
            </button>
            <button onClick={handleReturn} aria-label={`Return request ${request.title} for clarification`} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-amber-700 dark:hover:bg-amber-500 transition">
              <CornerUpLeft size={14} strokeWidth={1.75} /> Return for Clarification
            </button>
            <button onClick={handleReject} aria-label={`Reject request ${request.title}`} className={`${confirmReject ? 'bg-rose-800' : 'bg-rose-600'} text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-rose-700 dark:hover:bg-rose-500 transition`}>
              <XCircle size={14} strokeWidth={1.75} /> {confirmReject ? 'Confirm Reject' : 'Reject'}
            </button>
          </div>
        </div>
      );
    }

    // Specialist Code Creation (PENDING_ORACLE_CREATION)
    if (currentUser.role === Role.SPECIALIST && request.status === RequestStatus.PENDING_ORACLE_CREATION) {
      return (
        <div className="space-y-3">
          {/* Feature #22: Comprehensive Summary in Oracle Creation */}
          {renderComprehensiveSummary()}
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200/60 dark:border-emerald-700/60 rounded-xl p-3">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1 tracking-wide">Validated Description</p>
            <p className="font-mono text-sm text-emerald-900 dark:text-emerald-300">{request.finalDescription || request.generatedDescription}</p>
          </div>
          {/* Feature #19: Amend Description & Return to Technical Review */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amend Final Description (optional)</label>
            <textarea
              aria-label="Amend final description"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm font-mono focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200"
              rows={2}
              value={finalDesc}
              onChange={e => setFinalDesc(e.target.value)}
              placeholder="Edit the validated description if amendment is needed..."
            />
          </div>
          {/* Feature #20: UOM editable in Oracle Creation */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Unit of Measure (UOM)</label>
            <input
              type="text"
              list="uom-options-oracle"
              aria-label="Edit unit of measure"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200"
              value={editableUom}
              onChange={e => setEditableUom(e.target.value)}
              placeholder="Select or type UOM..."
            />
            <datalist id="uom-options-oracle">
              {commonUomValues.map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Enter Oracle Code..." aria-label="Enter Oracle code" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 flex-1 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200" value={oracleCode} onChange={e => setOracleCode(e.target.value)} />
            <button onClick={handleCreateCode} aria-label={`Complete request ${request.title} with Oracle code`} className="btn-success text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm">
              <FileCheck size={14} strokeWidth={1.75} /> Complete
            </button>
          </div>
          {/* Feature #19: Amend & Return to Technical Review button */}
          <div className="flex gap-2 items-center border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
            <button
              onClick={handleAmendAndReturn}
              aria-label="Amend description and return to technical review"
              className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 dark:hover:bg-amber-500 transition text-sm"
            >
              <CornerUpLeft size={14} strokeWidth={1.75} /> Amend & Return to Technical Review
            </button>
          </div>
        </div>
      );
    }

    // Tech Reviewer Actions (UNDER_TECHNICAL_VALIDATION)
    if (currentUser.role === Role.TECHNICAL_REVIEWER && request.status === RequestStatus.UNDER_TECHNICAL_VALIDATION) {
      return (
        <div className="space-y-3">
          {/* Feature #22: Comprehensive Summary for Tech Reviewer */}
          {renderComprehensiveSummary()}
          <div>
            <label className="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1"><Edit3 size={12} /> Final Description (Editable)</label>
            <textarea aria-label="Final description for validation" className="w-full border border-blue-300 dark:border-blue-600 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700 transition dark:bg-slate-700 dark:text-slate-200" rows={3} value={finalDesc} onChange={e => setFinalDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleTechValidation} aria-label={`Validate description for request ${request.title}`} className="btn-success text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm">
              <CheckCircle size={14} strokeWidth={1.75} /> Validate Description
            </button>
            <button onClick={() => {
              if (!comment.trim()) { addToast('Add a comment explaining what needs correction.', 'warning'); return; }
              updateRequestStatus(request.id, RequestStatus.UNDER_SPECIALIST_REVIEW, comment);
            }} aria-label={`Return request ${request.title} to specialist`} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 dark:hover:bg-amber-500 transition text-sm">
              <CornerUpLeft size={14} strokeWidth={1.75} /> Return to Specialist
            </button>
          </div>
        </div>
      );
    }

    return <p className="text-sm text-slate-500 dark:text-slate-400 italic">No actions available for your role at this stage.</p>;
  };

  const showWorkflowActions = request.status !== RequestStatus.COMPLETED;

  const stageTimestamps = request.stageTimestamps || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} aria-label="Back to dashboard" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"><ArrowLeft size={20} strokeWidth={1.75} className="text-slate-700 dark:text-slate-300" /></button>
        <button
          onClick={() => exportRequestPdf(request, priority, users, attributes)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition shadow-sm"
          aria-label="Download request as PDF"
        >
          <FileDown size={16} /> PDF
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{request.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{request.id} &bull; {request.classification} &bull; {request.requestType || 'New'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SLACountdown request={request} priority={priority} expanded />
          <span role="status" aria-label={`Status: ${request.status}`} className={`badge-refined ring-1 font-bold ${
            request.status === RequestStatus.REJECTED ? 'bg-rose-50 text-rose-800 ring-rose-600/10 dark:bg-rose-950 dark:text-rose-400' :
            request.status === RequestStatus.CANCELLED ? 'bg-slate-100 text-slate-700 ring-slate-400/20 dark:bg-slate-800 dark:text-slate-400' :
            request.status === RequestStatus.RETURNED_FOR_CLARIFICATION ? 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950 dark:text-amber-400' :
            request.status === RequestStatus.COMPLETED ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/10 dark:bg-emerald-950 dark:text-emerald-400' :
            'bg-blue-50 text-blue-800 ring-blue-600/10 dark:bg-blue-950 dark:text-blue-400'
          }`}>
            {request.status}
          </span>
        </div>
      </div>

      {/* Request Timeline */}
      {stageTimestamps.length > 0 && (
        <RequestTimeline stageTimestamps={stageTimestamps} currentStatus={request.status} />
      )}

      {request.status === RequestStatus.CANCELLED && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold mb-1">
            <Ban size={16} /> Request Cancelled
          </div>
          <p className="text-sm text-red-600 dark:text-red-500">
            {request.cancellationReason || 'No reason provided'}
          </p>
          <p className="text-xs text-red-500 dark:text-red-600 mt-1">
            Cancelled on {request.cancelledAt ? new Date(request.cancelledAt).toLocaleString() : 'Unknown date'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {request.requestType === 'Amendment' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">Amendment Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Existing Code:</span>
                  <span className="ml-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{request.existingCode}</span>
                </div>
                {request.existingDescription && (
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">Existing Description:</span>
                    <p className="mt-1 font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600">{request.existingDescription}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Technical Attributes */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">Technical Attributes</h3>
            <DynamicForm
              attributes={attributes.filter(a => a.active && (a.visibleForClassification ? a.visibleForClassification.includes(request.classification) : true))}
              values={request.attributes}
              onChange={() => {}}
              readOnly={true}
            />
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">Auto-Generated Description</span>
              <div className="text-sm font-mono text-slate-600 dark:text-slate-400 mt-1">{request.generatedDescription || '-'}</div>
            </div>
            {request.finalDescription && request.status !== RequestStatus.UNDER_TECHNICAL_VALIDATION && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200/60 dark:border-emerald-700/60">
                <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 tracking-wide"><CheckCircle size={12} /> Final Description</span>
                <div className="text-base font-mono text-emerald-900 dark:text-emerald-300 mt-1">{request.finalDescription}</div>
              </div>
            )}
            {/* Description Comparison */}
            {request.specialistDescription && request.finalDescription &&
             request.specialistDescription !== request.finalDescription && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description Changes</h4>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Original (Specialist)</div>
                  <p className="text-sm text-red-800 dark:text-red-300 font-mono">{request.specialistDescription}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Amended (Final)</div>
                  <p className="text-sm text-green-800 dark:text-green-300 font-mono">{request.finalDescription}</p>
                </div>
              </div>
            )}
            {request.oracleCode && (
              <div className="mt-4 p-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl text-white shadow-lg">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wide">Oracle Code</span>
                <div className="text-2xl font-bold mt-1 tracking-wider">{request.oracleCode}</div>
              </div>
            )}
            {/* Short & Long Descriptions */}
            {(request.shortDescription || request.longDescription) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {request.shortDescription && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Short Description</div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 font-mono">
                      {request.shortDescription}
                    </div>
                    <div className="text-xs text-slate-400 text-right mt-1">{request.shortDescription.length}/240</div>
                  </div>
                )}
                {request.longDescription && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Long Description</div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 font-mono">
                      {request.longDescription}
                    </div>
                    <div className="text-xs text-slate-400 text-right mt-1">{request.longDescription.length}/500</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Discussion Thread */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60" aria-label="Discussion thread" role="log">
            <h3 className="text-sm uppercase font-bold text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2 tracking-wide">
              <MessageSquare size={16} strokeWidth={1.75} /> Discussion Thread
              {request.clarificationThread && request.clarificationThread.length > 0 && (
                <span className="ml-auto text-xs font-normal text-slate-500 dark:text-slate-400">
                  {request.clarificationThread.length} message{request.clarificationThread.length !== 1 ? 's' : ''}
                </span>
              )}
            </h3>

            {/* Chat messages area */}
            <div className="max-h-80 overflow-y-auto mb-4 space-y-1 px-1" role="list" aria-label="Discussion messages">
              {(!request.clarificationThread || request.clarificationThread.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                  <MessageSquare size={32} strokeWidth={1.25} className="mb-2 opacity-50" />
                  <p className="text-sm italic">No messages yet. Start the discussion below.</p>
                </div>
              )}
              {(request.clarificationThread || []).map((c, idx, arr) => {
                const isCurrentUser = c.userId === currentUser.id;
                const isGrouped = idx > 0 && shouldGroupMessages(arr[idx - 1], c);
                const isLastInGroup = idx === arr.length - 1 || !shouldGroupMessages(c, arr[idx + 1]);

                return (
                  <div key={c.id} role="listitem" className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
                    {/* Left avatar for others */}
                    {!isCurrentUser && (
                      <div className="flex-shrink-0 mr-2 self-end">
                        {isLastInGroup ? (
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 uppercase" title={c.userName}>
                            {c.userName.charAt(0)}
                          </div>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                      {/* Show name only for first message in group (others) */}
                      {!isCurrentUser && !isGrouped && (
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5 ml-1">{c.userName}</div>
                      )}
                      <div className={`px-3 py-2 text-sm ${
                        isCurrentUser
                          ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{renderMessageWithMentions(c.message)}</p>
                      </div>
                      {/* Timestamp + seen indicator on last message in group */}
                      {isLastInGroup && (
                        <div className={`flex items-center gap-1 mt-0.5 ${isCurrentUser ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(c.timestamp)}</span>
                          {isCurrentUser && (
                            <Eye size={10} className="text-blue-400 dark:text-blue-500" aria-label="Seen" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right avatar for current user */}
                    {isCurrentUser && (
                      <div className="flex-shrink-0 ml-2 self-end">
                        {isLastInGroup ? (
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase" title={c.userName}>
                            {c.userName.charAt(0)}
                          </div>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input area */}
            <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-3 relative">
              {/* @mention autocomplete dropdown */}
              {showMentions && mentionUsers.length > 0 && (
                <div ref={mentionDropdownRef} className="absolute bottom-full mb-1 left-0 w-64 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-10 overflow-hidden">
                  {mentionUsers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-600 flex items-center gap-2 transition"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(u.name); }}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-500 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-200 uppercase">
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-slate-800 dark:text-slate-200">{u.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    ref={chatTextareaRef}
                    aria-label="Type a message"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-16 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200 resize-none overflow-hidden"
                    placeholder="Type a message... (@ to mention)"
                    value={clarificationMessage}
                    onChange={handleChatInputChange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddClarification();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    disabled={isSendingChat}
                    style={{ minHeight: '40px' }}
                  />
                  <span className="absolute right-2 bottom-1.5 text-[10px] text-slate-400 dark:text-slate-500 pointer-events-none">
                    {clarificationMessage.length}/1000
                  </span>
                </div>
                <button
                  onClick={handleAddClarification}
                  disabled={!clarificationMessage.trim() || isSendingChat}
                  aria-label="Send message"
                  className="bg-blue-600 text-white p-2.5 rounded-lg flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send size={16} strokeWidth={1.75} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>

          {/* Workflow Actions */}
          {showWorkflowActions && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-blue-100/60 dark:border-blue-700/60 ring-1 ring-blue-50 dark:ring-blue-900/30">
              <h3 className="text-sm uppercase font-bold text-blue-800 dark:text-blue-400 mb-4 tracking-wide">Workflow Actions</h3>
              <div className="space-y-4">
                {!(currentUser.id === request.requesterId && (request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION)) && (
                  <textarea aria-label="Workflow action comment" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500/20 transition dark:bg-slate-700 dark:text-slate-200" placeholder="Add comments (required for rejection/return)..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                )}
                {renderActions()}
                {/* Cancel Request Button */}
                {request.status !== RequestStatus.COMPLETED &&
                 request.status !== RequestStatus.CANCELLED &&
                 request.status !== RequestStatus.REJECTED &&
                 (currentUser.id === request.requesterId || hasRole(currentUser, Role.ADMIN) || hasRole(currentUser, Role.POC)) && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Ban size={16} /> Cancel Request
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Request Details */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Request Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Priority</dt>
                <dd className={`font-medium badge-refined ring-1 ${priority?.name.toLowerCase().includes('critical') ? 'bg-rose-50 text-rose-800 ring-rose-600/10 dark:bg-rose-950 dark:text-rose-400' : priority?.name.toLowerCase().includes('urgent') ? 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950 dark:text-amber-400' : 'bg-blue-50 text-blue-800 ring-blue-600/10 dark:bg-blue-950 dark:text-blue-400'}`}>{priority?.name ?? 'Unknown'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Classification</dt>
                <dd className="font-medium dark:text-slate-200">{request.classification}</dd>
              </div>
              {request.materialSubType && <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Sub-Type</dt><dd className="font-medium dark:text-slate-200">{request.materialSubType}</dd></div>}
              {request.serviceSubType && <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Sub-Type</dt><dd className="font-medium dark:text-slate-200">{request.serviceSubType}</dd></div>}
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Project</dt>
                <dd className="font-medium dark:text-slate-200">{request.project}</dd>
              </div>
              {request.unspscCode && <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">UNSPSC</dt><dd className="font-medium dark:text-slate-200">{request.unspscCode}</dd></div>}
              {request.uom && <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">UOM</dt><dd className="font-medium dark:text-slate-200">{request.uom}</dd></div>}
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Requester</dt>
                <dd className="font-medium dark:text-slate-200">{users.find(u => u.id === request.requesterId)?.name ?? 'Unknown'}</dd>
              </div>
              {assignedSpecialist && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400 mb-1">Assigned Specialist</dt>
                  <dd className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-2 rounded-lg"><UserIcon size={16} strokeWidth={1.75} />{assignedSpecialist.name}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Created</dt><dd className="font-medium dark:text-slate-200">{new Date(request.createdAt).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Updated</dt><dd className="font-medium dark:text-slate-200">{new Date(request.updatedAt).toLocaleString()}</dd></div>
              {request.justification && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400 mb-1">Justification</dt>
                  <dd className="italic text-slate-600 dark:text-slate-400 text-xs bg-amber-50 dark:bg-amber-950 p-2 rounded-lg border border-amber-200/60 dark:border-amber-700/60">{request.justification}</dd>
                </div>
              )}
              {request.managerName && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400 mb-1">Approving Manager</dt>
                  <dd className="font-medium dark:text-slate-200">
                    {request.managerName}
                    <a href={`mailto:${request.managerEmail}`} className="text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs hover:underline mt-0.5"><Mail size={10} /> {request.managerEmail}</a>
                  </dd>
                </div>
              )}
              {request.rejectionReason && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400 mb-1">Rejection Reason</dt>
                  <dd className="text-rose-700 dark:text-rose-400 text-xs bg-rose-50 dark:bg-rose-950 p-2 rounded-lg border border-rose-200/60 dark:border-rose-700/60">{request.rejectionReason}</dd>
                </div>
              )}
              {request.attachments && request.attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1"><Paperclip size={12} /> Attachments</dt>
                  <dd className="space-y-1.5">
                    {request.attachments.map(att => (
                      <AttachmentThumbnail key={att.id} attachment={att} />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Stage Timestamps */}
          {stageTimestamps.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Clock size={16} strokeWidth={1.75} /> Stage Durations</h3>
              <div className="space-y-2 text-xs">
                {stageTimestamps.map((st, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{st.status}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{st.durationHours != null ? `${st.durationHours}h` : 'Active'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60" aria-label="Request audit trail">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Audit Log</h3>
            <div className="space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-slate-300 before:to-slate-100 dark:before:from-slate-600 dark:before:to-slate-800" role="list" aria-label="Audit trail entries">
              {request.history.map((log, idx) => (
                <div key={idx} className="relative pl-6" role="listitem" aria-label={`${log.action} by ${log.user} on ${new Date(log.timestamp).toLocaleString()}`}>
                  <div className={`timeline-dot absolute left-0 top-1.5 ${
                    log.action.includes('Completed') || log.action.includes('approved') ? 'bg-emerald-500' :
                    log.action.includes('Reject') || log.action.includes('rejected') ? 'bg-rose-500' :
                    log.action.includes('Return') || log.action.includes('returned') ? 'bg-amber-500' :
                    log.action.includes('Created') ? 'bg-blue-500' :
                    'bg-slate-300 dark:bg-slate-600'
                  }`}></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.action}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">by {log.user}</div>
                  {log.details && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">&ldquo;{log.details}&rdquo;</div>}
                  {log.changedFields && log.changedFields.length > 0 && (
                    <div className="mt-1 text-xs space-y-0.5">
                      {log.changedFields.map((cf, ci) => (
                        <div key={ci} className="text-slate-500 dark:text-slate-400"><span className="font-medium">{cf.field}</span>: <span className="line-through text-rose-400">{cf.oldValue || '(empty)'}</span> → <span className="text-emerald-600 dark:text-emerald-400">{cf.newValue || '(empty)'}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <Ban size={20} /> Cancel Request
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to cancel request <strong>{request.id}</strong>? This action will be tracked in the audit trail.
            </p>
            <textarea
              className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border p-2.5 focus:border-red-500 focus:ring-red-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 mb-4"
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Reason for cancellation (required)..."
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition">
                Keep Request
              </button>
              <button onClick={handleCancelRequest} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
