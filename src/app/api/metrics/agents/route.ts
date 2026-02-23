// Task 2.7: GET /api/metrics/agents — metrics per agent
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workspaceId = searchParams.get('workspace_id');
    const sortBy = searchParams.get('sort_by') || 'total_cost';
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

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

    // Validate sort column
    const validSorts = ['total_cost', 'total_tokens', 'total_input', 'total_output', 'request_count'];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'total_cost';

    const agents = queryAll<{
      agent_id: string;
      agent_name: string;
      avatar_emoji: string;
      role: string;
      model: string;
      workspace_id: string;
      total_tokens: number;
      total_input: number;
      total_output: number;
      total_cost: number;
      request_count: number;
      tasks_with_usage: number;
    }>(
      `SELECT
         tu.agent_id,
         a.name as agent_name,
         a.avatar_emoji,
         a.role,
         COALESCE(a.model, 'unknown') as model,
         a.workspace_id,
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.input_tokens), 0) as total_input,
         COALESCE(SUM(tu.output_tokens), 0) as total_output,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as request_count,
         COUNT(DISTINCT tu.task_id) as tasks_with_usage
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${where}
       GROUP BY tu.agent_id
       ORDER BY ${sortColumn} ${order}`,
      params
    );

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agent metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch agent metrics' }, { status: 500 });
  }
}
