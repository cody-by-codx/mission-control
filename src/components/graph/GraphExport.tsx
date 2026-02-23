'use client';

import { memo, useCallback } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { Download } from 'lucide-react';

interface GraphExportProps {
  filename?: string;
}

function GraphExportComponent({ filename = 'mission-control-graph' }: GraphExportProps) {
  const { getNodes } = useReactFlow();

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const nodes = getNodes();
    if (nodes.length === 0) return;

    const bounds = getNodesBounds(nodes);
    const padding = 50;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;

    const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, padding);

    // Find the ReactFlow viewport element
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportEl) return;

    if (format === 'svg') {
      // SVG export: serialize the viewport DOM
      const svgEl = document.querySelector('.react-flow__edges svg') as SVGSVGElement | null;
      const clonedViewport = viewportEl.cloneNode(true) as HTMLElement;

      const svgDoc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgDoc.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgDoc.setAttribute('width', String(width));
      svgDoc.setAttribute('height', String(height));
      svgDoc.setAttribute('viewBox', `0 0 ${width} ${height}`);

      const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObject.setAttribute('width', '100%');
      foreignObject.setAttribute('height', '100%');

      const body = document.createElement('div');
      body.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      body.style.width = `${width}px`;
      body.style.height = `${height}px`;
      body.style.background = '#0d1117';
      body.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
      body.appendChild(clonedViewport);

      foreignObject.appendChild(body);
      svgDoc.appendChild(foreignObject);

      const svgData = new XMLSerializer().serializeToString(svgDoc);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      downloadBlob(blob, `${filename}.svg`);
    } else {
      // PNG export using canvas
      try {
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        // Use html2canvas-like approach with foreignObject
        const svgData = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="
                width: ${width}px; height: ${height}px; background: #0d1117;
                font-family: 'JetBrains Mono', monospace; color: #c9d1d9;
              ">
                ${viewportEl.outerHTML}
              </div>
            </foreignObject>
          </svg>
        `;

        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `${filename}.png`);
          }, 'image/png');
        };

        img.onerror = () => {
          // Fallback: simple export notification
          URL.revokeObjectURL(url);
          alert('PNG export failed. Try SVG export instead.');
        };

        img.src = url;
      } catch {
        alert('PNG export failed. Try SVG export instead.');
      }
    }
  }, [getNodes, filename]);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => exportImage('png')}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors"
        title="Export as PNG"
      >
        <Download className="w-4 h-4 text-mc-text-secondary" />
      </button>
      <button
        onClick={() => exportImage('svg')}
        className="p-2 bg-mc-bg-secondary border border-mc-border rounded-lg hover:bg-mc-bg-tertiary transition-colors text-[8px] text-mc-text-secondary font-bold"
        title="Export as SVG"
      >
        SVG
      </button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const GraphExport = memo(GraphExportComponent);
