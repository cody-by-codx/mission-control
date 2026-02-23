// Task 2.17: TokenDistribution — pie/donut chart of tokens by model
'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

interface ModelMetric {
  model: string;
  provider: string | null;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  request_count: number;
  unique_agents: number;
}

interface TokenDistributionProps {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
}

const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c'];

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function TokenDistribution({ startDate, endDate, workspaceId }: TokenDistributionProps) {
  const [models, setModels] = useState<ModelMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (workspaceId) params.set('workspace_id', workspaceId);

        const res = await fetch(`/api/metrics/models?${params}`);
        if (res.ok) setModels(await res.json());
      } catch (err) {
        console.error('Failed to load model metrics:', err);
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

  const chartData = models.map((m) => ({
    name: m.model,
    value: m.total_tokens,
    cost: m.total_cost,
  }));

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary mb-4">
        Token Distribution by Model
      </h3>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-mc-text-secondary text-sm">
          No model usage data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--mc-bg-secondary)',
                border: '1px solid var(--mc-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, _, props) => {
                const v = Number(value ?? 0);
                const p = (props as { payload?: { name?: string; cost?: number } })?.payload;
                return [
                  `${formatTokens(v)} tokens ($${(p?.cost ?? 0).toFixed(4)})`,
                  p?.name ?? '',
                ];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value: string) => (
                <span className="text-mc-text-secondary">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
