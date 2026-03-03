import React, { useState, useEffect } from 'react';
import { useStore, useToast } from '../store';
import { RequestStatus, Role, Classification, ClarificationComment } from '../types';
import { DynamicForm } from '../components/DynamicForm';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, AlertTriangle, FileCheck, Mail, Edit3, RotateCcw, CornerUpLeft, Paperclip, Download, User as UserIcon, MessageSquare, Send, Clock, RefreshCw } from 'lucide-react';

interface RequestDetailProps {
  id: string;
  onNavigate: (page: string, id?: string) => void;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({ id, onNavigate }) => {
  const { requests, currentUser, updateRequestStatus, updateRequest, users, priorities, attributes } = useStore();
  const { addToast } = useToast();
  const request = requests.find(r => r.id === id);

  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [oracleCode, setOracleCode] = useState('');
  const [finalDesc, setFinalDesc] = useState('');
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    if (request) {
      setFinalDesc(request.finalDescription || request.generatedDescription || '');
    }
  }, [request]);

  if (!request) {
    return (
      <div className="text-center py-16">
        <AlertTriangle size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700">Request not found</h3>
        <p className="text-gray-500 text-sm mt-1">The request may have been deleted or the ID is invalid.</p>
        <button onClick={() => onNavigate('dashboard')} className="mt-4 text-indigo-600 hover:underline text-sm">Back to Dashboard</button>
      </div>
    );
  }

  const priority = priorities.find(p => p.id === request.priorityId);
  const assignedSpecialist = users.find(u => u.id === request.assignedSpecialistId);

  // SLA calculation
  const getSLAInfo = () => {
    if (!priority?.slaHours) return null;
    const elapsed = (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60);
    const remaining = priority.slaHours - elapsed;
    const ratio = elapsed / priority.slaHours;
    return { elapsed: Math.round(elapsed * 10) / 10, remaining: Math.round(remaining * 10) / 10, ratio, breached: ratio >= 1 };
  };
  const slaInfo = getSLAInfo();

  // Manager validation
  const isRequestManager = currentUser.role === Role.MANAGER && (
    request.managerId === currentUser.id ||
    request.managerEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    (!request.managerId && !request.managerEmail) // General manager can approve any
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

  const handleSpecialistReview = () => {
    if (!finalDesc.trim()) {
      addToast('A description is required before sending for validation.', 'warning');
      return;
    }
    updateRequestStatus(request.id, RequestStatus.UNDER_TECHNICAL_VALIDATION, comment || 'Sent for technical validation', { finalDescription: finalDesc });
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
    if (!clarificationMessage.trim()) return;
    const newComment: ClarificationComment = {
      id: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
      userId: currentUser.id,
      userName: currentUser.name,
      message: clarificationMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedThread = [...(request.clarificationThread || []), newComment];
    updateRequest(request.id, { clarificationThread: updatedThread }, `Added clarification comment`);
    setClarificationMessage('');
  };

  const renderActions = () => {
    // Requester Actions
    if (currentUser.id === request.requesterId && (request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION)) {
      return (
        <div className="flex gap-2">
          <button onClick={() => onNavigate('edit-request', request.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition">
            <RotateCcw size={16} /> Modify & Resubmit
          </button>
        </div>
      );
    }

    // Manager Actions
    if (isRequestManager && request.status === RequestStatus.PENDING_APPROVAL) {
      return (
        <div className="flex flex-wrap gap-2">
          <button onClick={handleManagerApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition">
            <CheckCircle size={16} /> Approve
          </button>
          <button onClick={handleReturn} className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-700 transition">
            <CornerUpLeft size={16} /> Return
          </button>
          <button onClick={handleReject} className={`${confirmReject ? 'bg-red-800' : 'bg-red-600'} text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition`}>
            <XCircle size={16} /> {confirmReject ? 'Confirm Reject' : 'Reject'}
          </button>
        </div>
      );
    }

    // POC Actions
    if (currentUser.role === Role.POC && request.status === RequestStatus.SUBMITTED_TO_POC) {
      const specialists = users.filter(u => u.role === Role.SPECIALIST);
      return (
        <div className="flex gap-2 items-center flex-wrap">
          <select className="border rounded-lg p-2.5 text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">Select Specialist...</option>
            {specialists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handlePOCAssign} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition">
            <UserPlus size={16} /> Assign
          </button>
        </div>
      );
    }

    // POC Reassignment
    if (currentUser.role === Role.POC && request.status === RequestStatus.ASSIGNED) {
      const specialists = users.filter(u => u.role === Role.SPECIALIST);
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Currently assigned to <strong>{assignedSpecialist?.name}</strong></p>
          {!showReassign ? (
            <button onClick={() => setShowReassign(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 transition text-sm">
              <RefreshCw size={14} /> Reassign
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <select className="border rounded-lg p-2 text-sm" value={reassignId} onChange={e => setReassignId(e.target.value)}>
                <option value="">Select New Specialist...</option>
                {specialists.filter(s => s.id !== request.assignedSpecialistId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleReassign} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">Confirm</button>
              <button onClick={() => setShowReassign(false)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
            </div>
          )}
        </div>
      );
    }

    // Specialist Actions
    if (currentUser.role === Role.SPECIALIST && request.assignedSpecialistId === currentUser.id && request.status === RequestStatus.ASSIGNED) {
      return (
        <button onClick={() => updateRequestStatus(request.id, RequestStatus.UNDER_SPECIALIST_REVIEW, 'Started review')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
          Start Review
        </button>
      );
    }

    if (currentUser.role === Role.SPECIALIST && request.assignedSpecialistId === currentUser.id && request.status === RequestStatus.UNDER_SPECIALIST_REVIEW) {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Draft Final Description</label>
            <textarea className="w-full border rounded-lg p-2.5 text-sm font-mono" rows={2} value={finalDesc} onChange={e => setFinalDesc(e.target.value)} placeholder="Edit the auto-generated description if needed..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSpecialistReview} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-blue-700 transition">
              <CheckCircle size={14} /> Send for Technical Validation
            </button>
            <button onClick={handleReturn} className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-yellow-700 transition">
              <CornerUpLeft size={14} /> Return for Clarification
            </button>
            <button onClick={handleReject} className={`${confirmReject ? 'bg-red-800' : 'bg-red-600'} text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-red-700 transition`}>
              <XCircle size={14} /> {confirmReject ? 'Confirm Reject' : 'Reject'}
            </button>
          </div>
        </div>
      );
    }

    // Specialist Code Creation
    if (currentUser.role === Role.SPECIALIST && request.status === RequestStatus.PENDING_ORACLE_CREATION) {
      return (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-bold text-green-700 uppercase mb-1">Validated Description</p>
            <p className="font-mono text-sm text-green-900">{request.finalDescription || request.generatedDescription}</p>
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Enter Oracle Code..." className="border rounded-lg p-2.5 flex-1 text-sm" value={oracleCode} onChange={e => setOracleCode(e.target.value)} />
            <button onClick={handleCreateCode} className="bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 transition text-sm">
              <FileCheck size={14} /> Complete
            </button>
          </div>
        </div>
      );
    }

    // Tech Reviewer Actions
    if (currentUser.role === Role.TECHNICAL_REVIEWER && request.status === RequestStatus.UNDER_TECHNICAL_VALIDATION) {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1 flex items-center gap-1"><Edit3 size={12} /> Final Description (Editable)</label>
            <textarea className="w-full border border-blue-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-200" rows={3} value={finalDesc} onChange={e => setFinalDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleTechValidation} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition text-sm">
              <CheckCircle size={14} /> Validate Description
            </button>
            <button onClick={() => {
              if (!comment.trim()) { addToast('Add a comment explaining what needs correction.', 'warning'); return; }
              updateRequestStatus(request.id, RequestStatus.UNDER_SPECIALIST_REVIEW, comment);
            }} className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-700 transition text-sm">
              <CornerUpLeft size={14} /> Return to Specialist
            </button>
          </div>
        </div>
      );
    }

    return <p className="text-sm text-gray-500 italic">No actions available for your role at this stage.</p>;
  };

  const showWorkflowActions = request.status !== RequestStatus.COMPLETED;

  // Stage timestamps for display
  const stageTimestamps = request.stageTimestamps || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-gray-200 rounded-full transition"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
          <p className="text-sm text-gray-500">{request.id} &bull; {request.classification} &bull; {request.requestType || 'New'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {slaInfo && request.status !== RequestStatus.COMPLETED && request.status !== RequestStatus.REJECTED && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${slaInfo.breached ? 'bg-red-500 text-white' : slaInfo.ratio >= 0.75 ? 'bg-amber-500 text-white' : 'bg-green-100 text-green-800'}`}>
              {slaInfo.breached ? `SLA Breached (${Math.abs(slaInfo.remaining)}h over)` : `${slaInfo.remaining}h remaining`}
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
            request.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-800 border-red-200' :
            request.status === RequestStatus.RETURNED_FOR_CLARIFICATION ? 'bg-orange-100 text-orange-800 border-orange-200' :
            request.status === RequestStatus.COMPLETED ? 'bg-green-100 text-green-800 border-green-200' :
            'bg-indigo-100 text-indigo-800 border-indigo-200'
          }`}>
            {request.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Technical Attributes */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Technical Attributes</h3>
            <DynamicForm
              attributes={attributes.filter(a => a.active && (a.visibleForClassification ? a.visibleForClassification.includes(request.classification) : true))}
              values={request.attributes}
              onChange={() => {}}
              readOnly={true}
            />
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs uppercase font-bold text-gray-500">Auto-Generated Description</span>
              <div className="text-sm font-mono text-gray-600 mt-1">{request.generatedDescription || '-'}</div>
            </div>
            {request.finalDescription && request.status !== RequestStatus.UNDER_TECHNICAL_VALIDATION && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <span className="text-xs uppercase font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> Final Description</span>
                <div className="text-base font-mono text-green-900 mt-1">{request.finalDescription}</div>
              </div>
            )}
            {request.oracleCode && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg text-white">
                <span className="text-xs uppercase font-bold text-gray-400">Oracle Code</span>
                <div className="text-2xl font-bold mt-1 tracking-wider">{request.oracleCode}</div>
              </div>
            )}
          </div>

          {/* Clarification Thread */}
          {(request.status === RequestStatus.RETURNED_FOR_CLARIFICATION || (request.clarificationThread && request.clarificationThread.length > 0)) && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200">
              <h3 className="text-sm uppercase font-bold text-orange-800 mb-4 flex items-center gap-2"><MessageSquare size={16} /> Clarification Thread</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {(request.clarificationThread || []).map(c => (
                  <div key={c.id} className={`p-3 rounded-lg text-sm ${c.userId === request.requesterId ? 'bg-blue-50 border border-blue-100 ml-4' : 'bg-gray-50 border border-gray-200 mr-4'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-800">{c.userName}</span>
                      <span className="text-xs text-gray-500">{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-700">{c.message}</p>
                  </div>
                ))}
                {(!request.clarificationThread || request.clarificationThread.length === 0) && (
                  <p className="text-sm text-gray-500 italic">No messages yet. Use the form below to add a clarification.</p>
                )}
              </div>
              {request.status === RequestStatus.RETURNED_FOR_CLARIFICATION && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-lg p-2.5 text-sm"
                    placeholder="Type your message..."
                    value={clarificationMessage}
                    onChange={e => setClarificationMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddClarification(); }}
                  />
                  <button onClick={handleAddClarification} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700 transition text-sm">
                    <Send size={14} /> Send
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Workflow Actions */}
          {showWorkflowActions && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 ring-1 ring-indigo-50">
              <h3 className="text-sm uppercase font-bold text-indigo-800 mb-4">Workflow Actions</h3>
              <div className="space-y-4">
                {!(currentUser.id === request.requesterId && (request.status === RequestStatus.REJECTED || request.status === RequestStatus.RETURNED_FOR_CLARIFICATION)) && (
                  <textarea className="w-full border rounded-lg p-2.5 text-sm" placeholder="Add comments (required for rejection/return)..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                )}
                {renderActions()}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Request Details */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Request Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Priority</dt>
                <dd className={`font-medium px-2 py-0.5 rounded text-xs ${priority?.name.toLowerCase().includes('critical') ? 'bg-red-100 text-red-800' : priority?.name.toLowerCase().includes('urgent') ? 'bg-orange-100 text-orange-800' : 'bg-blue-50 text-blue-800'}`}>{priority?.name ?? 'Unknown'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Classification</dt>
                <dd className="font-medium">{request.classification}</dd>
              </div>
              {request.materialSubType && <div className="flex justify-between"><dt className="text-gray-500">Sub-Type</dt><dd className="font-medium">{request.materialSubType}</dd></div>}
              {request.serviceSubType && <div className="flex justify-between"><dt className="text-gray-500">Sub-Type</dt><dd className="font-medium">{request.serviceSubType}</dd></div>}
              <div className="flex justify-between">
                <dt className="text-gray-500">Project</dt>
                <dd className="font-medium">{request.project}</dd>
              </div>
              {request.unspscCode && <div className="flex justify-between"><dt className="text-gray-500">UNSPSC</dt><dd className="font-medium">{request.unspscCode}</dd></div>}
              {request.uom && <div className="flex justify-between"><dt className="text-gray-500">UOM</dt><dd className="font-medium">{request.uom}</dd></div>}
              <div className="flex justify-between">
                <dt className="text-gray-500">Requester</dt>
                <dd className="font-medium">{users.find(u => u.id === request.requesterId)?.name ?? 'Unknown'}</dd>
              </div>
              {assignedSpecialist && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-1">Assigned Specialist</dt>
                  <dd className="font-medium flex items-center gap-2 text-indigo-700 bg-indigo-50 p-2 rounded-lg"><UserIcon size={16} />{assignedSpecialist.name}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-gray-500">Created</dt><dd className="font-medium">{new Date(request.createdAt).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Updated</dt><dd className="font-medium">{new Date(request.updatedAt).toLocaleString()}</dd></div>
              {request.justification && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-1">Justification</dt>
                  <dd className="italic text-gray-600 text-xs bg-yellow-50 p-2 rounded">{request.justification}</dd>
                </div>
              )}
              {request.managerName && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-1">Approving Manager</dt>
                  <dd className="font-medium">
                    {request.managerName}
                    <a href={`mailto:${request.managerEmail}`} className="text-indigo-600 flex items-center gap-1 text-xs hover:underline mt-0.5"><Mail size={10} /> {request.managerEmail}</a>
                  </dd>
                </div>
              )}
              {request.rejectionReason && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-1">Rejection Reason</dt>
                  <dd className="text-red-700 text-xs bg-red-50 p-2 rounded">{request.rejectionReason}</dd>
                </div>
              )}
              {request.attachments && request.attachments.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-2 flex items-center gap-1"><Paperclip size={12} /> Attachments</dt>
                  <dd className="space-y-1.5">
                    {request.attachments.map(att => (
                      <a key={att.id} href={att.url} download={att.name} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition group">
                        <span className="text-xs font-medium truncate max-w-[150px]">{att.name}</span>
                        <Download size={12} className="text-gray-400 group-hover:text-indigo-600" />
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Stage Timestamps */}
          {stageTimestamps.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Clock size={16} /> Stage Durations</h3>
              <div className="space-y-2 text-xs">
                {stageTimestamps.map((st, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600 truncate max-w-[140px]">{st.status}</span>
                    <span className="font-mono text-gray-800">{st.durationHours != null ? `${st.durationHours}h` : 'Active'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Audit Log</h3>
            <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {request.history.map((log, idx) => (
                <div key={idx} className="relative pl-6">
                  <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                    log.action.includes('Completed') || log.action.includes('approved') ? 'bg-green-500' :
                    log.action.includes('Reject') || log.action.includes('rejected') ? 'bg-red-500' :
                    log.action.includes('Return') || log.action.includes('returned') ? 'bg-orange-500' :
                    log.action.includes('Created') ? 'bg-indigo-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-900">{log.action}</div>
                  <div className="text-xs text-gray-600">by {log.user}</div>
                  {log.details && <div className="text-xs text-gray-400 mt-1 italic">&ldquo;{log.details}&rdquo;</div>}
                  {log.changedFields && log.changedFields.length > 0 && (
                    <div className="mt-1 text-xs space-y-0.5">
                      {log.changedFields.map((cf, ci) => (
                        <div key={ci} className="text-gray-500"><span className="font-medium">{cf.field}</span>: <span className="line-through text-red-400">{cf.oldValue || '(empty)'}</span> → <span className="text-green-600">{cf.newValue || '(empty)'}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
