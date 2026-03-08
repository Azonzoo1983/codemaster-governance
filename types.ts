export enum Role {
  REQUESTER = 'Requester',
  MANAGER = 'Manager',
  POC = 'One Point of Contact',
  SPECIALIST = 'Item Coding Specialist',
  TECHNICAL_REVIEWER = 'Technical Reviewer',
  ADMIN = 'Admin'
}

export enum RequestStatus {
  DRAFT = 'Draft',
  PENDING_APPROVAL = 'Pending Approval',
  SUBMITTED_TO_POC = 'Submitted to POC',
  ASSIGNED = 'Assigned',
  UNDER_SPECIALIST_REVIEW = 'Under Specialist Review',
  RETURNED_FOR_CLARIFICATION = 'Returned for Clarification',
  REJECTED = 'Rejected',
  UNDER_TECHNICAL_VALIDATION = 'Under Technical Validation',
  PENDING_ORACLE_CREATION = 'Pending Manual Oracle Creation',
  COMPLETED = 'Completed'
}

export enum Classification {
  ITEM = 'Item',
  SERVICE = 'Service'
}

export enum MaterialSubType {
  DIRECT_NONSTOCK = 'Direct (Nonstock)',
  INVENTORY_STOCK = 'Inventory (Stock)',
}

export enum ServiceSubType {
  GENERAL = 'General Service',
  MAINTENANCE = 'Maintenance',
  CONSULTING = 'Consulting',
  LOGISTICS = 'Logistics',
  SUBCONTRACTING = 'Subcontracting',
  SOFTWARE_IT = 'Software/IT',
  OTHER = 'Other'
}

export enum AttributeType {
  TEXT = 'Text',
  LONG_TEXT = 'Long Text',
  DROPDOWN = 'Dropdown',
  MULTI_SELECT = 'Multi-select',
  NUMERIC = 'Numeric',
  NUMERIC_UNIT = 'Numeric + Unit',
  DIMENSION_BLOCK = 'Structured Dimension Block',
  DATE = 'Date'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  contactNumber?: string;
  projectNumber?: string;
  projectName?: string;
}

export interface Priority {
  id: string;
  name: string;
  description: string; // Guidance text explaining timing and rules
  requiresApproval: boolean;
  slaHours?: number;
  active: boolean;
  displayOrder: number;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: AttributeType;
  mandatory: boolean;
  options?: string[]; // For dropdowns
  units?: string[]; // For numeric + unit
  active: boolean;
  includeInAutoDescription: boolean;
  descriptionOrder: number;
  visibleForClassification?: Classification[]; // Which classifications this attribute applies to
  dimensionFields?: string[]; // e.g. ['Length', 'Width', 'Height'] - for Dimension Block type
}

export interface RequestItem {
  id: string;
  requesterId: string;
  classification: Classification;
  priorityId: string;
  title: string;
  description: string; // The core description
  project: string;
  status: RequestStatus;
  
  // Dynamic Attributes - keyed by AttributeDefinition.id
  attributes: Record<string, string | number | string[] | Record<string, string | number>>;
  
  // Auto-generated description based on logic
  generatedDescription: string;
  
  // Workflow fields
  managerId?: string; // System ID if linked
  managerName?: string; // Manual Entry for urgency
  managerEmail?: string; // Manual Entry for urgency

  assignedSpecialistId?: string;
  technicalReviewerId?: string;
  
  justification?: string;
  rejectionReason?: string;
  clarificationComments?: string[];

  // Additional Item Details
  requestType?: 'New' | 'Amendment';
  existingCode?: string;
  materialType?: string;
  materialSubType?: MaterialSubType;
  serviceType?: string;
  serviceSubType?: ServiceSubType;
  uom?: string;
  unspscCode?: string;
  resourceCode?: string;

  // Final Oracle Data
  oracleCode?: string;
  finalDescription?: string;

  attachments?: Attachment[];

  // Stage-level SLA tracking
  stageTimestamps: StageTimestamp[];

  // Clarification thread
  clarificationThread?: ClarificationComment[];

  createdAt: string;
  updatedAt: string;
  history: AuditLog[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string; // Base64 or Storage URL
  type: string;
  size: number;
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
  changedFields?: { field: string; oldValue: string; newValue: string }[];
}

export interface StageTimestamp {
  status: RequestStatus;
  enteredAt: string;
  exitedAt?: string;
  durationHours?: number;
}

export interface InviteToken {
  id: string;
  email: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  role?: Role;
}

export interface ClarificationComment {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

// Initial Mock Data Helpers
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Requester', email: 'alice@company.com', role: Role.REQUESTER, department: 'Engineering' },
  { id: 'u2', name: 'Bob Manager', email: 'bob@company.com', role: Role.MANAGER, department: 'Engineering' },
  { id: 'u3', name: 'Charlie POC', email: 'charlie@company.com', role: Role.POC, department: 'Procurement' },
  { id: 'u4', name: 'David Specialist', email: 'david@company.com', role: Role.SPECIALIST, department: 'Master Data' },
  { id: 'u5', name: 'Eve Reviewer', email: 'eve@company.com', role: Role.TECHNICAL_REVIEWER, department: 'Engineering' },
  { id: 'u6', name: 'Frank Admin', email: 'frank@company.com', role: Role.ADMIN, department: 'IT' },
];

export const MOCK_PRIORITIES: Priority[] = [
  { 
    id: 'p1', 
    name: 'Normal', 
    description: 'Processed within 2 working days.',
    requiresApproval: false, 
    slaHours: 48, 
    active: true, 
    displayOrder: 1 
  },
  { 
    id: 'p2', 
    name: 'Urgent', 
    description: 'Processed within 1 working day.',
    requiresApproval: false, 
    slaHours: 24, 
    active: true, 
    displayOrder: 2 
  },
  { 
    id: 'p3', 
    name: 'Critical', 
    description: 'Same day if submitted 4 hours before EOB. Requires Manager Approval and Justification.',
    requiresApproval: true, 
    slaHours: 4, 
    active: true, 
    displayOrder: 3 
  },
];

export const MOCK_ATTRIBUTES: AttributeDefinition[] = [
  // Material Attributes
  { id: 'mat_type', name: 'Material Type & Specs', type: AttributeType.TEXT, mandatory: true, active: true, includeInAutoDescription: true, descriptionOrder: 1, visibleForClassification: [Classification.ITEM] },
  { id: 'mat_grade', name: 'Material Grade/Classification', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 2, visibleForClassification: [Classification.ITEM] },
  { id: 'size_dim', name: 'Size & Dimensions', type: AttributeType.DIMENSION_BLOCK, dimensionFields: ['Length', 'Width', 'Height', 'Thickness', 'Diameter'], mandatory: true, active: true, includeInAutoDescription: true, descriptionOrder: 3, visibleForClassification: [Classification.ITEM] },
  { id: 'part_num', name: 'Part Number/Ref Code', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 4, visibleForClassification: [Classification.ITEM] },
  { id: 'machine_info', name: 'Machine/Equipment Name & Model', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 5, visibleForClassification: [Classification.ITEM] },
  { id: 'surface', name: 'Surface Finish/Coating', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 6, visibleForClassification: [Classification.ITEM] },
  { id: 'weight', name: 'Weight', type: AttributeType.NUMERIC_UNIT, units: ['kg', 'g', 'lb', 'oz', 'ton'], mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 7, visibleForClassification: [Classification.ITEM] },
  { id: 'origin', name: 'Country of Origin', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: false, descriptionOrder: 99, visibleForClassification: [Classification.ITEM] },
  { id: 'brand', name: 'Brand/Manufacturer', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 8, visibleForClassification: [Classification.ITEM] },
  { id: 'certs', name: 'Certification / SDS / TDS', type: AttributeType.MULTI_SELECT, options: ['SDS', 'TDS', 'Inspection Report', 'Test Report', 'Mill Cert'], mandatory: false, active: true, includeInAutoDescription: false, descriptionOrder: 99, visibleForClassification: [Classification.ITEM] },
  { id: 'standards', name: 'Compliance Standards', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 9, visibleForClassification: [Classification.ITEM] },
  { id: 'shelf_life', name: 'Shelf Life / Expiry', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: false, descriptionOrder: 99, visibleForClassification: [Classification.ITEM] },
  { id: 'warranty', name: 'Warranty Details', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: false, descriptionOrder: 99, visibleForClassification: [Classification.ITEM] },
  { id: 'conditions', name: 'Operating Conditions', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 10, visibleForClassification: [Classification.ITEM] },
  { id: 'color', name: 'Color', type: AttributeType.TEXT, mandatory: false, active: true, includeInAutoDescription: true, descriptionOrder: 11, visibleForClassification: [Classification.ITEM] },
  { id: 'drawings', name: 'Drawings/Graphics Available?', type: AttributeType.DROPDOWN, options: ['Yes', 'No'], mandatory: false, active: true, includeInAutoDescription: false, descriptionOrder: 99, visibleForClassification: [Classification.ITEM] },
  
  // Service Attributes
  { id: 'svc_details', name: 'Service Details/Specs', type: AttributeType.LONG_TEXT, mandatory: true, active: true, includeInAutoDescription: true, descriptionOrder: 1, visibleForClassification: [Classification.SERVICE] },
];