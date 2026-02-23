// Task 2.12: GET /api/metrics/export — export CSV/JSON
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workspaceId = searchParams.get('workspace_id');
    const agentId = searchParams.get('agent_id');

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

    const rows = queryAll<{
      id: string;
      agent_id: string;
      agent_name: string;
      task_id: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost_usd: number;
      operation: string;
      created_at: string;
    }>(
      `SELECT
         tu.id,
         tu.agent_id,
         COALESCE(a.name, 'Unknown') as agent_name,
         tu.task_id,
         tu.model,
         tu.input_tokens,
         tu.output_tokens,
         (tu.input_tokens + tu.output_tokens) as total_tokens,
         tu.cost_usd,
         tu.operation,
         tu.created_at
       FROM token_usage tu
       LEFT JOIN agents a ON tu.agent_id = a.id
       ${where}
       ORDER BY tu.created_at DESC
       LIMIT 10000`,
      params
    );

    if (format === 'csv') {
      const headers = ['id', 'agent_id', 'agent_name', 'task_id', 'model', 'input_tokens', 'output_tokens', 'total_tokens', 'cost_usd', 'operation', 'created_at'];
      const csvLines = [headers.join(',')];

      for (const row of rows) {
        csvLines.push(
          headers
            .map((h) => {
              const val = (row as Record<string, unknown>)[h];
              if (val == null) return '';
              const str = String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            })
            .join(',')
        );
      }

      return new NextResponse(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="metrics-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to export metrics:', error);
    return NextResponse.json({ error: 'Failed to export metrics' }, { status: 500 });
  }
}
