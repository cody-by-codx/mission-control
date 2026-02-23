// Task 2.22: Scheduled task for daily metrics aggregation
// Runs aggregation once a day using a server-side interval
// Started automatically when the module is imported from a server component/route

import { aggregateDaily } from './metrics-aggregator';
import logger from '@/lib/logger';

const CRON_GLOBAL_KEY = '__metrics_cron_timer__';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Start the daily metrics aggregation cron.
 * Safe to call multiple times — only one timer is created.
 */
export function startMetricsCron(): void {
  if ((globalThis as Record<string, unknown>)[CRON_GLOBAL_KEY]) {
    return; // Already running
  }

  logger.info('Starting daily aggregation cron');

  // Run immediately for yesterday's data
  runAggregation();

  // Schedule daily
  const timer = setInterval(runAggregation, TWENTY_FOUR_HOURS);
  (globalThis as Record<string, unknown>)[CRON_GLOBAL_KEY] = timer;
}

function runAggregation(): void {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const count = aggregateDaily(dateStr);
    logger.info({ count, date: dateStr }, 'Daily aggregation complete');
  } catch (err) {
    logger.error({ err }, 'Daily aggregation failed');
  }
}
