import { create } from 'zustand';
import { User, Role, MOCK_USERS } from '../types';
import { upsertRecord, TABLES } from '../lib/supabase';
import { useToastStore } from './toastStore';

// --- localStorage fallback for currentUserId (session-specific) ---
function getStoredUserId(): string | null {
  try {
    return localStorage.getItem('cm_currentUserId');
  } catch {
    return null;
  }
}

function setStoredUserId(id: string): void {
  try {
    localStorage.setItem('cm_currentUserId', id);
  } catch {
    /* ignore */
  }
}

// --- Unique ID Generation ---
let idCounter = 0;
export function generateId(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6);
  idCounter += 1;
  return `${prefix}-${dateStr}-${random}${idCounter}`;
}

interface UserState {
  users: User[];
  currentUser: User;
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User) => void;
  addUser: (userData: Omit<User, 'id'>) => User;
  updateUserRole: (userId: string, role: Role) => void;
  updateUser: (userId: string, updates: Partial<Omit<User, 'id'>>) => void;
  resolveCurrentUser: (allUsers: User[]) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: MOCK_USERS,
  currentUser: MOCK_USERS.find((u) => u.role === Role.ADMIN) || MOCK_USERS[0],

  setUsers: (users) => set({ users }),

  setCurrentUser: (user) => {
    set({ currentUser: user });
    setStoredUserId(user.id);
  },

  resolveCurrentUser: (allUsers) => {
    const savedUserId = getStoredUserId();
    const resolved =
      allUsers.find((u) => u.id === savedUserId) ||
      allUsers.find((u) => u.role === Role.ADMIN) ||
      allUsers[0];
    set({ currentUser: resolved });
  },

  addUser: (userData) => {
    const addToast = useToastStore.getState().addToast;
    const newUser: User = { ...userData, id: generateId('USR') };
    set((state) => ({ users: [...state.users, newUser] }));
    upsertRecord(TABLES.users, newUser).then((result) => {
      if (!result.success) {
        set((state) => ({ users: state.users.filter((u) => u.id !== newUser.id) }));
        addToast(`Failed to register user: ${result.error}`, 'error');
      }
    });
    return newUser;
  },

  updateUserRole: (userId, role) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().users;
    const updated = prev.map((u) => (u.id === userId ? { ...u, role } : u));
    set({ users: updated });
    const user = updated.find((u) => u.id === userId);
    if (user) {
      upsertRecord(TABLES.users, user).then((result) => {
        if (result.success) {
          addToast('User role updated.', 'success');
        } else {
          set({ users: prev });
          addToast(`Failed to update role: ${result.error}`, 'error');
        }
      });
    }
  },

  updateUser: (userId, updates) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().users;
    const updated = prev.map((u) => (u.id === userId ? { ...u, ...updates } : u));
    set({ users: updated });

    // Also update currentUser if it's the same user
    const current = get().currentUser;
    if (current.id === userId) {
      set({ currentUser: { ...current, ...updates } });
    }

    const user = updated.find((u) => u.id === userId);
    if (user) {
      upsertRecord(TABLES.users, user).then((result) => {
        if (result.success) {
          addToast('User details updated.', 'success');
        } else {
          set({ users: prev });
          if (current.id === userId) {
            set({ currentUser: current });
          }
          addToast(`Failed to update user: ${result.error}`, 'error');
        }
      });
    }
  },
}));
