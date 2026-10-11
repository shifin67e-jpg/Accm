import React from 'react';
import { Plus, Settings2, CheckCircle2, Circle } from 'lucide-react';
import type { ServerProfile, ServerStatus } from '../types/aternos.ts';

interface ServerSwitcherProps {
  servers: ServerProfile[];
  activeServerId: string;
  activeStatus: ServerStatus;
  onSelectServer: (id: string) => void;
  onOpenManageServers: () => void;
  onQuickAddServer: () => void;
}

export const ServerSwitcher: React.FC<ServerSwitcherProps> = ({
  servers,
  activeServerId,
  activeStatus,
  onSelectServer,
  onOpenManageServers,
  onQuickAddServer,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-2.5 sm:px-4 sm:py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
          SERVERS:
        </span>

        {servers.map(server => {
          const isActive = server.id === activeServerId;
          const statusDisplay = isActive ? activeStatus : 'offline';
          const isOnline = statusDisplay === 'online';

          return (
            <button
              key={server.id}
              onClick={() => onSelectServer(server.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-zinc-800 text-white font-bold border-zinc-600 shadow-sm'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-zinc-800/80'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span className="max-w-[130px] sm:max-w-[180px] truncate">{server.name}</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </button>
          );
        })}

        <button
          onClick={onQuickAddServer}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono text-zinc-400 hover:text-white bg-zinc-950/50 hover:bg-zinc-900 border border-dashed border-zinc-700 transition-colors cursor-pointer shrink-0"
          title="Add another Minecraft server"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <button
          onClick={onOpenManageServers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
          title="Manage server profiles"
        >
          <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
          <span>Manage ({servers.length})</span>
        </button>
      </div>
    </div>
  );
};
