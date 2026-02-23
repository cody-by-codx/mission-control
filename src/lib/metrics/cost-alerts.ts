/**
 * Cost Alert Checker
 * Checks current spending against configured thresholds and triggers alerts
 */

import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { v4 as uuid } from 'uuid';
import type { CostAlertPayload, CostAlertConfig } from '@/lib/types';

interface AlertConfig {
  id: string;
  entity_type: 'agent' | 'workspace';
  entity_id: string;
  threshold_usd: number;
  period: string;
  enabled: number;
}

function getPeriodStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case 'daily':
      return now.toISOString().split('T')[0];
    case 'weekly': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      return monday.toISOString().split('T')[0];
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return now.toISOString().split('T')[0];
  }
}

export function checkCostAlerts(): CostAlertPayload[] {
  const db = getDb();
  const alerts: CostAlertPayload[] = [];

  const configs = db.prepare(
    'SELECT * FROM cost_alert_configs WHERE enabled = 1'
  ).all() as AlertConfig[];

  for (const config of configs) {
    const startDate = getPeriodStartDate(config.period);

    let currentCost = 0;
    let entityName = config.entity_id;

    if (config.entity_type === 'agent') {
      const result = db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total_cost
        FROM token_usage
        WHERE agent_id = ? AND created_at >= ?
      `).get(config.entity_id, startDate) as { total_cost: number };
      currentCost = result.total_cost;

      const agent = db.prepare('SELECT name FROM agents WHERE id = ?').get(config.entity_id) as { name: string } | undefined;
      if (agent) entityName = agent.name;
    } else {
      const result = db.prepare(`
        SELECT COALESCE(SUM(tu.cost_usd), 0) as total_cost
        FROM token_usage tu
        JOIN agents a ON tu.agent_id = a.id
        WHERE a.workspace_id = ? AND tu.created_at >= ?
      `).get(config.entity_id, startDate) as { total_cost: number };
      currentCost = result.total_cost;

      const ws = db.prepare('SELECT name FROM workspaces WHERE id = ?').get(config.entity_id) as { name: string } | undefined;
      if (ws) entityName = ws.name;
    }

    if (currentCost >= config.threshold_usd) {
      const alert: CostAlertPayload = {
        alertId: uuid(),
        alertType: config.entity_type === 'agent' ? 'agent_threshold' : 'workspace_threshold',
        entityId: config.entity_id,
        entityName,
        currentCost,
        threshold: config.threshold_usd,
        period: config.period,
        message: `Cost alert: ${entityName} has reached $${currentCost.toFixed(2)} (threshold: $${config.threshold_usd.toFixed(2)} ${config.period})`,
        triggered_at: new Date().toISOString(),
      };
      alerts.push(alert);
      broadcast({ type: 'cost_alert', payload: alert });
    }
  }

  return alerts;
}
