import React, { useState, useMemo } from 'react';
import { useStore, useToast } from '../store';
import { AttributeDefinition, AttributeType, Priority, Role } from '../types';
import { Trash2, Plus, Edit, Link, Copy, Users, Mail, Shield, Clock, CheckCircle, XCircle, Send } from 'lucide-react';

export const Admin: React.FC = () => {
  const {
    attributes,
    priorities,
    users,
    inviteTokens,
    updateAttribute,
    addAttribute,
    deleteAttribute,
    updatePriority,
    addPriority,
    deletePriority,
    createInviteToken,
    updateUserRole,
  } = useStore();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'attributes' | 'priorities' | 'users' | 'invites'>('attributes');

  const [editingAttr, setEditingAttr] = useState<Partial<AttributeDefinition> | null>(null);
  const [editingPrio, setEditingPrio] = useState<Partial<Priority> | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>(Role.REQUESTER);

  // Confirm deletion state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- Attributes Handlers ---
  const saveAttribute = () => {
    if (!editingAttr?.name?.trim()) {
      addToast('Attribute name is required.', 'warning');
      return;
    }

    if (editingAttr.id && attributes.some(a => a.id === editingAttr.id)) {
      updateAttribute(editingAttr as AttributeDefinition);
    } else {
      const newAttr: AttributeDefinition = {
        id: `attr-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
        name: editingAttr.name.trim(),
        active: true,
        type: editingAttr.type || AttributeType.TEXT,
        mandatory: editingAttr.mandatory || false,
        includeInAutoDescription: editingAttr.includeInAutoDescription || false,
        descriptionOrder: editingAttr.descriptionOrder || 99,
        options: editingAttr.options,
        units: editingAttr.units,
        dimensionFields: editingAttr.dimensionFields,
        visibleForClassification: editingAttr.visibleForClassification,
      };
      addAttribute(newAttr);
    }
    setEditingAttr(null);
  };

  const confirmDelete = (id: string, type: 'attribute' | 'priority') => {
    if (confirmDeleteId === id) {
      if (type === 'attribute') deleteAttribute(id);
      else deletePriority(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId(prev => prev === id ? null : prev);
      }, 3000);
    }
  };

  // --- Priorities Handlers ---
  const savePriority = () => {
    if (!editingPrio?.name?.trim()) {
      addToast('Priority name is required.', 'warning');
      return;
    }

    if (editingPrio.id && priorities.some(p => p.id === editingPrio.id)) {
      updatePriority(editingPrio as Priority);
    } else {
      const newPrio: Priority = {
        id: `prio-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
        name: editingPrio.name.trim(),
        active: true,
        requiresApproval: editingPrio.requiresApproval || false,
        slaHours: editingPrio.slaHours || 24,
        displayOrder: editingPrio.displayOrder || 99,
        description: editingPrio.description || ''
      };
      addPriority(newPrio);
    }
    setEditingPrio(null);
  };

  // --- Invite Handlers ---
  const handleCreateInvite = () => {
    if (!inviteEmail.trim()) {
      addToast('Please enter an email address.', 'warning');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      addToast('Please enter a valid email address.', 'warning');
      return;
    }
    const token = createInviteToken(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    // Auto copy link
    const link = `${window.location.origin}/register?token=${token.token}`;
    navigator.clipboard.writeText(link).then(() => {
      addToast('Invite link copied to clipboard!', 'success');
    }).catch(() => {});
  };

  const copyInviteLink = async (tokenStr: string) => {
    const link = `${window.location.origin}/register?token=${tokenStr}`;
    try {
      await navigator.clipboard.writeText(link);
      addToast('Invite link copied to clipboard.', 'success');
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  // Sort invites: unused first, then by creation date desc
  const sortedInvites = useMemo(() =>
    [...inviteTokens].sort((a, b) => {
      if (a.used !== b.used) return a.used ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
  [inviteTokens]);

  const inviteStats = useMemo(() => ({
    total: inviteTokens.length,
    pending: inviteTokens.filter(t => !t.used && new Date(t.expiresAt) > new Date()).length,
    used: inviteTokens.filter(t => t.used).length,
    expired: inviteTokens.filter(t => !t.used && new Date(t.expiresAt) <= new Date()).length,
  }), [inviteTokens]);

  const tabs = [
    { key: 'attributes' as const, label: 'Item Attributes' },
    { key: 'priorities' as const, label: 'Priorities' },
    { key: 'users' as const, label: 'User Management' },
    { key: 'invites' as const, label: 'Invitations' },
  ];

  const roleOptions = Object.values(Role);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Admin Configuration</h2>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`py-2.5 px-4 font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- ATTRIBUTES TAB --- */}
      {activeTab === 'attributes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setEditingAttr({})}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
            >
              <Plus size={16} /> Add Attribute
            </button>
          </div>

          {editingAttr && (
            <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 space-y-4">
              <h4 className="font-bold text-gray-700">{editingAttr.id ? 'Edit' : 'New'} Attribute</h4>
              <div className="grid grid-cols-2 gap-4">
                <input
                  placeholder="Name"
                  className="p-2 border rounded"
                  value={editingAttr.name || ''}
                  onChange={e => setEditingAttr({ ...editingAttr, name: e.target.value })}
                />
                <select
                  className="p-2 border rounded"
                  value={editingAttr.type || AttributeType.TEXT}
                  onChange={e => setEditingAttr({ ...editingAttr, type: e.target.value as AttributeType })}
                >
                  {Object.values(AttributeType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingAttr.mandatory || false} onChange={e => setEditingAttr({ ...editingAttr, mandatory: e.target.checked })} />
                  Mandatory
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingAttr.includeInAutoDescription || false} onChange={e => setEditingAttr({ ...editingAttr, includeInAutoDescription: e.target.checked })} />
                  Use in Auto Description
                </label>
                <input
                  type="number"
                  placeholder="Order"
                  className="p-2 border rounded"
                  value={editingAttr.descriptionOrder || 0}
                  onChange={e => setEditingAttr({ ...editingAttr, descriptionOrder: parseInt(e.target.value) || 0 })}
                />
                {(editingAttr.type === AttributeType.DROPDOWN || editingAttr.type === AttributeType.NUMERIC_UNIT || editingAttr.type === AttributeType.MULTI_SELECT) && (
                  <input
                    placeholder="Options/Units (comma separated)"
                    className="p-2 border rounded col-span-2"
                    value={(editingAttr.type === AttributeType.NUMERIC_UNIT ? editingAttr.units : editingAttr.options)?.join(', ') || ''}
                    onChange={e => {
                      const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      if (editingAttr.type === AttributeType.NUMERIC_UNIT) setEditingAttr({ ...editingAttr, units: val });
                      else setEditingAttr({ ...editingAttr, options: val });
                    }}
                  />
                )}
                {editingAttr.type === AttributeType.DIMENSION_BLOCK && (
                  <input
                    placeholder="Fields (e.g. Length,Width,Depth)"
                    className="p-2 border rounded col-span-2"
                    value={editingAttr.dimensionFields?.join(', ') || ''}
                    onChange={e => {
                      const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setEditingAttr({ ...editingAttr, dimensionFields: val });
                    }}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={saveAttribute} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Save</button>
                <button onClick={() => setEditingAttr(null)} className="text-gray-600 hover:text-gray-800">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="p-3">Order</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Mandatory</th>
                  <th className="p-3">In Desc.</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...attributes].sort((a, b) => a.descriptionOrder - b.descriptionOrder).map(attr => (
                  <tr key={attr.id} className="hover:bg-gray-50">
                    <td className="p-3">{attr.descriptionOrder}</td>
                    <td className="p-3 font-medium">{attr.name}</td>
                    <td className="p-3">{attr.type}</td>
                    <td className="p-3 text-center">{attr.mandatory ? 'Yes' : '-'}</td>
                    <td className="p-3 text-center">{attr.includeInAutoDescription ? 'Yes' : '-'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => setEditingAttr(attr)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Edit size={16} /></button>
                      <button
                        onClick={() => confirmDelete(attr.id, 'attribute')}
                        className={`p-1 rounded ${confirmDeleteId === attr.id ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'}`}
                        title={confirmDeleteId === attr.id ? 'Click again to confirm' : 'Delete'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PRIORITIES TAB --- */}
      {activeTab === 'priorities' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setEditingPrio({})}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
            >
              <Plus size={16} /> Add Priority
            </button>
          </div>

          {editingPrio && (
            <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 space-y-4">
              <h4 className="font-bold text-gray-700">{editingPrio.id ? 'Edit' : 'New'} Priority</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500">Priority Name</label>
                  <input
                    className="p-2 border rounded w-full mt-1"
                    value={editingPrio.name || ''}
                    onChange={e => setEditingPrio({ ...editingPrio, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500">SLA (Hours)</label>
                  <input
                    type="number"
                    className="p-2 border rounded w-full mt-1"
                    value={editingPrio.slaHours || 24}
                    onChange={e => setEditingPrio({ ...editingPrio, slaHours: parseInt(e.target.value) || 24 })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500">Guidance Text (User Facing)</label>
                  <textarea
                    className="p-2 border rounded w-full mt-1"
                    rows={2}
                    value={editingPrio.description || ''}
                    onChange={e => setEditingPrio({ ...editingPrio, description: e.target.value })}
                    placeholder="Explain timing and rules for this priority..."
                  />
                </div>
                <div className="col-span-2 flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={editingPrio.requiresApproval || false} onChange={e => setEditingPrio({ ...editingPrio, requiresApproval: e.target.checked })} />
                    Requires Manager Approval
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Display Order:
                    <input
                      type="number"
                      className="p-1 border rounded w-16"
                      value={editingPrio.displayOrder || 0}
                      onChange={e => setEditingPrio({ ...editingPrio, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={savePriority} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Save</button>
                <button onClick={() => setEditingPrio(null)} className="text-gray-600 hover:text-gray-800">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[700px]">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="p-3 w-16">Order</th>
                  <th className="p-3 w-24">Name</th>
                  <th className="p-3">Guidance Text</th>
                  <th className="p-3 w-16">SLA</th>
                  <th className="p-3 w-24 text-center">Approval</th>
                  <th className="p-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...priorities].sort((a, b) => a.displayOrder - b.displayOrder).map(prio => (
                  <tr key={prio.id} className="hover:bg-gray-50">
                    <td className="p-3">{prio.displayOrder}</td>
                    <td className="p-3 font-medium">{prio.name}</td>
                    <td className="p-3 text-gray-500 italic text-xs">{prio.description}</td>
                    <td className="p-3 font-semibold">{prio.slaHours}h</td>
                    <td className="p-3 text-center">{prio.requiresApproval ? <span className="text-red-600 font-bold">Yes</span> : 'No'}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditingPrio(prio)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Edit"><Edit size={16} /></button>
                        <button
                          onClick={() => confirmDelete(prio.id, 'priority')}
                          className={`p-1 rounded ${confirmDeleteId === prio.id ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'}`}
                          title={confirmDeleteId === prio.id ? 'Click again to confirm' : 'Delete'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase mb-1">
                <Users size={14} /> Total Users
              </div>
              <p className="text-2xl font-bold text-gray-800">{users.length}</p>
            </div>
            {roleOptions.slice(0, 3).map(role => (
              <div key={role} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-gray-500 text-xs font-semibold uppercase mb-1">{role}s</div>
                <p className="text-2xl font-bold text-gray-800">{users.filter(u => u.role === role).length}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-700">Registered Users ({users.length})</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 text-gray-500">{u.email}</td>
                      <td className="p-3 text-gray-500">{u.department}</td>
                      <td className="p-3 text-gray-500">{u.projectName || u.projectNumber || '-'}</td>
                      <td className="p-3">
                        <select
                          className="text-xs font-medium px-2 py-1 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={u.role}
                          onChange={e => updateUserRole(u.id, e.target.value as Role)}
                        >
                          {roleOptions.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">No users registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- INVITATIONS TAB --- */}
      {activeTab === 'invites' && (
        <div className="space-y-6">
          {/* Create Invite */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Send size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">Generate Invitation</h3>
                <p className="text-blue-700 text-sm mt-0.5">Create an invite link for a new user. Links expire in 7 days.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <div className="flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" />
                  <input
                    type="email"
                    placeholder="user@company.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateInvite()}
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned Role</label>
                <div className="flex items-center gap-1.5">
                  <Shield size={14} className="text-gray-400" />
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as Role)}
                  >
                    {roleOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sm:self-end">
                <button
                  onClick={handleCreateInvite}
                  className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Link size={16} />
                  Generate & Copy
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-gray-500 text-xs font-semibold uppercase mb-1">Total Invites</div>
              <p className="text-2xl font-bold text-gray-800">{inviteStats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 text-amber-600 text-xs font-semibold uppercase mb-1">
                <Clock size={12} /> Pending
              </div>
              <p className="text-2xl font-bold text-amber-600">{inviteStats.pending}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 text-green-600 text-xs font-semibold uppercase mb-1">
                <CheckCircle size={12} /> Used
              </div>
              <p className="text-2xl font-bold text-green-600">{inviteStats.used}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 text-red-500 text-xs font-semibold uppercase mb-1">
                <XCircle size={12} /> Expired
              </div>
              <p className="text-2xl font-bold text-red-500">{inviteStats.expired}</p>
            </div>
          </div>

          {/* Invites Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h4 className="font-bold text-gray-700">Invitation History</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedInvites.map(inv => {
                    const isExpired = !inv.used && new Date(inv.expiresAt) <= new Date();
                    const statusLabel = inv.used ? 'Used' : isExpired ? 'Expired' : 'Pending';
                    const statusColor = inv.used
                      ? 'bg-green-50 text-green-700'
                      : isExpired
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-700';

                    return (
                      <tr key={inv.id} className={`hover:bg-gray-50 ${inv.used || isExpired ? 'opacity-60' : ''}`}>
                        <td className="p-3 font-medium">{inv.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                            {inv.role || Role.REQUESTER}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-gray-500">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {!inv.used && !isExpired && (
                            <button
                              onClick={() => copyInviteLink(inv.token)}
                              className="text-indigo-600 hover:bg-indigo-50 p-1 rounded flex items-center gap-1 text-xs"
                              title="Copy invite link"
                            >
                              <Copy size={14} /> Copy Link
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedInvites.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        No invitations yet. Generate one above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
