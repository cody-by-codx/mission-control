'use client';

import { memo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, LayoutGrid } from 'lucide-react';

interface GraphControlsProps {
  onAutoLayout: () => void;
}

function GraphControlsComponent({ onAutoLayout }: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
      <button
        onClick={() => zoomIn()}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4 text-mc-text-secondary" />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4 text-mc-text-secondary" />
      </button>
      <button
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors"
        title="Fit View"
      >
        <Maximize className="w-4 h-4 text-mc-text-secondary" />
      </button>
      <div className="border-t border-mc-border my-0.5" />
      <button
        onClick={onAutoLayout}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors"
        title="Auto Layout"
      >
        <LayoutGrid className="w-4 h-4 text-mc-text-secondary" />
      </button>
    </div>
  );
}

export const GraphControls = memo(GraphControlsComponent);
