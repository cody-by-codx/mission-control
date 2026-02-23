// Task 2.18: AgentPerformance — bar chart of efficiency (tokens/task, cost/task)
'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface AgentMetric {
  agent_id: string;
  agent_name: string;
  avatar_emoji: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
  tasks_with_usage: number;
}

interface AgentPerformanceProps {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
}

export function AgentPerformance({ startDate, endDate, workspaceId }: AgentPerformanceProps) {
  const [data, setData] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'tokens' | 'cost'>('cost');

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (workspaceId) params.set('workspace_id', workspaceId);

        const res = await fetch(`/api/metrics/agents?${params}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Failed to load agent performance:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, workspaceId]);

  if (loading) {
    return (
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-mc-bg-tertiary rounded w-40 mb-4" />
        <div className="h-64 bg-mc-bg-tertiary rounded" />
      </div>
    );
  }

  const chartData = data.map((agent) => ({
    name: agent.agent_name,
    emoji: agent.avatar_emoji,
    tokensPerTask: agent.tasks_with_usage > 0 ? Math.round(agent.total_tokens / agent.tasks_with_usage) : 0,
    costPerTask: agent.tasks_with_usage > 0 ? agent.total_cost / agent.tasks_with_usage : 0,
    totalTokens: agent.total_tokens,
    totalCost: agent.total_cost,
    tasks: agent.tasks_with_usage,
  }));

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary">
          Agent Efficiency
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setMetric('cost')}
            className={`px-2 py-1 text-xs rounded ${
              metric === 'cost'
                ? 'bg-mc-accent/20 text-mc-accent'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
          >
            Cost/Task
          </button>
          <button
            onClick={() => setMetric('tokens')}
            className={`px-2 py-1 text-xs rounded ${
              metric === 'tokens'
                ? 'bg-mc-accent/20 text-mc-accent'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
          >
            Tokens/Task
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-mc-text-secondary text-sm">
          No agent performance data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                metric === 'cost' ? `$${v.toFixed(2)}` : `${(v / 1000).toFixed(0)}K`
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--mc-bg-secondary)',
                border: '1px solid var(--mc-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, name) => {
                const v = Number(value ?? 0);
                const n = String(name ?? '');
                if (n.includes('Cost')) return [`$${v.toFixed(4)}`, n];
                return [v.toLocaleString(), n];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {metric === 'cost' ? (
              <Bar
                dataKey="costPerTask"
                name="Cost per Task"
                fill="#22d3ee"
                radius={[0, 4, 4, 0]}
              />
            ) : (
              <Bar
                dataKey="tokensPerTask"
                name="Tokens per Task"
                fill="#a78bfa"
                radius={[0, 4, 4, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
