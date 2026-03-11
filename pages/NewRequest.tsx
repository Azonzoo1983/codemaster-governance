import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserStore, useAdminStore, useRequestStore, useToastStore, useBrandStore } from '../stores';
import { Classification, MaterialSubType, RequestStatus, RequestItem, AttributeType } from '../types';
import { ArrowLeft, ArrowRight, Send, Info, Save } from 'lucide-react';
import { uploadFile, validateFile, formatFileSize } from '../lib/fileUpload';
import { StepRequestType } from './steps/StepRequestType';
import { StepClassification } from './steps/StepClassification';
import { StepDetails } from './steps/StepDetails';
import { StepPriority } from './steps/StepPriority';
import { findPotentialDuplicates, DuplicateMatch } from '../lib/duplicateDetection';

const MAX_ATTACHMENT_SIZE = 10_000_000; // 10MB (upgraded with Supabase Storage)
const TOTAL_STEPS = 4;
const AUTOSAVE_KEY = 'cm-draft-autosave';
const AUTOSAVE_INTERVAL = 30_000; // 30 seconds


export const NewRequest: React.FC = () => {
  const navigate = useNavigate();
  const { id: requestId } = useParams();
  const currentUser = useUserStore((s) => s.currentUser);
  const priorities = useAdminStore((s) => s.priorities);
  const attributes = useAdminStore((s) => s.attributes);
  const addRequest = useRequestStore((s) => s.addRequest);
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const requests = useRequestStore((s) => s.requests);
  const users = useUserStore((s) => s.users);
  const addToast = useToastStore((s) => s.addToast);
  const brands = useBrandStore((s) => s.brands);
  const addBrand = useBrandStore((s) => s.addBrand);

  const [step, setStep] = useState(1);
  const [dbChecked, setDbChecked] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [autoSaveIndicator, setAutoSaveIndicator] = useState(false);
  const autoSaveIndicatorKey = useRef(0);

  const [formData, setFormData] = useState<Partial<RequestItem>>({
    classification: Classification.ITEM,
    attributes: {},
    requestType: 'New',
    materialSubType: MaterialSubType.DIRECT_NONSTOCK,
  });

  // Load existing request data if in edit mode
  useEffect(() => {
    if (requestId) {
      const req = requests.find(r => r.id === requestId);
      if (req) {
        setFormData({ ...req });
        setDbChecked(true);
        // Amendments skip Step 3 — open on Step 2 (Amendment Details) instead
        setStep(req.requestType === 'Amendment' ? 2 : 3);
      }
    }
  }, [requestId, requests]);

  // Check for saved draft on mount (only for new requests)
  useEffect(() => {
    if (requestId) return;
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        setShowDraftBanner(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [requestId]);

  // Auto-save every 30 seconds (only for new requests)
  useEffect(() => {
    if (requestId) return;
    const interval = setInterval(() => {
      try {
        const draftData = {
          step,
          dbChecked,
          formData: {
            ...formData,
            attachments: (formData.attachments || []).map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              size: a.size,
              url: a.url,
            })),
          },
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draftData));
        autoSaveIndicatorKey.current += 1;
        setAutoSaveIndicator(true);
        setTimeout(() => setAutoSaveIndicator(false), 2000);
      } catch {
        // Ignore localStorage errors
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [requestId, step, dbChecked, formData]);

  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.formData) setFormData(draft.formData);
        if (draft.step) setStep(draft.step);
        if (draft.dbChecked) setDbChecked(draft.dbChecked);
      }
    } catch {
      // Ignore parse errors
    }
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // Ignore
    }
    setShowDraftBanner(false);
  };

  const handleManualSave = () => {
    try {
      const draftData = {
        step,
        dbChecked,
        formData: {
          ...formData,
          attachments: (formData.attachments || []).map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            size: a.size,
            url: a.url,
          })),
        },
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draftData));
      autoSaveIndicatorKey.current += 1;
      setAutoSaveIndicator(true);
      setTimeout(() => setAutoSaveIndicator(false), 2000);
      addToast('Draft saved successfully.', 'info');
    } catch {
      addToast('Could not save draft.', 'warning');
    }
  };

  // Filtered attributes based on classification
  const relevantAttributes = useMemo(() =>
    attributes.filter(a =>
      a.active && (a.visibleForClassification && formData.classification
        ? a.visibleForClassification.includes(formData.classification)
        : true)
    ),
    [attributes, formData.classification]
  );

  // Brand autocomplete suggestions: admin-managed brands + unique brands from existing requests
  const attributeSuggestions = useMemo(() => {
    const brandNames = new Set(brands.filter((b) => b.active).map((b) => b.name));
    // Also collect brand values used in existing requests
    for (const req of requests) {
      const brandVal = req.attributes?.brand;
      if (typeof brandVal === 'string' && brandVal.trim()) {
        brandNames.add(brandVal.trim());
      }
    }
    return { brand: [...brandNames].sort((a, b) => a.localeCompare(b)) };
  }, [brands, requests]);

  const projectSuggestions = useMemo(() => {
    const projects = new Set<string>();
    for (const req of requests) {
      if (req.project?.trim()) projects.add(req.project.trim());
    }
    return Array.from(projects).sort();
  }, [requests]);

  // Auto-Description Logic
  const generateDescription = useCallback((attrs: Record<string, string | number | string[] | Record<string, string | number>>) => {
    const activeAttrs = relevantAttributes
      .filter(a => a.includeInAutoDescription)
      .sort((a, b) => a.descriptionOrder - b.descriptionOrder);

    const parts: string[] = [];

    activeAttrs.forEach(attr => {
      const val = attrs[attr.id];
      if (!val) return;

      if (attr.type === AttributeType.TEXT || attr.type === AttributeType.LONG_TEXT || attr.type === AttributeType.DROPDOWN || attr.type === AttributeType.NUMERIC) {
        parts.push(String(val));
      } else if (attr.type === AttributeType.NUMERIC_UNIT && typeof val === 'object' && !Array.isArray(val)) {
        const numUnit = val as Record<string, string | number>;
        if (numUnit.value) parts.push(`${numUnit.value}${numUnit.unit || ''}`);
      } else if (attr.type === AttributeType.DIMENSION_BLOCK && typeof val === 'object' && !Array.isArray(val)) {
        const dimVal = val as Record<string, string | number>;
        const dims: string[] = [];
        attr.dimensionFields?.forEach(field => {
          if (dimVal[field]) dims.push(`${field.charAt(0)}${dimVal[field]}`);
        });
        if (dims.length > 0) parts.push(dims.join('x') + (dimVal._unit || 'mm'));
      } else if (attr.type === AttributeType.MULTI_SELECT && Array.isArray(val)) {
        if (val.length > 0) parts.push(val.join('/'));
      }
    });

    return parts.join(' ');
  }, [relevantAttributes]);

  // Real-time auto-description update
  const generatedDescription = useMemo(() => {
    if (formData.attributes) {
      return generateDescription(formData.attributes);
    }
    return '';
  }, [formData.attributes, generateDescription]);

  const potentialDuplicates = useMemo(() => {
    return findPotentialDuplicates(formData, requests, requestId);
  }, [formData.generatedDescription, formData.unspscCode, formData.attributes, requests, requestId]);

  // Keep formData.generatedDescription synced
  useEffect(() => {
    setFormData(prev => ({ ...prev, generatedDescription }));
  }, [generatedDescription]);

  // Keyboard shortcuts: Ctrl+S to save draft, Ctrl+Enter to submit
  const keyboardHandlersRef = useRef<{ save: () => void; submit: () => void }>({ save: () => {}, submit: () => {} });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        keyboardHandlersRef.current.save();
      }
      if (e.key === 'Enter' && step === TOTAL_STEPS) {
        e.preventDefault();
        keyboardHandlersRef.current.submit();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  const selectedPriority = priorities.find(p => p.id === formData.priorityId);

  // Step-level validation
  const validateStep = (stepNum: number): string[] => {
    const errors: string[] = [];
    switch (stepNum) {
      case 1:
        // Request Type always has a default selection, no validation needed
        break;
      case 2:
        if (formData.requestType === 'Amendment') {
          if (!formData.existingCode?.trim()) {
            errors.push('Existing Oracle Code is required for amendments.');
          }
          if (!formData.existingDescription?.trim()) {
            errors.push('Current Oracle Description is required for amendments.');
          }
          if (!formData.proposedDescription?.trim()) {
            errors.push('New Proposed Description is required for amendments.');
          }
        } else {
          // DB Check + Classification validation for New requests
          if (!dbChecked) {
            errors.push('You must confirm database verification before proceeding.');
          }
          if (formData.classification === Classification.SERVICE && !formData.serviceSubType) {
            errors.push('Service Sub-Type is required.');
          }
        }
        break;
      case 3:
        // Title auto-derived from short description at submit time
        if (!formData.project?.trim()) errors.push('Project Code is required.');
        relevantAttributes.filter(a => a.mandatory).forEach(a => {
          const val = formData.attributes?.[a.id];
          if (a.type === AttributeType.DIMENSION_BLOCK) {
            // At least one dimension field must have a value (aligned with bulkUploadHelpers)
            const dimVal = val as Record<string, string | number> | undefined;
            if (!dimVal || !Object.entries(dimVal).some(
              ([k, v]) => k !== '_unit' && String(v || '').trim() !== ''
            )) {
              errors.push(`${a.name} is required (at least one dimension).`);
            }
            return;
          } else if (a.type === AttributeType.NUMERIC_UNIT) {
            const numVal = val as Record<string, string | number> | undefined;
            if (!numVal?.value) errors.push(`${a.name} is required.`);
          } else if (!val || (typeof val === 'string' && !val.trim())) {
            errors.push(`${a.name} is required.`);
          }
        });
        break;
      case 4:
        if (!formData.priorityId) errors.push('Priority Level is required.');
        if (selectedPriority?.requiresApproval) {
          if (!formData.justification?.trim()) errors.push('Justification is required for Critical priority.');
          if (!formData.managerName?.trim()) errors.push('Approving Manager Name is required.');
          if (!formData.managerEmail?.trim()) errors.push('Approving Manager Email is required.');
          if (formData.managerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.managerEmail)) {
            errors.push('Please enter a valid manager email address.');
          }
        }
        break;
    }
    return errors;
  };

  const validateStepFields = (stepNum: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    switch (stepNum) {
      case 2:
        if (formData.requestType === 'Amendment') {
          if (!formData.existingCode?.trim()) errors.existingCode = 'Existing Oracle Code is required.';
          if (!formData.existingDescription?.trim()) errors.existingDescription = 'Current Oracle Description is required.';
          if (!formData.proposedDescription?.trim()) errors.proposedDescription = 'New Proposed Description is required.';
        } else {
          if (!dbChecked) errors.dbChecked = 'You must confirm database verification.';
          if (formData.classification === Classification.SERVICE && !formData.serviceSubType) errors.serviceSubType = 'Service Sub-Type is required.';
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
  };

  const isAmendment = formData.requestType === 'Amendment';

  const handleNext = () => {
    const errors = validateStep(step);
    const fields = validateStepFields(step);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setFieldErrors(fields);
      addToast(errors[0], 'warning');
      return;
    }
    setValidationErrors([]);
    setFieldErrors({});
    // Amendments skip Step 3 (Details & Attributes) — go from Step 2 directly to Step 4
    if (isAmendment && step === 2) {
      setStep(4);
    } else {
      setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    setFieldErrors({});
    // Amendments skip Step 3 — go from Step 4 back to Step 2
    if (isAmendment && step === 4) {
      setStep(2);
    } else {
      setStep(prev => Math.max(prev - 1, 1));
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    const allErrors = isAmendment
      ? [...validateStep(1), ...validateStep(2), ...validateStep(4)]
      : [...validateStep(1), ...validateStep(2), ...validateStep(3), ...validateStep(4)];
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      const allFieldErrors = isAmendment
        ? { ...validateStepFields(1), ...validateStepFields(2), ...validateStepFields(4) }
        : { ...validateStepFields(1), ...validateStepFields(2), ...validateStepFields(3), ...validateStepFields(4) };
      setFieldErrors(allFieldErrors);
      addToast(allErrors[0], 'warning');
      return;
    }
    setValidationErrors([]);
    setFieldErrors({});

    const initialStatus = selectedPriority?.requiresApproval
      ? RequestStatus.PENDING_APPROVAL
      : RequestStatus.SUBMITTED_TO_POC;

    let linkedManagerId: string | undefined;
    if (formData.managerEmail) {
      const managerUser = users.find(u => u.email.toLowerCase() === formData.managerEmail?.toLowerCase());
      if (managerUser) linkedManagerId = managerUser.id;
    }

    if (requestId) {
      const existingReq = requests.find(r => r.id === requestId);
      let resubStatus = initialStatus;
      if (existingReq && existingReq.priorityId === formData.priorityId && existingReq.assignedSpecialistId) {
        resubStatus = RequestStatus.UNDER_SPECIALIST_REVIEW;
      }

      const updatePayload: Partial<RequestItem> = {
        ...formData,
        status: resubStatus,
        attributes: formData.attributes || {},
        generatedDescription: generatedDescription || ''
      };
      if (linkedManagerId) updatePayload.managerId = linkedManagerId;
      updateRequest(requestId, updatePayload, 'Resubmitted Request');
    } else {
      const newRequestPayload: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'> = {
        requesterId: currentUser.id,
        classification: formData.classification || Classification.ITEM,
        priorityId: formData.priorityId || '',
        title: (formData.shortDescription || generatedDescription?.slice(0, 240) || (isAmendment ? `Amendment: ${formData.existingCode}` : '') || formData.classification || 'New Request').trim(),
        description: formData.description || generatedDescription || (isAmendment ? formData.proposedDescription : '') || '',
        project: formData.project?.trim() || '',
        status: initialStatus,
        attributes: formData.attributes || {},
        generatedDescription: generatedDescription || '',
        justification: formData.justification || '',
        managerName: formData.managerName || '',
        managerEmail: formData.managerEmail || '',
        managerId: linkedManagerId,
        requestType: formData.requestType || 'New',
        existingCode: formData.existingCode || '',
        shortDescription: formData.shortDescription || generatedDescription?.slice(0, 240) || '',
        longDescription: formData.longDescription || '',
        existingDescription: formData.existingDescription || '',
        materialType: formData.materialType || '',
        materialSubType: formData.materialSubType,
        serviceType: formData.serviceType || '',
        serviceSubType: formData.serviceSubType,
        uom: formData.uom || '',
        unspscCode: formData.unspscCode || '',
        resourceCode: formData.resourceCode || '',
        proposedDescription: formData.proposedDescription || '',
        attachments: formData.attachments || []
      };

      setSubmitting(true);
      addRequest(newRequestPayload);
    }

    // Auto-add new brand to brand master data (so it shows up for future requests)
    const brandVal = formData.attributes?.brand;
    if (typeof brandVal === 'string' && brandVal.trim()) {
      const exists = brands.some((b) => b.name.toLowerCase() === brandVal.trim().toLowerCase());
      if (!exists) {
        addBrand(brandVal.trim());
      }
    }

    // Clear auto-saved draft on successful submission
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
    navigate('/');
  };

  // Update keyboard shortcut refs (must be after handleManualSave & handleSubmit)
  keyboardHandlersRef.current = { save: handleManualSave, submit: handleSubmit };

  const [uploading, setUploading] = useState(false);

  const uploadSingleFile = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      addToast(validation.error || 'Invalid file.', 'warning');
      return;
    }

    try {
      const result = await uploadFile(file, currentUser.id);
      const newAttachment = {
        id: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
        name: file.name,
        type: file.type,
        size: file.size,
        url: result.url,
      };
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));
      addToast(`${file.name} uploaded (${formatFileSize(file.size)}).`, 'info');
    } catch (err: any) {
      addToast(`Upload failed for ${file.name}: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        await uploadSingleFile(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        await uploadSingleFile(file);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const stepLabels = isAmendment
    ? ['Request Type', 'Amendment Details', 'Details & Attributes', 'Priority & Review']
    : ['Request Type', 'DB Check & Classification', 'Details & Attributes', 'Priority & Review'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Draft Resume Banner */}
      {showDraftBanner && !requestId && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-700/60 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info size={18} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Resume your previous draft?</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Discard
            </button>
            <button
              onClick={handleResumeDraft}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => step > 1 ? handleBack() : navigate('/')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition" title={step > 1 ? `Back to Step ${step - 1}` : 'Back to Dashboard'}>
            <ArrowLeft size={20} strokeWidth={1.75} className="text-slate-700 dark:text-slate-300" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{requestId ? 'Edit & Resubmit Request' : 'New Request'}</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save indicator */}
          {autoSaveIndicator && (
            <span key={autoSaveIndicatorKey.current} className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-autosave-fade">
              Draft saved
            </span>
          )}
          {/* Manual Save Draft button (only for new requests) */}
          {!requestId && (
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 transition"
              title="Save draft"
            >
              <Save size={14} strokeWidth={1.75} />
              Save Draft
            </button>
          )}
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Step {isAmendment ? (step <= 2 ? step : step - 1) : step} of {isAmendment ? TOTAL_STEPS - 1 : TOTAL_STEPS}
          </div>
        </div>
      </div>

      {/* Step Indicator — Clickable for completed steps */}
      <div className="flex items-center gap-1" role="list" aria-label="Request form steps">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          // Hide Step 3 for amendments
          if (isAmendment && stepNum === 3) return null;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          const canClick = isCompleted && !isActive;
          return (
            <button
              key={label}
              type="button"
              className={`flex-1 group ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${stepNum}: ${label} - ${isActive ? 'current' : isCompleted ? 'completed, click to go back' : 'upcoming'}`}
              onClick={() => {
                if (canClick) {
                  setValidationErrors([]);
                  setFieldErrors({});
                  setStep(stepNum);
                }
              }}
              disabled={!canClick && !isActive}
              tabIndex={canClick ? 0 : -1}
            >
              <div className={`h-2 rounded-full transition-all ${isCompleted ? 'step-completed' : isActive ? 'step-active' : 'bg-slate-200 dark:bg-slate-700'} ${canClick ? 'group-hover:opacity-80 group-hover:scale-y-150 transform transition-transform' : ''}`} />
              <p className={`text-xs mt-1 text-center font-medium transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} ${canClick ? 'group-hover:text-emerald-700 dark:group-hover:text-emerald-300 group-hover:underline' : ''}`}>
                {label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div id="validation-errors" role="alert" className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200/60 dark:border-rose-700/60 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300 mb-2">Please fix the following errors:</h4>
          <ul className="list-disc list-inside text-sm text-rose-700 dark:text-rose-400 space-y-1">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-premium-md border border-slate-200/60 dark:border-slate-700/60">

        {/* ====== STEP 1: Request Type ====== */}
        {step === 1 && (
          <div className="space-y-6">
            <StepRequestType formData={formData} setFormData={setFormData} />
            <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleNext} className="btn-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition" aria-label="Go to Step 2">
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 2: DB Check & Classification / Amendment Details ====== */}
        {step === 2 && (
          <div className="space-y-6">
            <StepClassification
              isAmendment={isAmendment}
              formData={formData}
              setFormData={setFormData}
              dbChecked={dbChecked}
              setDbChecked={setDbChecked}
              addToast={addToast}
              fieldErrors={fieldErrors}
            />
            <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleBack} className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition" aria-label="Go back to Step 1: Request Type">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleNext} className="btn-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition" aria-label={isAmendment ? "Go to Priority & Review" : "Go to Step 3: Details & Attributes"}>
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 3: Core Details & Attributes ====== */}
        {step === 3 && (
          <div className="space-y-6">
            <StepDetails
              formData={formData}
              setFormData={setFormData}
              generatedDescription={generatedDescription}
              relevantAttributes={relevantAttributes}
              attributeSuggestions={attributeSuggestions}
              projectSuggestions={projectSuggestions}
              requestId={requestId}
              uploading={uploading}
              onFileUpload={handleFileUpload}
              onFileDrop={handleFileDrop}
              fieldErrors={fieldErrors}
              potentialDuplicates={potentialDuplicates}
            />
            <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleBack} className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition" aria-label="Go back to Step 2: DB Check & Classification">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleNext} className="btn-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition" aria-label="Go to Step 4: Priority & Review">
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 4: Urgency, Priority & Review ====== */}
        {step === 4 && (
          <div className="space-y-6">
            <StepPriority
              formData={formData}
              setFormData={setFormData}
              fieldErrors={fieldErrors}
              priorities={priorities}
              selectedPriority={selectedPriority}
              isAmendment={isAmendment}
              generatedDescription={generatedDescription}
            />
            <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleBack} className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition" aria-label="Go back to Step 3: Details & Attributes">
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.priorityId || submitting}
                className="btn-success text-white px-8 py-3 rounded-lg flex items-center gap-2 transition disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed font-medium"
                aria-label={requestId ? 'Resubmit request' : 'Submit request'}
              >
                <Send size={18} strokeWidth={1.75} />
                {requestId ? 'Resubmit Request' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
