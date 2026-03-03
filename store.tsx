import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  User,
  Priority,
  AttributeDefinition,
  RequestItem,
  InviteToken,
  StageTimestamp,
  MOCK_USERS,
  MOCK_PRIORITIES,
  MOCK_ATTRIBUTES,
  RequestStatus,
  AuditLog,
  Role
} from './types';
import { supabase, loadAll, upsertRecord, upsertMany, deleteRecord, TABLES } from './lib/supabase';

// --- Toast Notification System ---
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a StoreProvider');
  }
  return context;
};

// --- Unique ID Generation ---
let idCounter = 0;
function generateId(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6);
  idCounter += 1;
  return `${prefix}-${dateStr}-${random}${idCounter}`;
}

// --- Stage Timestamp Helpers ---
function createStageTimestamp(status: RequestStatus): StageTimestamp {
  return { status, enteredAt: new Date().toISOString() };
}

function closeCurrentStage(timestamps: StageTimestamp[]): StageTimestamp[] {
  if (timestamps.length === 0) return timestamps;
  const last = timestamps[timestamps.length - 1];
  if (last.exitedAt) return timestamps;
  const now = new Date().toISOString();
  const durationHours = (new Date(now).getTime() - new Date(last.enteredAt).getTime()) / (1000 * 60 * 60);
  return [
    ...timestamps.slice(0, -1),
    { ...last, exitedAt: now, durationHours: Math.round(durationHours * 100) / 100 }
  ];
}

// --- localStorage fallback for currentUserId (session-specific) ---
function getStoredUserId(): string | null {
  try {
    return localStorage.getItem('cm_currentUserId');
  } catch { return null; }
}

function setStoredUserId(id: string): void {
  try {
    localStorage.setItem('cm_currentUserId', id);
  } catch { /* ignore */ }
}

// --- Store Types ---
interface StoreContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  priorities: Priority[];
  attributes: AttributeDefinition[];
  requests: RequestItem[];
  inviteTokens: InviteToken[];
  loading: boolean;

  // User Actions
  addUser: (user: Omit<User, 'id'>) => User;
  updateUserRole: (userId: string, role: Role) => void;

  // Invite Token Actions
  createInviteToken: (email: string, role?: Role) => InviteToken;
  validateInviteToken: (token: string) => InviteToken | null;
  markInviteTokenUsed: (token: string) => void;

  // Request Actions
  addRequest: (req: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'>) => void;
  updateRequestStatus: (id: string, status: RequestStatus, comment?: string, updates?: Partial<RequestItem>) => void;
  updateRequest: (id: string, updates: Partial<RequestItem>, actionName?: string) => void;

  // Admin Actions
  updateAttribute: (attr: AttributeDefinition) => void;
  addAttribute: (attr: AttributeDefinition) => void;
  deleteAttribute: (id: string) => void;
  updatePriority: (prio: Priority) => void;
  addPriority: (prio: Priority) => void;
  deletePriority: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUserState] = useState<User>(MOCK_USERS.find(u => u.role === Role.ADMIN) || MOCK_USERS[0]);
  const [priorities, setPriorities] = useState<Priority[]>(MOCK_PRIORITIES);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>(MOCK_ATTRIBUTES);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [inviteTokens, setInviteTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);

  // Track if initial load is done to avoid saving stale data back
  const initialLoadDone = useRef(false);

  // --- Load all data from Supabase on mount ---
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [dbUsers, dbPriorities, dbAttributes, dbRequests, dbTokens] = await Promise.all([
          loadAll<User>(TABLES.users),
          loadAll<Priority>(TABLES.priorities),
          loadAll<AttributeDefinition>(TABLES.attributes),
          loadAll<RequestItem>(TABLES.requests),
          loadAll<InviteToken>(TABLES.inviteTokens),
        ]);

        if (cancelled) return;

        // If tables are empty, seed with defaults
        if (dbUsers.length === 0) {
          await upsertMany(TABLES.users, MOCK_USERS);
          setUsers(MOCK_USERS);
        } else {
          setUsers(dbUsers);
        }

        if (dbPriorities.length === 0) {
          await upsertMany(TABLES.priorities, MOCK_PRIORITIES);
          setPriorities(MOCK_PRIORITIES);
        } else {
          setPriorities(dbPriorities);
        }

        if (dbAttributes.length === 0) {
          await upsertMany(TABLES.attributes, MOCK_ATTRIBUTES);
          setAttributes(MOCK_ATTRIBUTES);
        } else {
          setAttributes(dbAttributes);
        }

        setRequests(dbRequests);
        setInviteTokens(dbTokens);

        // Restore current user from localStorage (session-specific)
        const savedUserId = getStoredUserId();
        const allUsers = dbUsers.length > 0 ? dbUsers : MOCK_USERS;
        const resolved = allUsers.find(u => u.id === savedUserId)
          || allUsers.find(u => u.role === Role.ADMIN)
          || allUsers[0];
        setCurrentUserState(resolved);

        initialLoadDone.current = true;
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
        // Fall back to mock data — already set as initial state
        initialLoadDone.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  // --- Real-time subscriptions for multi-user sync ---
  useEffect(() => {
    const channel = supabase
      .channel('cm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.requests }, (payload) => {
        if (!initialLoadDone.current) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const record = (payload.new as { data: RequestItem }).data;
          setRequests(prev => {
            const exists = prev.find(r => r.id === record.id);
            if (exists) {
              return prev.map(r => r.id === record.id ? record : r);
            }
            return [record, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id;
          setRequests(prev => prev.filter(r => r.id !== id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.users }, (payload) => {
        if (!initialLoadDone.current) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const record = (payload.new as { data: User }).data;
          setUsers(prev => {
            const exists = prev.find(u => u.id === record.id);
            if (exists) return prev.map(u => u.id === record.id ? record : u);
            return [...prev, record];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.priorities }, (payload) => {
        if (!initialLoadDone.current) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const record = (payload.new as { data: Priority }).data;
          setPriorities(prev => {
            const exists = prev.find(p => p.id === record.id);
            if (exists) return prev.map(p => p.id === record.id ? record : p);
            return [...prev, record];
          });
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id;
          setPriorities(prev => prev.filter(p => p.id !== id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.attributes }, (payload) => {
        if (!initialLoadDone.current) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const record = (payload.new as { data: AttributeDefinition }).data;
          setAttributes(prev => {
            const exists = prev.find(a => a.id === record.id);
            if (exists) return prev.map(a => a.id === record.id ? record : a);
            return [...prev, record];
          });
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id;
          setAttributes(prev => prev.filter(a => a.id !== id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.inviteTokens }, (payload) => {
        if (!initialLoadDone.current) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const record = (payload.new as { data: InviteToken }).data;
          setInviteTokens(prev => {
            const exists = prev.find(t => t.id === record.id);
            if (exists) return prev.map(t => t.id === record.id ? record : t);
            return [...prev, record];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const setCurrentUser = useCallback((user: User) => {
    setCurrentUserState(user);
    setStoredUserId(user.id);
  }, []);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- User Actions ---
  const addUser = useCallback((userData: Omit<User, 'id'>): User => {
    const newUser: User = { ...userData, id: generateId('USR') };
    setUsers(prev => [...prev, newUser]);
    upsertRecord(TABLES.users, newUser);
    return newUser;
  }, []);

  const updateUserRole = useCallback((userId: string, role: Role) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, role } : u);
      const user = updated.find(u => u.id === userId);
      if (user) upsertRecord(TABLES.users, user);
      return updated;
    });
    addToast('User role updated.', 'success');
  }, [addToast]);

  // --- Invite Token Actions ---
  const createInviteToken = useCallback((email: string, role?: Role): InviteToken => {
    const token: InviteToken = {
      id: generateId('INV'),
      email,
      token: crypto.getRandomValues(new Uint32Array(4)).reduce((s, v) => s + v.toString(36), ''),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      used: false,
      role,
    };
    setInviteTokens(prev => [...prev, token]);
    upsertRecord(TABLES.inviteTokens, token);
    addToast(`Invite token created for ${email}.`, 'success');
    return token;
  }, [addToast]);

  const validateInviteToken = useCallback((tokenStr: string): InviteToken | null => {
    const token = inviteTokens.find(t => t.token === tokenStr);
    if (!token) return null;
    if (token.used) return null;
    if (new Date(token.expiresAt) < new Date()) return null;
    return token;
  }, [inviteTokens]);

  const markInviteTokenUsed = useCallback((tokenStr: string) => {
    setInviteTokens(prev => {
      const updated = prev.map(t => t.token === tokenStr ? { ...t, used: true } : t);
      const token = updated.find(t => t.token === tokenStr);
      if (token) upsertRecord(TABLES.inviteTokens, token);
      return updated;
    });
  }, []);

  // --- Request Actions ---
  const addRequest = useCallback((reqData: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'>) => {
    const newId = generateId('REQ');
    const now = new Date().toISOString();

    const newRequest: RequestItem = {
      ...reqData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      stageTimestamps: [createStageTimestamp(reqData.status)],
      history: [{
        timestamp: now,
        user: currentUser.name,
        action: 'Request Created',
        details: `New ${reqData.requestType || 'New'} ${reqData.classification} request submitted with ${reqData.priorityId ? 'priority' : 'default'} priority`
      }]
    };

    setRequests(prev => [newRequest, ...prev]);
    upsertRecord(TABLES.requests, newRequest);
    addToast(`Request ${newId} created successfully.`, 'success');
  }, [currentUser.name, addToast]);

  const updateRequestStatus = useCallback((id: string, status: RequestStatus, comment?: string, updates?: Partial<RequestItem>) => {
    setRequests(prev => {
      const req = prev.find(r => r.id === id);
      if (!req) {
        addToast(`Request ${id} not found.`, 'error');
        return prev;
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
        details: comment
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
        history: [newHistory, ...req.history]
      };

      addToast(`Request ${id} updated to "${status}".`, 'success');
      upsertRecord(TABLES.requests, updatedRequest);
      return prev.map(r => r.id === id ? updatedRequest : r);
    });
  }, [currentUser.name, addToast]);

  const updateRequest = useCallback((id: string, updates: Partial<RequestItem>, actionName: string = 'Updated Request') => {
    setRequests(prev => {
      const req = prev.find(r => r.id === id);
      if (!req) {
        addToast(`Request ${id} not found.`, 'error');
        return prev;
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
            newValue: newVal !== undefined ? String(newVal) : ''
          });
        }
      }

      const newHistory: AuditLog = {
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        action: actionName,
        details: changedFields.length > 0
          ? `Modified: ${changedFields.map(c => c.field).join(', ')}`
          : 'Request details modified',
        changedFields: changedFields.length > 0 ? changedFields : undefined,
      };

      const updatedRequest = {
        ...req,
        ...updates,
        updatedAt: new Date().toISOString(),
        history: [newHistory, ...req.history]
      };

      addToast(`Request ${id} updated.`, 'success');
      upsertRecord(TABLES.requests, updatedRequest);
      return prev.map(r => r.id === id ? updatedRequest : r);
    });
  }, [currentUser.name, addToast]);

  // --- Admin Actions ---
  const updateAttribute = useCallback((attr: AttributeDefinition) => {
    setAttributes(prev => prev.map(a => a.id === attr.id ? attr : a));
    upsertRecord(TABLES.attributes, attr);
    addToast(`Attribute "${attr.name}" updated.`, 'success');
  }, [addToast]);

  const addAttribute = useCallback((attr: AttributeDefinition) => {
    setAttributes(prev => [...prev, attr]);
    upsertRecord(TABLES.attributes, attr);
    addToast(`Attribute "${attr.name}" added.`, 'success');
  }, [addToast]);

  const deleteAttribute = useCallback((id: string) => {
    setAttributes(prev => {
      const attr = prev.find(a => a.id === id);
      addToast(`Attribute "${attr?.name ?? id}" deleted.`, 'info');
      return prev.filter(a => a.id !== id);
    });
    deleteRecord(TABLES.attributes, id);
  }, [addToast]);

  const updatePriority = useCallback((prio: Priority) => {
    setPriorities(prev => prev.map(p => p.id === prio.id ? prio : p));
    upsertRecord(TABLES.priorities, prio);
    addToast(`Priority "${prio.name}" updated.`, 'success');
  }, [addToast]);

  const addPriority = useCallback((prio: Priority) => {
    setPriorities(prev => [...prev, prio]);
    upsertRecord(TABLES.priorities, prio);
    addToast(`Priority "${prio.name}" added.`, 'success');
  }, [addToast]);

  const deletePriority = useCallback((id: string) => {
    setPriorities(prev => {
      const prio = prev.find(p => p.id === id);
      addToast(`Priority "${prio?.name ?? id}" deleted.`, 'info');
      return prev.filter(p => p.id !== id);
    });
    deleteRecord(TABLES.priorities, id);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <StoreContext.Provider value={{
        currentUser,
        setCurrentUser,
        users,
        priorities,
        attributes,
        requests,
        inviteTokens,
        loading,
        addUser,
        updateUserRole,
        createInviteToken,
        validateInviteToken,
        markInviteTokenUsed,
        addRequest,
        updateRequestStatus,
        updateRequest,
        updateAttribute,
        addAttribute,
        deleteAttribute,
        updatePriority,
        addPriority,
        deletePriority
      }}>
        {children}
      </StoreContext.Provider>
    </ToastContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
