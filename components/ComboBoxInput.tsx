import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ComboBoxInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-required'?: boolean;
}

/**
 * Autocomplete combo box — text input with filtered suggestion dropdown.
 * User can pick from suggestions OR type a custom value.
 */
export const ComboBoxInput: React.FC<ComboBoxInputProps> = ({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
  className = '',
  'aria-required': ariaRequired,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter suggestions based on current query
  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes((query || value || '').toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightIdx]) {
        (items[highlightIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
    setHighlightIdx(-1);
  };

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setQuery('');
      setOpen(false);
      setHighlightIdx(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
      return;
    }

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < filtered.length) {
          handleSelect(filtered[highlightIdx]);
        } else {
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        setHighlightIdx(-1);
        break;
    }
  };

  const handleFocus = () => {
    setOpen(true);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={ariaRequired}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
        role="combobox"
        autoComplete="off"
        className={className}
      />

      {open && filtered.length > 0 && !disabled && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1"
        >
          {filtered.map((item, idx) => {
            const isHighlighted = idx === highlightIdx;
            const isExact = item.toLowerCase() === (value || '').toLowerCase();
            return (
              <li
                key={item}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault(); // Don't blur input
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  isHighlighted
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                } ${isExact ? 'font-medium' : ''}`}
              >
                {item}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
