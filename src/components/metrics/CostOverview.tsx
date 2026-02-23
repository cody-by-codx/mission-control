// Task 2.14: CostOverview — summary cards (today, week, month, all-time)
'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Coins, TrendingUp, Users } from 'lucide-react';

interface OverviewData {
  today: { tokens: number; cost: number };
  week: { tokens: number; cost: number };
  month: { tokens: number; cost: number };
  allTime: { tokens: number; cost: number };
  totalRecords: number;
  activeAgents: number;
}

interface CostOverviewProps {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  agentId?: string;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function CostOverview({ startDate, endDate, workspaceId, agentId }: CostOverviewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (workspaceId) params.set('workspace_id', workspaceId);
        if (agentId) params.set('agent_id', agentId);

        const res = await fetch(`/api/metrics/overview?${params}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Failed to load metrics overview:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, workspaceId, agentId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-mc-bg-tertiary rounded w-16 mb-2" />
            <div className="h-8 bg-mc-bg-tertiary rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: 'Today',
      cost: data.today.cost,
      tokens: data.today.tokens,
      icon: DollarSign,
      color: 'text-mc-accent-cyan',
      bg: 'bg-mc-accent-cyan/10',
    },
    {
      label: 'This Week',
      cost: data.week.cost,
      tokens: data.week.tokens,
      icon: TrendingUp,
      color: 'text-mc-accent-green',
      bg: 'bg-mc-accent-green/10',
    },
    {
      label: 'This Month',
      cost: data.month.cost,
      tokens: data.month.tokens,
      icon: Coins,
      color: 'text-mc-accent-purple',
      bg: 'bg-mc-accent-purple/10',
    },
    {
      label: 'All Time',
      cost: data.allTime.cost,
      tokens: data.allTime.tokens,
      icon: Users,
      color: 'text-mc-accent-yellow',
      bg: 'bg-mc-accent-yellow/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-mc-text-secondary uppercase tracking-wider">
              {card.label}
            </span>
            <div className={`p-1.5 rounded ${card.bg}`}>
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
            </div>
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {formatCost(card.cost)}
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">
            {formatTokens(card.tokens)} tokens
          </div>
        </div>
      ))}
    </div>
  );
}
