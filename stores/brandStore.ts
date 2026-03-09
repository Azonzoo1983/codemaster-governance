import { create } from 'zustand';
import { Brand } from '../types';
import { upsertRecord, deleteRecord, loadAll, TABLES } from '../lib/supabase';
import { useToastStore } from './toastStore';
import { generateId } from './userStore';

interface BrandState {
  brands: Brand[];
  setBrands: (brands: Brand[]) => void;
  addBrand: (name: string) => void;
  updateBrand: (brand: Brand) => void;
  deleteBrand: (id: string) => void;
}

export const useBrandStore = create<BrandState>((set, get) => ({
  brands: [],

  setBrands: (brands) => set({ brands }),

  addBrand: (name) => {
    const addToast = useToastStore.getState().addToast;
    const newBrand: Brand = { id: generateId('BRD'), name, active: true };
    set((state) => ({ brands: [...state.brands, newBrand] }));
    upsertRecord(TABLES.brands, newBrand).then((result) => {
      if (result.success) {
        addToast(`Brand "${name}" added.`, 'success');
      } else {
        set((state) => ({ brands: state.brands.filter((b) => b.id !== newBrand.id) }));
        addToast(`Failed to add brand: ${result.error}`, 'error');
      }
    });
  },

  updateBrand: (brand) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().brands;
    set((state) => ({ brands: state.brands.map((b) => (b.id === brand.id ? brand : b)) }));
    upsertRecord(TABLES.brands, brand).then((result) => {
      if (result.success) {
        addToast(`Brand "${brand.name}" updated.`, 'success');
      } else {
        set({ brands: prev });
        addToast(`Failed to update brand: ${result.error}`, 'error');
      }
    });
  },

  deleteBrand: (id) => {
    const addToast = useToastStore.getState().addToast;
    const prev = get().brands;
    const brand = prev.find((b) => b.id === id);
    set((state) => ({ brands: state.brands.filter((b) => b.id !== id) }));
    deleteRecord(TABLES.brands, id).then((result) => {
      if (result.success) {
        addToast(`Brand "${brand?.name}" deleted.`, 'info');
      } else {
        set({ brands: prev });
        addToast(`Failed to delete brand: ${result.error}`, 'error');
      }
    });
  },
}));
