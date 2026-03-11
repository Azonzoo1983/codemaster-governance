import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role } from '../types';

export interface DashboardWidget {
  id: string; // 'kpi-cards' | 'request-table'
  label: string;
  visible: boolean;
  order: number;
}

interface LayoutState {
  widgets: DashboardWidget[];
  compactMode: boolean;
  setWidgets: (widgets: DashboardWidget[]) => void;
  toggleWidget: (id: string) => void;
  moveWidget: (id: string, direction: 'up' | 'down') => void;
  resetLayout: () => void;
  setCompactMode: (compact: boolean) => void;
  applyRoleDefaults: (role: Role) => void;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-cards', label: 'KPI Cards', visible: true, order: 0 },
  { id: 'request-table', label: 'Request Table', visible: true, order: 1 },
];

export function getDefaultWidgetsForRole(_role: Role): DashboardWidget[] {
  return DEFAULT_WIDGETS.map((w) => ({ ...w }));
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      compactMode: false,

      setWidgets: (widgets) => set({ widgets }),

      toggleWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w
          ),
        })),

      moveWidget: (id, direction) =>
        set((state) => {
          const sorted = [...state.widgets].sort((a, b) => a.order - b.order);
          const index = sorted.findIndex((w) => w.id === id);
          if (index === -1) return state;

          const swapIndex = direction === 'up' ? index - 1 : index + 1;
          if (swapIndex < 0 || swapIndex >= sorted.length) return state;

          // Swap orders
          const updatedWidgets = sorted.map((w, i) => {
            if (i === index) return { ...w, order: sorted[swapIndex].order };
            if (i === swapIndex) return { ...w, order: sorted[index].order };
            return w;
          });

          return { widgets: updatedWidgets };
        }),

      resetLayout: () =>
        set({ widgets: DEFAULT_WIDGETS, compactMode: false }),

      setCompactMode: (compact) => set({ compactMode: compact }),

      applyRoleDefaults: (role) =>
        set({ widgets: getDefaultWidgetsForRole(role) }),
    }),
    {
      name: 'cm-dashboard-layout',
      // Merge new default widgets into persisted state so existing users get the new widget
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<LayoutState> | undefined;
        if (!persistedState?.widgets) return { ...current, ...persistedState };
        const validIds = new Set(DEFAULT_WIDGETS.map((w) => w.id));
        // Remove old widgets (analytics, performance) that no longer exist
        const cleaned = persistedState.widgets.filter((w) => validIds.has(w.id));
        const existingIds = new Set(cleaned.map((w) => w.id));
        const missingWidgets = DEFAULT_WIDGETS.filter((w) => !existingIds.has(w.id));
        const maxOrder = Math.max(...cleaned.map((w) => w.order), -1);
        const mergedWidgets = [
          ...cleaned,
          ...missingWidgets.map((w, i) => ({ ...w, order: maxOrder + 1 + i })),
        ];
        return { ...current, ...persistedState, widgets: mergedWidgets };
      },
    }
  )
);
