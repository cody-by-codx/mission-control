// Task 2.15: AgentCostTable — sortable table with agent, tokens, cost, tasks
'use client';

import { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AgentMetric {
  agent_id: string;
  agent_name: string;
  avatar_emoji: string;
  role: string;
  model: string;
  total_tokens: number;
  total_input: number;
  total_output: number;
  total_cost: number;
  request_count: number;
  tasks_with_usage: number;
}

type SortField = 'total_cost' | 'total_tokens' | 'request_count';

interface AgentCostTableProps {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
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

export function AgentCostTable({ startDate, endDate, workspaceId }: AgentCostTableProps) {
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>('total_cost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (workspaceId) params.set('workspace_id', workspaceId);
        params.set('sort_by', sortBy);
        params.set('order', sortOrder);

        const res = await fetch(`/api/metrics/agents?${params}`);
        if (res.ok) setAgents(await res.json());
      } catch (err) {
        console.error('Failed to load agent metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, workspaceId, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortOrder === 'desc'
      ? <ArrowDown className="w-3 h-3 text-mc-accent" />
      : <ArrowUp className="w-3 h-3 text-mc-accent" />;
  };

  if (loading) {
    return (
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-mc-bg-tertiary rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-mc-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-mc-border">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary">
          Cost by Agent
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mc-border text-mc-text-secondary text-xs uppercase">
              <th className="px-4 py-2 text-left">Agent</th>
              <th className="px-4 py-2 text-left">Model</th>
              <th
                className="px-4 py-2 text-right cursor-pointer select-none hover:text-mc-text"
                onClick={() => handleSort('total_tokens')}
              >
                <span className="inline-flex items-center gap-1">
                  Tokens <SortIcon field="total_tokens" />
                </span>
              </th>
              <th
                className="px-4 py-2 text-right cursor-pointer select-none hover:text-mc-text"
                onClick={() => handleSort('total_cost')}
              >
                <span className="inline-flex items-center gap-1">
                  Cost <SortIcon field="total_cost" />
                </span>
              </th>
              <th
                className="px-4 py-2 text-right cursor-pointer select-none hover:text-mc-text"
                onClick={() => handleSort('request_count')}
              >
                <span className="inline-flex items-center gap-1">
                  Requests <SortIcon field="request_count" />
                </span>
              </th>
              <th className="px-4 py-2 text-right">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-mc-text-secondary">
                  No agent metrics recorded yet
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr
                  key={agent.agent_id}
                  className="border-b border-mc-border/50 hover:bg-mc-bg-tertiary/50 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent.avatar_emoji}</span>
                      <div>
                        <div className="font-medium">{agent.agent_name}</div>
                        <div className="text-xs text-mc-text-secondary">{agent.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-mc-text-secondary text-xs font-mono">
                    {agent.model}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatTokens(agent.total_tokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-mc-accent-cyan">
                    {formatCost(agent.total_cost)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {agent.request_count}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {agent.tasks_with_usage}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
