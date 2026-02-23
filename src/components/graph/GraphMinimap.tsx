'use client';

import { memo } from 'react';
import { MiniMap } from '@xyflow/react';

function GraphMinimapComponent() {
  return (
    <MiniMap
      nodeStrokeColor={(node) => {
        if (node.type === 'agentNode') return '#10B981';
        return '#3B82F6';
      }}
      nodeColor={(node) => {
        if (node.type === 'agentNode') return '#10B98133';
        return '#3B82F633';
      }}
      nodeBorderRadius={8}
      maskColor="rgba(0, 0, 0, 0.7)"
      className="!bg-mc-bg-secondary !border !border-mc-border !rounded-lg"
      pannable
      zoomable
    />
  );
}

export const GraphMinimap = memo(GraphMinimapComponent);
