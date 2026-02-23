// Task 2.20: MetricsFilter — filters for period, workspace, agent
'use client';

import { useState, useEffect } from 'react';
import { Filter, Download } from 'lucide-react';

interface MetricsFilterProps {
  onFilterChange: (filters: FilterState) => void;
  workspaceId?: string;
}

export interface FilterState {
  period: 'today' | '7d' | '30d' | '90d' | 'all';
  workspaceId?: string;
  agentId?: string;
  startDate?: string;
  endDate?: string;
}

interface AgentOption {
  id: string;
  name: string;
  avatar_emoji: string;
}

function getPeriodDates(period: string): { startDate?: string; endDate?: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  switch (period) {
    case 'today':
      return { startDate: end, endDate: end };
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString().split('T')[0], endDate: end };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString().split('T')[0], endDate: end };
    }
    case '90d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { startDate: start.toISOString().split('T')[0], endDate: end };
    }
    default:
      return {};
  }
}

export function MetricsFilter({ onFilterChange, workspaceId }: MetricsFilterProps) {
  const [period, setPeriod] = useState<FilterState['period']>('30d');
  const [agentId, setAgentId] = useState<string>('');
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadAgents() {
      try {
        const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
        const res = await fetch(`/api/agents${params}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.map((a: AgentOption) => ({ id: a.id, name: a.name, avatar_emoji: a.avatar_emoji })));
        }
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    }
    loadAgents();
  }, [workspaceId]);

  useEffect(() => {
    const dates = getPeriodDates(period);
    onFilterChange({
      period,
      workspaceId,
      agentId: agentId || undefined,
      ...dates,
    });
  }, [period, agentId, workspaceId, onFilterChange]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const dates = getPeriodDates(period);
      const params = new URLSearchParams({ format });
      if (dates.startDate) params.set('start_date', dates.startDate);
      if (dates.endDate) params.set('end_date', dates.endDate);
      if (workspaceId) params.set('workspace_id', workspaceId);
      if (agentId) params.set('agent_id', agentId);

      const res = await fetch(`/api/metrics/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const periods: { value: FilterState['period']; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Filter className="w-4 h-4 text-mc-text-secondary" />

      {/* Period selector */}
      <div className="flex gap-1 bg-mc-bg-tertiary rounded-lg p-0.5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              period === p.value
                ? 'bg-mc-accent/20 text-mc-accent font-medium'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Agent filter */}
      <select
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        className="bg-mc-bg-tertiary border border-mc-border rounded-lg px-3 py-1.5 text-xs text-mc-text"
      >
        <option value="">All Agents</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.avatar_emoji} {a.name}
          </option>
        ))}
      </select>

      {/* Export buttons */}
      <div className="ml-auto flex gap-1">
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting}
          className="flex items-center gap-1 px-2 py-1 text-xs text-mc-text-secondary hover:text-mc-text bg-mc-bg-tertiary rounded border border-mc-border hover:border-mc-accent/50 transition-colors"
        >
          <Download className="w-3 h-3" />
          CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={exporting}
          className="flex items-center gap-1 px-2 py-1 text-xs text-mc-text-secondary hover:text-mc-text bg-mc-bg-tertiary rounded border border-mc-border hover:border-mc-accent/50 transition-colors"
        >
          <Download className="w-3 h-3" />
          JSON
        </button>
      </div>
    </div>
  );
}
