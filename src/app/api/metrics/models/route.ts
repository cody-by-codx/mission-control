// Task 2.10: GET /api/metrics/models — distribution by model
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workspaceId = searchParams.get('workspace_id');

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

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const models = queryAll<{
      model: string;
      provider: string | null;
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
      total_cost: number;
      request_count: number;
      unique_agents: number;
    }>(
      `SELECT
         tu.model,
         mp.provider,
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.input_tokens), 0) as input_tokens,
         COALESCE(SUM(tu.output_tokens), 0) as output_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as request_count,
         COUNT(DISTINCT tu.agent_id) as unique_agents
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       LEFT JOIN model_pricing mp ON tu.model = mp.model_name
       ${where}
       GROUP BY tu.model
       ORDER BY total_cost DESC`,
      params
    );

    return NextResponse.json(models);
  } catch (error) {
    console.error('Failed to fetch model metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch model metrics' }, { status: 500 });
  }
}
