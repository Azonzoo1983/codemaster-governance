import React, { useMemo, useState } from 'react';
import { useRequestStore, useAdminStore, useUserStore } from '../stores';
import { RequestStatus, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { calculateBusinessHours } from '../lib/businessHours';
import { TrendingUp, Users, Clock, Target, Download, FileText, Calendar, FileSpreadsheet, FileDown, AlertTriangle } from 'lucide-react';
import { exportToCsv } from '../lib/exportCsv';
import { exportToPdf } from '../lib/exportPdf';
import { exportRequestsToExcel } from '../lib/exportExcel';
import { exportAuditTrailPdf } from '../lib/exportBatchPdf';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export const Reports: React.FC = () => {
  const allRequests = useRequestStore((s) => s.requests);
  const priorities = useAdminStore((s) => s.priorities);
  const users = useUserStore((s) => s.users);

  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  const departments = useMemo(() => {
    const depts = new Set(users.map(u => u.department).filter(Boolean));
    return ['All', ...Array.from(depts).sort()];
  }, [users]);

  const requests = useMemo(() => {
    let filtered = allRequests;
    if (dateFrom || dateTo) {
      filtered = filtered.filter((r) => {
        const d = new Date(r.createdAt);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      });
    }
    if (filterDept !== 'All') {
      filtered = filtered.filter(r => {
        const user = users.find(u => u.id === r.requesterId);
        return user?.department === filterDept;
      });
    }
    return filtered;
  }, [allRequests, dateFrom, dateTo, filterDept, users]);

  // Export handlers
  const handleExportCsv = () => {
    const data = requests.map((r) => ({
      ID: r.id,
      Title: r.title,
      Classification: r.classification,
      Status: r.status,
      Priority: priorities.find((p) => p.id === r.priorityId)?.name || '',
      Requester: users.find((u) => u.id === r.requesterId)?.name || '',
      Created: new Date(r.createdAt).toLocaleDateString(),
      Updated: new Date(r.updatedAt).toLocaleDateString(),
    }));
    exportToCsv(data, `codemaster-report-${new Date().toISOString().slice(0, 10)}`);
  };

  const handleExportPdf = () => {
    exportToPdf(requests, priorities, users, `codemaster-report-${new Date().toISOString().slice(0, 10)}`);
  };

  const handleExportExcel = () => {
    exportRequestsToExcel(requests, priorities, users, `codemaster-report-${new Date().toISOString().slice(0, 10)}`);
  };

  const handleExportAuditTrailPdf = () => {
    exportAuditTrailPdf(allRequests, users);
  };

  // Status Distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [requests]);

  // Priority Distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => {
      const name = priorities.find(p => p.id === r.priorityId)?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [requests, priorities]);

  // SLA Compliance
  const completedRequests = useMemo(() => requests.filter(r => r.status === RequestStatus.COMPLETED), [requests]);

  const slaData = useMemo(() => completedRequests.map(req => {
    const completedLog = req.history.find(h => h.action.includes('completed') || h.action.includes('Completed') || h.action.includes('Code Created'));
    const completedDate = completedLog ? new Date(completedLog.timestamp) : new Date(req.updatedAt);
    const durationHours = calculateBusinessHours(req.createdAt, completedDate);
    const prio = priorities.find(p => p.id === req.priorityId);
    const sla = prio?.slaHours || 24;
    return { id: req.id.slice(-8), actual: Math.round(durationHours * 10) / 10, sla, metSla: durationHours <= sla };
  }), [completedRequests, priorities]);

  const metSlaCount = slaData.filter(d => d.metSla).length;
  const complianceRate = slaData.length > 0 ? ((metSlaCount / slaData.length) * 100).toFixed(1) : 'N/A';

  // Per-stage average durations
  const stageAvgData = useMemo(() => {
    const stageDurations: Record<string, number[]> = {};
    requests.forEach(req => {
      (req.stageTimestamps || []).forEach(st => {
        if (st.durationHours != null) {
          if (!stageDurations[st.status]) stageDurations[st.status] = [];
          stageDurations[st.status].push(st.durationHours);
        }
      });
    });
    return Object.entries(stageDurations).map(([stage, durations]) => ({
      stage: stage.length > 20 ? stage.slice(0, 18) + '...' : stage,
      avgHours: Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10,
      count: durations.length,
    }));
  }, [requests]);

  // Specialist performance
  const specialistData = useMemo(() => {
    const specialists = users.filter(u => u.role === Role.SPECIALIST);
    return specialists.map(spec => {
      const assigned = requests.filter(r => r.assignedSpecialistId === spec.id);
      const completed = assigned.filter(r => r.status === RequestStatus.COMPLETED);
      const avgTime = completed.length > 0
        ? completed.reduce((sum, r) => {
            const dur = calculateBusinessHours(r.createdAt, r.updatedAt);
            return sum + dur;
          }, 0) / completed.length
        : 0;
      const slaCompliant = completed.filter(r => {
        const prio = priorities.find(p => p.id === r.priorityId);
        if (!prio?.slaHours) return true;
        const dur = calculateBusinessHours(r.createdAt, r.updatedAt);
        return dur <= prio.slaHours;
      }).length;
      return {
        name: spec.name,
        assigned: assigned.length,
        completed: completed.length,
        inProgress: assigned.length - completed.length,
        avgHours: Math.round(avgTime * 10) / 10,
        slaRate: completed.length > 0 ? Math.round((slaCompliant / completed.length) * 100) : 0,
      };
    }).filter(s => s.assigned > 0);
  }, [requests, users, priorities]);

  // By Requester
  const byRequesterData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => {
      const user = users.find(u => u.id === r.requesterId);
      const name = user?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [requests, users]);

  // By Project
  const byProjectData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => {
      const proj = r.project || 'Unassigned';
      counts[proj] = (counts[proj] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [requests]);

  // By Department/Division
  const byDepartmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => {
      const user = users.find(u => u.id === r.requesterId);
      const dept = user?.department || 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [requests, users]);

  // Requests Trend (30 days)
  const trendData = useMemo(() => {
    const days = 30;
    const now = new Date();
    const data: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const count = requests.filter(r => r.createdAt.slice(0, 10) === dateStr).length;
      data.push({ date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }), count });
    }
    return data;
  }, [requests]);

  // Specialist Workload
  const workloadData = useMemo(() => {
    const specs = users.filter(u => u.role === Role.SPECIALIST);
    return specs.map(s => ({
      name: s.name.split(' ')[0],
      active: requests.filter(r => r.assignedSpecialistId === s.id && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.REJECTED && r.status !== RequestStatus.CANCELLED).length,
    })).filter(s => s.active > 0);
  }, [requests, users]);

  // Rejection Analytics
  const rejectionData = useMemo(() => {
    const rejected = requests.filter(r => r.status === RequestStatus.REJECTED);

    const byDept: Record<string, number> = {};
    rejected.forEach(r => {
      const user = users.find(u => u.id === r.requesterId);
      const dept = user?.department || 'Unknown';
      byDept[dept] = (byDept[dept] || 0) + 1;
    });
    const byDepartment = Object.entries(byDept).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const byUser: Record<string, number> = {};
    rejected.forEach(r => {
      const user = users.find(u => u.id === r.requesterId);
      const name = user?.name || r.requesterId;
      byUser[name] = (byUser[name] || 0) + 1;
    });
    const byRequester = Object.entries(byUser).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const byReason: Record<string, number> = {};
    rejected.forEach(r => {
      const reason = r.rejectionReason || 'No reason given';
      byReason[reason] = (byReason[reason] || 0) + 1;
    });
    const reasons = Object.entries(byReason).map(([name, value]) => ({ name: name.length > 50 ? name.slice(0, 47) + '...' : name, value })).sort((a, b) => b.value - a.value);

    const trend: Record<string, number> = {};
    rejected.forEach(r => {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trend[key] = (trend[key] || 0) + 1;
    });
    const trendArr = Object.keys(trend).sort().map(key => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      return { month: label, count: trend[key] };
    });

    return { byDepartment, byRequester, reasons, trend: trendArr, total: rejected.length };
  }, [requests, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Performance Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            aria-label="Export report as CSV"
          >
            <Download size={14} strokeWidth={1.75} /> CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            aria-label="Export report as PDF"
          >
            <FileText size={14} strokeWidth={1.75} /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            aria-label="Export report as Excel"
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} /> Excel
          </button>
          <button
            onClick={handleExportAuditTrailPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            aria-label="Export audit trail as PDF"
          >
            <FileDown size={14} strokeWidth={1.75} /> Audit Trail
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Calendar size={16} strokeWidth={1.75} className="text-slate-400" />
          <span className="font-medium">Filter by date:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
            aria-label="Filter from date"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
            aria-label="Filter to date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-blue-500/20 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
          aria-label="Filter by department"
        >
          {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
        </select>
        {(dateFrom || dateTo || filterDept !== 'All') && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {requests.length} of {allRequests.length} requests
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div id="reports-content" className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 card-accent-left" role="status" aria-label={`Total Requests: ${requests.length}`}>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2"><TrendingUp size={16} strokeWidth={1.75} /> Total Requests</div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{requests.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60" role="status" aria-label={`Completed: ${completedRequests.length}`}>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2"><Target size={16} strokeWidth={1.75} /> Completed</div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completedRequests.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60" role="status" aria-label={`SLA Compliance: ${complianceRate}${complianceRate !== 'N/A' ? '%' : ''}`}>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2"><Clock size={16} strokeWidth={1.75} /> SLA Compliance</div>
          <p className={`text-3xl font-bold ${complianceRate !== 'N/A' && parseFloat(complianceRate) >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>{complianceRate}{complianceRate !== 'N/A' ? '%' : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60" role="status" aria-label={`Active Specialists: ${specialistData.length}`}>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2"><Users size={16} strokeWidth={1.75} /> Active Specialists</div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{specialistData.length}</p>
        </div>
      </div>

      {/* Requests Trend (30 Days) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp size={18} /> Requests Trend (30 Days)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Status Distribution</h3>
          {statusData.length > 0 ? (
            <div className="h-64" aria-label="Pie chart showing request distribution by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-slate-400 italic">No data</div>}
        </div>

        {/* Priority Volume */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Volume by Priority</h3>
          {priorityData.length > 0 ? (
            <div className="h-64" aria-label="Bar chart showing request volume by priority level">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" name="Requests" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-slate-400 italic">No data</div>}
        </div>

        {/* Average Time per Stage */}
        {stageAvgData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Average Time per Stage (Hours)</h3>
            <div className="h-64" aria-label="Bar chart showing average time per workflow stage in hours">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageAvgData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => `${val}h`} />
                  <Bar dataKey="avgHours" fill="#10b981" name="Avg Hours" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* SLA Performance */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">SLA Performance - Actual vs Target</h3>
          {slaData.length > 0 ? (
            <div className="h-64" aria-label="Bar chart showing SLA performance with actual versus target hours">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="id" tick={{ fontSize: 10 }} />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sla" fill="#f59e0b" name="SLA Target" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-slate-400 italic">No completed requests to analyze yet.</div>}
        </div>

        {/* Specialist Workload */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Users size={18} /> Specialist Workload
          </h3>
          {workloadData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                  <Bar dataKey="active" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20} name="Active Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 italic">No active specialist assignments</div>
          )}
        </div>
      </div>

      {/* Specialist Performance Table */}
      {specialistData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Specialist Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/60 dark:border-slate-700/60">
                <tr>
                  <th scope="col" className="p-3 text-xs uppercase tracking-wider">Specialist</th>
                  <th scope="col" className="p-3 text-center text-xs uppercase tracking-wider">Assigned</th>
                  <th scope="col" className="p-3 text-center text-xs uppercase tracking-wider">Completed</th>
                  <th scope="col" className="p-3 text-center text-xs uppercase tracking-wider">In Progress</th>
                  <th scope="col" className="p-3 text-center text-xs uppercase tracking-wider">Avg Time (h)</th>
                  <th scope="col" className="p-3 text-center text-xs uppercase tracking-wider">SLA Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {specialistData.map(spec => (
                  <tr key={spec.name} className="table-row-hover">
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{spec.name}</td>
                    <td className="p-3 text-center text-slate-700 dark:text-slate-300">{spec.assigned}</td>
                    <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">{spec.completed}</td>
                    <td className="p-3 text-center text-blue-600 dark:text-blue-400">{spec.inProgress}</td>
                    <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{spec.avgHours}</td>
                    <td className="p-3 text-center">
                      <span className={`badge-refined ring-1 ${spec.slaRate >= 90 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20' : spec.slaRate >= 70 ? 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-400/20' : 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-400/20'}`}>
                        {spec.slaRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* By Requester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Users size={18} /> Requests by User
          </h3>
          {byRequesterData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRequesterData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No data available</p>
          )}
        </div>

        {/* By Project */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Target size={18} /> Requests by Project
          </h3>
          {byProjectData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProjectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* By Department/Division */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users size={18} /> Requests by Department
        </h3>
        {byDepartmentData.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDepartmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">No data available</p>
        )}
      </div>

      {/* Rejection Analytics */}
      <div className="mt-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          Rejection Analytics
          <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({rejectionData.total} total rejections)</span>
        </h3>
        {rejectionData.total > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rejections by Department */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">By Department</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rejectionData.byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#ef4444" name="Rejections" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rejections by User — Ranked Table */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">By Requester (Repeat Offenders)</h4>
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-xs uppercase">#</th>
                      <th className="text-left p-2 text-xs uppercase">Requester</th>
                      <th className="text-right p-2 text-xs uppercase">Rejections</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rejectionData.byRequester.map((item, i) => (
                      <tr key={item.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="p-2 text-slate-400">{i + 1}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300">{item.name}</td>
                        <td className="p-2 text-right font-bold text-red-600 dark:text-red-400">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejection Reasons — Pie Chart */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Rejection Reasons</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rejectionData.reasons} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {rejectionData.reasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rejection Trend — Line Chart */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Rejection Trend</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rejectionData.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="Rejections" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 text-center">
            <AlertTriangle size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No rejected requests in the selected period</p>
          </div>
        )}
      </div>

      </div>{/* end reports-content */}
    </div>
  );
};
