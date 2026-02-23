// Task 2.6: GET /api/metrics/overview — global metrics summary
import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { startMetricsCron } from '@/lib/metrics/cron';

// Start the daily aggregation cron on first API access
startMetricsCron();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workspaceId = searchParams.get('workspace_id');
    const agentId = searchParams.get('agent_id');

    // Build conditions for token_usage table (real-time data)
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (startDate) {
      conditions.push('tu.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('tu.created_at <= ?');
      params.push(endDate + 'T23:59:59');
    }
    if (agentId) {
      conditions.push('tu.agent_id = ?');
      params.push(agentId);
    }
    if (workspaceId) {
      conditions.push('a.workspace_id = ?');
      params.push(workspaceId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Totals
    const totals = queryOne<{
      total_tokens: number;
      total_cost: number;
      total_records: number;
    }>(
      `SELECT
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as total_records
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${where}`,
      params
    );

    // Today's metrics
    const today = new Date().toISOString().split('T')[0];
    const todayParams = [...params];
    const todayConditions = [...conditions, `date(tu.created_at) = ?`];
    todayParams.push(today);
    const todayWhere = `WHERE ${todayConditions.join(' AND ')}`;

    const todayMetrics = queryOne<{
      total_tokens: number;
      total_cost: number;
    }>(
      `SELECT
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${todayWhere}`,
      todayParams
    );

    // This week (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekParams = [...params];
    const weekConditions = [...conditions, `tu.created_at >= ?`];
    weekParams.push(weekAgo.toISOString());
    const weekWhere = `WHERE ${weekConditions.join(' AND ')}`;

    const weekMetrics = queryOne<{
      total_tokens: number;
      total_cost: number;
    }>(
      `SELECT
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${weekWhere}`,
      weekParams
    );

    // This month (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthParams = [...params];
    const monthConditions = [...conditions, `tu.created_at >= ?`];
    monthParams.push(monthAgo.toISOString());
    const monthWhere = `WHERE ${monthConditions.join(' AND ')}`;

    const monthMetrics = queryOne<{
      total_tokens: number;
      total_cost: number;
    }>(
      `SELECT
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${monthWhere}`,
      monthParams
    );

    // Active agents count
    const activeAgents = queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT tu.agent_id) as count
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${where}`,
      params
    );

    return NextResponse.json({
      today: {
        tokens: todayMetrics?.total_tokens || 0,
        cost: todayMetrics?.total_cost || 0,
      },
      week: {
        tokens: weekMetrics?.total_tokens || 0,
        cost: weekMetrics?.total_cost || 0,
      },
      month: {
        tokens: monthMetrics?.total_tokens || 0,
        cost: monthMetrics?.total_cost || 0,
      },
      allTime: {
        tokens: totals?.total_tokens || 0,
        cost: totals?.total_cost || 0,
      },
      totalRecords: totals?.total_records || 0,
      activeAgents: activeAgents?.count || 0,
    });
  } catch (error) {
    console.error('Failed to fetch metrics overview:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
