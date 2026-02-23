// Task 2.16: CostTimeline — line chart for temporal cost/token data
'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface TimelinePoint {
  period: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  request_count: number;
}

interface CostTimelineProps {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  agentId?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function CostTimeline({ startDate, endDate, workspaceId, agentId }: CostTimelineProps) {
  const [data, setData] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'cost' | 'tokens'>('cost');

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (workspaceId) params.set('workspace_id', workspaceId);
        if (agentId) params.set('agent_id', agentId);

        const res = await fetch(`/api/metrics/timeline?${params}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, workspaceId, agentId]);

  if (loading) {
    return (
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-mc-bg-tertiary rounded w-32 mb-4" />
        <div className="h-64 bg-mc-bg-tertiary rounded" />
      </div>
    );
  }

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary">
          Cost Timeline
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
            Cost
          </button>
          <button
            onClick={() => setMetric('tokens')}
            className={`px-2 py-1 text-xs rounded ${
              metric === 'tokens'
                ? 'bg-mc-accent/20 text-mc-accent'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
          >
            Tokens
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-mc-text-secondary text-sm">
          No timeline data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="period"
              tickFormatter={formatDate}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                metric === 'cost' ? `$${v.toFixed(2)}` : `${(v / 1000).toFixed(0)}K`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--mc-bg-secondary)',
                border: '1px solid var(--mc-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelFormatter={formatDate}
              formatter={(value: number, name: string) => {
                if (name.includes('cost')) return [`$${value.toFixed(4)}`, 'Cost'];
                return [value.toLocaleString(), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {metric === 'cost' ? (
              <Line
                type="monotone"
                dataKey="total_cost"
                name="Cost (USD)"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="input_tokens"
                  name="Input"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="output_tokens"
                  name="Output"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
