import { create } from 'zustand';
import { AttributeDefinition, Priority, MOCK_PRIORITIES, MOCK_ATTRIBUTES } from '../types';
import { upsertRecord, deleteRecord, TABLES } from '../lib/supabase';
import { useToastStore } from './toastStore';

interface AdminState {
  attributes: AttributeDefinition[];
  priorities: Priority[];
  saving: boolean;
  setAttributes: (attrs: AttributeDefinition[]) => void;
  setPriorities: (prios: Priority[]) => void;

  // Attribute CRUD
  updateAttribute: (attr: AttributeDefinition) => void;
  addAttribute: (attr: AttributeDefinition) => void;
  deleteAttribute: (id: string) => void;

  // Priority CRUD
  updatePriority: (prio: Priority) => void;
  addPriority: (prio: Priority) => void;
  deletePriority: (id: string) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  attributes: MOCK_ATTRIBUTES,
  priorities: MOCK_PRIORITIES,
  saving: false,

  setAttributes: (attributes) => set({ attributes }),
  setPriorities: (priorities) => set({ priorities }),

  // --- Attribute Actions ---
  updateAttribute: (attr) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().attributes;
    set((state) => ({
      attributes: state.attributes.map((a) => (a.id === attr.id ? attr : a)),
      saving: true,
    }));
    upsertRecord(TABLES.attributes, attr).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Attribute "${attr.name}" updated.`, 'success');
      } else {
        set({ attributes: prev });
        addToast(`Failed to update attribute: ${result.error}`, 'error');
      }
    });
  },

  addAttribute: (attr) => {
    const addToast = useToastStore.getState().addToast;
    set((state) => ({ attributes: [...state.attributes, attr], saving: true }));
    upsertRecord(TABLES.attributes, attr).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Attribute "${attr.name}" added.`, 'success');
      } else {
        set((state) => ({ attributes: state.attributes.filter((a) => a.id !== attr.id) }));
        addToast(`Failed to add attribute: ${result.error}`, 'error');
      }
    });
  },

  deleteAttribute: (id) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().attributes;
    const attr = prev.find((a) => a.id === id);
    set((state) => ({ attributes: state.attributes.filter((a) => a.id !== id), saving: true }));
    deleteRecord(TABLES.attributes, id).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Attribute "${attr?.name ?? id}" deleted.`, 'info');
      } else {
        set({ attributes: prev });
        addToast(`Failed to delete attribute: ${result.error}`, 'error');
      }
    });
  },

  // --- Priority Actions ---
  updatePriority: (prio) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().priorities;
    set((state) => ({
      priorities: state.priorities.map((p) => (p.id === prio.id ? prio : p)),
      saving: true,
    }));
    upsertRecord(TABLES.priorities, prio).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Priority "${prio.name}" updated.`, 'success');
      } else {
        set({ priorities: prev });
        addToast(`Failed to update priority: ${result.error}`, 'error');
      }
    });
  },

  addPriority: (prio) => {
    const addToast = useToastStore.getState().addToast;
    set((state) => ({ priorities: [...state.priorities, prio], saving: true }));
    upsertRecord(TABLES.priorities, prio).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Priority "${prio.name}" added.`, 'success');
      } else {
        set((state) => ({ priorities: state.priorities.filter((p) => p.id !== prio.id) }));
        addToast(`Failed to add priority: ${result.error}`, 'error');
      }
    });
  },

  deletePriority: (id) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().priorities;
    const prio = prev.find((p) => p.id === id);
    set((state) => ({ priorities: state.priorities.filter((p) => p.id !== id), saving: true }));
    deleteRecord(TABLES.priorities, id).then((result) => {
      set({ saving: false });
      if (result.success) {
        addToast(`Priority "${prio?.name ?? id}" deleted.`, 'info');
      } else {
        set({ priorities: prev });
        addToast(`Failed to delete priority: ${result.error}`, 'error');
      }
    });
  },
}));
