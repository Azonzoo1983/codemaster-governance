import { Classification, RequestItem, AttributeType, AttributeDefinition } from '../types';

/**
 * Per-field validation errors for a given wizard step.
 * Returns Record<string, string> mapping field names to error messages.
 */
export function validateStepFields(
  stepNum: number,
  formData: Partial<RequestItem>,
  options: {
    dbChecked?: boolean;
    relevantAttributes?: AttributeDefinition[];
    selectedPriority?: { requiresApproval?: boolean };
  } = {}
): Record<string, string> {
  const errors: Record<string, string> = {};
  const { dbChecked = false, relevantAttributes = [], selectedPriority } = options;

  switch (stepNum) {
    case 2:
      if (formData.requestType === 'Amendment') {
        if (!formData.existingCode?.trim()) errors.existingCode = 'Existing Oracle Code is required.';
        if (!formData.existingDescription?.trim()) errors.existingDescription = 'Current Oracle Description is required.';
        if (!formData.proposedDescription?.trim()) errors.proposedDescription = 'New Proposed Description is required.';
      } else {
        if (!dbChecked) errors.dbChecked = 'You must confirm database verification.';
        if (formData.classification === Classification.SERVICE && !formData.serviceSubType) {
          errors.serviceSubType = 'Service Sub-Type is required.';
        }
      }
      break;
    case 3:
      if (!formData.project?.trim()) errors.project = 'Project Code is required.';
      relevantAttributes.filter(a => a.mandatory).forEach(a => {
        const val = formData.attributes?.[a.id];
        if (a.type === AttributeType.DIMENSION_BLOCK) {
          const dimVal = val as Record<string, string | number> | undefined;
          if (!dimVal || !Object.entries(dimVal).some(([k, v]) => k !== '_unit' && String(v || '').trim() !== '')) {
            errors[`attr_${a.id}`] = `${a.name} is required (at least one dimension).`;
          }
        } else if (a.type === AttributeType.NUMERIC_UNIT) {
          const numVal = val as Record<string, string | number> | undefined;
          if (!numVal?.value) errors[`attr_${a.id}`] = `${a.name} is required.`;
        } else if (!val || (typeof val === 'string' && !val.trim())) {
          errors[`attr_${a.id}`] = `${a.name} is required.`;
        }
      });
      break;
    case 4:
      if (!formData.priorityId) errors.priorityId = 'Priority Level is required.';
      if (selectedPriority?.requiresApproval) {
        if (!formData.justification?.trim()) errors.justification = 'Justification is required for Critical priority.';
        if (!formData.managerName?.trim()) errors.managerName = 'Approving Manager Name is required.';
        if (!formData.managerEmail?.trim()) errors.managerEmail = 'Approving Manager Email is required.';
        if (formData.managerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.managerEmail)) {
          errors.managerEmail = 'Please enter a valid email address.';
        }
      }
      break;
  }
  return errors;
}

/**
 * Validation as string[] (backward compat with the original validateStep).
 */
export function validateStepErrors(
  stepNum: number,
  formData: Partial<RequestItem>,
  options: {
    dbChecked?: boolean;
    relevantAttributes?: AttributeDefinition[];
    selectedPriority?: { requiresApproval?: boolean };
  } = {}
): string[] {
  return Object.values(validateStepFields(stepNum, formData, options));
}
