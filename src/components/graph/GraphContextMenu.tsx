'use client';

import { memo, useEffect, useRef } from 'react';
import { Trash2, Link, Unlink, Eye, Layers } from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'pane';
  nodeId?: string;
  nodeType?: string;
  edgeId?: string;
}

interface GraphContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCreateDependency?: (nodeId: string) => void;
  onViewDetails?: (nodeId: string, nodeType: string) => void;
  onGroupByWorkspace?: () => void;
  onGroupByRole?: () => void;
}

function GraphContextMenuComponent({
  menu,
  onClose,
  onDeleteEdge,
  onCreateDependency,
  onViewDetails,
  onGroupByWorkspace,
  onGroupByRole,
}: GraphContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];

  if (menu.type === 'node' && menu.nodeId) {
    if (menu.nodeType === 'taskNode') {
      items.push({
        label: 'View Task Details',
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => {
          onViewDetails?.(menu.nodeId!, 'task');
          onClose();
        },
      });
      items.push({
        label: 'Add Dependency From Here',
        icon: <Link className="w-3.5 h-3.5" />,
        onClick: () => {
          onCreateDependency?.(menu.nodeId!);
          onClose();
        },
      });
    } else if (menu.nodeType === 'agentNode') {
      items.push({
        label: 'View Agent Details',
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => {
          onViewDetails?.(menu.nodeId!, 'agent');
          onClose();
        },
      });
    }
  }

  if (menu.type === 'edge' && menu.edgeId) {
    items.push({
      label: 'Remove Connection',
      icon: <Unlink className="w-3.5 h-3.5" />,
      onClick: () => {
        onDeleteEdge?.(menu.edgeId!);
        onClose();
      },
      danger: true,
    });
  }

  if (menu.type === 'pane') {
    items.push({
      label: 'Group by Workspace',
      icon: <Layers className="w-3.5 h-3.5" />,
      onClick: () => {
        onGroupByWorkspace?.();
        onClose();
      },
    });
    items.push({
      label: 'Group by Role',
      icon: <Layers className="w-3.5 h-3.5" />,
      onClick: () => {
        onGroupByRole?.();
        onClose();
      },
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            item.danger
              ? 'text-mc-accent-red hover:bg-mc-accent-red/10'
              : 'text-mc-text hover:bg-mc-bg-tertiary'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export const GraphContextMenu = memo(GraphContextMenuComponent);
