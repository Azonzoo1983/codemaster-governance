import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, Copy, Check, Grid3X3, List,
  ExternalLink, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useRequestStore } from '../stores/requestStore';
import { RequestStatus, Classification } from '../types';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = (() => { try { return Number(localStorage.getItem('cm-catalog-page-size')) || 24; } catch { return 24; } })();

export const CodeCatalog: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'code' | 'description'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const requests = useRequestStore(s => s.requests);

  const completedRequests = useMemo(() =>
    requests.filter(r => r.status === RequestStatus.COMPLETED && r.oracleCode),
    [requests]
  );

  const projects = useMemo(() => {
    const projs = new Set(completedRequests.map(r => r.project).filter(Boolean));
    return Array.from(projs).sort();
  }, [completedRequests]);

  const filtered = useMemo(() => {
    let result = [...completedRequests];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.oracleCode?.toLowerCase().includes(q) ||
        r.finalDescription?.toLowerCase().includes(q) ||
        r.generatedDescription?.toLowerCase().includes(q) ||
        r.project?.toLowerCase().includes(q) ||
        r.unspscCode?.toLowerCase().includes(q) ||
        Object.values(r.attributes || {}).some(v => String(v).toLowerCase().includes(q))
      );
    }

    if (filterClassification !== 'all') {
      result = result.filter(r => r.classification === filterClassification);
    }
    if (filterProject !== 'all') {
      result = result.filter(r => r.project === filterProject);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (sortField === 'code') cmp = (a.oracleCode || '').localeCompare(b.oracleCode || '');
      if (sortField === 'description') cmp = (a.finalDescription || a.generatedDescription || '').localeCompare(b.finalDescription || b.generatedDescription || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [completedRequests, searchQuery, filterClassification, filterProject, sortField, sortDir]);

  // Reset page when filters change
  const filterKey = `${searchQuery}|${filterClassification}|${filterProject}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => { /* clipboard unavailable */ });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Empty states
  if (completedRequests.length === 0) {
    return (
      <div className="p-8 text-center">
        <BookOpen size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Code Catalog</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          No completed codes yet. Once requests are completed with Oracle codes, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Code Catalog</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {completedRequests.length} Oracle code{completedRequests.length !== 1 ? 's' : ''} in database
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            aria-label="Grid view"
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            aria-label="Table view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by code, description, brand, attributes..."
          aria-label="Search codes"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterClassification}
          onChange={e => setFilterClassification(e.target.value)}
          aria-label="Filter by classification"
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        >
          <option value="all">All Classifications</option>
          <option value={Classification.ITEM}>Item</option>
          <option value={Classification.SERVICE}>Service</option>
        </select>

        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          aria-label="Filter by project"
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        >
          <option value="all">All Projects</option>
          {projects.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={`${sortField}-${sortDir}`}
          onChange={e => {
            const [f, d] = e.target.value.split('-') as ['date' | 'code' | 'description', 'asc' | 'desc'];
            setSortField(f);
            setSortDir(d);
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="code-asc">Code A-Z</option>
          <option value="code-desc">Code Z-A</option>
          <option value="description-asc">Description A-Z</option>
          <option value="description-desc">Description Z-A</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {filtered.length} code{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* No search results */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Search size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">No codes match your search</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Try adjusting your search terms or filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map(r => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Oracle Code */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleCopy(r.oracleCode!, r.id)}
                  className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                  title="Click to copy code"
                >
                  {r.oracleCode}
                  {copiedId === r.id ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="text-slate-400" />
                  )}
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 mb-3">
                {r.finalDescription || r.generatedDescription || 'No description'}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                  {r.classification}
                </span>
                {(r.materialSubType || r.serviceSubType) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    {r.materialSubType || r.serviceSubType}
                  </span>
                )}
                {r.unspscCode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    UNSPSC: {r.unspscCode}
                  </span>
                )}
              </div>

              {/* Project + Date */}
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-auto mb-3">
                {r.project && <span className="block">{r.project}</span>}
                <span className="block">Completed {formatDate(r.updatedAt)}</span>
              </div>

              {/* View link */}
              <button
                onClick={() => navigate(`/requests/${r.id}`)}
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <ExternalLink size={14} />
                View Full Request
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Oracle Code</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">UNSPSC</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Project</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800">
              {paginatedItems.map(r => (
                <tr key={r.id} className="group border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{r.oracleCode}</span>
                      <button
                        onClick={() => handleCopy(r.oracleCode!, r.id)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        title="Copy code"
                      >
                        {copiedId === r.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="line-clamp-1 text-slate-700 dark:text-slate-300">
                      {r.finalDescription || r.generatedDescription || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      {r.classification}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.unspscCode || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.project || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(r.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/requests/${r.id}`)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      <ExternalLink size={14} />
                      <span className="hidden sm:inline">View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-2 text-slate-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      page === p
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
