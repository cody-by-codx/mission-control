// Task 2.19: MetricsDashboard — main layout composing all charts
'use client';

import { useState, useCallback } from 'react';
import { CostOverview } from './CostOverview';
import { AgentCostTable } from './AgentCostTable';
import { CostTimeline } from './CostTimeline';
import { TokenDistribution } from './TokenDistribution';
import { AgentPerformance } from './AgentPerformance';
import { MetricsFilter, type FilterState } from './MetricsFilter';
import { CostAlertSettings } from './CostAlertSettings';

interface MetricsDashboardProps {
  workspaceId?: string;
}

export function MetricsDashboard({ workspaceId }: MetricsDashboardProps) {
  const [filters, setFilters] = useState<FilterState>({
    period: '30d',
    workspaceId,
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Filters */}
      <MetricsFilter onFilterChange={handleFilterChange} workspaceId={workspaceId} />

      {/* Summary Cards */}
      <CostOverview
        startDate={filters.startDate}
        endDate={filters.endDate}
        workspaceId={filters.workspaceId}
        agentId={filters.agentId}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostTimeline
          startDate={filters.startDate}
          endDate={filters.endDate}
          workspaceId={filters.workspaceId}
          agentId={filters.agentId}
        />
        <TokenDistribution
          startDate={filters.startDate}
          endDate={filters.endDate}
          workspaceId={filters.workspaceId}
        />
      </div>

      {/* Agent Performance */}
      <AgentPerformance
        startDate={filters.startDate}
        endDate={filters.endDate}
        workspaceId={filters.workspaceId}
      />

      {/* Agent Cost Table */}
      <AgentCostTable
        startDate={filters.startDate}
        endDate={filters.endDate}
        workspaceId={filters.workspaceId}
      />

      {/* Cost Alert Settings */}
      <CostAlertSettings workspaceId={workspaceId} />
    </div>
  );
}
