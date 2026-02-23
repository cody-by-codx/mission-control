/**
 * Cost Alert Configuration API - Single alert
 * PATCH  - Update a cost alert config
 * DELETE - Remove a cost alert config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const body = await request.json();
    const { threshold_usd, period, enabled } = body;

    const existing = db.prepare('SELECT * FROM cost_alert_configs WHERE id = ?').get(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Alert config not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (threshold_usd !== undefined) {
      updates.push('threshold_usd = ?');
      values.push(threshold_usd);
    }
    if (period !== undefined) {
      updates.push('period = ?');
      values.push(period);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(params.id);
      db.prepare(`UPDATE cost_alert_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM cost_alert_configs WHERE id = ?').get(params.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update cost alert:', error);
    return NextResponse.json({ error: 'Failed to update cost alert' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM cost_alert_configs WHERE id = ?').run(params.id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Alert config not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete cost alert:', error);
    return NextResponse.json({ error: 'Failed to delete cost alert' }, { status: 500 });
  }
}
