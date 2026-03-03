import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore, useToast } from '../store';
import { Classification, MaterialSubType, ServiceSubType, RequestStatus, RequestItem, AttributeType } from '../types';
import { DynamicForm } from '../components/DynamicForm';
import { ArrowLeft, ArrowRight, Send, Info, AlertTriangle, CheckCircle, Paperclip, X, FileText, Eye } from 'lucide-react';

interface NewRequestProps {
  onNavigate: (page: string, id?: string) => void;
  requestId?: string;
}

const MAX_ATTACHMENT_SIZE = 500_000; // 500KB
const TOTAL_STEPS = 4;

const SERVICE_UOM_OPTIONS = ['Days', 'Hours', 'Lumpsum', 'Each', 'Monthly', 'Weekly', 'Per Visit', 'Per Unit'];

export const NewRequest: React.FC<NewRequestProps> = ({ onNavigate, requestId }) => {
  const { currentUser, priorities, attributes, addRequest, updateRequest, requests, users } = useStore();
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [dbChecked, setDbChecked] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
        setStep(3); // Jump to attributes step for resubmission
      }
    }
  }, [requestId, requests]);

  // Filtered attributes based on classification
  const relevantAttributes = useMemo(() =>
    attributes.filter(a =>
      a.active && (a.visibleForClassification
        ? a.visibleForClassification.includes(formData.classification!)
        : true)
    ),
    [attributes, formData.classification]
  );

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
        if (dims.length > 0) parts.push(dims.join('x') + 'mm');
      } else if (attr.type === AttributeType.MULTI_SELECT && Array.isArray(val)) {
        if (val.length > 0) parts.push(val.join('/'));
      }
    });

    return parts.join(', ');
  }, [relevantAttributes]);

  // Real-time auto-description update
  const generatedDescription = useMemo(() => {
    if (formData.attributes) {
      return generateDescription(formData.attributes);
    }
    return '';
  }, [formData.attributes, generateDescription]);

  // Keep formData.generatedDescription synced
  useEffect(() => {
    setFormData(prev => ({ ...prev, generatedDescription }));
  }, [generatedDescription]);

  const selectedPriority = priorities.find(p => p.id === formData.priorityId);

  // Step-level validation
  const validateStep = (stepNum: number): string[] => {
    const errors: string[] = [];
    switch (stepNum) {
      case 2:
        if (formData.requestType === 'Amendment' && !formData.existingCode?.trim()) {
          errors.push('Existing Oracle Code is required for amendments.');
        }
        if (formData.classification === Classification.SERVICE && !formData.serviceSubType) {
          errors.push('Service Sub-Type is required.');
        }
        break;
      case 3:
        if (!formData.title?.trim()) errors.push('Request Title is required.');
        if (!formData.project?.trim()) errors.push('Project Code is required.');
        // Check mandatory attributes
        relevantAttributes.filter(a => a.mandatory).forEach(a => {
          const val = formData.attributes?.[a.id];
          if (a.type === AttributeType.DIMENSION_BLOCK) {
            const dimVal = val as Record<string, string | number> | undefined;
            if (!dimVal || Object.values(dimVal).every(v => !v)) {
              errors.push(`${a.name} is required.`);
            }
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

  const handleNext = () => {
    const errors = validateStep(step);
    if (errors.length > 0) {
      setValidationErrors(errors);
      addToast(errors[0], 'warning');
      return;
    }
    setValidationErrors([]);
    setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setValidationErrors([]);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    // Final validation across all steps
    const allErrors = [...validateStep(2), ...validateStep(3), ...validateStep(4)];
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      addToast(allErrors[0], 'warning');
      return;
    }
    setValidationErrors([]);

    const initialStatus = selectedPriority?.requiresApproval
      ? RequestStatus.PENDING_APPROVAL
      : RequestStatus.SUBMITTED_TO_POC;

    // Link manager email to system user
    let linkedManagerId: string | undefined;
    if (formData.managerEmail) {
      const managerUser = users.find(u => u.email.toLowerCase() === formData.managerEmail?.toLowerCase());
      if (managerUser) linkedManagerId = managerUser.id;
    }

    if (requestId) {
      // Resubmission logic
      const existingReq = requests.find(r => r.id === requestId);
      let resubStatus = initialStatus;
      if (existingReq && existingReq.priorityId === formData.priorityId && existingReq.assignedSpecialistId) {
        resubStatus = RequestStatus.UNDER_SPECIALIST_REVIEW;
      }

      const updatePayload: Partial<RequestItem> = {
        ...formData,
        status: resubStatus,
        attributes: formData.attributes!,
        generatedDescription: generatedDescription || ''
      };
      if (linkedManagerId) updatePayload.managerId = linkedManagerId;
      updateRequest(requestId, updatePayload, 'Resubmitted Request');
    } else {
      const newRequestPayload: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'stageTimestamps'> = {
        requesterId: currentUser.id,
        classification: formData.classification!,
        priorityId: formData.priorityId!,
        title: formData.title!.trim(),
        description: formData.description || generatedDescription || '',
        project: formData.project!.trim(),
        status: initialStatus,
        attributes: formData.attributes || {},
        generatedDescription: generatedDescription || '',
        justification: formData.justification || '',
        managerName: formData.managerName || '',
        managerEmail: formData.managerEmail || '',
        managerId: linkedManagerId,
        requestType: formData.requestType || 'New',
        existingCode: formData.existingCode || '',
        materialType: formData.materialType || '',
        materialSubType: formData.materialSubType,
        serviceType: formData.serviceType || '',
        serviceSubType: formData.serviceSubType,
        uom: formData.uom || '',
        unspscCode: formData.unspscCode || '',
        resourceCode: formData.resourceCode || '',
        attachments: formData.attachments || []
      };

      addRequest(newRequestPayload);
    }

    onNavigate('dashboard');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_SIZE) {
      addToast(`File too large. Maximum size is ${MAX_ATTACHMENT_SIZE / 1000}KB.`, 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newAttachment = {
        id: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
        name: file.name,
        type: file.type,
        size: file.size,
        url: reader.result as string
      };
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));
      addToast(`${file.name} attached.`, 'info');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stepLabels = ['Database Check', 'Classification', 'Details & Attributes', 'Priority & Review'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{requestId ? 'Edit & Resubmit Request' : 'New Request'}</h2>
        </div>
        <div className="text-sm text-gray-500 font-medium">Step {step} of {TOTAL_STEPS}</div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum || (stepNum === 1 && dbChecked);
          return (
            <div key={label} className="flex-1">
              <div className={`h-2 rounded-full transition-all ${isCompleted ? 'bg-green-500' : isActive ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              <p className={`text-xs mt-1 text-center font-medium ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">

        {/* ====== STEP 1: Database Verification ====== */}
        {step === 1 && (
          <div className="space-y-6 text-center py-8">
            <AlertTriangle size={48} className="mx-auto text-orange-500" />
            <h3 className="text-xl font-bold text-gray-800">Database Verification</h3>
            <p className="text-gray-600 max-w-lg mx-auto">
              Before submitting a request, you must verify that this item or service code does not already exist in the Oracle ERP database.
            </p>

            {!dbChecked ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-amber-800 font-medium mb-4">Have you checked the existing Oracle ERP database for this item code?</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => addToast('You must check the Oracle ERP database before proceeding. Please verify the code does not already exist.', 'warning')}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition"
                  >
                    No, I haven't
                  </button>
                  <button
                    onClick={() => setDbChecked(true)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-200 transition"
                  >
                    Yes, I have checked
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto">
                <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
                <p className="text-green-800 font-medium">Database verification confirmed.</p>
                <button
                  onClick={() => setStep(2)}
                  className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-200 transition flex items-center gap-2 mx-auto"
                >
                  Proceed <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ====== STEP 2: Request Classification & Type ====== */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-700">Request Type & Classification</h3>

            {/* Request Type */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-3">Request Type</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData({ ...formData, requestType: 'New', existingCode: '' })}
                  className={`p-5 border-2 rounded-xl text-left transition-all ${
                    formData.requestType === 'New' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.requestType === 'New' ? 'border-indigo-600' : 'border-gray-300'}`}>
                      {formData.requestType === 'New' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <span className="font-bold text-lg">New Item</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-8">Code does not exist in the system.</p>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, requestType: 'Amendment' })}
                  className={`p-5 border-2 rounded-xl text-left transition-all ${
                    formData.requestType === 'Amendment' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.requestType === 'Amendment' ? 'border-indigo-600' : 'border-gray-300'}`}>
                      {formData.requestType === 'Amendment' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    <span className="font-bold text-lg">Amendment</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-8">Code exists but description requires modification.</p>
                </button>
              </div>
            </div>

            {formData.requestType === 'Amendment' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-amber-800 mb-1">Existing Oracle Code <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full rounded-md border-amber-200 shadow-sm border p-2.5 focus:border-amber-500 focus:ring-amber-500"
                  value={formData.existingCode || ''}
                  onChange={(e) => setFormData({ ...formData, existingCode: e.target.value })}
                  placeholder="Enter the existing Oracle code..."
                />
              </div>
            )}

            {/* Classification */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-600 mb-3">Classification</label>
              <div className="flex gap-4">
                {[Classification.ITEM, Classification.SERVICE].map(c => (
                  <button
                    key={c}
                    onClick={() => setFormData({
                      ...formData,
                      classification: c,
                      materialSubType: c === Classification.ITEM ? MaterialSubType.DIRECT_NONSTOCK : undefined,
                      serviceSubType: c === Classification.SERVICE ? undefined : undefined,
                      attributes: {},
                    })}
                    className={`flex-1 py-3.5 border-2 rounded-lg text-center font-semibold transition-all ${
                      formData.classification === c
                        ? 'bg-gray-800 text-white border-gray-800 shadow-md'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {c === Classification.ITEM ? 'Material (Item)' : 'Service'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Type Selection */}
            {formData.classification === Classification.ITEM && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-3">Material Sub-Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.values(MaterialSubType).map(st => (
                    <button
                      key={st}
                      onClick={() => setFormData({ ...formData, materialSubType: st })}
                      className={`p-3 border-2 rounded-lg text-center text-sm font-medium transition-all ${
                        formData.materialSubType === st
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.classification === Classification.SERVICE && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-3">Service Sub-Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.values(ServiceSubType).map(st => (
                    <button
                      key={st}
                      onClick={() => setFormData({ ...formData, serviceSubType: st })}
                      className={`p-3 border-2 rounded-lg text-center text-sm font-medium transition-all ${
                        formData.serviceSubType === st
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t border-gray-100">
              <button onClick={handleBack} className="text-gray-600 hover:text-gray-800 flex items-center gap-1 transition">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleNext} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition">
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 3: Core Details & Attributes ====== */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-700">Core Details & Specifications</h3>

            {/* Auto-Description Preview */}
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={14} className="text-indigo-500" />
                <h4 className="text-xs uppercase font-bold text-indigo-500">Auto-Generated Description Preview</h4>
              </div>
              <p className="font-mono text-base text-indigo-900 break-all min-h-[24px]">
                {generatedDescription || '(Complete attributes below to generate)'}
              </p>
            </div>

            {/* Core Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Ball Bearing SKF 6205-2RS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Code <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                  value={formData.project || ''}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  placeholder="e.g. PRJ-2026-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UNSPSC Commodity Code</label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                  value={formData.unspscCode || ''}
                  onChange={(e) => setFormData({ ...formData, unspscCode: e.target.value })}
                  placeholder="e.g. 31171500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Code</label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                  value={formData.resourceCode || ''}
                  onChange={(e) => setFormData({ ...formData, resourceCode: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measurement (UOM)
                  {formData.classification === Classification.SERVICE && <span className="text-red-500"> *</span>}
                </label>
                {formData.classification === Classification.SERVICE ? (
                  <select
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.uom || ''}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  >
                    <option value="">Select UOM...</option>
                    {SERVICE_UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                    value={formData.uom || ''}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    placeholder="e.g. Each, Set, Box, Meter"
                  />
                )}
              </div>
            </div>

            {/* Dynamic Attributes */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">
                {formData.classification === Classification.ITEM ? 'Material Attributes' : 'Service Attributes'}
              </h4>
              <DynamicForm
                attributes={relevantAttributes}
                values={formData.attributes || {}}
                onChange={(key, val) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: val } }))}
              />
            </div>

            {/* Attachments */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <Paperclip size={14} /> Attachments
              </h4>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg flex items-center gap-2 transition border border-gray-200">
                  <FileText size={16} />
                  <span className="text-sm font-medium">Choose File</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                </label>
                <span className="text-xs text-gray-500">Max 500KB per file (Images, PDF)</span>
              </div>

              {formData.attachments && formData.attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {formData.attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{att.name}</span>
                        <span className="text-xs text-gray-400">({Math.round(att.size / 1024)} KB)</span>
                      </div>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== att.id) }))}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t border-gray-100">
              <button onClick={handleBack} className="text-gray-600 hover:text-gray-800 flex items-center gap-1 transition">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleNext} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition">
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP 4: Urgency, Priority & Review ====== */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-700">Urgency, Priority & Final Review</h3>

            {/* Priority Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Priority Level <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {priorities.filter(p => p.active).sort((a, b) => a.displayOrder - b.displayOrder).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFormData({ ...formData, priorityId: p.id })}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      formData.priorityId === p.id
                        ? p.name === 'Critical'
                          ? 'border-red-500 bg-red-50 shadow-md'
                          : p.name === 'Urgent'
                            ? 'border-orange-500 bg-orange-50 shadow-md'
                            : 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-base mb-1">{p.name}</div>
                    <p className="text-xs text-gray-500">{p.description}</p>
                    {p.slaHours && (
                      <p className="text-xs font-medium mt-2 text-gray-600">SLA: {p.slaHours}h</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Critical Priority - Approval Fields */}
            {selectedPriority?.requiresApproval && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle size={18} />
                  <span className="font-semibold">Critical Priority - Manager Approval Required</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-800 mb-1">Justification <span className="text-red-600">*</span></label>
                  <textarea
                    className="w-full rounded-lg border-red-200 shadow-sm border p-3 focus:border-red-500 focus:ring-red-500"
                    rows={3}
                    value={formData.justification || ''}
                    onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                    placeholder="Explain why this request is critical and requires same-day processing..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-1">Approving Manager Name <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      className="w-full rounded-lg border-red-200 shadow-sm border p-2.5 focus:border-red-500 focus:ring-red-500"
                      value={formData.managerName || ''}
                      onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-1">Approving Manager Email <span className="text-red-600">*</span></label>
                    <input
                      type="email"
                      className="w-full rounded-lg border-red-200 shadow-sm border p-2.5 focus:border-red-500 focus:ring-red-500"
                      value={formData.managerEmail || ''}
                      onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                      placeholder="e.g. john@company.com"
                    />
                  </div>
                </div>
                <p className="text-xs text-red-600 italic">
                  This request will require manager approval before it reaches the coding team.
                  {selectedPriority.slaHours && ` Must be submitted at least ${selectedPriority.slaHours} hours before end of business.`}
                </p>
              </div>
            )}

            {/* Review Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Eye size={16} /> Request Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Request Type</span>
                  <span className="font-medium text-gray-800">{formData.requestType}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Classification</span>
                  <span className="font-medium text-gray-800">{formData.classification}</span>
                </div>
                {formData.classification === Classification.ITEM && formData.materialSubType && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">Material Sub-Type</span>
                    <span className="font-medium text-gray-800">{formData.materialSubType}</span>
                  </div>
                )}
                {formData.classification === Classification.SERVICE && formData.serviceSubType && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">Service Sub-Type</span>
                    <span className="font-medium text-gray-800">{formData.serviceSubType}</span>
                  </div>
                )}
                {formData.existingCode && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">Existing Code</span>
                    <span className="font-medium text-gray-800">{formData.existingCode}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Title</span>
                  <span className="font-medium text-gray-800 text-right max-w-[200px] truncate">{formData.title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Project Code</span>
                  <span className="font-medium text-gray-800">{formData.project}</span>
                </div>
                {formData.unspscCode && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">UNSPSC Code</span>
                    <span className="font-medium text-gray-800">{formData.unspscCode}</span>
                  </div>
                )}
                {formData.uom && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-500">UOM</span>
                    <span className="font-medium text-gray-800">{formData.uom}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Priority</span>
                  <span className={`font-medium ${selectedPriority?.name === 'Critical' ? 'text-red-600' : selectedPriority?.name === 'Urgent' ? 'text-orange-600' : 'text-green-600'}`}>
                    {selectedPriority?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-500">Attachments</span>
                  <span className="font-medium text-gray-800">{formData.attachments?.length || 0} file(s)</span>
                </div>
              </div>

              {generatedDescription && (
                <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                  <p className="text-xs uppercase font-bold text-indigo-500 mb-1">Auto-Generated Description</p>
                  <p className="font-mono text-sm text-indigo-900">{generatedDescription}</p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t border-gray-100">
              <button onClick={handleBack} className="text-gray-600 hover:text-gray-800 flex items-center gap-1 transition">
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.priorityId}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200 transition disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none font-medium"
              >
                <Send size={18} />
                {requestId ? 'Resubmit Request' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
