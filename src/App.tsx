import React, { useState, useEffect, useCallback } from 'react';
import type { AternosState, LogEntry, ServerProfile, SessionConfig } from './types/aternos.ts';
import { TopBar } from './components/TopBar.tsx';
import { ServerSwitcher } from './components/ServerSwitcher.tsx';
import { ManageServersModal } from './components/ManageServersModal.tsx';
import { ServerCard } from './components/ServerCard.tsx';
import { AternosCountdownWidget } from './components/AternosCountdownWidget.tsx';
import { ActionControls } from './components/ActionControls.tsx';
import { MacroControlPanel } from './components/MacroControlPanel.tsx';
import { TerminalConsole } from './components/TerminalConsole.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { MobileTouchBar } from './components/MobileTouchBar.tsx';
import { ToastContainer, type ToastMessage } from './components/Toast.tsx';
import { Key } from 'lucide-react';

const STORAGE_SERVERS_KEY = 'aternos_multi_servers';
const STORAGE_ACTIVE_ID_KEY = 'aternos_active_server_id';

const DEFAULT_SERVERS: ServerProfile[] = [
  {
    id: 'server-1',
    name: 'myserver.aternos.me',
    serverIp: 'myserver.aternos.me',
    serverPort: '25565',
    software: 'Paper / Bukkit',
    version: '1.20.4',
    sessionCookie: '',
    serverCookie: '',
    lastActive: Date.now(),
  },
];

const INITIAL_STATE: AternosState = {
  status: 'offline',
  rawStatus: 'Offline',
  serverIp: 'myserver.aternos.me',
  serverPort: '25565',
  software: 'Paper / Bukkit',
  version: '1.20.4',
  queuePosition: null,
  queueEta: null,
  countdownSeconds: null,
  countdownFormatted: null,
  countdownActive: false,
  canExtend: false,
  startVisible: true,
  stopVisible: false,
  restartVisible: false,
  extendVisible: false,
  lastUpdated: Date.now(),
  isActionPending: false,
  currentAction: null,
  sessionConnected: false,
  sessionError: null,
};

export default function App() {
  // 1. Multi-Server Profiles State
  const [servers, setServers] = useState<ServerProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERVERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_SERVERS;
  });

  const [activeServerId, setActiveServerId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
      if (savedId) return savedId;
    } catch {}
    return DEFAULT_SERVERS[0].id;
  });

  const activeServer = servers.find(s => s.id === activeServerId) || servers[0] || DEFAULT_SERVERS[0];

  const [state, setState] = useState<AternosState>({
    ...INITIAL_STATE,
    serverIp: activeServer.serverIp,
    serverPort: activeServer.serverPort,
    software: activeServer.software,
    version: activeServer.version,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageServersOpen, setIsManageServersOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const addToast = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Persist servers changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SERVERS_KEY, JSON.stringify(servers));
      fetch('/api/servers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers }),
      }).catch(() => {});
    } catch {}
  }, [servers]);

  // Persist active server ID
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeServerId);
    } catch {}
  }, [activeServerId]);

  // Sync active server credentials with backend
  const syncServerWithBackend = useCallback(async (server: ServerProfile) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCookie: server.sessionCookie,
          serverCookie: server.serverCookie,
          serverAddress: server.serverIp,
          software: server.software,
          version: server.version,
          serverPort: server.serverPort,
        }),
      });
    } catch {}
  }, []);

  // Sync on initial mount & whenever active server changes
  useEffect(() => {
    syncServerWithBackend(activeServer);
    setState(prev => ({
      ...prev,
      serverIp: activeServer.serverIp,
      serverPort: activeServer.serverPort,
      software: activeServer.software,
      version: activeServer.version,
      sessionConnected: Boolean(activeServer.sessionCookie && activeServer.sessionCookie.trim()),
    }));
  }, [activeServer.id, syncServerWithBackend]);

  // 2. Poll Status & Logs every 2500ms
  useEffect(() => {
    let isMounted = true;

    const fetchSync = async () => {
      try {
        setIsSyncing(true);
        const [statusRes, logsRes] = await Promise.all([
          fetch('/api/status'),
          fetch('/api/logs'),
        ]);

        if (statusRes.ok && isMounted) {
          const statusData: AternosState = await statusRes.json();
          setState(prev => {
            if (statusData.status === 'offline' || statusData.status === 'stopping') {
              return {
                ...statusData,
                serverIp: activeServer.serverIp || statusData.serverIp,
                software: activeServer.software || statusData.software,
                version: activeServer.version || statusData.version,
                countdownActive: false,
                countdownSeconds: null,
                countdownFormatted: null,
                canExtend: false,
              };
            }
            return {
              ...statusData,
              serverIp: statusData.serverIp || activeServer.serverIp,
              software: statusData.software || activeServer.software,
              version: statusData.version || activeServer.version,
              countdownSeconds: statusData.countdownSeconds !== null ? statusData.countdownSeconds : null,
            };
          });
        }

        if (logsRes.ok && isMounted) {
          const logsData: LogEntry[] = await logsRes.json();
          setLogs(logsData);
        }
      } catch {
        // network retry
      } finally {
        if (isMounted) setIsSyncing(false);
      }
    };

    fetchSync();
    const interval = setInterval(fetchSync, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeServer]);

  // 3. Local Countdown Ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setState(prev => {
        if (
          prev.status === 'online' &&
          prev.countdownActive &&
          prev.countdownSeconds !== null &&
          prev.countdownSeconds > 0
        ) {
          const nextSec = prev.countdownSeconds - 1;
          const mins = Math.floor(nextSec / 60);
          const secs = nextSec % 60;
          return {
            ...prev,
            countdownSeconds: nextSec,
            countdownFormatted: `${mins}:${secs < 10 ? '0' : ''}${secs}`,
            canExtend: nextSec <= 60,
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  // Multi-Server Profile Handlers
  const handleSelectServer = (id: string) => {
    const target = servers.find(s => s.id === id);
    if (!target) return;
    setActiveServerId(id);
    addToast('info', `Switched active server to ${target.name}.`);
  };

  const handleAddServer = (newServerData: Omit<ServerProfile, 'id'>) => {
    const newId = `server-${Date.now()}`;
    const newProfile: ServerProfile = {
      ...newServerData,
      id: newId,
      lastActive: Date.now(),
    };
    setServers(prev => [...prev, newProfile]);
    setActiveServerId(newId);
    addToast('success', `Server "${newProfile.name}" created and activated.`);
  };

  const handleUpdateServer = (id: string, updated: Partial<ServerProfile>) => {
    setServers(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updated } : s))
    );
    if (id === activeServerId) {
      const merged = { ...activeServer, ...updated };
      syncServerWithBackend(merged);
    }
    addToast('info', 'Server profile updated.');
  };

  const handleDeleteServer = (id: string) => {
    if (servers.length <= 1) {
      addToast('warning', 'You must maintain at least one server profile.');
      return;
    }
    const remaining = servers.filter(s => s.id !== id);
    setServers(remaining);
    if (activeServerId === id) {
      setActiveServerId(remaining[0].id);
    }
    addToast('info', 'Server profile removed.');
  };

  // Actions
  const handleStart = async () => {
    if (!activeServer.sessionCookie) {
      addToast('warning', 'Please enter your Aternos session cookie in Session Auth first.');
      setIsSettingsOpen(true);
      return;
    }
    if (state.status === 'online') {
      addToast('info', 'Server is already running online.');
      return;
    }
    if (state.status === 'starting' || state.status === 'loading') {
      addToast('info', 'Startup sequence in progress.');
      return;
    }

    setIsActionLoading(true);
    addToast('info', `Starting ${activeServer.name}...`);

    try {
      const res = await fetch('/api/action/start', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || 'Server start sequence triggered.');
        const updated = await fetch('/api/status').then(r => r.json());
        setState(updated);
      } else {
        addToast('error', data.message || 'Failed to start server.');
      }
    } catch (err: any) {
      addToast('error', `Connection error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeServer.sessionCookie) {
      addToast('warning', 'Session cookies required.');
      return;
    }
    if (state.status === 'offline') {
      addToast('warning', 'Server is already offline.');
      return;
    }

    setIsActionLoading(true);
    addToast('info', `Stopping ${activeServer.name}...`);

    try {
      const res = await fetch('/api/action/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || 'Server shutdown initiated.');
        const updated = await fetch('/api/status').then(r => r.json());
        setState(updated);
      } else {
        addToast('error', data.message || 'Failed to stop server.');
      }
    } catch (err: any) {
      addToast('error', `Connection error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!activeServer.sessionCookie) {
      addToast('warning', 'Session cookies required.');
      return;
    }
    if (state.status === 'offline') {
      addToast('warning', 'Cannot restart offline server. Please click Start Server.');
      return;
    }

    setIsActionLoading(true);
    addToast('info', `Rebooting ${activeServer.name}...`);

    try {
      const res = await fetch('/api/action/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || 'Server restart cycle triggered.');
        const updated = await fetch('/api/status').then(r => r.json());
        setState(updated);
      } else {
        addToast('error', data.message || 'Failed to restart server.');
      }
    } catch (err: any) {
      addToast('error', `Connection error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExtend = async () => {
    if (state.status !== 'online') {
      addToast('warning', 'Keepalive timer is not available when server is inactive.');
      return;
    }

    setIsActionLoading(true);
    addToast('info', 'Adding +1m keepalive...');

    try {
      const res = await fetch('/api/action/extend', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', '+1 Minute added to countdown timer!');
        setState(prev => {
          const nextSec = (prev.countdownSeconds || 0) + 60;
          const m = Math.floor(nextSec / 60);
          const s = nextSec % 60;
          return {
            ...prev,
            countdownSeconds: nextSec,
            countdownFormatted: `${m}:${s < 10 ? '0' : ''}${s}`,
            countdownActive: true,
          };
        });
      } else {
        addToast('warning', data.message || 'Could not extend server timer.');
      }
    } catch (err: any) {
      addToast('error', `Connection error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClearLogs = async () => {
    setLogs([]);
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      addToast('info', 'Terminal logs cleared.');
    } catch {}
  };

  const handleSaveConfig = async (newConfig: Partial<SessionConfig>) => {
    // Update active server profile with new config
    const nextAddress = newConfig.serverAddress ? newConfig.serverAddress.trim() : activeServer.serverIp;
    const updated = {
      ...activeServer,
      name: nextAddress,
      sessionCookie: newConfig.sessionCookie ?? activeServer.sessionCookie,
      serverCookie: newConfig.serverCookie ?? activeServer.serverCookie,
      serverIp: nextAddress,
    };

    setServers(prev =>
      prev.map(s => (s.id === activeServerId ? updated : s))
    );

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });

    if (res.ok) {
      addToast('success', 'Credentials saved and synchronized.');
    } else {
      addToast('error', 'Failed to update credentials.');
    }
  };

  const isCountdownVisible =
    state.status === 'online' &&
    state.countdownActive &&
    state.countdownSeconds !== null &&
    state.countdownSeconds > 0;

  const hasSessionConfigured = Boolean(activeServer.sessionCookie && activeServer.sessionCookie.trim());

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans pb-24 md:pb-10 selection:bg-white/20 selection:text-white overflow-x-hidden">
      {/* Top Bar Navigation */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeServerName={activeServer.serverIp || activeServer.name}
        totalServersCount={servers.length}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Multi-Server Switcher Bar */}
        <ServerSwitcher
          servers={servers}
          activeServerId={activeServerId}
          activeStatus={state.status}
          onSelectServer={handleSelectServer}
          onOpenManageServers={() => setIsManageServersOpen(true)}
          onQuickAddServer={() => setIsManageServersOpen(true)}
        />

        {/* Unconfigured Standby Prompt */}
        {!hasSessionConfigured && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-zinc-300">
              <Key className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>
                Default profile active for <strong className="text-white">{activeServer.name}</strong>. Add your Aternos session cookies in Session Auth to enable remote startup and live keepalive.
              </span>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors shrink-0 cursor-pointer self-start sm:self-auto font-mono"
            >
              Configure Auth
            </button>
          </div>
        )}

        {/* Server Status Hero Card */}
        <ServerCard
          state={state}
          serverName={activeServer.name}
          onCopyAddress={addr => addToast('success', `Copied address: ${addr}`)}
          onEditServer={() => setIsManageServersOpen(true)}
        />

        {/* Idle Countdown Widget (Online Only) */}
        {isCountdownVisible && (
          <div className="py-1 flex justify-center animate-in fade-in duration-300">
            <AternosCountdownWidget
              serverStatus={state.status}
              countdownActive={state.countdownActive}
              countdownSeconds={state.countdownSeconds}
              countdownFormatted={state.countdownFormatted}
              onExtend={handleExtend}
              isExtending={isActionLoading}
            />
          </div>
        )}

        {/* Quick Action Control Panel */}
        <ActionControls
          state={state}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
          onExtend={handleExtend}
          isLoading={isActionLoading}
        />

        {/* Macro Automation Section */}
        <MacroControlPanel
          serverStatus={state.status}
          countdownSeconds={state.countdownSeconds}
          countdownFormatted={state.countdownFormatted}
          onRestart={handleRestart}
          onExtend={handleExtend}
          isActionLoading={isActionLoading}
          addToast={addToast}
        />

        {/* Terminal Console */}
        <TerminalConsole
          logs={logs}
          onCopyNotice={() => addToast('info', 'Console logs copied to clipboard.')}
          onClearLogs={handleClearLogs}
        />
      </main>

      {/* Mobile Sticky Touch Bar (< md) */}
      <MobileTouchBar
        state={state}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onExtend={handleExtend}
        isLoading={isActionLoading}
      />

      {/* Manage Servers Modal */}
      <ManageServersModal
        isOpen={isManageServersOpen}
        onClose={() => setIsManageServersOpen(false)}
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onAddServer={handleAddServer}
        onUpdateServer={handleUpdateServer}
        onDeleteServer={handleDeleteServer}
      />

      {/* Session Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        currentConfig={{
          sessionCookie: activeServer.sessionCookie,
          serverCookie: activeServer.serverCookie,
          serverAddress: activeServer.serverIp,
        }}
        serverName={activeServer.name}
      />

      {/* Card-Stack Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
