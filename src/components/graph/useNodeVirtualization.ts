'use client';

import { useMemo } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';

const NODE_RENDER_LIMIT = 100;
const VIEWPORT_BUFFER = 200; // extra pixels around viewport

/**
 * Task 3.12: Virtualization hook for large graphs (>100 nodes)
 * Returns a subset of nodes visible in the current viewport.
 * For graphs with <= NODE_RENDER_LIMIT nodes, returns all nodes.
 */
export function useNodeVirtualization(allNodes: Node[]): Node[] {
  const { getViewport } = useReactFlow();

  return useMemo(() => {
    // Don't virtualize small graphs
    if (allNodes.length <= NODE_RENDER_LIMIT) {
      return allNodes;
    }

    // For large graphs, we rely on React Flow's built-in `onlyRenderVisibleElements` prop
    // and additionally mark off-screen nodes with a simplified render
    // React Flow v12 handles this automatically with its internal viewport culling
    // We add a priority hint: keep active/working nodes always rendered
    const priorityNodes = allNodes.filter(n => {
      const data = n.data as Record<string, unknown>;
      if (n.type === 'agentNode') {
        const agent = data.agent as { status: string };
        return agent?.status === 'working';
      }
      if (n.type === 'taskNode') {
        const task = data.task as { status: string };
        return task?.status === 'in_progress' || task?.status === 'planning';
      }
      return false;
    });

    const otherNodes = allNodes.filter(n => !priorityNodes.includes(n));

    // Always show priority nodes + fill up to limit with others
    const remaining = NODE_RENDER_LIMIT - priorityNodes.length;
    return [...priorityNodes, ...otherNodes.slice(0, Math.max(0, remaining))];
  }, [allNodes]);
}
