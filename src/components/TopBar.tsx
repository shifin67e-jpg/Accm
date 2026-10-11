import React from 'react';
import { Key, Plus, Server } from 'lucide-react';

interface TopBarProps {
  onOpenSettings: () => void;
  activeServerName?: string;
  totalServersCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  activeServerName = 'Default Server',
  totalServersCount = 1,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3 shrink-0 select-none">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-sm">
            <Server className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            Aternos Command Center
          </span>
        </div>

        {/* Zone 2: Navigation Links / Active Server Context */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
          <span className="text-zinc-300 font-medium whitespace-nowrap">
            {activeServerName}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {totalServersCount} {totalServersCount === 1 ? 'Server' : 'Servers'}
          </span>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium text-black bg-white hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm whitespace-nowrap shrink-0"
            title="Configure Session Cookies"
          >
            <Key className="w-3 h-3" />
            <span>Auth</span>
          </button>
        </div>
      </div>
    </header>
  );
};
