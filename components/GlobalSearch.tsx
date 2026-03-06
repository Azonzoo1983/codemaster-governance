import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequestStore, useUserStore } from '../stores';
import { RequestStatus, Role } from '../types';
import {
  Search,
  FileText,
  User as UserIcon,
  LayoutDashboard,
  PlusCircle,
  BarChart2,
  Activity,
  Settings,
  GitBranch,
  X,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  AlertCircle,
} from 'lucide-react';

interface SearchResult {
  id: string;
  category: 'Requests' | 'Users' | 'Pages';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: { text: string; className: string };
  path: string;
}

const ROLE_COLORS: Record<string, string> = {
  [Role.ADMIN]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  [Role.MANAGER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  [Role.POC]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  [Role.SPECIALIST]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  [Role.TECHNICAL_REVIEWER]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  [Role.REQUESTER]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const PRIORITY_LABELS: Record<string, { text: string; className: string }> = {
  p1: { text: 'Normal', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  p2: { text: 'Urgent', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  p3: { text: 'Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
};

const PAGES = [
  { path: '/', title: 'Dashboard', subtitle: 'Overview of all requests and metrics', icon: <LayoutDashboard size={18} className="text-blue-500" /> },
  { path: '/requests/new', title: 'New Request', subtitle: 'Create a new coding request', icon: <PlusCircle size={18} className="text-green-500" /> },
  { path: '/reports', title: 'Reports', subtitle: 'Analytics and reporting dashboard', icon: <BarChart2 size={18} className="text-purple-500" /> },
  { path: '/activity', title: 'Activity Feed', subtitle: 'Recent actions and audit trail', icon: <Activity size={18} className="text-orange-500" /> },
  { path: '/workflow', title: 'Workflow Builder', subtitle: 'Configure workflow stages', icon: <GitBranch size={18} className="text-cyan-500" /> },
  { path: '/admin', title: 'Admin Panel', subtitle: 'User management and settings', icon: <Settings size={18} className="text-red-500" /> },
  { path: '/my-requests', title: 'My Requests', subtitle: 'View your submitted requests', icon: <FileText size={18} className="text-indigo-500" /> },
];

const ANIMATION_CSS = '@keyframes globalSearchFadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes globalSearchScaleIn { from { opacity: 0; transform: scale(0.95) translateY(-16px); } to { opacity: 1; transform: scale(1) translateY(0); } }';
interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const requests = useRequestStore((s) => s.requests);
  const users = useUserStore((s) => s.users);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle open - reset state and focus
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Global keyboard listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  // Search logic
  const results = useMemo((): SearchResult[] => {
    if (!debouncedQuery) return [];

    const allResults: SearchResult[] = [];

    // Search requests
    const matchedRequests = requests
      .filter((r) => {
        const q = debouncedQuery;
        return (
          r.title.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((r): SearchResult => {
        const priority = PRIORITY_LABELS[r.priorityId];
        return {
          id: 'req-' + r.id,
          category: 'Requests',
          title: r.title,
          subtitle: r.id + ' — ' + r.status,
          icon: <FileText size={18} className="text-blue-500" />,
          badge: priority
            ? { text: priority.text, className: priority.className }
            : undefined,
          path: '/requests/' + r.id,
        };
      });
    allResults.push(...matchedRequests);

    // Search users
    const matchedUsers = users
      .filter((u) => {
        const q = debouncedQuery;
        return (
          u.name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((u): SearchResult => ({
        id: 'user-' + u.id,
        category: 'Users',
        title: u.name,
        subtitle: u.email + ' — ' + u.department,
        icon: <UserIcon size={18} className="text-emerald-500" />,
        badge: {
          text: u.role,
          className: ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700',
        },
        path: '/admin',
      }));
    allResults.push(...matchedUsers);

    // Search pages
    const matchedPages = PAGES.filter((pg) => {
      const q = debouncedQuery;
      return (
        pg.title.toLowerCase().includes(q) ||
        pg.subtitle.toLowerCase().includes(q)
      );
    })
      .slice(0, 5)
      .map((pg): SearchResult => ({
        id: 'page-' + pg.path,
        category: 'Pages',
        title: pg.title,
        subtitle: pg.subtitle,
        icon: pg.icon,
        path: pg.path,
      }));
    allResults.push(...matchedPages);

    return allResults;
  }, [debouncedQuery, requests, users]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: { category: string; items: SearchResult[] }[] = [];
    const categories = ['Requests', 'Users', 'Pages'] as const;
    for (const cat of categories) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(
    () => groupedResults.flatMap((g) => g.items),
    [groupedResults]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length, debouncedQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.path);
      onClose();
    },
    [navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelect(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, handleSelect, onClose]
  );

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal={true}
      aria-label="Global search"
      style={{ animation: 'globalSearchFadeIn 200ms ease-out' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" />

      <div
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        style={{ animation: 'globalSearchScaleIn 200ms ease-out' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search requests, users, pages..."
            className="flex-1 py-4 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none text-base"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[11px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-600 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[360px] overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {debouncedQuery && flatResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertCircle size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                No results found
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Try a different search term
              </p>
            </div>
          )}

          {groupedResults.map((group) => (
            <div key={group.category}>
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                {group.category}
              </div>
              {group.items.map((result) => {
                flatIndex++;
                const isSelected = flatIndex === selectedIndex;
                const currentFlatIndex = flatIndex;
                return (
                  <button
                    key={result.id}
                    data-selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                    className={'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ' +
                      (isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50')
                    }
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {result.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {result.subtitle}
                      </div>
                    </div>
                    {result.badge && (
                      <span
                        className={'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ' + result.badge.className}
                      >
                        {result.badge.text}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft size={14} className="shrink-0 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {(flatResults.length > 0 || !debouncedQuery) && (
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="flex items-center gap-0.5">
                <ArrowUp size={12} />
                <ArrowDown size={12} />
              </span>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CornerDownLeft size={12} />
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-600">
                ESC
              </kbd>
              <span>Close</span>
            </div>
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_CSS }} />
    </div>
  );
};
