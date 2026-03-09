import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface UnspscEntry {
  c: string; // commodity code
  t: string; // title
}

interface UnspscSearchProps {
  value: string;
  onChange: (code: string, title: string) => void;
  disabled?: boolean;
}

let cachedData: UnspscEntry[] | null = null;
let loadingPromise: Promise<UnspscEntry[]> | null = null;

async function loadUnspscData(): Promise<UnspscEntry[]> {
  if (cachedData) return cachedData;
  if (loadingPromise) return loadingPromise;
  loadingPromise = fetch('/unspsc-data.json')
    .then((res) => res.json())
    .then((data: UnspscEntry[]) => {
      cachedData = data;
      return data;
    })
    .catch(() => {
      loadingPromise = null;
      return [];
    });
  return loadingPromise;
}

export const UnspscSearch: React.FC<UnspscSearchProps> = ({ value, onChange, disabled }) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<UnspscEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(!!cachedData);
  const [selectedTitle, setSelectedTitle] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload data on mount
  useEffect(() => {
    if (!cachedData) {
      setLoading(true);
      loadUnspscData().then((data) => {
        setDataLoaded(true);
        setLoading(false);
        // If we already have a value, look up the title
        if (value && data.length > 0) {
          const entry = data.find((e) => e.c === value);
          if (entry) setSelectedTitle(entry.t);
        }
      });
    } else if (value) {
      const entry = cachedData.find((e) => e.c === value);
      if (entry) setSelectedTitle(entry.t);
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(
    (term: string) => {
      if (!cachedData || term.length < 2) {
        setResults([]);
        return;
      }
      const lower = term.toLowerCase();
      const matches: UnspscEntry[] = [];
      for (let i = 0; i < cachedData.length && matches.length < 50; i++) {
        const entry = cachedData[i];
        if (entry.c.includes(lower) || entry.t.toLowerCase().includes(lower)) {
          matches.push(entry);
        }
      }
      setResults(matches);
    },
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 250);
  };

  const handleSelect = (entry: UnspscEntry) => {
    setQuery(entry.c);
    setSelectedTitle(entry.t);
    onChange(entry.c, entry.t);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedTitle('');
    onChange('', '');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.length >= 2) {
              doSearch(query);
              setIsOpen(true);
            }
          }}
          placeholder="Search by UNSPSC code or description..."
          className="w-full rounded-lg border-slate-300 dark:border-slate-600 shadow-sm border pl-10 pr-10 p-2 focus:border-blue-500 focus:ring-blue-500/20 transition bg-white dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
          aria-label="UNSPSC Code Search"
          aria-expanded={isOpen}
          role="combobox"
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        )}
        {query && !loading && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear UNSPSC selection"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selected display */}
      {selectedTitle && query && (
        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 truncate">
          <span className="font-semibold">{query}</span> — {selectedTitle}
        </div>
      )}

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
          role="listbox"
        >
          {results.map((entry) => (
            <button
              key={entry.c}
              onClick={() => handleSelect(entry)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0 transition"
              role="option"
              aria-selected={entry.c === query}
            >
              <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                {entry.c}
              </span>
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{entry.t}</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && dataLoaded && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-3 text-sm text-slate-500 dark:text-slate-400 text-center">
          No UNSPSC codes found matching "{query}"
        </div>
      )}
    </div>
  );
};
