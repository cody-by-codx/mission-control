// Task 2.8: GET /api/metrics/agents/[id] — single agent metrics detail
import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const conditions: string[] = ['tu.agent_id = ?'];
    const queryParams: unknown[] = [agentId];

    if (startDate) {
      conditions.push('tu.created_at >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      conditions.push('tu.created_at <= ?');
      queryParams.push(endDate + 'T23:59:59');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Summary
    const summary = queryOne<{
      total_tokens: number;
      total_input: number;
      total_output: number;
      total_cost: number;
      request_count: number;
    }>(
      `SELECT
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.input_tokens), 0) as total_input,
         COALESCE(SUM(tu.output_tokens), 0) as total_output,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as request_count
       FROM token_usage tu
       ${where}`,
      queryParams
    );

    // By operation
    const byOperation = queryAll<{
      operation: string;
      total_tokens: number;
      total_cost: number;
      count: number;
    }>(
      `SELECT
         tu.operation,
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as count
       FROM token_usage tu
       ${where}
       GROUP BY tu.operation
       ORDER BY total_cost DESC`,
      queryParams
    );

    // By model
    const byModel = queryAll<{
      model: string;
      total_tokens: number;
      total_cost: number;
      count: number;
    }>(
      `SELECT
         tu.model,
         COALESCE(SUM(tu.input_tokens + tu.output_tokens), 0) as total_tokens,
         COALESCE(SUM(tu.cost_usd), 0) as total_cost,
         COUNT(*) as count
       FROM token_usage tu
       ${where}
       GROUP BY tu.model
       ORDER BY total_cost DESC`,
      queryParams
    );

    // Recent usage (last 20)
    const recent = queryAll<{
      id: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      operation: string;
      task_id: string;
      created_at: string;
    }>(
      `SELECT tu.id, tu.model, tu.input_tokens, tu.output_tokens, tu.cost_usd, tu.operation, tu.task_id, tu.created_at
       FROM token_usage tu
       ${where}
       ORDER BY tu.created_at DESC
       LIMIT 20`,
      queryParams
    );

    // Agent info
    const agent = queryOne<{
      id: string;
      name: string;
      avatar_emoji: string;
      role: string;
      model: string;
    }>(
      'SELECT id, name, avatar_emoji, role, model FROM agents WHERE id = ?',
      [agentId]
    );

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      agent,
      summary: summary || { total_tokens: 0, total_input: 0, total_output: 0, total_cost: 0, request_count: 0 },
      byOperation,
      byModel,
      recent,
    });
  } catch (error) {
    console.error('Failed to fetch agent detail metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
