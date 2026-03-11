import React from 'react';
import { AttributeDefinition, AttributeType } from '../types';
import { ComboBoxInput } from './ComboBoxInput';

interface DynamicFormProps {
  attributes: AttributeDefinition[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  readOnly?: boolean;
  /** When true, mandatory fields that are empty get an amber highlight */
  highlightEmpty?: boolean;
  /** Autocomplete suggestions keyed by attribute ID (e.g. { brand: ['SKF', 'Tenaris', ...] }) */
  suggestions?: Record<string, string[]>;
  /** Per-field validation errors keyed by `attr_${id}` */
  fieldErrors?: Record<string, string>;
}

const inputClasses = "w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500/20 border p-2 disabled:bg-slate-100 dark:disabled:bg-slate-800 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400";

const emptyHighlightClasses = "!border-amber-400 dark:!border-amber-500 ring-2 ring-amber-200/50 dark:ring-amber-500/20 bg-amber-50/30 dark:bg-amber-900/10";

/** Check if a value is effectively empty */
function isEmpty(val: any, type: AttributeType): boolean {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'number') return false;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') {
    // DIMENSION_BLOCK or NUMERIC_UNIT
    if (type === AttributeType.NUMERIC_UNIT) {
      return val.value == null || String(val.value).trim() === '';
    }
    // DIMENSION_BLOCK — at least one dimension must be filled
    return !Object.entries(val).some(
      ([k, v]) => k !== '_unit' && String(v || '').trim() !== ''
    );
  }
  return true;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ attributes, values, onChange, readOnly = false, highlightEmpty = false, suggestions = {}, fieldErrors = {} }) => {

  const sortedAttributes = [...attributes].sort((a, b) => a.descriptionOrder - b.descriptionOrder);

  const handleChange = (id: string, val: any) => {
    if (readOnly) return;
    onChange(id, val);
  };

  /** Get classes for an input — adds amber highlight if mandatory + empty + highlightEmpty mode */
  const getInputClasses = (attr: AttributeDefinition, extraClasses = '') => {
    const shouldHighlight =
      highlightEmpty && attr.mandatory && !readOnly && isEmpty(values[attr.id], attr.type);
    return `${extraClasses ? `${extraClasses} ` : ''}${inputClasses}${shouldHighlight ? ` ${emptyHighlightClasses}` : ''}`;
  };

  /** Whether to show the "required" hint under a field */
  const showRequiredHint = (attr: AttributeDefinition) =>
    highlightEmpty && attr.mandatory && !readOnly && isEmpty(values[attr.id], attr.type);

  const RequiredHint = () => (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
      This field is required
    </p>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="group" aria-label="Request attributes">
      {sortedAttributes.map(attr => {
        const shouldHint = showRequiredHint(attr);

        return (
          <div key={attr.id} className={`${attr.type === AttributeType.DIMENSION_BLOCK ? 'md:col-span-2' : ''}`}>
            <label htmlFor={`field-${attr.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5 flex-wrap">
              <span>{attr.name}</span>
              {attr.mandatory && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/60 dark:border-amber-700/40">
                  Required
                </span>
              )}
              {attr.mandatory && <span className="sr-only"> (required)</span>}
            </label>

          {/* Text Input — with autocomplete if suggestions exist */}
          {attr.type === AttributeType.TEXT && (
            <>
              {suggestions[attr.id] && suggestions[attr.id].length > 0 ? (
                <ComboBoxInput
                  id={`field-${attr.id}`}
                  value={values[attr.id] || ''}
                  onChange={(val) => handleChange(attr.id, val)}
                  suggestions={suggestions[attr.id]}
                  disabled={readOnly}
                  aria-required={attr.mandatory || undefined}
                  className={getInputClasses(attr)}
                  placeholder={`Type or select ${attr.name}`}
                />
              ) : (
                <input
                  id={`field-${attr.id}`}
                  type="text"
                  disabled={readOnly}
                  aria-required={attr.mandatory || undefined}
                  value={values[attr.id] || ''}
                  onChange={(e) => handleChange(attr.id, e.target.value)}
                  className={getInputClasses(attr)}
                  placeholder={`Enter ${attr.name}`}
                />
              )}
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Long Text Input */}
          {attr.type === AttributeType.LONG_TEXT && (
            <>
              <textarea
                id={`field-${attr.id}`}
                disabled={readOnly}
                aria-required={attr.mandatory || undefined}
                value={values[attr.id] || ''}
                onChange={(e) => handleChange(attr.id, e.target.value)}
                className={getInputClasses(attr)}
                placeholder={`Enter ${attr.name}`}
                rows={4}
              />
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Numeric Input */}
          {attr.type === AttributeType.NUMERIC && (
            <>
              <input
                id={`field-${attr.id}`}
                type="number"
                disabled={readOnly}
                aria-required={attr.mandatory || undefined}
                aria-label={`${attr.name} value`}
                value={values[attr.id] ?? ''}
                onChange={(e) => handleChange(attr.id, e.target.value === '' ? '' : Number(e.target.value))}
                className={getInputClasses(attr)}
              />
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Numeric + Unit */}
          {attr.type === AttributeType.NUMERIC_UNIT && (
            <>
              <div className="flex gap-2" role="group" aria-label={`${attr.name} with unit`}>
                <input
                  id={`field-${attr.id}`}
                  type="number"
                  disabled={readOnly}
                  aria-required={attr.mandatory || undefined}
                  aria-label={`${attr.name} value`}
                  value={values[attr.id]?.value ?? ''}
                  onChange={(e) => handleChange(attr.id, { ...values[attr.id], value: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={getInputClasses(attr, 'flex-1')}
                />
                <select
                  disabled={readOnly}
                  aria-label={`${attr.name} unit`}
                  value={values[attr.id]?.unit || (attr.units?.[0] || '')}
                  onChange={(e) => handleChange(attr.id, { ...values[attr.id], unit: e.target.value })}
                  className={`w-24 ${inputClasses}`}
                >
                  {attr.units?.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Dropdown */}
          {attr.type === AttributeType.DROPDOWN && (
            <>
              <select
                id={`field-${attr.id}`}
                disabled={readOnly}
                aria-required={attr.mandatory || undefined}
                value={values[attr.id] || ''}
                onChange={(e) => handleChange(attr.id, e.target.value)}
                className={getInputClasses(attr)}
              >
                <option value="">Select...</option>
                {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Multi Select */}
          {attr.type === AttributeType.MULTI_SELECT && (
            <>
              <fieldset aria-label={`${attr.name} options`}>
                <div className={`space-y-2 border border-slate-200/60 dark:border-slate-700/60 p-3 rounded-xl max-h-40 overflow-y-auto bg-slate-50/50 dark:bg-slate-700/30${
                  highlightEmpty && attr.mandatory && !readOnly && isEmpty(values[attr.id], attr.type) ? ` ${emptyHighlightClasses}` : ''
                }`} role="group">
                  {attr.options?.map(opt => {
                      const currentVals = values[attr.id] || [];
                      const isChecked = currentVals.includes(opt);
                      return (
                          <label key={opt} className="flex items-center space-x-2">
                              <input
                                  type="checkbox"
                                  disabled={readOnly}
                                  checked={isChecked}
                                  onChange={(e) => {
                                      const newVals = e.target.checked
                                          ? [...currentVals, opt]
                                          : currentVals.filter((v: string) => v !== opt);
                                      handleChange(attr.id, newVals);
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500/20"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                          </label>
                      );
                  })}
                </div>
              </fieldset>
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

          {/* Dimension Block */}
          {attr.type === AttributeType.DIMENSION_BLOCK && (
            <>
              <fieldset>
                <legend className="sr-only">{attr.name} dimensions</legend>
                <div className={`p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl grid grid-cols-3 gap-4${
                  highlightEmpty && attr.mandatory && !readOnly && isEmpty(values[attr.id], attr.type) ? ` ${emptyHighlightClasses}` : ''
                }`}>
                  {attr.dimensionFields?.map(field => (
                    <div key={field}>
                      <label htmlFor={`field-${attr.id}-${field}`} className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{field}</label>
                      <div className="mt-1 flex items-center">
                        <span className="text-slate-400 mr-2 text-sm" aria-hidden="true">{field.charAt(0)}:</span>
                        <input
                          id={`field-${attr.id}-${field}`}
                          type="number"
                          disabled={readOnly}
                          aria-label={`${attr.name} ${field}`}
                          value={values[attr.id]?.[field] || ''}
                          onChange={(e) => handleChange(attr.id, { ...values[attr.id], [field]: e.target.value })}
                          className={`text-sm ${inputClasses}`}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <label htmlFor={`field-${attr.id}-_unit`} className="text-xs font-medium text-slate-500 dark:text-slate-400">Unit:</label>
                    <select
                      id={`field-${attr.id}-_unit`}
                      disabled={readOnly}
                      aria-label={`${attr.name} unit`}
                      value={values[attr.id]?._unit || 'mm'}
                      onChange={(e) => handleChange(attr.id, { ...values[attr.id], _unit: e.target.value })}
                      className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="inches">inches</option>
                      <option value="feet">feet</option>
                    </select>
                  </div>
                </div>
              </fieldset>
              {shouldHint && <RequiredHint />}
              {fieldErrors[`attr_${attr.id}`] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[`attr_${attr.id}`]}</p>
              )}
            </>
          )}

        </div>
        );
      })}
    </div>
  );
};
