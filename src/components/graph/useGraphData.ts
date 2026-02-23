'use client';

import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useMissionControl } from '@/lib/store';
import type { Agent, Task, TaskDependency, OpenClawSession } from '@/lib/types';

interface UseGraphDataOptions {
  workspaceId: string;
  dependencies: TaskDependency[];
  sessions: Record<string, OpenClawSession | null>;
}

export function useGraphData({ workspaceId, dependencies, sessions }: UseGraphDataOptions) {
  const { agents, tasks } = useMissionControl();

  const wsAgents = useMemo(
    () => agents.filter(a => a.workspace_id === workspaceId),
    [agents, workspaceId]
  );

  const wsTasks = useMemo(
    () => tasks.filter(t => t.workspace_id === workspaceId),
    [tasks, workspaceId]
  );

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Build task counts per agent
    const agentTaskCounts: Record<string, number> = {};
    for (const task of wsTasks) {
      if (task.assigned_agent_id && task.status !== 'done') {
        agentTaskCounts[task.assigned_agent_id] = (agentTaskCounts[task.assigned_agent_id] || 0) + 1;
      }
    }

    // Build subagent counts (agents with sessions that are subagent type)
    const subagentCounts: Record<string, number> = {};
    for (const [agentId, session] of Object.entries(sessions)) {
      if (session?.session_type === 'subagent') {
        // The "parent" here is the agent that spawned this subagent
        // For now, count subagents per agent that has active sessions
        subagentCounts[agentId] = (subagentCounts[agentId] || 0) + 1;
      }
    }

    // Create agent nodes
    for (const agent of wsAgents) {
      nodeList.push({
        id: `agent-${agent.id}`,
        type: 'agentNode',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          agent,
          taskCount: agentTaskCounts[agent.id] || 0,
          subagentCount: subagentCounts[agent.id] || 0,
        },
      });
    }

    // Create task nodes
    for (const task of wsTasks) {
      nodeList.push({
        id: `task-${task.id}`,
        type: 'taskNode',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          task,
          deliverableCount: 0,
          totalDeliverables: 0,
        },
      });
    }

    // Create assignment edges (agent → task)
    for (const task of wsTasks) {
      if (task.assigned_agent_id) {
        edgeList.push({
          id: `assign-${task.assigned_agent_id}-${task.id}`,
          source: `agent-${task.assigned_agent_id}`,
          target: `task-${task.id}`,
          type: 'assignmentEdge',
        });
      }
    }

    // Create dependency edges (task → task)
    for (const dep of dependencies) {
      edgeList.push({
        id: `dep-${dep.id}`,
        source: `task-${dep.source_task_id}`,
        target: `task-${dep.target_task_id}`,
        type: 'dependencyEdge',
        data: { dependencyType: dep.dependency_type },
      });
    }

    // Create subagent edges based on sessions
    // Sub-agents have sessions of type 'subagent' linked to a task
    for (const [agentId, session] of Object.entries(sessions)) {
      if (session?.session_type === 'subagent' && session.task_id) {
        // Find if there's a parent agent assigned to the same task
        const parentTask = wsTasks.find(t => t.id === session.task_id);
        if (parentTask?.assigned_agent_id && parentTask.assigned_agent_id !== agentId) {
          edgeList.push({
            id: `subagent-${parentTask.assigned_agent_id}-${agentId}`,
            source: `agent-${parentTask.assigned_agent_id}`,
            target: `agent-${agentId}`,
            type: 'subagentEdge',
          });
        }
      }
    }

    // Create parent-child task edges
    for (const task of wsTasks) {
      if (task.parent_task_id) {
        edgeList.push({
          id: `subtask-${task.parent_task_id}-${task.id}`,
          source: `task-${task.parent_task_id}`,
          target: `task-${task.id}`,
          type: 'dependencyEdge',
          data: { dependencyType: 'subtask_of' },
        });
      }
    }

    return { nodes: nodeList, edges: edgeList };
  }, [wsAgents, wsTasks, dependencies, sessions]);

  return { nodes, edges, agents: wsAgents, tasks: wsTasks };
}
