import { create } from 'zustand';
import { InviteToken, Role } from '../types';
import { upsertRecord, TABLES } from '../lib/supabase';
import { useToastStore } from './toastStore';
import { generateId } from './userStore';

interface InviteState {
  inviteTokens: InviteToken[];
  setInviteTokens: (tokens: InviteToken[]) => void;
  createInviteToken: (email: string, role?: Role) => InviteToken;
  validateInviteToken: (tokenStr: string) => InviteToken | null;
  markInviteTokenUsed: (tokenStr: string) => void;
}

export const useInviteStore = create<InviteState>((set, get) => ({
  inviteTokens: [],

  setInviteTokens: (inviteTokens) => set({ inviteTokens }),

  createInviteToken: (email, role) => {
    const addToast = useToastStore.getState().addToast;
    const token: InviteToken = {
      id: generateId('INV'),
      email,
      token: crypto.getRandomValues(new Uint32Array(4)).reduce((s, v) => s + v.toString(36), ''),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      used: false,
      role,
    };
    set((state) => ({ inviteTokens: [...state.inviteTokens, token] }));
    upsertRecord(TABLES.inviteTokens, token).then((result) => {
      if (result.success) {
        addToast(`Invite token created for ${email}.`, 'success');
      } else {
        set((state) => ({ inviteTokens: state.inviteTokens.filter((t) => t.id !== token.id) }));
        addToast(`Failed to create invite: ${result.error}`, 'error');
      }
    });
    return token;
  },

  validateInviteToken: (tokenStr) => {
    const token = get().inviteTokens.find((t) => t.token === tokenStr);
    if (!token) return null;
    if (token.used) return null;
    if (new Date(token.expiresAt) < new Date()) return null;
    return token;
  },

  markInviteTokenUsed: (tokenStr) => {
    const prev = get().inviteTokens;
    const updated = prev.map((t) => (t.token === tokenStr ? { ...t, used: true } : t));
    set({ inviteTokens: updated });
    const token = updated.find((t) => t.token === tokenStr);
    if (token) {
      upsertRecord(TABLES.inviteTokens, token).then((result) => {
        if (!result.success) {
          set({ inviteTokens: prev });
          useToastStore.getState().addToast(`Failed to mark token as used: ${result.error}`, 'error');
        }
      });
    }
  },
}));
