import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RequestStatus } from '../types';

// --- Types (same as WorkflowBuilder) ---
interface WorkflowNode {
  id: string;
  status: RequestStatus;
  label: string;
  color: string;
  icon: 'clock' | 'check' | 'x' | 'alert' | 'users' | 'zap' | 'settings';
  autoAssign?: boolean;
  requiresApproval?: boolean;
  notifyRoles?: string[];
  slaMultiplier?: number;
  description?: string;
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
  label?: string;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isDefault: boolean;
}

// Default workflow
const DEFAULT_WORKFLOW: WorkflowConfig = {
  id: 'default',
  name: 'Standard Approval Workflow',
  nodes: [
    { id: 'n1', status: RequestStatus.DRAFT, label: 'Draft', color: 'bg-slate-400', icon: 'clock', description: 'Request created by requester' },
    { id: 'n2', status: RequestStatus.PENDING_APPROVAL, label: 'Manager Approval', color: 'bg-yellow-500', icon: 'users', requiresApproval: true, description: 'Waiting for manager approval (Critical priority only)' },
    { id: 'n3', status: RequestStatus.SUBMITTED_TO_POC, label: 'POC Review', color: 'bg-blue-500', icon: 'zap', description: 'POC assigns to specialist' },
    { id: 'n4', status: RequestStatus.ASSIGNED, label: 'Assigned', color: 'bg-indigo-500', icon: 'users', autoAssign: false, description: 'Specialist assigned to request' },
    { id: 'n5', status: RequestStatus.UNDER_SPECIALIST_REVIEW, label: 'Specialist Review', color: 'bg-violet-500', icon: 'settings', description: 'Specialist analyzes and codes the item/service' },
    { id: 'n6', status: RequestStatus.UNDER_TECHNICAL_VALIDATION, label: 'Technical Validation', color: 'bg-cyan-500', icon: 'check', description: 'Technical reviewer validates the coding' },
    { id: 'n7', status: RequestStatus.PENDING_ORACLE_CREATION, label: 'Oracle Creation', color: 'bg-teal-500', icon: 'zap', description: 'Final code creation in Oracle ERP' },
    { id: 'n8', status: RequestStatus.COMPLETED, label: 'Completed', color: 'bg-emerald-500', icon: 'check', description: 'Request fulfilled with final code' },
    { id: 'n9', status: RequestStatus.REJECTED, label: 'Rejected', color: 'bg-rose-500', icon: 'x', description: 'Request rejected at any stage' },
    { id: 'n10', status: RequestStatus.RETURNED_FOR_CLARIFICATION, label: 'Clarification', color: 'bg-amber-500', icon: 'alert', description: 'Additional information needed from requester' },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', label: 'Submit (Critical)', condition: 'priority === Critical' },
    { id: 'e2', from: 'n1', to: 'n3', label: 'Submit (Normal/Urgent)', condition: 'priority !== Critical' },
    { id: 'e3', from: 'n2', to: 'n3', label: 'Approved' },
    { id: 'e4', from: 'n2', to: 'n9', label: 'Rejected' },
    { id: 'e5', from: 'n3', to: 'n4', label: 'Assign Specialist' },
    { id: 'e6', from: 'n4', to: 'n5', label: 'Begin Review' },
    { id: 'e7', from: 'n5', to: 'n6', label: 'Submit for Validation' },
    { id: 'e8', from: 'n5', to: 'n10', label: 'Need Clarification' },
    { id: 'e9', from: 'n6', to: 'n7', label: 'Validated' },
    { id: 'e10', from: 'n6', to: 'n10', label: 'Need Clarification' },
    { id: 'e11', from: 'n7', to: 'n8', label: 'Code Created' },
    { id: 'e12', from: 'n10', to: 'n5', label: 'Clarified' },
  ],
  isDefault: true,
};

interface WorkflowState {
  workflow: WorkflowConfig;
  setWorkflow: (config: WorkflowConfig) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      workflow: DEFAULT_WORKFLOW,
      setWorkflow: (config) => set({ workflow: config }),
      resetWorkflow: () => set({ workflow: DEFAULT_WORKFLOW }),
    }),
    { name: 'cm-workflow-config' }
  )
);
