import { describe, it, expect } from 'vitest';
import { validateStepFields, validateStepErrors } from '../../lib/validateRequest';
import { Classification, AttributeType } from '../../types';

describe('validateStepFields', () => {
  describe('Step 2 — New Item', () => {
    it('requires database check for new items', () => {
      const errors = validateStepFields(2, { requestType: 'New', classification: Classification.ITEM }, { dbChecked: false });
      expect(errors.dbChecked).toBeDefined();
    });

    it('passes when db is checked', () => {
      const errors = validateStepFields(2, { requestType: 'New', classification: Classification.ITEM }, { dbChecked: true });
      expect(errors.dbChecked).toBeUndefined();
    });

    it('requires serviceSubType for service classification', () => {
      const errors = validateStepFields(2, { requestType: 'New', classification: Classification.SERVICE }, { dbChecked: true });
      expect(errors.serviceSubType).toBeDefined();
    });
  });

  describe('Step 2 — Amendment', () => {
    it('requires existingCode, existingDescription, and proposedDescription', () => {
      const errors = validateStepFields(2, { requestType: 'Amendment' });
      expect(errors.existingCode).toBeDefined();
      expect(errors.existingDescription).toBeDefined();
      expect(errors.proposedDescription).toBeDefined();
    });

    it('passes with all amendment fields filled', () => {
      const errors = validateStepFields(2, {
        requestType: 'Amendment',
        existingCode: 'ABC-123',
        existingDescription: 'Old desc',
        proposedDescription: 'New desc',
      });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('Step 3 — Details', () => {
    it('requires project code', () => {
      const errors = validateStepFields(3, {});
      expect(errors.project).toBeDefined();
    });

    it('validates mandatory text attributes', () => {
      const attrs = [{ id: 'brand', name: 'Brand', mandatory: true, type: AttributeType.TEXT, descriptionOrder: 1, displayOrder: 1, appliesTo: [] as any }];
      const errors = validateStepFields(3, { project: 'P001', attributes: {} }, { relevantAttributes: attrs });
      expect(errors.attr_brand).toBeDefined();
    });

    it('passes with filled project and attributes', () => {
      const attrs = [{ id: 'brand', name: 'Brand', mandatory: true, type: AttributeType.TEXT, descriptionOrder: 1, displayOrder: 1, appliesTo: [] as any }];
      const errors = validateStepFields(3, { project: 'P001', attributes: { brand: 'SKF' } }, { relevantAttributes: attrs });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('Step 4 — Priority', () => {
    it('requires priorityId', () => {
      const errors = validateStepFields(4, {});
      expect(errors.priorityId).toBeDefined();
    });

    it('requires approval fields for critical priority', () => {
      const errors = validateStepFields(4, { priorityId: 'p1' }, { selectedPriority: { requiresApproval: true } });
      expect(errors.justification).toBeDefined();
      expect(errors.managerName).toBeDefined();
      expect(errors.managerEmail).toBeDefined();
    });

    it('validates email format', () => {
      const errors = validateStepFields(4, {
        priorityId: 'p1',
        justification: 'Urgent',
        managerName: 'John',
        managerEmail: 'invalid-email',
      }, { selectedPriority: { requiresApproval: true } });
      expect(errors.managerEmail).toContain('valid email');
    });

    it('passes with valid critical priority data', () => {
      const errors = validateStepFields(4, {
        priorityId: 'p1',
        justification: 'Urgent production need',
        managerName: 'John Doe',
        managerEmail: 'john@company.com',
      }, { selectedPriority: { requiresApproval: true } });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});

describe('validateStepErrors', () => {
  it('returns string array of error messages', () => {
    const errors = validateStepErrors(4, {});
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(typeof errors[0]).toBe('string');
  });
});
