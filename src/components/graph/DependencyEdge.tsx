'use client';

import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const depType = (data as { dependencyType?: string })?.dependencyType || 'blocks';

  const colorMap: Record<string, string> = {
    blocks: '#EF4444',
    relates_to: '#6B7280',
    subtask_of: '#8B5CF6',
  };

  const dashMap: Record<string, string> = {
    blocks: 'none',
    relates_to: '5,5',
    subtask_of: 'none',
  };

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: colorMap[depType] || '#6B7280',
        strokeWidth: depType === 'blocks' ? 2 : 1.5,
        strokeDasharray: dashMap[depType] || 'none',
        ...style,
      }}
    />
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
