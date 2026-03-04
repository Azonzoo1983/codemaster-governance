import React, { useEffect, useRef } from 'react';
import { LayoutGrid, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, Minimize2, X } from 'lucide-react';
import { useLayoutStore } from '../stores';

interface DashboardLayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardLayoutEditor: React.FC<DashboardLayoutEditorProps> = ({ isOpen, onClose }) => {
  const widgets = useLayoutStore((s) => s.widgets);
  const compactMode = useLayoutStore((s) => s.compactMode);
  const toggleWidget = useLayoutStore((s) => s.toggleWidget);
  const moveWidget = useLayoutStore((s) => s.moveWidget);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const setCompactMode = useLayoutStore((s) => s.setCompactMode);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Delay adding listener to avoid closing immediately from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-premium-xl animate-fadeIn"
      role="dialog"
      aria-label="Customize dashboard layout"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Customize Layout</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition"
          aria-label="Close layout editor"
        >
          <X size={16} />
        </button>
      </div>

      {/* Widget List */}
      <div className="p-3 space-y-1">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider px-1 mb-2">
          Widgets
        </p>
        {sortedWidgets.map((widget, index) => (
          <div
            key={widget.id}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50"
          >
            {/* Visibility toggle */}
            <button
              onClick={() => toggleWidget(widget.id)}
              className={`p-1 rounded transition ${
                widget.visible
                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600'
              }`}
              aria-label={widget.visible ? `Hide ${widget.label}` : `Show ${widget.label}`}
            >
              {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {/* Label */}
            <span
              className={`flex-1 text-sm font-medium ${
                widget.visible
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 dark:text-slate-500 line-through'
              }`}
            >
              {widget.label}
            </span>

            {/* Reorder buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => moveWidget(widget.id, 'up')}
                disabled={index === 0}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label={`Move ${widget.label} up`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => moveWidget(widget.id, 'down')}
                disabled={index === sortedWidgets.length - 1}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label={`Move ${widget.label} down`}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Compact Mode Toggle */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <Minimize2 size={14} className="text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Compact Mode</span>
          </div>
          <button
            role="switch"
            aria-checked={compactMode}
            onClick={() => setCompactMode(!compactMode)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              compactMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                compactMode ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Reset */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={resetLayout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <RotateCcw size={14} />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
