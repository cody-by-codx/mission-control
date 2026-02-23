'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type Connection,
  type OnConnectStartParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './AgentNode';
import { TaskNode } from './TaskNode';
import { AssignmentEdge } from './AssignmentEdge';
import { DependencyEdge } from './DependencyEdge';
import { SubagentEdge } from './SubagentEdge';
import { GraphControls } from './GraphControls';
import { GraphMinimap } from './GraphMinimap';
import { GraphContextMenu, type ContextMenuState } from './GraphContextMenu';
import { GraphExport } from './GraphExport';
import { useGraphData } from './useGraphData';
import { useGraphLayout } from './useGraphLayout';
import { useGraphShortcuts } from './useGraphShortcuts';
import { useMissionControl } from '@/lib/store';
import type { TaskDependency, OpenClawSession } from '@/lib/types';

const nodeTypes = {
  agentNode: AgentNode,
  taskNode: TaskNode,
};

const edgeTypes = {
  assignmentEdge: AssignmentEdge,
  dependencyEdge: DependencyEdge,
  subagentEdge: SubagentEdge,
};

export type GraphViewMode = 'default' | 'timeline';
export type GraphGroupBy = 'none' | 'workspace' | 'role';

interface GraphViewInnerProps {
  workspaceId: string;
  onSelectTask: (taskId: string) => void;
  onSelectAgent: (agentId: string) => void;
}

function GraphViewInner({ workspaceId, onSelectTask, onSelectAgent }: GraphViewInnerProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const { applyLayout } = useGraphLayout();
  const { agentOpenClawSessions } = useMissionControl();

  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [layoutApplied, setLayoutApplied] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewMode, setViewMode] = useState<GraphViewMode>('default');
  const [groupBy, setGroupBy] = useState<GraphGroupBy>('none');
  const connectingNodeRef = useRef<OnConnectStartParams | null>(null);

  // Debounce timer for position updates (Task 3.13)
  const positionUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPositionUpdates = useRef<Map<string, { x: number; y: number; type: string }>>(new Map());

  // Fetch dependencies
  useEffect(() => {
    async function fetchDeps() {
      try {
        const res = await fetch(`/api/tasks/dependencies?workspace_id=${workspaceId}`);
        if (res.ok) {
          setDependencies(await res.json());
        }
      } catch {
        // ignore
      }
    }
    fetchDeps();
  }, [workspaceId]);

  const { nodes: graphNodes, edges: graphEdges, agents: wsAgents, tasks: wsTasks } = useGraphData({
    workspaceId,
    dependencies,
    sessions: agentOpenClawSessions as Record<string, OpenClawSession | null>,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Apply grouping to nodes
  const applyGrouping = useCallback((nodeList: Node[]) => {
    if (groupBy === 'none') return nodeList;

    const groups = new Map<string, Node[]>();
    for (const node of nodeList) {
      let groupKey = 'other';
      if (groupBy === 'workspace') {
        groupKey = workspaceId;
      } else if (groupBy === 'role') {
        if (node.type === 'agentNode') {
          const agentData = node.data as { agent: { role: string } };
          groupKey = agentData.agent.role || 'Unknown Role';
        } else {
          groupKey = 'Tasks';
        }
      }
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(node);
    }

    // Apply offset per group for visual separation
    let groupOffset = 0;
    const result: Node[] = [];
    for (const [, groupNodes] of groups) {
      for (const node of groupNodes) {
        result.push({
          ...node,
          position: {
            x: node.position.x + groupOffset,
            y: node.position.y,
          },
        });
      }
      groupOffset += 400;
    }
    return result;
  }, [groupBy, workspaceId]);

  // Apply timeline layout
  const applyTimelineLayout = useCallback((nodeList: Node[]) => {
    if (viewMode !== 'timeline') return nodeList;

    // Sort task nodes by created_at date, position agents at top
    const agentNodes = nodeList.filter(n => n.type === 'agentNode');
    const taskNodes = nodeList.filter(n => n.type === 'taskNode');

    // Sort task nodes by created_at
    const sortedTasks = [...taskNodes].sort((a, b) => {
      const dateA = (a.data as { task: { created_at: string } }).task.created_at;
      const dateB = (b.data as { task: { created_at: string } }).task.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    // Place agents in a row at top
    const positionedAgents = agentNodes.map((node, i) => ({
      ...node,
      position: { x: i * 260, y: 0 },
    }));

    // Place tasks in timeline (left to right by date)
    const positionedTasks = sortedTasks.map((node, i) => ({
      ...node,
      position: { x: i * 260, y: 200 },
    }));

    return [...positionedAgents, ...positionedTasks];
  }, [viewMode]);

  // Apply auto-layout when graph data changes
  const doAutoLayout = useCallback(() => {
    let layoutedNodes = applyLayout(graphNodes, graphEdges);

    if (viewMode === 'timeline') {
      layoutedNodes = applyTimelineLayout(layoutedNodes);
    }
    if (groupBy !== 'none') {
      layoutedNodes = applyGrouping(layoutedNodes);
    }

    setNodes(layoutedNodes);
    setEdges(graphEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [graphNodes, graphEdges, applyLayout, setNodes, setEdges, fitView, viewMode, groupBy, applyTimelineLayout, applyGrouping]);

  // Task 3.11: Keyboard shortcuts
  useGraphShortcuts({ onAutoLayout: doAutoLayout });

  // Auto-layout on initial load and when graph structure changes
  useEffect(() => {
    if (graphNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const currentNodeIds = new Set(nodes.map(n => n.id));
    const newNodeIds = new Set(graphNodes.map(n => n.id));
    const structureChanged =
      currentNodeIds.size !== newNodeIds.size ||
      Array.from(newNodeIds).some(id => !currentNodeIds.has(id));

    if (!layoutApplied || structureChanged) {
      doAutoLayout();
      setLayoutApplied(true);
    } else {
      setNodes(prev =>
        prev.map(node => {
          const updated = graphNodes.find(n => n.id === node.id);
          if (updated) {
            return { ...node, data: updated.data };
          }
          return node;
        })
      );
      setEdges(graphEdges);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphNodes, graphEdges]);

  // Re-layout when mode changes
  useEffect(() => {
    if (layoutApplied) {
      doAutoLayout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, groupBy]);

  // Handle node click
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'taskNode') {
        const taskId = node.id.replace('task-', '');
        onSelectTask(taskId);
      } else if (node.type === 'agentNode') {
        const agentId = node.id.replace('agent-', '');
        onSelectAgent(agentId);
      }
    },
    [onSelectTask, onSelectAgent]
  );

  // Task 3.13: Debounced position save
  const flushPositionUpdates = useCallback(() => {
    const updates = Array.from(pendingPositionUpdates.current.entries()).map(([id, pos]) => ({
      workspace_id: workspaceId,
      node_type: pos.type === 'agentNode' ? 'agent' : 'task',
      node_id: id.replace(/^(agent|task)-/, ''),
      x: pos.x,
      y: pos.y,
      pinned: true,
    }));

    if (updates.length > 0) {
      fetch('/api/graph/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: updates }),
      }).catch(() => {});
      pendingPositionUpdates.current.clear();
    }
  }, [workspaceId]);

  // Save node positions on drag end (debounced)
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number }; type?: string }) => {
      pendingPositionUpdates.current.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        type: node.type || 'taskNode',
      });

      if (positionUpdateTimerRef.current) {
        clearTimeout(positionUpdateTimerRef.current);
      }
      positionUpdateTimerRef.current = setTimeout(flushPositionUpdates, 300);
    },
    [flushPositionUpdates]
  );

  // Task 3.4: Drag-to-connect for creating dependencies
  const onConnectStart = useCallback((_: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams) => {
    connectingNodeRef.current = params;
  }, []);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Only create dependencies between task nodes
    const sourceIsTask = connection.source.startsWith('task-');
    const targetIsTask = connection.target.startsWith('task-');

    if (sourceIsTask && targetIsTask) {
      const sourceTaskId = connection.source.replace('task-', '');
      const targetTaskId = connection.target.replace('task-', '');

      try {
        const res = await fetch('/api/tasks/dependencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_task_id: sourceTaskId,
            target_task_id: targetTaskId,
            dependency_type: 'blocks',
          }),
        });

        if (res.ok) {
          const newDep = await res.json();
          setDependencies(prev => [...prev, newDep]);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const onConnectEnd = useCallback(() => {
    connectingNodeRef.current = null;
  }, []);

  // Task 3.5: Context menu handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
      nodeType: node.type,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'edge',
      edgeId: edge.id,
    });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'pane',
    });
  }, []);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    // Only delete dependency edges
    if (edgeId.startsWith('dep-')) {
      const depId = edgeId.replace('dep-', '');
      try {
        await fetch(`/api/tasks/dependencies?id=${depId}`, { method: 'DELETE' });
        setDependencies(prev => prev.filter(d => d.id !== depId));
      } catch {
        // ignore
      }
    }
  }, []);

  const handleContextViewDetails = useCallback((nodeId: string, nodeType: string) => {
    if (nodeType === 'task') {
      const taskId = nodeId.replace('task-', '');
      onSelectTask(taskId);
    } else if (nodeType === 'agent') {
      const agentId = nodeId.replace('agent-', '');
      onSelectAgent(agentId);
    }
  }, [onSelectTask, onSelectAgent]);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
    }),
    []
  );

  return (
    <div className="w-full h-full relative graph-view-container">
      {/* View mode toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-mc-bg-secondary border border-mc-border rounded-lg px-1 py-1">
        <button
          onClick={() => setViewMode('default')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            viewMode === 'default' ? 'bg-mc-accent/20 text-mc-accent' : 'text-mc-text-secondary hover:text-mc-text'
          }`}
        >
          Default
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            viewMode === 'timeline' ? 'bg-mc-accent/20 text-mc-accent' : 'text-mc-text-secondary hover:text-mc-text'
          }`}
        >
          Timeline
        </button>
        <div className="w-px h-4 bg-mc-border mx-1" />
        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value as GraphGroupBy)}
          className="bg-transparent text-xs text-mc-text-secondary border-none outline-none cursor-pointer"
        >
          <option value="none">No Grouping</option>
          <option value="workspace">By Workspace</option>
          <option value="role">By Role</option>
        </select>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setContextMenu(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: '#EF4444', strokeWidth: 2, strokeDasharray: '5,5' }}
        fitView
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements={nodes.length > 100}
        proOptions={{ hideAttribution: true }}
        className="bg-mc-bg"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#ffffff08"
        />
        <GraphControls onAutoLayout={doAutoLayout} />
        <GraphMinimap />
        {/* Task 3.10: Export controls */}
        <div className="absolute bottom-4 right-4 z-10">
          <GraphExport />
        </div>
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (
        <GraphContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDeleteEdge={handleDeleteEdge}
          onCreateDependency={(nodeId) => {
            // Start visual connection mode hint
            console.log('Drag from this node to create dependency:', nodeId);
          }}
          onViewDetails={handleContextViewDetails}
          onGroupByWorkspace={() => setGroupBy('workspace')}
          onGroupByRole={() => setGroupBy('role')}
        />
      )}

      {/* Empty state */}
      {graphNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-30">🕸️</div>
            <p className="text-mc-text-secondary text-sm">
              No agents or tasks yet. Create some to see the graph.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Public wrapper with ReactFlowProvider
interface GraphViewProps {
  workspaceId: string;
  onSelectTask: (taskId: string) => void;
  onSelectAgent: (agentId: string) => void;
}

export function GraphView({ workspaceId, onSelectTask, onSelectAgent }: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewInner
        workspaceId={workspaceId}
        onSelectTask={onSelectTask}
        onSelectAgent={onSelectAgent}
      />
    </ReactFlowProvider>
  );
}
