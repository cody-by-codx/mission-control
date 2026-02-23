# GraphView API Documentation

## Overview

The GraphView component provides a visual representation of agents, tasks, and their relationships using React Flow. It supports drag-to-connect dependencies, context menus, grouping, timeline mode, keyboard shortcuts, and graph export.

## Components

### GraphView

Main wrapper component. Must be used within a page that provides `workspaceId`.

```tsx
import { GraphView } from '@/components/graph/GraphView';

<GraphView
  workspaceId="workspace-id"
  onSelectTask={(taskId) => handleTaskSelect(taskId)}
  onSelectAgent={(agentId) => handleAgentSelect(agentId)}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `workspaceId` | `string` | ID of the current workspace |
| `onSelectTask` | `(taskId: string) => void` | Callback when a task node is clicked |
| `onSelectAgent` | `(agentId: string) => void` | Callback when an agent node is clicked |

### Node Types

#### AgentNode
Displays agent information with status indicator, task count, and sub-agent count.

**Data interface:**
```ts
interface AgentNodeData {
  agent: Agent;
  taskCount: number;
  subagentCount: number;
}
```

#### TaskNode
Displays task information with status icon, priority badge, elapsed time.

**Data interface:**
```ts
interface TaskNodeData {
  task: Task;
  deliverableCount: number;
  totalDeliverables: number;
}
```

### Edge Types

| Edge Type | Source | Target | Description |
|-----------|--------|--------|-------------|
| `assignmentEdge` | Agent | Task | Agent is assigned to task (blue, solid) |
| `dependencyEdge` | Task | Task | Task dependency (red=blocks, gray=relates_to, purple=subtask_of) |
| `subagentEdge` | Agent | Agent | Sub-agent relationship (green, dashed) |

## View Modes

### Default Mode
Standard dagre-based hierarchical layout. Agents at top, tasks below, connected by edges.

### Timeline Mode
Nodes ordered chronologically by `created_at` date. Agents in a row at top, tasks sorted left-to-right by creation date.

## Grouping

| Group By | Description |
|----------|-------------|
| `none` | No grouping (default) |
| `workspace` | Group nodes by workspace |
| `role` | Group agent nodes by role, task nodes together |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit view to show all nodes |
| `L` | Apply auto-layout |
| `G` | Toggle graph view |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom to 1x |
| `?` | Log shortcuts to console |

## Context Menu

Right-click on:
- **Task node**: View details, Add dependency from here
- **Agent node**: View details
- **Edge (dependency)**: Remove connection
- **Pane (background)**: Group by workspace, Group by role

## Drag-to-Connect

Drag from a task node's source handle to another task node's target handle to create a dependency edge. The dependency is persisted via the API as `blocks` type.

## Export

Two export options available in bottom-right corner:
- **PNG**: Canvas-based rasterization
- **SVG**: DOM serialization as scalable vector

## REST API Endpoints

### Dependencies

#### GET `/api/tasks/dependencies?workspace_id={id}`
Returns all task dependencies for a workspace.

**Response:**
```json
[
  {
    "id": "uuid",
    "source_task_id": "uuid",
    "target_task_id": "uuid",
    "dependency_type": "blocks",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

#### POST `/api/tasks/dependencies`
Create a new task dependency.

**Body:**
```json
{
  "source_task_id": "uuid",
  "target_task_id": "uuid",
  "dependency_type": "blocks" | "relates_to" | "subtask_of"
}
```

#### DELETE `/api/tasks/dependencies?id={id}`
Delete a task dependency.

### Graph Positions

#### PUT `/api/graph/positions`
Save node positions for layout persistence.

**Body:**
```json
{
  "positions": [
    {
      "workspace_id": "uuid",
      "node_type": "agent" | "task",
      "node_id": "uuid",
      "x": 100.0,
      "y": 200.0,
      "pinned": true
    }
  ]
}
```

## Hooks

### useGraphData
Builds nodes and edges from store data (agents, tasks, dependencies, sessions).

### useGraphLayout
Applies dagre hierarchical layout to nodes and edges.

### useGraphShortcuts
Registers keyboard shortcuts when GraphView is active.

### useNodeVirtualization
Performance optimization: limits rendered nodes to 100 for large graphs, prioritizing active/working nodes.

## Performance Notes

- Node positions are debounced (300ms) before persisting to API
- Graphs >100 nodes use `onlyRenderVisibleElements` for viewport culling
- SSE events are batched in 100ms windows to reduce re-renders
- Background polling for dependencies is supplemented by SSE events
