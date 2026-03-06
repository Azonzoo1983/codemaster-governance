import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bookmark, X, Check } from 'lucide-react';

export interface FilterPreset {
  id: string;
  name: string;
  statusFilter: string;
  priorityFilter: string;
  classificationFilter: string;
  searchQuery: string;
}

interface FilterPresetsProps {
  currentFilters: {
    statusFilter: string;
    priorityFilter: string;
    classificationFilter: string;
    searchQuery: string;
  };
  onApplyPreset: (preset: FilterPreset) => void;
}

const STORAGE_KEY = 'cm-filter-presets';
const MAX_PRESETS = 10;

function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FilterPreset[];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function countActiveFilters(preset: FilterPreset): number {
  let count = 0;
  if (preset.statusFilter !== 'all') count++;
  if (preset.priorityFilter !== 'all') count++;
  if (preset.classificationFilter !== 'all') count++;
  if (preset.searchQuery.trim()) count++;
  return count;
}

function filtersMatch(
  a: FilterPreset,
  b: { statusFilter: string; priorityFilter: string; classificationFilter: string; searchQuery: string }
): boolean {
  return (
    a.statusFilter === b.statusFilter &&
    a.priorityFilter === b.priorityFilter &&
    a.classificationFilter === b.classificationFilter &&
    a.searchQuery === b.searchQuery
  );
}

export const FilterPresets: React.FC<FilterPresetsProps> = ({ currentFilters, onApplyPreset }) => {
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { savePresets(presets); }, [presets]);

  useEffect(() => {
    if (showSavePopover && inputRef.current) inputRef.current.focus();
  }, [showSavePopover]);

  useEffect(() => {
    if (!showSavePopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSavePopover(false);
        setNewPresetName('');
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [showSavePopover]);

  const activePresetId = useMemo(() => {
    const match = presets.find((p) => filtersMatch(p, currentFilters));
    return match?.id ?? null;
  }, [presets, currentFilters]);

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name || presets.length >= MAX_PRESETS) return;
    const preset: FilterPreset = {
      id: 'fp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name,
      statusFilter: currentFilters.statusFilter,
      priorityFilter: currentFilters.priorityFilter,
      classificationFilter: currentFilters.classificationFilter,
      searchQuery: currentFilters.searchQuery,
    };
    setPresets((prev) => [...prev, preset]);
    setNewPresetName('');
    setShowSavePopover(false);
  };

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const hasActiveFilter =
    currentFilters.statusFilter !== 'all' ||
    currentFilters.priorityFilter !== 'all' ||
    currentFilters.classificationFilter !== 'all' ||
    currentFilters.searchQuery.trim() !== '';

  if (presets.length === 0 && !hasActiveFilter) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((preset) => {
        const filterCount = countActiveFilters(preset);
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onApplyPreset(preset)}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className="truncate max-w-[120px]">{preset.name}</span>
            {filterCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {filterCount}
              </span>
            )}
            <span
              role="button"
              aria-label={`Delete preset ${preset.name}`}
              onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
              className={`ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400'}`}
            >
              <X size={12} />
            </span>
          </button>
        );
      })}

      {hasActiveFilter && (
        <div className="relative">
          <button
            onClick={() => setShowSavePopover((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
            aria-label="Save current filters as preset"
          >
            <Bookmark size={12} />
            Save Filters
          </button>
          {showSavePopover && (
            <div ref={popoverRef} className="absolute left-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 w-64 animate-fadeIn">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Name this preset</p>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePreset();
                    if (e.key === 'Escape') { setShowSavePopover(false); setNewPresetName(''); }
                  }}
                  placeholder="e.g. My Critical Items"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  maxLength={30}
                />
                <button onClick={handleSavePreset} disabled={!newPresetName.trim() || presets.length >= MAX_PRESETS} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition" aria-label="Save preset">
                  <Check size={14} />
                </button>
              </div>
              {presets.length >= MAX_PRESETS && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">Maximum of {MAX_PRESETS} presets reached.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
