import React from 'react';
import { Play, Square, RotateCw, Plus } from 'lucide-react';
import type { AternosState } from '../types/aternos.ts';

interface MobileTouchBarProps {
  state: AternosState;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onExtend: () => void;
  isLoading: boolean;
}

export const MobileTouchBar: React.FC<MobileTouchBarProps> = ({
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

  const showKeepalive = isOnline;
  const isReadyToExtend = showKeepalive && (state.countdownSeconds || 0) <= 60;
  const startDisabled = isLoading || isOnline || isStarting || isQueue;
  const stopDisabled = isLoading || isStopping || isOffline;
  const restartDisabled = isLoading || isStarting || isStopping || isOffline;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-3 py-2 shadow-2xl">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Start Button */}
        <button
          onClick={onStart}
          disabled={startDisabled}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
            startDisabled
              ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-50'
              : 'bg-white text-black font-black shadow-lg shadow-white/10 active:bg-zinc-200'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isStarting ? 'Starting' : isQueue ? 'Queue' : 'Start'}</span>
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={stopDisabled}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
            stopDisabled
              ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-50'
              : 'bg-zinc-900 text-white border border-zinc-700 active:bg-zinc-800'
          }`}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{isStopping ? 'Stopping' : 'Stop'}</span>
        </button>

        {/* Restart Button */}
        <button
          onClick={onRestart}
          disabled={restartDisabled}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
            restartDisabled
              ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-50'
              : 'bg-zinc-900 text-white border border-zinc-700 active:bg-zinc-800'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Restart</span>
        </button>

        {/* Extend Keepalive Button */}
        {showKeepalive && (
          <button
            onClick={onExtend}
            disabled={isLoading}
            className={`min-h-[44px] px-3.5 flex items-center justify-center gap-1 rounded-xl font-black text-xs transition-all cursor-pointer bg-white text-black active:bg-zinc-200 shadow-md ${
              isReadyToExtend ? 'ring-2 ring-white animate-pulse' : ''
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>1m</span>
          </button>
        )}
      </div>
    </div>
  );
};
