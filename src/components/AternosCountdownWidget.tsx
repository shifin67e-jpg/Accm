import React from 'react';
import { Clock, Plus } from 'lucide-react';
import type { ServerStatus } from '../types/aternos.ts';

interface AternosCountdownWidgetProps {
  serverStatus: ServerStatus;
  countdownActive: boolean;
  countdownSeconds: number | null;
  countdownFormatted: string | null;
  onExtend: () => void;
  isExtending: boolean;
}

export const AternosCountdownWidget: React.FC<AternosCountdownWidgetProps> = ({
  serverStatus,
  countdownActive,
  countdownSeconds,
  countdownFormatted,
  onExtend,
  isExtending,
}) => {
  if (
    serverStatus !== 'online' ||
    !countdownActive ||
    countdownSeconds === null ||
    countdownSeconds <= 0
  ) {
    return null;
  }

  const isReady = countdownSeconds <= 60 && countdownSeconds > 0;
  const mins = Math.floor(countdownSeconds / 60);
  const secs = countdownSeconds % 60;
  const displayTime = countdownFormatted || `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono uppercase tracking-wider">
        <span>Aternos Idle Timer</span>
        <span>•</span>
        <span className={isReady ? 'text-white font-bold animate-pulse' : 'text-zinc-500'}>
          {isReady ? 'Keepalive Critical (≤ 1:00)' : 'Keepalive Standby'}
        </span>
      </div>

      {/* Pure Monochrome Dark Pill Countdown Widget */}
      <div className="bg-zinc-900/95 text-white rounded-full px-5 py-2.5 shadow-2xl border border-zinc-700 flex items-center gap-4 transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="font-mono text-lg font-black tabular-nums tracking-widest text-white select-none">
            {displayTime}
          </span>
        </div>

        {/* High-Contrast White +1 Minute Keepalive Button */}
        <button
          onClick={onExtend}
          disabled={isExtending || countdownSeconds <= 0}
          title="Extend server countdown by +1 minute"
          className={`relative group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider text-black bg-white hover:bg-zinc-200 transition-all duration-200 active:scale-95 cursor-pointer shadow-lg ${
            isReady ? 'ring-2 ring-white animate-pulse' : ''
          } ${countdownSeconds <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>1 MIN</span>
          {isReady && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300"></span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
