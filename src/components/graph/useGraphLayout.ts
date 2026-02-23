'use client';

import { useCallback } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 220,
  nodeHeight: 140,
  rankSep: 80,
  nodeSep: 40,
};

export function useGraphLayout() {
  const applyLayout = useCallback(
    (nodes: Node[], edges: Edge[], options?: LayoutOptions): Node[] => {
      if (nodes.length === 0) return nodes;

      const opts = { ...DEFAULT_OPTIONS, ...options };
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: opts.direction,
        ranksep: opts.rankSep,
        nodesep: opts.nodeSep,
      });

      // Add nodes to dagre graph
      for (const node of nodes) {
        g.setNode(node.id, {
          width: opts.nodeWidth,
          height: node.type === 'agentNode' ? opts.nodeHeight + 20 : opts.nodeHeight,
        });
      }

      // Add edges to dagre graph
      for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
      }

      // Run layout algorithm
      dagre.layout(g);

      // Apply positions back to nodes
      return nodes.map((node) => {
        const dagreNode = g.node(node.id);
        if (!dagreNode) return node;

        return {
          ...node,
          position: {
            x: dagreNode.x - opts.nodeWidth / 2,
            y: dagreNode.y - (node.type === 'agentNode' ? (opts.nodeHeight + 20) / 2 : opts.nodeHeight / 2),
          },
        };
      });
    },
    []
  );

  return { applyLayout };
}
