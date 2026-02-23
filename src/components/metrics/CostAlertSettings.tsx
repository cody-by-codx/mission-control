'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { CostAlertConfig } from '@/lib/types';

interface CostAlertSettingsProps {
  workspaceId?: string;
}

export function CostAlertSettings({ workspaceId }: CostAlertSettingsProps) {
  const { agents } = useMissionControl();
  const [alerts, setAlerts] = useState<CostAlertConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entity_type: 'agent' as 'agent' | 'workspace',
    entity_id: '',
    threshold_usd: '10',
    period: 'daily' as 'daily' | 'weekly' | 'monthly',
  });

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/alerts');
      if (res.ok) {
        setAlerts(await res.json());
      }
    } catch (error) {
      console.error('Failed to load cost alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleCreate = async () => {
    if (!form.entity_id || !form.threshold_usd) return;
    try {
      const res = await fetch('/api/metrics/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          threshold_usd: parseFloat(form.threshold_usd),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ entity_type: 'agent', entity_id: '', threshold_usd: '10', period: 'daily' });
        loadAlerts();
      }
    } catch (error) {
      console.error('Failed to create cost alert:', error);
    }
  };

  const handleToggle = async (alert: CostAlertConfig) => {
    try {
      await fetch(`/api/metrics/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !alert.enabled }),
      });
      loadAlerts();
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/metrics/alerts/${id}`, { method: 'DELETE' });
      loadAlerts();
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const getEntityName = (alert: CostAlertConfig) => {
    if (alert.entity_type === 'agent') {
      const agent = agents.find(a => a.id === alert.entity_id);
      return agent ? `${agent.avatar_emoji} ${agent.name}` : alert.entity_id;
    }
    return alert.entity_id;
  };

  if (isLoading) {
    return <div className="text-mc-text-secondary text-sm p-4">Loading alerts...</div>;
  }

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4 text-mc-accent-yellow" />
          Cost Alerts
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-mc-bg-tertiary hover:bg-mc-border rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Alert
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-4 p-3 bg-mc-bg rounded-lg border border-mc-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-mc-text-secondary mb-1">Type</label>
              <select
                value={form.entity_type}
                onChange={e => setForm({ ...form, entity_type: e.target.value as 'agent' | 'workspace', entity_id: '' })}
                className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2 py-1.5 text-xs"
              >
                <option value="agent">Agent</option>
                <option value="workspace">Workspace</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-mc-text-secondary mb-1">
                {form.entity_type === 'agent' ? 'Agent' : 'Workspace'}
              </label>
              <select
                value={form.entity_id}
                onChange={e => setForm({ ...form, entity_id: e.target.value })}
                className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2 py-1.5 text-xs"
              >
                <option value="">Select...</option>
                {form.entity_type === 'agent'
                  ? agents.map(a => (
                      <option key={a.id} value={a.id}>{a.avatar_emoji} {a.name}</option>
                    ))
                  : workspaceId && <option value={workspaceId}>Current Workspace</option>
                }
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-mc-text-secondary mb-1">Threshold (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.threshold_usd}
                onChange={e => setForm({ ...form, threshold_usd: e.target.value })}
                className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-mc-text-secondary mb-1">Period</label>
              <select
                value={form.period}
                onChange={e => setForm({ ...form, period: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2 py-1.5 text-xs"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1 text-xs text-mc-text-secondary hover:text-mc-text"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.entity_id}
              className="px-3 py-1 text-xs bg-mc-accent text-mc-bg rounded disabled:opacity-50"
            >
              Create Alert
            </button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="text-xs text-mc-text-secondary">No cost alerts configured.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-2 bg-mc-bg rounded border border-mc-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {getEntityName(alert)}
                </div>
                <div className="text-xs text-mc-text-secondary">
                  ${Number(alert.threshold_usd).toFixed(2)} / {alert.period}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(alert)}
                  className={`p-1 rounded transition-colors ${
                    alert.enabled ? 'text-mc-accent-yellow hover:bg-mc-accent-yellow/10' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
                  }`}
                  title={alert.enabled ? 'Disable alert' : 'Enable alert'}
                >
                  {alert.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-1 text-mc-text-secondary hover:text-mc-accent-red hover:bg-mc-accent-red/10 rounded transition-colors"
                  title="Delete alert"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
