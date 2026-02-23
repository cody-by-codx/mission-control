'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Agent } from '@/lib/types';

export interface AgentNodeData {
  agent: Agent;
  taskCount: number;
  subagentCount: number;
}

function AgentNodeComponent({ data }: NodeProps) {
  const { agent, taskCount, subagentCount } = data as unknown as AgentNodeData;

  const statusColors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    working: {
      border: 'border-emerald-500',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/30',
    },
    standby: {
      border: 'border-gray-500',
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
      glow: '',
    },
    offline: {
      border: 'border-red-500',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      glow: '',
    },
  };

  const colors = statusColors[agent.status] || statusColors.standby;
  const isWorking = agent.status === 'working';
  const isOffline = agent.status === 'offline';

  return (
    <div
      className={`
        rounded-xl border-2 ${colors.border} ${colors.bg} p-3 min-w-[200px]
        backdrop-blur-sm transition-all duration-300
        ${isWorking ? `shadow-lg ${colors.glow} agent-node-pulse` : ''}
        ${isOffline ? 'opacity-60' : ''}
      `}
    >
      {/* Incoming connections (from tasks or parent agents) */}
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{agent.avatar_emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate text-white">{agent.name}</div>
          <div className="text-xs text-gray-400 truncate">{agent.role}</div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-1.5" />

      {/* Status + Info */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${
            isWorking ? 'bg-emerald-500 animate-pulse' :
            isOffline ? 'bg-red-500' : 'bg-gray-500'
          }`} />
          <span className={`font-medium uppercase ${colors.text}`}>
            {agent.status}
          </span>
        </div>

        {agent.model && (
          <div className="text-gray-500">
            Model: <span className="text-gray-400">{agent.model}</span>
          </div>
        )}

        <div className="text-gray-500">
          Tasks: <span className="text-gray-300">{taskCount} active</span>
        </div>

        {subagentCount > 0 && (
          <div className="text-gray-500">
            <span className="text-gray-400">{subagentCount} sub-agent{subagentCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Outgoing connections (to tasks or sub-agents) */}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2" />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
