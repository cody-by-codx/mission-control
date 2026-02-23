import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const startTime = Date.now();

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();
  const uptimeMs = now - startTime;

  // Database check
  let dbStatus: 'ok' | 'error' = 'error';
  let dbLatencyMs = 0;
  let dbTables = 0;
  try {
    const t0 = performance.now();
    const db = getDb();
    const result = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };
    dbLatencyMs = Math.round(performance.now() - t0);
    dbTables = result.count;
    dbStatus = 'ok';
  } catch {
    dbStatus = 'error';
  }

  // Memory usage
  const mem = process.memoryUsage();

  // Counts from key tables
  let agents = 0;
  let tasks = 0;
  let workspaces = 0;
  if (dbStatus === 'ok') {
    try {
      const db = getDb();
      agents = (db.prepare('SELECT count(*) as c FROM agents').get() as { c: number }).c;
      tasks = (db.prepare('SELECT count(*) as c FROM tasks').get() as { c: number }).c;
      workspaces = (db.prepare('SELECT count(*) as c FROM workspaces').get() as { c: number }).c;
    } catch {
      // non-critical, leave as 0
    }
  }

  const healthy = dbStatus === 'ok';

  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.2.0',
    timestamp: new Date(now).toISOString(),
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs),
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      tables: dbTables,
    },
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    counts: {
      agents,
      tasks,
      workspaces,
    },
    node: process.version,
    env: process.env.NODE_ENV || 'development',
  }, { status: healthy ? 200 : 503 });
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
