import React, { useState, useEffect } from 'react';
import type { MacroRule } from '../types/aternos.ts';

interface MacroControlPanelProps {
  serverStatus: string;
  countdownSeconds?: number | null;
  countdownFormatted?: string | null;
  onRestart: () => void;
  onExtend: () => void;
  isActionLoading: boolean;
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const MacroControlPanel: React.FC<MacroControlPanelProps> = ({
  serverStatus,
  countdownSeconds,
  countdownFormatted,
  onRestart,
  onExtend,
  isActionLoading,
  addToast,
}) => {
  const [macros, setMacros] = useState<MacroRule[]>([
    {
      id: 'macro-restart-interval',
      name: 'Interval Restart',
      description: 'Restart server periodically every X hours/minutes to refresh memory',
      type: 'restart_interval',
      enabled: false,
      intervalMinutes: 300, // 5 hours default
      lastRunTimestamp: null,
      nextRunTimestamp: null,
      runCount: 0,
    },
    {
      id: 'macro-restart-daily',
      name: 'Daily Schedule Restart',
      description: 'Restart server everyday at a designated clock time (e.g. 06:30 AM)',
      type: 'restart_daily',
      enabled: false,
      dailyTime: '06:30',
      lastRunTimestamp: null,
      nextRunTimestamp: null,
      runCount: 0,
    },
    {
      id: 'macro-extend-interval',
      name: 'Auto Add Timer (Stealth <= 1:00)',
      description: 'Auto-click Add Timer only when countdown reaches 1:00 or below, randomized between 50s-58s (e.g. 58s or 56s)',
      type: 'extend_interval',
      enabled: true,
      targetMinSec: 52,
      targetMaxSec: 58,
      randomTriggerSec: 56,
      intervalMinutes: 4,
      lastRunTimestamp: null,
      nextRunTimestamp: null,
      runCount: 0,
    },
  ]);

  const [now, setNow] = useState(Date.now());
  const [customInterval, setCustomInterval] = useState<{ [id: string]: string }>({});

  // Live timer tick every second for accurate macro countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch macro configuration from backend on mount
  useEffect(() => {
    fetch('/api/macros')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMacros(data);
        }
      })
      .catch(() => {});
  }, []);

  // Sync macros with backend when changed
  const saveMacrosToBackend = (updatedRules: MacroRule[]) => {
    fetch('/api/macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: updatedRules }),
    })
      .then(r => r.json())
      .then(saved => {
        if (Array.isArray(saved)) setMacros(saved);
      })
      .catch(() => {});
  };

  const handleToggle = (id: string) => {
    const updated = macros.map(m => {
      if (m.id === id) {
        const willEnable = !m.enabled;
        let nextRun = m.nextRunTimestamp;
        if (willEnable) {
          if (m.type === 'restart_interval' || m.type === 'extend_interval') {
            const mins = m.intervalMinutes || 60;
            nextRun = Date.now() + mins * 60 * 1000;
          } else if (m.type === 'restart_daily' && m.dailyTime) {
            nextRun = calculateNextDaily(m.dailyTime);
          }
        }
        return { ...m, enabled: willEnable, nextRunTimestamp: willEnable ? nextRun : null };
      }
      return m;
    });

    setMacros(updated);
    saveMacrosToBackend(updated);

    const target = updated.find(m => m.id === id);
    if (target?.enabled) {
      addToast('success', `${target.name} macro armed and active.`);
    } else {
      addToast('info', `${target?.name} macro paused.`);
    }
  };

  const calculateNextDaily = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
    const target = new Date();
    target.setHours(h || 0, m || 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  };

  const handleSetIntervalMinutes = (id: string, minutes: number) => {
    const updated = macros.map(m => {
      if (m.id === id) {
        return {
          ...m,
          intervalMinutes: minutes,
          nextRunTimestamp: m.enabled ? Date.now() + minutes * 60 * 1000 : m.nextRunTimestamp,
        };
      }
      return m;
    });
    setMacros(updated);
    saveMacrosToBackend(updated);
    addToast('info', `Interval set to ${formatIntervalDuration(minutes)}.`);
  };

  const handleSetDailyTime = (id: string, time24: string) => {
    const updated = macros.map(m => {
      if (m.id === id) {
        const next = m.enabled ? calculateNextDaily(time24) : m.nextRunTimestamp;
        return {
          ...m,
          dailyTime: time24,
          nextRunTimestamp: next,
        };
      }
      return m;
    });
    setMacros(updated);
    saveMacrosToBackend(updated);
    addToast('info', `Daily schedule updated to ${formatTime12h(time24)}.`);
  };

  const handleSetRandomRange = (id: string, minSec: number, maxSec: number) => {
    const updated = macros.map(m => {
      if (m.id === id) {
        const nextRand = Math.floor(minSec + Math.random() * (maxSec - minSec + 1));
        return {
          ...m,
          targetMinSec: minSec,
          targetMaxSec: maxSec,
          randomTriggerSec: nextRand,
        };
      }
      return m;
    });
    setMacros(updated);
    saveMacrosToBackend(updated);
    addToast('info', `Random stealth trigger set to ${minSec}s – ${maxSec}s (Next target: ~${Math.floor(minSec + Math.random() * (maxSec - minSec + 1))}s).`);
  };

  const handleManualTrigger = async (id: string) => {
    const target = macros.find(m => m.id === id);
    if (!target) return;

    try {
      const res = await fetch(`/api/macros/trigger/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || `Triggered ${target.name}.`);
        // Refresh macros state
        const ref = await fetch('/api/macros').then(r => r.json());
        if (Array.isArray(ref)) setMacros(ref);
      } else {
        addToast('error', data.message || 'Action failed.');
      }
    } catch {
      if (target.type === 'restart_interval' || target.type === 'restart_daily') {
        onRestart();
      } else {
        onExtend();
      }
    }
  };

  const formatIntervalDuration = (mins: number) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${h}h ${rem}m` : `${h} Hour${h > 1 ? 's' : ''}`;
    }
    return `${mins} Minute${mins > 1 ? 's' : ''}`;
  };

  const formatTime12h = (time24?: string) => {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':').map(n => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m < 10 ? '0' : ''}${m} ${period}`;
  };

  const formatRemainingCountdown = (targetTimestamp: number | null) => {
    if (!targetTimestamp) return '--:--';
    const diffSec = Math.max(0, Math.floor((targetTimestamp - now) / 1000));
    if (diffSec <= 0) return 'Executing...';

    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;

    if (h > 0) {
      return `${h}h ${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
    }
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const activeCount = macros.filter(m => m.enabled).length;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 md:p-6 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <h3 className="text-base font-bold text-white tracking-wide uppercase">
              Macro Automation Engine
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
              {activeCount} {activeCount === 1 ? 'Rule Armed' : 'Rules Armed'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Automated recurring triggers for scheduled server restarts and keepalive timer extensions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              fetch('/api/macros')
                .then(r => r.json())
                .then(data => {
                  if (Array.isArray(data)) setMacros(data);
                  addToast('info', 'Macro statuses synchronized.');
                });
            }}
            title="Sync macro states"
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-all cursor-pointer"
          >
            ↻ Sync
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {/* Rule 1: Interval Restart */}
        {macros.find(m => m.type === 'restart_interval') && (() => {
          const m = macros.find(m => m.type === 'restart_interval')!;
          const currentMins = m.intervalMinutes || 300;

          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                m.enabled
                  ? 'bg-zinc-950/80 border-zinc-600 shadow-lg'
                  : 'bg-zinc-950/40 border-zinc-800/80 opacity-85'
              }`}
            >
              <div>
                {/* Title & Toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                      Rule 01 • Periodic
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      Restart Every X Hours
                    </h4>
                  </div>
                  {/* Monochrome Switch */}
                  <button
                    onClick={() => handleToggle(m.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      m.enabled ? 'bg-white' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                        m.enabled ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Restart server automatically every {formatIntervalDuration(currentMins)} to prevent lag and chunk memory leaks.
                </p>

                {/* Preset Chips */}
                <div className="mt-4">
                  <div className="text-[11px] font-medium text-zinc-400 mb-1.5">Interval:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[60, 120, 240, 300, 360].map(mins => (
                      <button
                        key={mins}
                        onClick={() => handleSetIntervalMinutes(m.id, mins)}
                        className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                          currentMins === mins
                            ? 'bg-white text-black shadow-sm'
                            : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                        }`}
                      >
                        {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                      </button>
                    ))}
                  </div>

                  {/* Custom Minute Input */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      placeholder="Custom mins"
                      value={customInterval[m.id] ?? ''}
                      onChange={e => setCustomInterval({ ...customInterval, [m.id]: e.target.value })}
                      className="w-28 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-white"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(customInterval[m.id] || '', 10);
                        if (!isNaN(val) && val >= 5) {
                          handleSetIntervalMinutes(m.id, val);
                          setCustomInterval({ ...customInterval, [m.id]: '' });
                        } else {
                          addToast('warning', 'Please enter a valid interval of at least 5 minutes.');
                        }
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 rounded text-xs font-mono cursor-pointer"
                    >
                      Set
                    </button>
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">NEXT TRIGGER</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {m.enabled ? formatRemainingCountdown(m.nextRunTimestamp) : 'Paused'}
                  </div>
                </div>

                <button
                  onClick={() => handleManualTrigger(m.id)}
                  disabled={isActionLoading || serverStatus === 'offline'}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded text-xs font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  Run Now
                </button>
              </div>
            </div>
          );
        })()}

        {/* Rule 2: Daily Scheduled Restart */}
        {macros.find(m => m.type === 'restart_daily') && (() => {
          const m = macros.find(m => m.type === 'restart_daily')!;
          const dailyTime = m.dailyTime || '06:30';

          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                m.enabled
                  ? 'bg-zinc-950/80 border-zinc-600 shadow-lg'
                  : 'bg-zinc-950/40 border-zinc-800/80 opacity-85'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                      Rule 02 • Daily Clock
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      Restart at Specific Time
                    </h4>
                  </div>
                  <button
                    onClick={() => handleToggle(m.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      m.enabled ? 'bg-white' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                        m.enabled ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Restart automatically every single day at <strong className="text-white">{formatTime12h(dailyTime)}</strong> (ideal for daily morning resets).
                </p>

                {/* Daily Time Input */}
                <div className="mt-4">
                  <div className="text-[11px] font-medium text-zinc-400 mb-1.5">Scheduled Time:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dailyTime}
                      onChange={e => {
                        if (e.target.value) handleSetDailyTime(m.id, e.target.value);
                      }}
                      className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white font-mono focus:outline-none focus:border-white cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2 py-1 rounded border border-zinc-700">
                      {formatTime12h(dailyTime)}
                    </span>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {['04:00', '06:30', '12:00', '23:00'].map(t => (
                      <button
                        key={t}
                        onClick={() => handleSetDailyTime(m.id, t)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          dailyTime === t
                            ? 'bg-white text-black font-bold'
                            : 'bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700'
                        }`}
                      >
                        {formatTime12h(t)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">NEXT TRIGGER</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {m.enabled ? formatRemainingCountdown(m.nextRunTimestamp) : 'Paused'}
                  </div>
                </div>

                <button
                  onClick={() => handleManualTrigger(m.id)}
                  disabled={isActionLoading || serverStatus === 'offline'}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded text-xs font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  Run Now
                </button>
              </div>
            </div>
          );
        })()}

        {/* Rule 3: Auto Keepalive Extend (Randomized <= 1:00) */}
        {macros.find(m => m.type === 'extend_interval') && (() => {
          const m = macros.find(m => m.type === 'extend_interval')!;
          const minSec = m.targetMinSec || 52;
          const maxSec = m.targetMaxSec || 58;
          const targetSec = m.randomTriggerSec || 56;

          const isUnderOneMin = countdownSeconds !== null && countdownSeconds !== undefined && countdownSeconds <= 60;

          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                m.enabled
                  ? 'bg-zinc-950/80 border-zinc-600 shadow-lg'
                  : 'bg-zinc-950/40 border-zinc-800/80 opacity-85'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                      Rule 03 • Stealth Keepalive
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      Auto Add Timer (&le; 1:00)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleToggle(m.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      m.enabled ? 'bg-white' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                        m.enabled ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Only triggers when server timer reaches <strong className="text-white">1:00 or below</strong>. Randomizes trigger between <strong className="text-zinc-200">{minSec}s &ndash; {maxSec}s</strong> (e.g. 58s, 56s) to mimic authentic human reaction.
                </p>

                {/* Randomized Window Presets */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1.5">
                    <span>Random Stealth Window:</span>
                    <span className="text-white font-mono font-bold text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                      Target: ~{targetSec}s
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '52s – 58s (Default)', min: 52, max: 58 },
                      { label: '50s – 56s', min: 50, max: 56 },
                      { label: '45s – 55s', min: 45, max: 55 },
                      { label: '55s – 59s', min: 55, max: 59 },
                    ].map(preset => {
                      const isActive = minSec === preset.min && maxSec === preset.max;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => handleSetRandomRange(m.id, preset.min, preset.max)}
                          className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white text-black shadow-sm'
                              : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Trigger Condition:</span>
                    <span className="text-zinc-200 font-bold">Countdown &le; {targetSec}s</span>
                  </div>
                </div>
              </div>

              {/* Status & Action */}
              <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-zinc-400">NEXT TRIGGER</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {!m.enabled ? (
                      'Paused'
                    ) : serverStatus !== 'online' ? (
                      'Waiting for Online'
                    ) : countdownSeconds !== null && countdownSeconds !== undefined ? (
                      isUnderOneMin ? (
                        <span className="text-white font-black animate-pulse">
                          Triggering at ~{targetSec}s ({countdownSeconds}s left)
                        </span>
                      ) : (
                        <span className="text-zinc-300">
                          Waiting for &le;1:00 ({countdownFormatted || `${countdownSeconds}s`})
                        </span>
                      )
                    ) : (
                      'Monitoring countdown...'
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleManualTrigger(m.id)}
                  disabled={isActionLoading || serverStatus !== 'online'}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded text-xs font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  +1 Now
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
