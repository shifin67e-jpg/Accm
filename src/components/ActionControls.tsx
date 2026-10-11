import React from 'react';
import { Play, Square, RotateCw, Plus, Loader2 } from 'lucide-react';
import type { AternosState } from '../types/aternos.ts';

interface ActionControlsProps {
  state: AternosState;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onExtend?: () => void;
  isLoading: boolean;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  state,
  onStart,
  onStop,
  onRestart,
  onExtend,
  isLoading,
}) => {
  const isOnline = state.status === 'online';
  const isStarting = state.status === 'starting' || state.status === 'loading';
  const isQueue = state.status === 'queue';
  const isStopping = state.status === 'stopping';
  const isOffline = state.status === 'offline';

  // Start button: Enabled when offline
  const startDisabled = isLoading || isOnline || isStarting || isQueue;
  const startLabel = isStarting ? 'Starting...' : isQueue ? 'In Queue' : 'Start Server';

  // Stop button: Enabled when server is active
  const stopDisabled = isLoading || isStopping || isOffline;

  // Restart button: Enabled when server is online
  const restartDisabled = isLoading || isStarting || isStopping || isOffline;

  // Extend button: Enabled when server is online
  const extendDisabled = isLoading || !isOnline;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-5 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase font-mono">
            Direct Server Controls
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Synchronized with Sleeyax Aternos API and live background worker
          </p>
        </div>
        <div className="hidden sm:block">
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
            {state.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        {/* Start Button - High Contrast White */}
        <button
          onClick={onStart}
          disabled={startDisabled}
          className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] ${
            startDisabled
              ? 'bg-zinc-950 text-zinc-600 border border-zinc-800/80 cursor-not-allowed opacity-50'
              : 'bg-white hover:bg-zinc-200 text-black shadow-lg shadow-white/10 border border-white cursor-pointer font-black'
          }`}
          title={isOnline ? 'Server is already running' : 'Start server on Aternos'}
        >
          {isLoading && state.currentAction === 'start' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className={`w-4 h-4 ${!startDisabled ? 'fill-current' : ''}`} />
          )}
          <span>{startLabel}</span>
        </button>

        {/* Stop Button - Deep Graphite with White Text */}
        <button
          onClick={onStop}
          disabled={stopDisabled}
          className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] ${
            stopDisabled
              ? 'bg-zinc-950 text-zinc-600 border border-zinc-800/80 cursor-not-allowed opacity-50'
              : 'bg-zinc-950 hover:bg-zinc-800 text-white border border-zinc-700 shadow-md cursor-pointer'
          }`}
          title={isOffline ? 'Server is offline' : 'Stop Minecraft server'}
        >
          {isLoading && state.currentAction === 'stop' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Square className="w-4 h-4 fill-current" />
          )}
          <span>{isStopping ? 'Stopping...' : 'Stop Server'}</span>
        </button>

        {/* Restart Button - Deep Graphite with White Text */}
        <button
          onClick={onRestart}
          disabled={restartDisabled}
          className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] ${
            restartDisabled
              ? 'bg-zinc-950 text-zinc-600 border border-zinc-800/80 cursor-not-allowed opacity-50'
              : 'bg-zinc-950 hover:bg-zinc-800 text-white border border-zinc-700 shadow-md cursor-pointer'
          }`}
          title={isOffline ? 'Server must be online to restart' : 'Reboot server'}
        >
          {isLoading && state.currentAction === 'restart' ? (
            <RotateCw className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCw className="w-4 h-4" />
          )}
          <span>Restart Server</span>
        </button>

        {/* Extend Keepalive Button */}
        <button
          onClick={onExtend}
          disabled={extendDisabled}
          className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] ${
            extendDisabled
              ? 'bg-zinc-950 text-zinc-600 border border-zinc-800/80 cursor-not-allowed opacity-50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 shadow-md cursor-pointer'
          }`}
          title="Add +1 Minute Keepalive Timer"
        >
          {isLoading && state.currentAction === 'extend' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 stroke-[3]" />
          )}
          <span>+1 Min Timer</span>
        </button>
      </div>
    </div>
  );
};
