'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  ListTodo,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
  uptime: { ms: number; human: string };
  database: { status: string; latencyMs: number; tables: number };
  memory: { rss: string; heapUsed: string; heapTotal: string; external: string; rssMb: number };
  counts: { agents: number; tasks: number; workspaces: number };
  node: string;
  env: string;
}

interface MetricsOverview {
  totalTokens?: number;
  totalCost?: number;
  activeAgents?: number;
  tasksCompleted?: number;
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/metrics/overview').catch(() => null),
      ]);

      if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
      const healthData = await healthRes.json();
      setHealth(healthData);

      if (metricsRes?.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const StatusBadge = ({ status }: { status: string }) => {
    const isOk = status === 'ok' || status === 'healthy';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        isOk ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {isOk ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <Activity size={24} className="text-blue-400" />
            <h1 className="text-2xl font-bold">Monitoring</h1>
            {health && <StatusBadge status={health.status} />}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (15s)
            </label>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-card border border-mc-border rounded hover:bg-mc-hover text-sm transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {health && (
          <>
            {/* Top stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Clock size={18} />}
                label="Uptime"
                value={health.uptime.human}
                color="blue"
              />
              <StatCard
                icon={<Database size={18} />}
                label="DB Latency"
                value={`${health.database.latencyMs}ms`}
                color={health.database.latencyMs < 10 ? 'green' : health.database.latencyMs < 50 ? 'yellow' : 'red'}
              />
              <StatCard
                icon={<Cpu size={18} />}
                label="Memory (RSS)"
                value={health.memory.rss}
                subtext={`Heap: ${health.memory.heapUsed} / ${health.memory.heapTotal}`}
                color={health.memory.rssMb < 256 ? 'green' : health.memory.rssMb < 512 ? 'yellow' : 'red'}
              />
              <StatCard
                icon={<HardDrive size={18} />}
                label="DB Tables"
                value={String(health.database.tables)}
                color="purple"
              />
            </div>

            {/* Entity counts */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                icon={<Users size={18} />}
                label="Agents"
                value={String(health.counts.agents)}
                color="blue"
              />
              <StatCard
                icon={<ListTodo size={18} />}
                label="Tasks"
                value={String(health.counts.tasks)}
                color="green"
              />
              <StatCard
                icon={<Layers size={18} />}
                label="Workspaces"
                value={String(health.counts.workspaces)}
                color="purple"
              />
            </div>

            {/* Metrics (if available) */}
            {metrics && (
              <div className="bg-mc-card border border-mc-border rounded-lg p-5">
                <h2 className="text-lg font-semibold mb-4">Cost Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {metrics.totalTokens !== undefined && (
                    <div>
                      <div className="text-gray-400">Total Tokens</div>
                      <div className="text-xl font-bold">{formatNumber(metrics.totalTokens)}</div>
                    </div>
                  )}
                  {metrics.totalCost !== undefined && (
                    <div>
                      <div className="text-gray-400">Total Cost</div>
                      <div className="text-xl font-bold">${metrics.totalCost.toFixed(4)}</div>
                    </div>
                  )}
                  {metrics.activeAgents !== undefined && (
                    <div>
                      <div className="text-gray-400">Active Agents</div>
                      <div className="text-xl font-bold">{metrics.activeAgents}</div>
                    </div>
                  )}
                  {metrics.tasksCompleted !== undefined && (
                    <div>
                      <div className="text-gray-400">Tasks Completed</div>
                      <div className="text-xl font-bold">{metrics.tasksCompleted}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* System info */}
            <div className="bg-mc-card border border-mc-border rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-4">System Information</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 text-sm">
                <InfoRow label="Version" value={health.version} />
                <InfoRow label="Node.js" value={health.node} />
                <InfoRow label="Environment" value={health.env} />
                <InfoRow label="Database" value={health.database.status} />
                <InfoRow label="Last Refresh" value={lastRefresh.toLocaleTimeString()} />
                <InfoRow label="Timestamp" value={new Date(health.timestamp).toLocaleString()} />
              </div>
            </div>
          </>
        )}

        {loading && !health && (
          <div className="text-center py-20 text-gray-400">
            <RefreshCw size={32} className="animate-spin mx-auto mb-4" />
            Loading monitoring data...
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const colorMap = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="bg-mc-card border border-mc-border rounded-lg p-4">
      <div className={`flex items-center gap-2 mb-1 ${colorMap[color]}`}>
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
