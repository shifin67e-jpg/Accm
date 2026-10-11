import React, { useState } from 'react';
import { Copy, Check, Globe, Edit2, Server as ServerIcon } from 'lucide-react';
import type { AternosState } from '../types/aternos.ts';

interface ServerCardProps {
  state: AternosState;
  serverName?: string;
  onCopyAddress: (text: string) => void;
  onEditServer?: () => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  state,
  serverName = 'Minecraft Server',
  onCopyAddress,
  onEditServer,
}) => {
  const [copied, setCopied] = useState(false);

  const fullAddress = state.serverPort && state.serverPort !== '25565'
    ? `${state.serverIp}:${state.serverPort}`
    : state.serverIp;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    onCopyAddress(fullAddress);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case 'online':
        return {
          bg: 'bg-white text-black font-black shadow-md',
          label: 'ONLINE',
          isLive: true,
        };
      case 'starting':
      case 'loading':
        return {
          bg: 'bg-zinc-800 text-white font-bold border border-zinc-500 animate-pulse',
          label: (state.rawStatus || 'STARTING...').toUpperCase(),
          isLive: false,
        };
      case 'queue':
        return {
          bg: 'bg-zinc-800 text-zinc-200 font-bold border border-zinc-600',
          label: state.queuePosition ? `IN QUEUE (#${state.queuePosition})` : 'IN QUEUE',
          isLive: false,
        };
      case 'stopping':
        return {
          bg: 'bg-zinc-800 text-zinc-300 font-bold border border-zinc-600',
          label: 'STOPPING...',
          isLive: false,
        };
      default:
        return {
          bg: 'bg-zinc-900 text-zinc-400 font-medium border border-zinc-800',
          label: 'OFFLINE',
          isLive: false,
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-md p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Left column: Server identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <ServerIcon className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
              {serverName}
            </h2>
            {onEditServer && (
              <button
                onClick={onEditServer}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Edit server profile"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean unboxed metadata with separators */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span>{state.software || 'Paper'}</span>
            <span aria-hidden="true">·</span>
            <span>v{state.version || '1.20.4'}</span>
            <span aria-hidden="true">·</span>
            <span>Port {state.serverPort || '25565'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Direct Connect Address Bar */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200">
              <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="font-semibold select-all text-white">{fullAddress}</span>
              <button
                onClick={handleCopy}
                title="Copy Server Address"
                className="ml-1 p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Status Badge */}
        <div className="flex flex-col sm:items-end justify-center">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono tracking-wider transition-all select-none ${statusBadge.bg}`}
          >
            <span>{statusBadge.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
