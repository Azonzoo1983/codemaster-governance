// Legacy compatibility re-exports
// All stores have been migrated to ./stores/ directory using Zustand
// This file exists for backwards compatibility only

export { useToastStore as useToast } from './stores/toastStore';
export type { Toast } from './stores/toastStore';
export { useUserStore as useStore } from './stores/userStore';
