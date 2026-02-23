/**
 * Cost Alert Configuration API
 * GET  - List all cost alert configs
 * POST - Create a new cost alert config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    let query = 'SELECT * FROM cost_alert_configs WHERE 1=1';
    const params: string[] = [];

    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (entityId) {
      query += ' AND entity_id = ?';
      params.push(entityId);
    }

    query += ' ORDER BY created_at DESC';
    const alerts = db.prepare(query).all(...params);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Failed to fetch cost alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch cost alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { entity_type, entity_id, threshold_usd, period = 'daily', enabled = true } = body;

    if (!entity_type || !entity_id || threshold_usd === undefined) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and threshold_usd are required' },
        { status: 400 }
      );
    }

    if (!['agent', 'workspace'].includes(entity_type)) {
      return NextResponse.json({ error: 'entity_type must be agent or workspace' }, { status: 400 });
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json({ error: 'period must be daily, weekly, or monthly' }, { status: 400 });
    }

    const id = uuid();
    db.prepare(`
      INSERT INTO cost_alert_configs (id, entity_type, entity_id, threshold_usd, period, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity_type, entity_id, threshold_usd, period, enabled ? 1 : 0);

    const alert = db.prepare('SELECT * FROM cost_alert_configs WHERE id = ?').get(id);
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Failed to create cost alert:', error);
    return NextResponse.json({ error: 'Failed to create cost alert' }, { status: 500 });
  }
}
