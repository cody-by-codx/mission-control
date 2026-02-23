/**
 * Database Migrations System
 * 
 * Handles schema changes in a production-safe way:
 * 1. Tracks which migrations have been applied
 * 2. Runs new migrations automatically on startup
 * 3. Never runs the same migration twice
 */

import Database from 'better-sqlite3';

interface Migration {
  id: string;
  name: string;
  up: (db: Database.Database) => void;
}

// All migrations in order - NEVER remove or reorder existing migrations
const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial_schema',
    up: (db) => {
      // Core tables - these are created in schema.ts on fresh databases
      // This migration exists to mark the baseline for existing databases
      console.log('[Migration 001] Baseline schema marker');
    }
  },
  {
    id: '002',
    name: 'add_workspaces',
    up: (db) => {
      console.log('[Migration 002] Adding workspaces table and columns...');
      
      // Create workspaces table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT DEFAULT '📁',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Insert default workspace if not exists
      db.exec(`
        INSERT OR IGNORE INTO workspaces (id, name, slug, description, icon) 
        VALUES ('default', 'Default Workspace', 'default', 'Default workspace', '🏠');
      `);
      
      // Add workspace_id to tasks if not exists
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      if (!tasksInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to tasks');
      }
      
      // Add workspace_id to agents if not exists
      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
      if (!agentsInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE agents ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to agents');
      }
    }
  },
  {
    id: '003',
    name: 'add_planning_tables',
    up: (db) => {
      console.log('[Migration 003] Adding planning tables...');
      
      // Create planning_questions table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS planning_questions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          question TEXT NOT NULL,
          question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
          options TEXT,
          answer TEXT,
          answered_at TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Create planning_specs table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS planning_specs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
          spec_markdown TEXT NOT NULL,
          locked_at TEXT NOT NULL,
          locked_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Create index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order)`);
      
      // Update tasks status check constraint to include 'planning'
      // SQLite doesn't support ALTER CONSTRAINT, so we check if it's needed
      const taskSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { sql: string } | undefined;
      if (taskSchema && !taskSchema.sql.includes("'planning'")) {
        console.log('[Migration 003] Note: tasks table needs planning status - will be handled by schema recreation on fresh dbs');
      }
    }
  },
  {
    id: '004',
    name: 'add_planning_session_columns',
    up: (db) => {
      console.log('[Migration 004] Adding planning session columns to tasks...');

      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];

      // Add planning_session_key column
      if (!tasksInfo.some(col => col.name === 'planning_session_key')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_session_key TEXT`);
        console.log('[Migration 004] Added planning_session_key');
      }

      // Add planning_messages column (stores JSON array of messages)
      if (!tasksInfo.some(col => col.name === 'planning_messages')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_messages TEXT`);
        console.log('[Migration 004] Added planning_messages');
      }

      // Add planning_complete column
      if (!tasksInfo.some(col => col.name === 'planning_complete')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_complete INTEGER DEFAULT 0`);
        console.log('[Migration 004] Added planning_complete');
      }

      // Add planning_spec column (stores final spec JSON)
      if (!tasksInfo.some(col => col.name === 'planning_spec')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_spec TEXT`);
        console.log('[Migration 004] Added planning_spec');
      }

      // Add planning_agents column (stores generated agents JSON)
      if (!tasksInfo.some(col => col.name === 'planning_agents')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_agents TEXT`);
        console.log('[Migration 004] Added planning_agents');
      }
    }
  },
  {
    id: '005',
    name: 'add_agent_model_field',
    up: (db) => {
      console.log('[Migration 005] Adding model field to agents...');

      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];

      // Add model column
      if (!agentsInfo.some(col => col.name === 'model')) {
        db.exec(`ALTER TABLE agents ADD COLUMN model TEXT`);
        console.log('[Migration 005] Added model to agents');
      }
    }
  },
  {
    id: '006',
    name: 'add_planning_dispatch_error_column',
    up: (db) => {
      console.log('[Migration 006] Adding planning_dispatch_error column to tasks...');

      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];

      // Add planning_dispatch_error column
      if (!tasksInfo.some(col => col.name === 'planning_dispatch_error')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_dispatch_error TEXT`);
        console.log('[Migration 006] Added planning_dispatch_error to tasks');
      }
    }
  },
  {
    id: '007',
    name: 'add_agent_source_and_gateway_id',
    up: (db) => {
      console.log('[Migration 007] Adding source and gateway_agent_id to agents...');

      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];

      // Add source column: 'local' for MC-created, 'gateway' for imported from OpenClaw Gateway
      if (!agentsInfo.some(col => col.name === 'source')) {
        db.exec(`ALTER TABLE agents ADD COLUMN source TEXT DEFAULT 'local'`);
        console.log('[Migration 007] Added source to agents');
      }

      // Add gateway_agent_id column: stores the original agent ID/name from the Gateway
      if (!agentsInfo.some(col => col.name === 'gateway_agent_id')) {
        db.exec(`ALTER TABLE agents ADD COLUMN gateway_agent_id TEXT`);
        console.log('[Migration 007] Added gateway_agent_id to agents');
      }
    }
  },
  {
    id: '008',
    name: 'add_task_dependencies',
    up: (db) => {
      console.log('[Migration 008] Creating task_dependencies table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_dependencies (
          id TEXT PRIMARY KEY,
          source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          dependency_type TEXT DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'relates_to', 'subtask_of')),
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(source_task_id, target_task_id)
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_deps_source ON task_dependencies(source_task_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_deps_target ON task_dependencies(target_task_id)`);
    }
  },
  {
    id: '009',
    name: 'add_graph_node_positions',
    up: (db) => {
      console.log('[Migration 009] Creating graph_node_positions table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS graph_node_positions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          node_type TEXT NOT NULL CHECK (node_type IN ('agent', 'task', 'group')),
          node_id TEXT NOT NULL,
          x REAL NOT NULL DEFAULT 0,
          y REAL NOT NULL DEFAULT 0,
          pinned INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(workspace_id, node_type, node_id)
        );
      `);
    }
  },
  {
    id: '010',
    name: 'add_token_usage_and_metrics',
    up: (db) => {
      console.log('[Migration 010] Creating token_usage, model_pricing, daily_metrics tables...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS token_usage (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          task_id TEXT REFERENCES tasks(id),
          session_id TEXT,
          model TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
          cost_usd REAL NOT NULL DEFAULT 0.0,
          operation TEXT NOT NULL CHECK (operation IN ('planning', 'execution', 'review', 'subagent', 'conversation')),
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id, created_at DESC)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_task ON token_usage(task_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at)`);

      db.exec(`
        CREATE TABLE IF NOT EXISTS model_pricing (
          id TEXT PRIMARY KEY,
          model_name TEXT NOT NULL UNIQUE,
          input_price_per_1k REAL NOT NULL,
          output_price_per_1k REAL NOT NULL,
          provider TEXT NOT NULL DEFAULT 'anthropic',
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_metrics (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          agent_id TEXT REFERENCES agents(id),
          workspace_id TEXT REFERENCES workspaces(id),
          total_tokens INTEGER DEFAULT 0,
          total_cost_usd REAL DEFAULT 0.0,
          tasks_completed INTEGER DEFAULT 0,
          avg_task_duration_ms INTEGER DEFAULT 0,
          error_count INTEGER DEFAULT 0,
          UNIQUE(date, agent_id)
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC, agent_id)`);

      // Seed model_pricing with current prices
      const seedPricing = db.prepare(`
        INSERT OR IGNORE INTO model_pricing (id, model_name, input_price_per_1k, output_price_per_1k, provider)
        VALUES (?, ?, ?, ?, ?)
      `);
      seedPricing.run('price-opus-4-6', 'claude-opus-4-6', 0.015, 0.075, 'anthropic');
      seedPricing.run('price-sonnet-4-6', 'claude-sonnet-4-6', 0.003, 0.015, 'anthropic');
      seedPricing.run('price-haiku-4-5', 'claude-haiku-4-5', 0.0008, 0.004, 'anthropic');
      seedPricing.run('price-gpt-4o', 'gpt-4o', 0.0025, 0.01, 'openai');
      seedPricing.run('price-gpt-4o-mini', 'gpt-4o-mini', 0.00015, 0.0006, 'openai');
      console.log('[Migration 010] Seeded model_pricing with 5 models');
    }
  },
  {
    id: '011',
    name: 'add_parent_task_id',
    up: (db) => {
      console.log('[Migration 011] Adding parent_task_id to tasks...');
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      if (!tasksInfo.some(col => col.name === 'parent_task_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id)`);
        console.log('[Migration 011] Added parent_task_id to tasks');
      }
    }
  },
  {
    id: '012',
    name: 'add_agent_group_label',
    up: (db) => {
      console.log('[Migration 012] Adding group_label to agents...');
      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
      if (!agentsInfo.some(col => col.name === 'group_label')) {
        db.exec(`ALTER TABLE agents ADD COLUMN group_label TEXT`);
        console.log('[Migration 012] Added group_label to agents');
      }
    }
  },
  {
    id: '013',
    name: 'add_cost_alert_configs',
    up: (db) => {
      console.log('[Migration 013] Creating cost_alert_configs table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS cost_alert_configs (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('agent', 'workspace')),
          entity_id TEXT NOT NULL,
          threshold_usd REAL NOT NULL,
          period TEXT DEFAULT 'daily' CHECK (period IN ('daily', 'weekly', 'monthly')),
          enabled INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(entity_type, entity_id, period)
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_cost_alerts_entity ON cost_alert_configs(entity_type, entity_id)`);
    }
  }
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Get already applied migrations
  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map(m => m.id)
  );
  
  // Run pending migrations in order
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    
    console.log(`[DB] Running migration ${migration.id}: ${migration.name}`);
    
    try {
      // Run migration in a transaction
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
      })();
      
      console.log(`[DB] Migration ${migration.id} completed`);
    } catch (error) {
      console.error(`[DB] Migration ${migration.id} failed:`, error);
      throw error;
    }
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: Database.Database): { applied: string[]; pending: string[] } {
  const applied = (db.prepare('SELECT id FROM _migrations ORDER BY id').all() as { id: string }[]).map(m => m.id);
  const pending = migrations.filter(m => !applied.includes(m.id)).map(m => m.id);
  return { applied, pending };
}
