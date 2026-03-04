import { create } from 'zustand';
import { RequestItem, RequestStatus, AuditLog, StageTimestamp, Role } from '../types';
import { upsertRecord, TABLES } from '../lib/supabase';
import { useToastStore } from './toastStore';
import { useUserStore } from './userStore';
import { generateId } from './userStore';
import { notifyStatusChange, notifyAssignment, notifyNewRequest } from '../lib/emailNotifications';

// --- Stage Timestamp Helpers ---
function createStageTimestamp(status: RequestStatus): StageTimestamp {
  return { status, enteredAt: new Date().toISOString() };
}

function closeCurrentStage(timestamps: StageTimestamp[]): StageTimestamp[] {
  if (timestamps.length === 0) return timestamps;
  const last = timestamps[timestamps.length - 1];
  if (last.exitedAt) return timestamps;
  const now = new Date().toISOString();
  const durationHours =
    (new Date(now).getTime() - new Date(last.enteredAt).getTime()) / (1000 * 60 * 60);
  return [
    ...timestamps.slice(0, -1),
    { ...last, exitedAt: now, durationHours: Math.round(durationHours * 100) / 100 },
  ];
}

interface RequestState {
  requests: RequestItem[];
  saving: boolean;
  setRequests: (requests: RequestItem[]) => void;

  addRequest: (
    req: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'>
  ) => void;
  updateRequestStatus: (
    id: string,
    status: RequestStatus,
    comment?: string,
    updates?: Partial<RequestItem>
  ) => void;
  updateRequest: (id: string, updates: Partial<RequestItem>, actionName?: string) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  requests: [],
  saving: false,

  setRequests: (requests) => set({ requests }),

  addRequest: (reqData) => {
    const currentUser = useUserStore.getState().currentUser;
    const addToast = useToastStore.getState().addToast;
    const newId = generateId('REQ');
    const now = new Date().toISOString();

    const newRequest: RequestItem = {
      ...reqData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      stageTimestamps: [createStageTimestamp(reqData.status)],
      history: [
        {
          timestamp: now,
          user: currentUser.name,
          action: 'Request Created',
          details: `New ${reqData.requestType || 'New'} ${reqData.classification} request submitted with ${reqData.priorityId ? 'priority' : 'default'} priority`,
        },
      ],
    };

    // Optimistic update
    set((state) => ({ requests: [newRequest, ...state.requests], saving: true }));

    // Persist to DB
    upsertRecord(TABLES.requests, newRequest).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Request ${newId} created successfully.`, 'success');

        // Fire-and-forget email notification to POC/manager for new requests
        const users = useUserStore.getState().users;
        const pocUsers = users.filter(u => u.role === Role.POC);
        pocUsers.forEach(poc => {
          notifyNewRequest(newId, reqData.title || 'New Request', poc.email, poc.name, currentUser.name, '').catch(() => {});
        });
      } else {
        // Rollback optimistic update
        set((state) => ({ requests: state.requests.filter((r) => r.id !== newId) }));
        addToast(`Failed to save request: ${result.error}`, 'error');
      }
    });
  },

  updateRequestStatus: (id, status, comment, updates) => {
    const currentUser = useUserStore.getState().currentUser;
    const addToast = useToastStore.getState().addToast;

    const prevRequests = get().requests;
    const req = prevRequests.find((r) => r.id === id);
    if (!req) {
      addToast(`Request ${id} not found.`, 'error');
      return;
    }

    // Build descriptive action message
    let actionMessage = `Status changed to ${status}`;
    const userName = currentUser.name;
    switch (status) {
      case RequestStatus.PENDING_APPROVAL:
        actionMessage = `${userName} submitted request for manager approval`;
        break;
      case RequestStatus.SUBMITTED_TO_POC:
        if (req.status === RequestStatus.PENDING_APPROVAL) {
          actionMessage = `Manager ${userName} approved the request`;
        } else {
          actionMessage = `Request submitted to coding team`;
        }
        break;
      case RequestStatus.ASSIGNED:
        actionMessage = `POC ${userName} assigned request to specialist ${updates?.assignedSpecialistId ? 'for review' : ''}`;
        break;
      case RequestStatus.UNDER_SPECIALIST_REVIEW:
        actionMessage = `Specialist ${userName} started reviewing the request`;
        break;
      case RequestStatus.RETURNED_FOR_CLARIFICATION:
        actionMessage = `${userName} returned the request for clarification`;
        break;
      case RequestStatus.REJECTED:
        actionMessage = `${userName} rejected the request`;
        break;
      case RequestStatus.UNDER_TECHNICAL_VALIDATION:
        actionMessage = `Specialist ${userName} submitted for technical validation`;
        break;
      case RequestStatus.PENDING_ORACLE_CREATION:
        actionMessage = `Technical Reviewer ${userName} validated the description`;
        break;
      case RequestStatus.COMPLETED:
        actionMessage = `${userName} completed Oracle code creation`;
        break;
    }

    const newHistory: AuditLog = {
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      action: actionMessage,
      details: comment,
    };

    // Update stage timestamps
    const closedStages = closeCurrentStage(req.stageTimestamps || []);
    const newStageTimestamps = [...closedStages, createStageTimestamp(status)];

    const updatedRequest = {
      ...req,
      ...updates,
      status,
      stageTimestamps: newStageTimestamps,
      updatedAt: new Date().toISOString(),
      history: [newHistory, ...req.history],
    };

    // Optimistic update
    set((state) => ({
      requests: state.requests.map((r) => (r.id === id ? updatedRequest : r)),
      saving: true,
    }));

    // Persist to DB
    upsertRecord(TABLES.requests, updatedRequest).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Request ${id} updated to "${status}".`, 'success');

        // Fire-and-forget email notifications
        const users = useUserStore.getState().users;
        const requester = users.find(u => u.id === req.requesterId);

        // Notify requester of status changes on their request
        if (requester && requester.id !== currentUser.id) {
          notifyStatusChange(id, req.title, requester.email, requester.name, req.status, status).catch(() => {});
        }

        // Notify specialist when assigned
        if (status === RequestStatus.ASSIGNED && updates?.assignedSpecialistId) {
          const specialist = users.find(u => u.id === updates.assignedSpecialistId);
          if (specialist) {
            notifyAssignment(id, req.title, specialist.email, specialist.name, specialist.name).catch(() => {});
          }
        }
      } else {
        // Rollback
        set({ requests: prevRequests });
        addToast(`Failed to update request: ${result.error}`, 'error');
      }
    });
  },

  updateRequest: (id, updates, actionName = 'Updated Request') => {
    const currentUser = useUserStore.getState().currentUser;
    const addToast = useToastStore.getState().addToast;

    const prevRequests = get().requests;
    const req = prevRequests.find((r) => r.id === id);
    if (!req) {
      addToast(`Request ${id} not found.`, 'error');
      return;
    }

    // Track changed fields
    const changedFields: { field: string; oldValue: string; newValue: string }[] = [];
    for (const [key, newVal] of Object.entries(updates)) {
      if (key === 'history' || key === 'updatedAt' || key === 'stageTimestamps') continue;
      const oldVal = (req as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedFields.push({
          field: key,
          oldValue: oldVal !== undefined ? String(oldVal) : '',
          newValue: newVal !== undefined ? String(newVal) : '',
        });
      }
    }

    const newHistory: AuditLog = {
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      action: actionName,
      details:
        changedFields.length > 0
          ? `Modified: ${changedFields.map((c) => c.field).join(', ')}`
          : 'Request details modified',
      changedFields: changedFields.length > 0 ? changedFields : undefined,
    };

    const updatedRequest = {
      ...req,
      ...updates,
      updatedAt: new Date().toISOString(),
      history: [newHistory, ...req.history],
    };

    // Optimistic update
    set((state) => ({
      requests: state.requests.map((r) => (r.id === id ? updatedRequest : r)),
      saving: true,
    }));

    // Persist to DB
    upsertRecord(TABLES.requests, updatedRequest).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Request ${id} updated.`, 'success');
      } else {
        // Rollback
        set({ requests: prevRequests });
        addToast(`Failed to update request: ${result.error}`, 'error');
      }
    });
  },
}));
