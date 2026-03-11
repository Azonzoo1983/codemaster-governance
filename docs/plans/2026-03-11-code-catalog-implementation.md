# Code Catalog, Dashboard Cleanup & Reports Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Code Catalog reference page, simplify the Dashboard into a focused work queue, move analytics to Reports with rejection tracking, and reorganize the sidebar.

**Architecture:** Four features implemented in dependency order. Sidebar reorganization first (unblocks routing), then Dashboard cleanup (removes analytics), then Reports enhancement (receives analytics), then Code Catalog (new page). All data from existing `cm_requests` store — no new tables.

**Tech Stack:** React, TypeScript, Zustand, Recharts (already installed), Tailwind v4 dark mode.

---

### Task 1: Sidebar Reorganization — Update NAV_ITEMS

**Files:**
- Modify: `components/Layout.tsx:32-41` (menuItems array)

**Step 1: Update the menuItems array**

Replace lines 32-41 with:

```tsx
const menuItems = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={1.75} />, roles: Object.values(Role) },
  { path: '/code-catalog', label: 'Code Catalog', icon: <BookOpen size={20} strokeWidth={1.75} />, roles: Object.values(Role) },
  { path: '/drafts', label: 'My Drafts', icon: <Inbox size={20} strokeWidth={1.75} />, roles: [Role.REQUESTER, Role.ADMIN] },
  { path: '/requests/new', label: 'New Request', icon: <PlusCircle size={20} strokeWidth={1.75} />, roles: [Role.REQUESTER, Role.ADMIN] },
  { path: '/reports', label: 'Reports', icon: <BarChart2 size={20} strokeWidth={1.75} />, roles: Object.values(Role) },
  { path: '/admin', label: 'Admin Panel', icon: <Settings size={20} strokeWidth={1.75} />, roles: [Role.ADMIN] },
];
```

Changes:
- Add `BookOpen` to lucide-react imports at top of file
- Add Code Catalog entry after Dashboard
- Remove `/my-requests` (My Requests) — Dashboard Active tab replaces it
- Remove `/activity` (Activity Feed) — moves to Admin Panel tab
- Remove `/workflow` (Workflow Builder) — moves to Admin Panel tab
- Change Reports roles from specific list to `Object.values(Role)` (all roles)

**Step 2: Add route for Code Catalog**

Find the route definitions (where pages are mapped to paths). Add:

```tsx
{ path: '/code-catalog', element: <CodeCatalog /> }
```

Import `CodeCatalog` from `'../pages/CodeCatalog'` (will be created in Task 5).

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May have import error for CodeCatalog (not yet created). Create a placeholder:

```tsx
// pages/CodeCatalog.tsx
export default function CodeCatalog() {
  return <div>Code Catalog — coming soon</div>;
}
```

**Step 4: Commit**

```
feat: reorganize sidebar — add Code Catalog, move Workflow Builder and Activity Feed to Admin
```

---

### Task 2: Admin Panel — Add Workflow Builder & Activity Feed Tabs

**Files:**
- Modify: `pages/Admin.tsx:31` (activeTab state type)
- Modify: `pages/Admin.tsx:210-217` (tabs array)
- Modify: `pages/Admin.tsx` (add tab content sections)

**Step 1: Update activeTab type and tabs array**

At line 31, update the state type to include new tabs:

```tsx
const [activeTab, setActiveTab] = useState<'attributes' | 'priorities' | 'users' | 'invites' | 'emails' | 'brands' | 'workflow' | 'activity'>('attributes');
```

At lines 210-217, add two entries to the tabs array:

```tsx
{ key: 'workflow' as const, label: 'Workflow Builder' },
{ key: 'activity' as const, label: 'Activity Feed' },
```

**Step 2: Import the existing components**

Add imports at top of Admin.tsx:

```tsx
import WorkflowBuilder from './WorkflowBuilder';
import ActivityFeed from './ActivityFeed';
```

Check how WorkflowBuilder and ActivityFeed are currently exported (default vs named) and match the import style.

**Step 3: Add tab content sections**

After the last `{activeTab === 'brands' && ...}` block, add:

```tsx
{activeTab === 'workflow' && (
  <WorkflowBuilder />
)}

{activeTab === 'activity' && (
  <ActivityFeed />
)}
```

Note: These components currently receive no props since they load their own data from stores. Verify by reading the component files. If they use `useNavigate` or route-specific hooks, they may need minor adjustments to work as embedded components instead of routed pages.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
feat: add Workflow Builder and Activity Feed as Admin Panel tabs
```

---

### Task 3: Dashboard Simplification — Remove Analytics, Add Tabs

**Files:**
- Modify: `pages/Dashboard.tsx`

**Step 1: Remove analytics state and computed values**

Remove these state variables (lines ~47-48):
- `showAnalytics`
- `showPerformance`

Remove these useMemo blocks (lines ~393-448):
- `trendData`
- `workloadData`
- `priorityDistData`
- `performanceMetrics`

Remove Recharts imports (line 11) — no longer needed in Dashboard.
Remove unused icon imports: `TrendingUp`, `Award`, `ChevronUp`, `ChevronDown` (check which are still used elsewhere first).
Remove `PerformanceMetrics` import if it exists.

**Step 2: Remove analytics and performance widget rendering**

In the widget rendering section (lines ~565-713), remove:
- The entire `if (widget.id === 'analytics')` block (~lines 565-683)
- The entire `if (widget.id === 'performance')` block (~lines 686-713)

**Step 3: Add tab state**

Add new state variable:

```tsx
const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');
```

**Step 4: Update filtering logic**

Replace the existing `filterStatus`-based filtering in the `filteredRequests` useMemo (lines ~235-258). Add tab-based filtering before the existing status/priority/classification filters:

```tsx
// Tab-level filtering
if (activeTab === 'active') {
  // Show everything except Completed, Cancelled
  if (r.status === RequestStatus.COMPLETED || r.status === RequestStatus.CANCELLED) return false;
} else if (activeTab === 'completed') {
  // Only completed
  if (r.status !== RequestStatus.COMPLETED) return false;
}
// 'all' tab shows everything
```

Remove the old `filterStatus` state and its dropdown from the filters bar. The tabs replace it.

**Step 5: Add tab UI above the request table**

Before the filters/search bar, render tabs:

```tsx
<div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
  {(['active', 'completed', 'all'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => { setActiveTab(tab); setPage(1); }}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
        activeTab === tab
          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {tab === 'active' ? 'Active' : tab === 'completed' ? 'Completed' : 'All'}
    </button>
  ))}
</div>
```

**Step 6: Enhance Completed tab — show Oracle Code**

In the request table row rendering, when `activeTab === 'completed'`, show the Oracle Code prominently. Add after the title cell:

```tsx
{activeTab === 'completed' && r.oracleCode && (
  <span className="font-mono text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
    {r.oracleCode}
  </span>
)}
```

**Step 7: Enhance Active tab — show Rejected badge with reason**

In the request table row rendering, when a request has status REJECTED, show a red badge:

```tsx
{r.status === RequestStatus.REJECTED && (
  <span className="text-xs text-red-600 dark:text-red-400" title={r.rejectionReason || ''}>
    Rejected{r.rejectionReason ? `: ${r.rejectionReason.slice(0, 50)}...` : ''}
  </span>
)}
```

**Step 8: Mute cancelled items in All tab**

Add conditional opacity to the row className when displaying cancelled items:

```tsx
className={`... ${r.status === RequestStatus.CANCELLED ? 'opacity-50' : ''}`}
```

**Step 9: Verify TypeScript compiles and preview**

Run: `npx tsc --noEmit`
Preview: Check Dashboard renders with tabs, Active tab is default, analytics are gone.

**Step 10: Commit**

```
feat: simplify Dashboard — remove analytics, add Active/Completed/All tabs
```

---

### Task 4: Reports Page Enhancement — Receive Analytics + Rejection Tracking

**Files:**
- Modify: `pages/Reports.tsx`

**Step 1: Add the moved analytics charts**

Reports.tsx already has Recharts and many analytics. Add the 4 charts moved from Dashboard. These are the computed values that were removed in Task 3:

Add to the existing useMemo blocks in Reports.tsx:

```tsx
// Requests Trend (30 days) — moved from Dashboard
const trendData = useMemo(() => {
  const days = 30;
  const now = new Date();
  const data: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const count = filteredForAnalytics.filter(r => {
      const created = new Date(r.createdAt);
      return created.toDateString() === d.toDateString();
    }).length;
    data.push({ date: key, count });
  }
  return data;
}, [filteredForAnalytics]);

// Specialist Workload — moved from Dashboard
const workloadData = useMemo(() => {
  const specialists = filteredForAnalytics.filter(r =>
    r.assignedSpecialistId && ![RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.REJECTED].includes(r.status)
  );
  const grouped = specialists.reduce<Record<string, number>>((acc, r) => {
    const name = users.find(u => u.id === r.assignedSpecialistId)?.name || r.assignedSpecialistId;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([name, active]) => ({ name, active })).sort((a, b) => b.active - a.active);
}, [filteredForAnalytics, users]);
```

Replicate the chart JSX from the removed Dashboard analytics section, placing them after the existing Reports charts. Use the same Recharts components and styling.

**Step 2: Add Specialist Performance**

Import `PerformanceMetrics` component (check where it's defined — likely `components/PerformanceMetrics.tsx`). Add it as a section in Reports:

```tsx
<div className="mt-6">
  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Specialist Performance</h3>
  <PerformanceMetrics requests={filteredForAnalytics} users={users} />
</div>
```

**Step 3: Add Rejection Analytics section**

Compute rejection data:

```tsx
const rejectionData = useMemo(() => {
  const rejected = filteredForAnalytics.filter(r => r.status === RequestStatus.REJECTED);

  // By department
  const byDept: Record<string, number> = {};
  rejected.forEach(r => {
    const user = users.find(u => u.id === r.requesterId);
    const dept = user?.department || 'Unknown';
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  const byDepartment = Object.entries(byDept)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // By user
  const byUser: Record<string, number> = {};
  rejected.forEach(r => {
    const user = users.find(u => u.id === r.requesterId);
    const name = user?.name || r.requesterId;
    byUser[name] = (byUser[name] || 0) + 1;
  });
  const byRequester = Object.entries(byUser)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // By reason
  const byReason: Record<string, number> = {};
  rejected.forEach(r => {
    const reason = r.rejectionReason?.slice(0, 50) || 'No reason given';
    byReason[reason] = (byReason[reason] || 0) + 1;
  });
  const reasons = Object.entries(byReason)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Trend (monthly)
  const trend: Record<string, number> = {};
  rejected.forEach(r => {
    const d = new Date(r.createdAt);
    const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    trend[key] = (trend[key] || 0) + 1;
  });
  const trendArr = Object.entries(trend).map(([month, count]) => ({ month, count }));

  return { byDepartment, byRequester, reasons, trend: trendArr, total: rejected.length };
}, [filteredForAnalytics, users]);
```

**Step 4: Render rejection analytics charts**

Add a "Rejection Analytics" section after the existing charts:

```tsx
{/* Rejection Analytics */}
<div className="mt-8">
  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
    <AlertTriangle size={18} className="text-red-500" />
    Rejection Analytics
    <span className="text-sm font-normal text-slate-500">({rejectionData.total} total rejections)</span>
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Rejections by Department — Bar chart */}
    {/* Rejections by User — Ranked table */}
    {/* Rejection Reasons — Pie chart */}
    {/* Rejection Trend — Line chart */}
  </div>
</div>
```

Use the same Recharts styling as existing charts (dark tooltip, consistent colors). Use `ANALYTICS_COLORS` array from Dashboard if available, or define locally.

**Step 5: Add date range and department filters**

Reports.tsx already has date filters (lines 21-33). Add a department filter dropdown:

```tsx
const departments = useMemo(() => {
  const depts = new Set(users.map(u => u.department).filter(Boolean));
  return ['All Departments', ...Array.from(depts).sort()];
}, [users]);

const [filterDept, setFilterDept] = useState('All Departments');
```

Apply the department filter to `filteredForAnalytics` before all chart computations.

**Step 6: Verify TypeScript compiles and preview**

Run: `npx tsc --noEmit`
Preview: Check Reports page shows all charts including rejection analytics.

**Step 7: Commit**

```
feat: enhance Reports — move Dashboard analytics here, add rejection tracking
```

---

### Task 5: Code Catalog Page

**Files:**
- Create: `pages/CodeCatalog.tsx`
- Modify: `pages/CodeCatalog.tsx` (placeholder from Task 1 → full implementation)

**Step 1: Build the Code Catalog page**

Create `pages/CodeCatalog.tsx` with:

```tsx
import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Copy, Check, Grid, List, Filter, ExternalLink } from 'lucide-react';
import { useRequestStore } from '../stores/requestStore';
import { RequestStatus, Classification } from '../types';
```

**State:**
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [filterClassification, setFilterClassification] = useState<string>('all');
const [filterProject, setFilterProject] = useState<string>('all');
const [sortField, setSortField] = useState<'date' | 'code' | 'description'>('date');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
const [copiedId, setCopiedId] = useState<string | null>(null);
```

**Data source:**
```tsx
const requests = useRequestStore(s => s.requests);

const completedRequests = useMemo(() =>
  requests.filter(r => r.status === RequestStatus.COMPLETED && r.oracleCode),
  [requests]
);
```

**Full-text search:**
```tsx
const filtered = useMemo(() => {
  let result = completedRequests;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(r =>
      r.oracleCode?.toLowerCase().includes(q) ||
      r.finalDescription?.toLowerCase().includes(q) ||
      r.generatedDescription?.toLowerCase().includes(q) ||
      r.project?.toLowerCase().includes(q) ||
      r.unspscCode?.toLowerCase().includes(q) ||
      Object.values(r.attributes || {}).some(v =>
        String(v).toLowerCase().includes(q)
      )
    );
  }

  if (filterClassification !== 'all') {
    result = result.filter(r => r.classification === filterClassification);
  }
  if (filterProject !== 'all') {
    result = result.filter(r => r.project === filterProject);
  }

  // Sort
  result.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortField === 'code') cmp = (a.oracleCode || '').localeCompare(b.oracleCode || '');
    if (sortField === 'description') cmp = (a.finalDescription || '').localeCompare(b.finalDescription || '');
    return sortDir === 'desc' ? cmp : -cmp;
  });

  return result;
}, [completedRequests, searchQuery, filterClassification, filterProject, sortField, sortDir]);
```

**Copy-to-clipboard handler:**
```tsx
const handleCopy = (code: string, id: string) => {
  navigator.clipboard.writeText(code);
  setCopiedId(id);
  setTimeout(() => setCopiedId(null), 2000);
};
```

**Step 2: Build the page header**

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <div className="p-2.5 icon-container icon-container-blue">
      <BookOpen size={22} strokeWidth={1.75} />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Code Catalog</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {completedRequests.length} Oracle codes available
      </p>
    </div>
  </div>
  <div className="flex gap-2">
    <button onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'active' : ''}>
      <Grid size={16} />
    </button>
    <button onClick={() => setViewMode('table')} className={viewMode === 'table' ? 'active' : ''}>
      <List size={16} />
    </button>
  </div>
</div>
```

**Step 3: Build filters bar**

```tsx
<div className="flex flex-wrap gap-3 mb-6">
  {/* Search */}
  <div className="relative flex-1 min-w-[250px]">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search by code, description, brand, attributes..."
      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition"
    />
  </div>
  {/* Classification filter */}
  <select value={filterClassification} onChange={(e) => setFilterClassification(e.target.value)}
    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 text-sm">
    <option value="all">All Types</option>
    <option value={Classification.ITEM}>Item</option>
    <option value={Classification.SERVICE}>Service</option>
  </select>
  {/* Project filter */}
  <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 text-sm">
    <option value="all">All Projects</option>
    {/* Map unique projects from completedRequests */}
  </select>
  {/* Sort */}
  <select value={`${sortField}-${sortDir}`} onChange={(e) => {
    const [f, d] = e.target.value.split('-');
    setSortField(f as any); setSortDir(d as any);
  }} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 text-sm">
    <option value="date-desc">Newest First</option>
    <option value="date-asc">Oldest First</option>
    <option value="code-asc">Code A-Z</option>
    <option value="description-asc">Description A-Z</option>
  </select>
</div>
```

**Step 4: Build card grid view**

```tsx
{viewMode === 'grid' && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {filtered.map(r => (
      <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-shadow">
        {/* Oracle Code — prominent, copyable */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
            {r.oracleCode}
          </span>
          <button
            onClick={() => handleCopy(r.oracleCode!, r.id)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Copy code"
          >
            {copiedId === r.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400" />}
          </button>
        </div>
        {/* Description */}
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 line-clamp-2">
          {r.finalDescription || r.generatedDescription}
        </p>
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            {r.classification}
          </span>
          {r.materialSubType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {r.materialSubType}
            </span>
          )}
          {r.serviceSubType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              {r.serviceSubType}
            </span>
          )}
          {r.unspscCode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              UNSPSC: {r.unspscCode}
            </span>
          )}
        </div>
        {/* Project + Date */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{r.project}</span>
          <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
        </div>
        {/* Link to original request */}
        <button
          onClick={() => navigate(`/requests/${r.id}`)}
          className="mt-3 w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition"
        >
          <ExternalLink size={12} /> View Full Request
        </button>
      </div>
    ))}
  </div>
)}
```

**Step 5: Build table view**

```tsx
{viewMode === 'table' && (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-700/60">
        <tr>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">Oracle Code</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">Description</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">Type</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">UNSPSC</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">Project</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase">Date</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {filtered.map(r => (
          <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.oracleCode}</span>
                <button onClick={() => handleCopy(r.oracleCode!, r.id)} className="opacity-0 group-hover:opacity-100 transition">
                  {copiedId === r.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-slate-400" />}
                </button>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[300px] truncate">
              {r.finalDescription || r.generatedDescription}
            </td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.classification}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{r.unspscCode || '-'}</td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.project}</td>
            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
            <td className="px-4 py-3">
              <button onClick={() => navigate(`/requests/${r.id}`)} className="text-blue-600 dark:text-blue-400 text-xs hover:underline">
                View
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

**Step 6: Add empty state**

```tsx
{filtered.length === 0 && (
  <div className="text-center py-16">
    <BookOpen size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
      {searchQuery || filterClassification !== 'all' || filterProject !== 'all'
        ? 'No codes match your search'
        : 'No Oracle codes yet'}
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {searchQuery || filterClassification !== 'all' || filterProject !== 'all'
        ? 'Try adjusting your filters or search terms'
        : 'Completed requests will appear here as a reference catalog'}
    </p>
  </div>
)}
```

**Step 7: Add pagination**

Use the same pagination pattern as Dashboard (PAGE_SIZE state with localStorage).

**Step 8: Verify TypeScript compiles and preview**

Run: `npx tsc --noEmit`
Preview: Navigate to Code Catalog, verify search and filters work, card/table views toggle.

**Step 9: Commit**

```
feat: add Code Catalog page — searchable reference database of completed Oracle codes
```

---

### Task 6: Final Verification & Cleanup

**Step 1: Full type check**

Run: `npx tsc --noEmit`

**Step 2: Run all tests**

Run: `npx vitest run`

**Step 3: Preview all affected pages**

- Dashboard: tabs work, no analytics, KPI cards present
- Code Catalog: search, filters, card/table views
- Reports: all charts including rejection analytics
- Admin Panel: Workflow Builder and Activity Feed tabs
- Sidebar: correct items per role

**Step 4: Dark mode check**

Toggle dark mode and verify all new/modified UI elements have proper `dark:` variants.

**Step 5: Final commit**

```
chore: final cleanup and verification for Code Catalog + Dashboard restructure
```
