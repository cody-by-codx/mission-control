# Metrics API Documentation

## Overview

The Metrics system tracks token usage, costs, and performance across agents and workspaces. It provides REST APIs for querying metrics, configuring cost alerts, and exporting data.

## API Endpoints

### GET `/api/metrics/overview`

Returns a summary of global metrics.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | `string` | ISO date filter start (optional) |
| `end_date` | `string` | ISO date filter end (optional) |
| `workspace_id` | `string` | Filter by workspace (optional) |
| `agent_id` | `string` | Filter by agent (optional) |
| `task_id` | `string` | Filter by task (optional) |

**Response:**
```json
{
  "total_cost": 12.50,
  "total_tokens": 150000,
  "today_cost": 2.30,
  "avg_cost_per_task": 0.85,
  "total_tasks_completed": 15,
  "active_agents": 3
}
```

### GET `/api/metrics/timeline`

Returns cost/token timeline data for charts.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | `string` | Start date (optional) |
| `end_date` | `string` | End date (optional) |
| `workspace_id` | `string` | Filter by workspace (optional) |
| `agent_id` | `string` | Filter by agent (optional) |

**Response:**
```json
[
  {
    "date": "2025-01-01",
    "total_cost": 3.50,
    "total_tokens": 45000,
    "tasks_completed": 5
  }
]
```

### GET `/api/metrics/agents`

Returns per-agent metrics.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | `string` | Start date (optional) |
| `end_date` | `string` | End date (optional) |
| `workspace_id` | `string` | Filter by workspace (optional) |

**Response:**
```json
[
  {
    "agent_id": "uuid",
    "agent_name": "Code Reviewer",
    "total_cost": 5.20,
    "total_tokens": 68000,
    "tasks_completed": 8,
    "avg_task_duration_ms": 120000
  }
]
```

### GET `/api/metrics/agents/{id}`

Returns metrics for a specific agent.

### GET `/api/metrics/models`

Returns model pricing and usage breakdown.

**Response:**
```json
[
  {
    "model_name": "claude-opus-4-6",
    "provider": "anthropic",
    "input_price_per_1k": 0.015,
    "output_price_per_1k": 0.075,
    "total_usage_tokens": 50000,
    "total_cost": 4.50
  }
]
```

### GET/POST `/api/metrics/pricing`

- **GET**: Returns current model pricing configuration
- **POST**: Update model pricing

**POST Body:**
```json
{
  "model_name": "claude-opus-4-6",
  "input_price_per_1k": 0.015,
  "output_price_per_1k": 0.075,
  "provider": "anthropic"
}
```

### GET `/api/metrics/export`

Export metrics data as CSV or JSON.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `format` | `string` | `csv` or `json` (default: `json`) |
| `start_date` | `string` | Start date (optional) |
| `end_date` | `string` | End date (optional) |

### POST `/api/metrics/aggregate`

Manually trigger daily metrics aggregation.

**Response:**
```json
{
  "success": true,
  "date": "2025-01-01",
  "records_aggregated": 42
}
```

## Cost Alert API

### GET `/api/metrics/alerts`

List all cost alert configurations.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entity_type` | `string` | `agent` or `workspace` (optional) |
| `entity_id` | `string` | Filter by entity ID (optional) |

**Response:**
```json
[
  {
    "id": "uuid",
    "entity_type": "agent",
    "entity_id": "agent-uuid",
    "threshold_usd": 10.00,
    "period": "daily",
    "enabled": 1,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
]
```

### POST `/api/metrics/alerts`

Create a new cost alert configuration.

**Body:**
```json
{
  "entity_type": "agent",
  "entity_id": "agent-uuid",
  "threshold_usd": 10.00,
  "period": "daily",
  "enabled": true
}
```

**Validation:**
- `entity_type`: Must be `agent` or `workspace`
- `entity_id`: Required
- `threshold_usd`: Required, numeric
- `period`: Must be `daily`, `weekly`, or `monthly`

### PATCH `/api/metrics/alerts/{id}`

Update a cost alert configuration.

**Body (all optional):**
```json
{
  "threshold_usd": 20.00,
  "period": "weekly",
  "enabled": false
}
```

### DELETE `/api/metrics/alerts/{id}`

Delete a cost alert configuration.

## SSE Events

The metrics system broadcasts real-time events via Server-Sent Events:

### `metrics_updated`

Sent when metrics are recalculated or aggregated.

```json
{
  "type": "metrics_updated",
  "payload": {
    "agentId": "uuid",
    "workspaceId": "uuid",
    "totalCost": 12.50,
    "totalTokens": 150000,
    "period": "daily"
  }
}
```

### `cost_alert`

Sent when a cost threshold is exceeded.

```json
{
  "type": "cost_alert",
  "payload": {
    "alertId": "uuid",
    "alertType": "agent_threshold",
    "entityId": "agent-uuid",
    "entityName": "Code Reviewer",
    "currentCost": 11.50,
    "threshold": 10.00,
    "period": "daily",
    "message": "Cost alert: Code Reviewer has reached $11.50 (threshold: $10.00 daily)",
    "triggered_at": "2025-01-01T12:00:00.000Z"
  }
}
```

## SSE Event Batching

Events are batched in 100ms windows for performance. Clients receive either:
- Single event: `{ "type": "metrics_updated", "payload": {...} }`
- Batch: `{ "type": "batch", "payload": [ {...}, {...} ] }`

The `useSSE` hook handles batch unwrapping transparently.

## Database Schema

### token_usage
Records individual token usage per operation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key |
| `agent_id` | TEXT | Agent who consumed tokens |
| `task_id` | TEXT | Associated task (optional) |
| `session_id` | TEXT | OpenClaw session (optional) |
| `model` | TEXT | Model name |
| `input_tokens` | INTEGER | Input token count |
| `output_tokens` | INTEGER | Output token count |
| `total_tokens` | INTEGER | Computed (input + output) |
| `cost_usd` | REAL | Cost in USD |
| `operation` | TEXT | planning/execution/review/subagent/conversation |
| `created_at` | TEXT | Timestamp |

### model_pricing
Model pricing configuration.

| Column | Type | Description |
|--------|------|-------------|
| `model_name` | TEXT | Unique model identifier |
| `input_price_per_1k` | REAL | Price per 1K input tokens |
| `output_price_per_1k` | REAL | Price per 1K output tokens |
| `provider` | TEXT | Provider (anthropic, openai) |

### daily_metrics
Aggregated daily metrics.

| Column | Type | Description |
|--------|------|-------------|
| `date` | TEXT | Aggregation date |
| `agent_id` | TEXT | Agent (optional) |
| `workspace_id` | TEXT | Workspace (optional) |
| `total_tokens` | INTEGER | Day total tokens |
| `total_cost_usd` | REAL | Day total cost |
| `tasks_completed` | INTEGER | Tasks done that day |

### cost_alert_configs
Cost alert threshold configurations.

| Column | Type | Description |
|--------|------|-------------|
| `entity_type` | TEXT | `agent` or `workspace` |
| `entity_id` | TEXT | ID of the entity |
| `threshold_usd` | REAL | Cost threshold |
| `period` | TEXT | `daily`, `weekly`, or `monthly` |
| `enabled` | INTEGER | 1=active, 0=disabled |

## UI Components

### MetricsDashboard
Main container that composes all metrics components with filter state.

### MetricsFilter
Period selector (7d, 30d, 90d, custom) with agent and workspace filters.

### CostOverview
Summary cards showing total cost, total tokens, today's cost, avg cost/task.

### CostTimeline
Line chart showing cost over time using Recharts.

### TokenDistribution
Pie chart of token usage breakdown by agent or model.

### AgentPerformance
Bar chart showing tasks completed and avg duration per agent.

### AgentCostTable
Sortable table with per-agent cost, token counts, and task completions.

### CostAlertSettings
Configuration UI for creating and managing cost alert thresholds.
