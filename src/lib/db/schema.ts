/**
 * Database Schema for Mission Control
 * 
 * This defines the current desired schema state.
 * For existing databases, migrations handle schema updates.
 * 
 * IMPORTANT: When adding new tables or columns:
 * 1. Add them here for new databases
 * 2. Create a migration in migrations.ts for existing databases
 */

export const schema = `
-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline')),
  is_master INTEGER DEFAULT 0,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  model TEXT,
  source TEXT DEFAULT 'local',
  gateway_agent_id TEXT,
  group_label TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks table (Mission Queue)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('pending_dispatch', 'planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TEXT,
  planning_session_key TEXT,
  planning_messages TEXT,
  planning_complete INTEGER DEFAULT 0,
  planning_spec TEXT,
  planning_agents TEXT,
  planning_dispatch_error TEXT,
  parent_task_id TEXT REFERENCES tasks(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Planning questions table
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

-- Planning specs table (locked specifications)
CREATE TABLE IF NOT EXISTS planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  locked_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversations table (agent-to-agent or task-related)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'task')),
  task_id TEXT REFERENCES tasks(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Events table (for live feed)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Businesses/Workspaces table (legacy - kept for compatibility)
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- OpenClaw session mapping
CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active',
  session_type TEXT DEFAULT 'persistent',
  task_id TEXT REFERENCES tasks(id),
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Task activities table (for real-time activity log)
CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task deliverables table (files, URLs, artifacts)
CREATE TABLE IF NOT EXISTS task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task dependencies (directed graph)
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'relates_to', 'subtask_of')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_task_id, target_task_id)
);

-- Graph node positions (layout persistence)
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

-- Token usage tracking
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

-- Model pricing configuration
CREATE TABLE IF NOT EXISTS model_pricing (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL UNIQUE,
  input_price_per_1k REAL NOT NULL,
  output_price_per_1k REAL NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Daily aggregated metrics
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverables_task ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_task_deps_source ON task_dependencies(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_target ON task_dependencies(target_task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_task ON token_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC, agent_id);
`;
