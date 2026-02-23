// Task 2.22: Scheduled/cron endpoint for daily metrics aggregation
// Can be called by a cron job (e.g., Vercel Cron, or system crontab)
// POST /api/metrics/aggregate — aggregate yesterday's metrics
// POST /api/metrics/aggregate?date=2024-01-15 — aggregate specific date
// POST /api/metrics/aggregate?start_date=2024-01-01&end_date=2024-01-31 — date range

import { NextRequest, NextResponse } from 'next/server';
import { aggregateDaily, aggregateDateRange } from '@/lib/metrics/metrics-aggregator';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let count = 0;

    if (startDate && endDate) {
      count = aggregateDateRange(startDate, endDate);
    } else if (date) {
      count = aggregateDaily(date);
    } else {
      // Default: aggregate yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      count = aggregateDaily(dateStr);
    }

    return NextResponse.json({
      success: true,
      aggregated: count,
      message: `Aggregated ${count} daily metric entries`,
    });
  } catch (error) {
    console.error('Failed to aggregate metrics:', error);
    return NextResponse.json({ error: 'Failed to aggregate metrics' }, { status: 500 });
  }
}

// GET endpoint for checking last aggregation status
export async function GET() {
  try {
    const { queryOne } = await import('@/lib/db');
    const latest = queryOne<{ date: string; count: number }>(
      `SELECT date, COUNT(*) as count FROM daily_metrics GROUP BY date ORDER BY date DESC LIMIT 1`
    );

    return NextResponse.json({
      lastAggregation: latest?.date || null,
      entriesCount: latest?.count || 0,
      endpoint: 'POST /api/metrics/aggregate',
      usage: {
        yesterday: 'POST /api/metrics/aggregate',
        specificDate: 'POST /api/metrics/aggregate?date=2024-01-15',
        dateRange: 'POST /api/metrics/aggregate?start_date=2024-01-01&end_date=2024-01-31',
      },
    });
  } catch (error) {
    console.error('Failed to check aggregation status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
