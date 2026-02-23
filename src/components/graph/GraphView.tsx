'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode } from './AgentNode';
import { TaskNode } from './TaskNode';
import { AssignmentEdge } from './AssignmentEdge';
import { DependencyEdge } from './DependencyEdge';
import { SubagentEdge } from './SubagentEdge';
import { GraphControls } from './GraphControls';
import { GraphMinimap } from './GraphMinimap';
import { useGraphData } from './useGraphData';
import { useGraphLayout } from './useGraphLayout';
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

interface GraphViewInnerProps {
  workspaceId: string;
  onSelectTask: (taskId: string) => void;
  onSelectAgent: (agentId: string) => void;
}

function GraphViewInner({ workspaceId, onSelectTask, onSelectAgent }: GraphViewInnerProps) {
  const { fitView } = useReactFlow();
  const { applyLayout } = useGraphLayout();
  const { agentOpenClawSessions } = useMissionControl();

  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [layoutApplied, setLayoutApplied] = useState(false);

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

  const { nodes: graphNodes, edges: graphEdges } = useGraphData({
    workspaceId,
    dependencies,
    sessions: agentOpenClawSessions as Record<string, OpenClawSession | null>,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Apply auto-layout when graph data changes
  const doAutoLayout = useCallback(() => {
    const layoutedNodes = applyLayout(graphNodes, graphEdges);
    setNodes(layoutedNodes);
    setEdges(graphEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [graphNodes, graphEdges, applyLayout, setNodes, setEdges, fitView]);

  // Auto-layout on initial load and when graph structure changes
  useEffect(() => {
    if (graphNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Check if structure changed (new/removed nodes)
    const currentNodeIds = new Set(nodes.map(n => n.id));
    const newNodeIds = new Set(graphNodes.map(n => n.id));
    const structureChanged =
      currentNodeIds.size !== newNodeIds.size ||
      Array.from(newNodeIds).some(id => !currentNodeIds.has(id));

    if (!layoutApplied || structureChanged) {
      doAutoLayout();
      setLayoutApplied(true);
    } else {
      // Update data without changing positions
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

  // Save node positions on drag end
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number }; type?: string }) => {
      const nodeType = node.type === 'agentNode' ? 'agent' : 'task';
      const nodeId = node.id.replace(/^(agent|task)-/, '');
      try {
        await fetch('/api/graph/positions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positions: [{
              workspace_id: workspaceId,
              node_type: nodeType,
              node_id: nodeId,
              x: node.position.x,
              y: node.position.y,
              pinned: true,
            }],
          }),
        });
      } catch {
        // Silently fail - positions are optional
      }
    },
    [workspaceId]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
    }),
    []
  );

  return (
    <div className="w-full h-full relative graph-view-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.1}
        maxZoom={2}
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
      </ReactFlow>

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
