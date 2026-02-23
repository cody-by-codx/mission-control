'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export interface TaskNodeData {
  task: Task;
  deliverableCount: number;
  totalDeliverables: number;
}

const statusConfig: Record<TaskStatus, { color: string; bg: string; icon: string }> = {
  planning: { color: 'text-purple-400', bg: 'border-purple-500 bg-purple-500/10', icon: '🧠' },
  inbox: { color: 'text-pink-400', bg: 'border-pink-500 bg-pink-500/10', icon: '📥' },
  assigned: { color: 'text-yellow-400', bg: 'border-yellow-500 bg-yellow-500/10', icon: '👤' },
  in_progress: { color: 'text-blue-400', bg: 'border-blue-500 bg-blue-500/10', icon: '▶' },
  testing: { color: 'text-cyan-400', bg: 'border-cyan-500 bg-cyan-500/10', icon: '🧪' },
  review: { color: 'text-purple-400', bg: 'border-purple-500 bg-purple-500/10', icon: '👀' },
  done: { color: 'text-emerald-400', bg: 'border-emerald-500 bg-emerald-500/10', icon: '✅' },
};

const priorityConfig: Record<TaskPriority, { color: string; label: string }> = {
  urgent: { color: 'text-red-400', label: 'URGENT' },
  high: { color: 'text-orange-400', label: 'HIGH' },
  normal: { color: 'text-gray-400', label: 'NORMAL' },
  low: { color: 'text-gray-500', label: 'LOW' },
};

function TaskNodeComponent({ data }: NodeProps) {
  const { task, deliverableCount, totalDeliverables } = data as unknown as TaskNodeData;

  const status = statusConfig[task.status] || statusConfig.inbox;
  const priority = priorityConfig[task.priority] || priorityConfig.normal;
  const isActive = task.status === 'in_progress' || task.status === 'planning';
  const isDone = task.status === 'done';
  const elapsed = formatDistanceToNow(new Date(task.created_at), { addSuffix: false });

  return (
    <div
      className={`
        rounded-xl border-2 ${status.bg} p-3 min-w-[200px] max-w-[240px]
        backdrop-blur-sm transition-all duration-300
        ${isActive ? 'shadow-lg shadow-blue-500/20 task-node-active' : ''}
        ${isDone ? 'opacity-70' : ''}
      `}
    >
      {/* Incoming connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      {/* Priority badge */}
      <div className={`text-[10px] font-bold uppercase ${priority.color} mb-1`}>
        {task.priority !== 'normal' ? priority.label : ''}
      </div>

      {/* Title */}
      <div className="font-semibold text-sm text-white truncate mb-1">
        {task.title}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-1.5" />

      {/* Status */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span>{status.icon}</span>
          <span className={`font-medium uppercase ${status.color}`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>

        <div className="text-gray-500">
          {elapsed} ago
        </div>

        {totalDeliverables > 0 && (
          <div className="text-gray-500">
            {deliverableCount}/{totalDeliverables} deliverables
          </div>
        )}
      </div>

      {/* Outgoing connections */}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
