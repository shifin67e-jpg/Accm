import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  Search,
  Maximize2,
  Minimize2,
  Download,
  Send,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import type { LogEntry, LogLevel } from '../types/aternos.ts';

interface TerminalConsoleProps {
  logs: LogEntry[];
  onCopyNotice: () => void;
  onClearLogs: () => void;
  onCommandExecuted?: (cmd: string) => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  logs,
  onCopyNotice,
  onClearLogs,
  onCommandExecuted,
}) => {
  const [filter, setFilter] = useState<'ALL' | LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs by level and text search
  const filteredLogs = logs.filter(entry => {
    const matchesLevel = filter === 'ALL' || entry.level === filter;
    const matchesSearch =
      !searchQuery ||
      entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.level.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.timestamp.includes(searchQuery);
    return matchesLevel && matchesSearch;
  });

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    onCopyNotice();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aternos-console-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendCommand = async (cmdToSend?: string) => {
    const cmd = (cmdToSend !== undefined ? cmdToSend : commandInput).trim();
    if (!cmd || isExecutingCommand) return;

    setIsExecutingCommand(true);
    setCommandHistory(prev => [cmd, ...prev.filter(c => c !== cmd)]);
    setHistoryIndex(-1);
    setCommandInput('');

    try {
      const res = await fetch('/api/action/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      await res.json();
      if (onCommandExecuted) onCommandExecuted(cmd);
    } catch {
      // offline/proxy error
    } finally {
      setIsExecutingCommand(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const getBadgeStyle = (level: LogLevel) => {
    switch (level) {
      case 'SYS':
        return 'bg-zinc-800 text-zinc-300';
      case 'CMD':
        return 'bg-white text-black font-bold';
      case 'INFO':
        return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
      case 'WARN':
        return 'bg-amber-950/70 text-amber-300 border border-amber-800/60';
      case 'ERR':
        return 'bg-red-950/70 text-red-300 border border-red-800/60';
      default:
        return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div
      className={`bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
        isExpanded ? 'h-[620px]' : 'h-[440px]'
      }`}
    >
      {/* Top Window Header (macOS/Unix Monochrome Style) */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Window dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 border border-zinc-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 border border-zinc-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 border border-zinc-600" />
          </div>

          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Aternos Live CLI Console
            </span>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              {logs.length} Lines
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center min-w-[140px] sm:min-w-[180px]">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-zinc-500 hover:text-white text-xs font-mono"
            >
              ×
            </button>
          )}
        </div>

        {/* Toolbar Action Icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
              autoScroll
                ? 'bg-zinc-800 text-white border-zinc-600 font-bold'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
            }`}
            title="Toggle Auto-Scroll"
          >
            Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleCopyLogs}
            title="Copy logs to clipboard"
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleDownloadLogs}
            title="Download .log file"
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            title="Clear terminal buffer"
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand Full Height'}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer hidden sm:block"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Filter Badges Sub-Bar */}
      <div className="bg-zinc-950/90 border-b border-zinc-800/80 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-400 mr-1">FILTER:</span>
          {(['ALL', 'SYS', 'CMD', 'INFO', 'WARN', 'ERR'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                filter === lvl
                  ? 'bg-white text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Quick Command Suggestions */}
        <div className="hidden md:flex items-center gap-1">
          <span className="text-[10px] font-mono text-zinc-400 mr-1">QUICK:</span>
          {['help', 'status', 'start', 'restart', 'extend', 'clear'].map(cmd => (
            <button
              key={cmd}
              onClick={() => handleSendCommand(cmd)}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 select-text bg-[#09090b]"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 italic text-center py-12 flex flex-col items-center gap-2">
            <Terminal className="w-6 h-6 opacity-40 text-zinc-500" />
            <span>
              {searchQuery ? `No logs matching "${searchQuery}"` : 'Awaiting server activity...'}
            </span>
          </div>
        ) : (
          filteredLogs.map(entry => (
            <div key={entry.id} className="flex items-start gap-2 py-0.5 leading-snug font-mono text-[11px] select-text">
              <span className="text-zinc-500 text-[10px] shrink-0 tabular-nums select-none pt-0.5">
                {entry.timestamp}
              </span>
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${getBadgeStyle(
                  entry.level
                )}`}
              >
                {entry.level}
              </span>
              <span className="text-zinc-300 break-words flex-1">{entry.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Interactive Command Line Bar (>_) */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-3 py-2 flex items-center gap-2 shrink-0">
        <span className="text-white font-mono font-black text-sm select-none pl-1">&gt;_</span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={e => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecutingCommand}
          placeholder='Type a command (e.g. "status", "start", "restart", "extend", "help")...'
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
        />
        <button
          onClick={() => handleSendCommand()}
          disabled={isExecutingCommand || !commandInput.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
        >
          {isExecutingCommand ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Exec</span>
        </button>
      </div>
    </div>
  );
};
