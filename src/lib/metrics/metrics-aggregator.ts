// Task 2.5: Metrics Aggregator
// Aggregates token_usage into daily_metrics for efficient querying

import { queryAll, queryOne, run, transaction } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { DailyMetric } from '@/lib/types';

/**
 * Aggregate token usage for a specific date into daily_metrics.
 * If metrics already exist for the date+agent combo, they are replaced.
 */
export function aggregateDaily(date: string): number {
  // date format: 'YYYY-MM-DD'
  const rows = queryAll<{
    agent_id: string;
    workspace_id: string | null;
    total_tokens: number;
    total_cost: number;
  }>(
    `SELECT
       tu.agent_id,
       a.workspace_id,
       SUM(tu.input_tokens + tu.output_tokens) as total_tokens,
       SUM(tu.cost_usd) as total_cost
     FROM token_usage tu
     LEFT JOIN agents a ON tu.agent_id = a.id
     WHERE date(tu.created_at) = ?
     GROUP BY tu.agent_id`,
    [date]
  );

  // Get task completion counts per agent for the date
  const completions = queryAll<{
    assigned_agent_id: string;
    count: number;
    avg_duration: number;
  }>(
    `SELECT
       assigned_agent_id,
       COUNT(*) as count,
       AVG(
         CAST((julianday(updated_at) - julianday(created_at)) * 86400000 AS INTEGER)
       ) as avg_duration
     FROM tasks
     WHERE date(updated_at) = ? AND status = 'done' AND assigned_agent_id IS NOT NULL
     GROUP BY assigned_agent_id`,
    [date]
  );

  const completionMap = new Map(
    completions.map((c) => [c.assigned_agent_id, c])
  );

  let count = 0;

  transaction(() => {
    // Delete existing entries for this date
    run('DELETE FROM daily_metrics WHERE date = ?', [date]);

    for (const row of rows) {
      const completion = completionMap.get(row.agent_id);
      run(
        `INSERT INTO daily_metrics (id, date, agent_id, workspace_id, total_tokens, total_cost_usd, tasks_completed, avg_task_duration_ms, error_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          uuidv4(),
          date,
          row.agent_id,
          row.workspace_id,
          row.total_tokens,
          row.total_cost,
          completion?.count || 0,
          Math.round(completion?.avg_duration || 0),
        ]
      );
      count++;
    }

    // Also add entries for agents with completions but no token usage
    for (const [agentId, completion] of Array.from(completionMap.entries())) {
      if (!rows.some((r) => r.agent_id === agentId)) {
        const agent = queryOne<{ workspace_id: string }>(
          'SELECT workspace_id FROM agents WHERE id = ?',
          [agentId]
        );
        run(
          `INSERT INTO daily_metrics (id, date, agent_id, workspace_id, total_tokens, total_cost_usd, tasks_completed, avg_task_duration_ms, error_count)
           VALUES (?, ?, ?, ?, 0, 0, ?, ?, 0)`,
          [
            uuidv4(),
            date,
            agentId,
            agent?.workspace_id || null,
            completion.count,
            Math.round(completion.avg_duration),
          ]
        );
        count++;
      }
    }
  });

  return count;
}

/**
 * Aggregate metrics for a date range.
 */
export function aggregateDateRange(startDate: string, endDate: string): number {
  let total = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    total += aggregateDaily(dateStr);
  }

  return total;
}

/**
 * Get aggregated metrics overview for a period.
 */
export function getMetricsOverview(params?: {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  agentId?: string;
}): {
  totalTokens: number;
  totalCost: number;
  tasksCompleted: number;
  avgCostPerTask: number;
  avgTokensPerTask: number;
} {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params?.startDate) {
    conditions.push('date >= ?');
    queryParams.push(params.startDate);
  }
  if (params?.endDate) {
    conditions.push('date <= ?');
    queryParams.push(params.endDate);
  }
  if (params?.workspaceId) {
    conditions.push('workspace_id = ?');
    queryParams.push(params.workspaceId);
  }
  if (params?.agentId) {
    conditions.push('agent_id = ?');
    queryParams.push(params.agentId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = queryOne<{
    total_tokens: number;
    total_cost: number;
    tasks_completed: number;
  }>(
    `SELECT
       COALESCE(SUM(total_tokens), 0) as total_tokens,
       COALESCE(SUM(total_cost_usd), 0) as total_cost,
       COALESCE(SUM(tasks_completed), 0) as tasks_completed
     FROM daily_metrics ${where}`,
    queryParams
  );

  const totalTokens = result?.total_tokens || 0;
  const totalCost = result?.total_cost || 0;
  const tasksCompleted = result?.tasks_completed || 0;

  return {
    totalTokens,
    totalCost,
    tasksCompleted,
    avgCostPerTask: tasksCompleted > 0 ? totalCost / tasksCompleted : 0,
    avgTokensPerTask: tasksCompleted > 0 ? totalTokens / tasksCompleted : 0,
  };
}
