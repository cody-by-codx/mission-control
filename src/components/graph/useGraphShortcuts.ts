'use client';

import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface UseGraphShortcutsOptions {
  onAutoLayout: () => void;
  onToggleView?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for GraphView:
 * F - Fit view
 * L - Auto layout
 * + / = - Zoom in
 * - - Zoom out
 * 0 - Reset zoom
 * ? - Show shortcuts help (console)
 */
export function useGraphShortcuts({ onAutoLayout, onToggleView, enabled = true }: UseGraphShortcutsOptions) {
  const { fitView, zoomIn, zoomOut, setViewport } = useReactFlow();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'f':
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
        break;
      case 'l':
        e.preventDefault();
        onAutoLayout();
        break;
      case 'g':
        e.preventDefault();
        onToggleView?.();
        break;
      case '=':
      case '+':
        e.preventDefault();
        zoomIn({ duration: 200 });
        break;
      case '-':
        e.preventDefault();
        zoomOut({ duration: 200 });
        break;
      case '0':
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
        break;
      case '?':
        console.log(
          '%c[GraphView Shortcuts]%c\n' +
          'F - Fit view\n' +
          'L - Auto layout\n' +
          'G - Toggle graph view\n' +
          '+ - Zoom in\n' +
          '- - Zoom out\n' +
          '0 - Reset zoom',
          'font-weight: bold; color: #58a6ff',
          'color: #c9d1d9'
        );
        break;
    }
  }, [fitView, zoomIn, zoomOut, setViewport, onAutoLayout, onToggleView]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
