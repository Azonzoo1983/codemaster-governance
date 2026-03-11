import React, { useState, useCallback, useMemo } from 'react';
import { useAdminStore, useToastStore, useWorkflowStore } from '../stores';
import { RequestStatus } from '../types';
import type { WorkflowConfig } from '../stores/workflowStore';
import {
  Plus, Trash2, GripVertical, Save, RotateCcw,
  ArrowRight, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Settings, Zap, Users,
} from 'lucide-react';

// Derived types from the store config
type WorkflowNode = WorkflowConfig['nodes'][number];
type WorkflowEdge = WorkflowConfig['edges'][number];

// Icon helper
const NodeIcon: React.FC<{ icon: WorkflowNode['icon']; size?: number }> = ({ icon, size = 16 }) => {
  switch (icon) {
    case 'clock': return <Clock size={size} />;
    case 'check': return <CheckCircle size={size} />;
    case 'x': return <XCircle size={size} />;
    case 'alert': return <AlertTriangle size={size} />;
    case 'users': return <Users size={size} />;
    case 'zap': return <Zap size={size} />;
    case 'settings': return <Settings size={size} />;
  }
};

export const WorkflowBuilder: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const selectedNode = useMemo(() => workflow.nodes.find(n => n.id === selectedNodeId), [workflow.nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => workflow.edges.find(e => e.id === selectedEdgeId), [workflow.edges, selectedEdgeId]);

  // Get edges for a node
  const getOutgoingEdges = useCallback((nodeId: string) =>
    workflow.edges.filter(e => e.from === nodeId), [workflow.edges]);
  const getIncomingEdges = useCallback((nodeId: string) =>
    workflow.edges.filter(e => e.to === nodeId), [workflow.edges]);

  // Update node
  const updateNode = (nodeId: string, updates: Partial<WorkflowConfig['nodes'][number]>) => {
    setWorkflow({
      ...workflow,
      nodes: workflow.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    });
    setHasChanges(true);
  };

  // Update edge
  const updateEdge = (edgeId: string, updates: Partial<WorkflowConfig['edges'][number]>) => {
    setWorkflow({
      ...workflow,
      edges: workflow.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e),
    });
    setHasChanges(true);
  };

  // Add node
  const addNode = () => {
    const newId = `n${Date.now()}`;
    const newNode: WorkflowConfig['nodes'][number] = {
      id: newId,
      status: RequestStatus.DRAFT,
      label: 'New Stage',
      color: 'bg-slate-400',
      icon: 'clock',
      description: 'New workflow stage',
    };
    setWorkflow({ ...workflow, nodes: [...workflow.nodes, newNode] });
    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
    setHasChanges(true);
  };

  // Remove node
  const removeNode = (nodeId: string) => {
    setWorkflow({
      ...workflow,
      nodes: workflow.nodes.filter(n => n.id !== nodeId),
      edges: workflow.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setHasChanges(true);
  };

  // Add edge
  const addEdge = (fromId: string, toId: string) => {
    const exists = workflow.edges.some(e => e.from === fromId && e.to === toId);
    if (exists) return;
    const newEdge: WorkflowConfig['edges'][number] = {
      id: `e${Date.now()}`,
      from: fromId,
      to: toId,
      label: 'Transition',
    };
    setWorkflow({ ...workflow, edges: [...workflow.edges, newEdge] });
    setHasChanges(true);
  };

  // Remove edge
  const removeEdge = (edgeId: string) => {
    setWorkflow({
      ...workflow,
      edges: workflow.edges.filter(e => e.id !== edgeId),
    });
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    setHasChanges(true);
  };

  // Move node in array (reorder)
  const moveNode = (fromIndex: number, toIndex: number) => {
    const nodes = [...workflow.nodes];
    const [moved] = nodes.splice(fromIndex, 1);
    nodes.splice(toIndex, 0, moved);
    setWorkflow({ ...workflow, nodes });
    setHasChanges(true);
  };

  // Save workflow (already persisted to localStorage via Zustand; mark as saved)
  const handleSave = () => {
    addToast('Workflow saved successfully!', 'success');
    setHasChanges(false);
  };

  // Reset to default
  const handleReset = () => {
    resetWorkflow();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHasChanges(false);
    addToast('Workflow reset to default.', 'info');
  };

  const colorOptions = [
    'bg-slate-400', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
    'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-yellow-500',
    'bg-amber-500', 'bg-rose-500',
  ];

  const iconOptions: WorkflowNode['icon'][] = ['clock', 'check', 'x', 'alert', 'users', 'zap', 'settings'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Workflow Builder</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{workflow.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>}
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition">
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-sm btn-primary text-white rounded-lg font-medium">
            <Save size={14} /> Save Workflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow Diagram (left 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Visual Flow */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Workflow Stages</h3>
              <button onClick={addNode} className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition font-medium">
                <Plus size={14} /> Add Stage
              </button>
            </div>

            {/* Node List */}
            <div className="space-y-2">
              {workflow.nodes.map((node, index) => {
                const outgoing = getOutgoingEdges(node.id);
                const incoming = getIncomingEdges(node.id);
                const isSelected = selectedNodeId === node.id;

                return (
                  <div key={node.id}>
                    <div
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      } ${draggedNodeId === node.id ? 'opacity-50' : ''}`}
                      onClick={() => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
                      draggable
                      onDragStart={() => setDraggedNodeId(node.id)}
                      onDragEnd={() => setDraggedNodeId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedNodeId && draggedNodeId !== node.id) {
                          const fromIdx = workflow.nodes.findIndex(n => n.id === draggedNodeId);
                          moveNode(fromIdx, index);
                        }
                      }}
                    >
                      {/* Drag Handle */}
                      <div className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>

                      {/* Color Dot */}
                      <div className={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center text-white shrink-0`}>
                        <NodeIcon icon={node.icon} size={14} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{node.label}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{node.status}</div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {node.requiresApproval && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Approval</span>
                        )}
                        {node.autoAssign && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">Auto</span>
                        )}
                        <span className="text-[10px] text-slate-400">{incoming.length}→{outgoing.length}</span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                        className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition p-1"
                        aria-label={`Remove ${node.label} stage`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Outgoing edges visualization */}
                    {outgoing.length > 0 && index < workflow.nodes.length - 1 && (
                      <div className="ml-8 pl-4 border-l-2 border-dashed border-slate-200 dark:border-slate-700 py-1">
                        {outgoing.map(edge => {
                          const targetNode = workflow.nodes.find(n => n.id === edge.to);
                          return (
                            <div
                              key={edge.id}
                              className={`flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer transition ${
                                selectedEdgeId === edge.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                              }`}
                              onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                            >
                              <ArrowRight size={12} />
                              <span className="font-medium">{edge.label || 'Transition'}</span>
                              <span className="text-slate-300 dark:text-slate-600">→</span>
                              <span>{targetNode?.label || 'Unknown'}</span>
                              {edge.condition && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-auto">{edge.condition}</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeEdge(edge.id); }}
                                className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 ml-1"
                              >
                                <XCircle size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edge Creator */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">Add Transition</h3>
            <EdgeCreator nodes={workflow.nodes} onAdd={addEdge} />
          </div>
        </div>

        {/* Properties Panel (right 1/3) */}
        <div className="space-y-4">
          {/* Node Properties */}
          {selectedNode && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-5 animate-fadeIn">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <div className={`w-6 h-6 rounded ${selectedNode.color} flex items-center justify-center text-white`}>
                  <NodeIcon icon={selectedNode.icon} size={12} />
                </div>
                Stage Properties
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                  <textarea
                    value={selectedNode.description || ''}
                    onChange={e => updateNode(selectedNode.id, { description: e.target.value })}
                    rows={2}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status Mapping</label>
                  <select
                    value={selectedNode.status}
                    onChange={e => updateNode(selectedNode.id, { status: e.target.value as RequestStatus })}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200"
                  >
                    {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Color</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {colorOptions.map(c => (
                      <button
                        key={c}
                        onClick={() => updateNode(selectedNode.id, { color: c })}
                        className={`w-7 h-7 rounded-lg ${c} transition-all ${selectedNode.color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-800' : 'hover:scale-110'}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Icon</label>
                  <div className="flex gap-1.5">
                    {iconOptions.map(ic => (
                      <button
                        key={ic}
                        onClick={() => updateNode(selectedNode.id, { icon: ic })}
                        className={`p-2 rounded-lg border transition-all ${selectedNode.icon === ic ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'}`}
                      >
                        <NodeIcon icon={ic} size={16} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedNode.requiresApproval || false}
                      onChange={e => updateNode(selectedNode.id, { requiresApproval: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    Requires Approval
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedNode.autoAssign || false}
                      onChange={e => updateNode(selectedNode.id, { autoAssign: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    Auto-Assign
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">SLA Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={selectedNode.slaMultiplier || 1}
                    onChange={e => updateNode(selectedNode.id, { slaMultiplier: parseFloat(e.target.value) || 1 })}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Time allocated for this stage as a fraction of total SLA</p>
                </div>
              </div>
            </div>
          )}

          {/* Edge Properties */}
          {selectedEdge && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-5 animate-fadeIn">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Transition Properties</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedEdge.label || ''}
                    onChange={e => updateEdge(selectedEdge.id, { label: e.target.value })}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Condition (optional)</label>
                  <input
                    type="text"
                    value={selectedEdge.condition || ''}
                    onChange={e => updateEdge(selectedEdge.id, { condition: e.target.value })}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 focus:border-blue-500"
                    placeholder="e.g. priority === Critical"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Expression evaluated to determine if this path is taken</p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <p><strong>From:</strong> {workflow.nodes.find(n => n.id === selectedEdge.from)?.label}</p>
                  <p><strong>To:</strong> {workflow.nodes.find(n => n.id === selectedEdge.to)?.label}</p>
                </div>
              </div>
            </div>
          )}

          {/* No selection */}
          {!selectedNode && !selectedEdge && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-8 text-center">
              <Settings size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Select a stage or transition</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click on any stage or arrow to edit its properties</p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-700/60 p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">Workflow Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Stages</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{workflow.nodes.length}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Transitions</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{workflow.edges.length}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Approval Stages</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{workflow.nodes.filter(n => n.requiresApproval).length}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Auto-Assign Stages</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{workflow.nodes.filter(n => n.autoAssign).length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edge Creator Sub-component
const EdgeCreator: React.FC<{
  nodes: WorkflowNode[];
  onAdd: (fromId: string, toId: string) => void;
}> = ({ nodes, onAdd }) => {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');

  const handleAdd = () => {
    if (fromId && toId && fromId !== toId) {
      onAdd(fromId, toId);
      setFromId('');
      setToId('');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={fromId}
        onChange={e => setFromId(e.target.value)}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 flex-1 min-w-[120px]"
        aria-label="From stage"
      >
        <option value="">From stage...</option>
        {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
      </select>
      <ArrowRight size={16} className="text-slate-400 shrink-0" />
      <select
        value={toId}
        onChange={e => setToId(e.target.value)}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 dark:text-slate-200 flex-1 min-w-[120px]"
        aria-label="To stage"
      >
        <option value="">To stage...</option>
        {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
      </select>
      <button
        onClick={handleAdd}
        disabled={!fromId || !toId || fromId === toId}
        className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium shrink-0"
      >
        <Plus size={14} /> Add
      </button>
    </div>
  );
};
