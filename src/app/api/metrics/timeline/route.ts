// Task 2.9: GET /api/metrics/timeline — time series data
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workspaceId = searchParams.get('workspace_id');
    const agentId = searchParams.get('agent_id');
    const granularity = searchParams.get('granularity') || 'day'; // day | hour

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
    if (workspaceId) {
      conditions.push('a.workspace_id = ?');
      params.push(workspaceId);
    }
    if (agentId) {
      conditions.push('tu.agent_id = ?');
      params.push(agentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Group by date or hour
    const dateExpr = granularity === 'hour'
      ? `strftime('%Y-%m-%dT%H:00:00', tu.created_at)`
      : `date(tu.created_at)`;

    const timeline = queryAll<{
      period: string;
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
      total_cost: number;
      request_count: number;
    }>(
      `SELECT
         ${dateExpr} as period,
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.input_tokens), 0) as input_tokens,
         COALESCE(SUM(tu.output_tokens), 0) as output_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as request_count
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${where}
       GROUP BY period
       ORDER BY period ASC`,
      params
    );

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Failed to fetch metrics timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}
