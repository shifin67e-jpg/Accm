import React, { useState } from 'react';
import { X, Server, Plus, Trash2, Edit2, Loader2, Check, Sparkles } from 'lucide-react';
import type { ServerProfile } from '../types/aternos.ts';

interface ManageServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerProfile[];
  activeServerId: string;
  onSelectServer: (id: string) => void;
  onAddServer: (newServer: Omit<ServerProfile, 'id'>) => void;
  onUpdateServer: (id: string, updated: Partial<ServerProfile>) => void;
  onDeleteServer: (id: string) => void;
}

const SOFTWARE_OPTIONS = [
  'Paper / Bukkit',
  'Fabric',
  'Purpur',
  'Spigot',
  'Vanilla',
  'Forge',
  'NeoForge',
  'Bedrock (Geyser)',
];

export const ManageServersModal: React.FC<ManageServersModalProps> = ({
  isOpen,
  onClose,
  servers,
  activeServerId,
  onSelectServer,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states (Unified Server Address field)
  const [serverAddress, setServerAddress] = useState('');
  const [serverPort, setServerPort] = useState('25565');
  const [software, setSoftware] = useState('Paper / Bukkit');
  const [version, setVersion] = useState('1.20.4');
  const [sessionCookie, setSessionCookie] = useState('');
  const [serverCookie, setServerCookie] = useState('');

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedSuccess, setDetectedSuccess] = useState(false);

  if (!isOpen) return null;

  const startEdit = (server: ServerProfile) => {
    setEditingId(server.id);
    setIsAddingNew(false);
    setServerAddress(server.serverIp || server.name);
    setServerPort(server.serverPort || '25565');
    setSoftware(server.software || 'Paper / Bukkit');
    setVersion(server.version || '1.20.4');
    setSessionCookie(server.sessionCookie || '');
    setServerCookie(server.serverCookie || '');
    setDetectedSuccess(false);
  };

  const startCreate = () => {
    setEditingId(null);
    setIsAddingNew(true);
    setServerAddress(`server${servers.length + 1}.aternos.me`);
    setServerPort('25565');
    setSoftware('Paper / Bukkit');
    setVersion('1.20.4');
    setSessionCookie('');
    setServerCookie('');
    setDetectedSuccess(false);
  };

  const handleAutoDetect = async (sessionVal = sessionCookie, serverVal = serverCookie) => {
    if (!sessionVal || sessionVal.trim().length < 20) return;
    setIsDetecting(true);
    try {
      const res = await fetch('/api/server/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCookie: sessionVal.trim(),
          serverCookie: serverVal.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.serverAddress) {
        setServerAddress(data.serverAddress);
        if (data.software) setSoftware(data.software);
        if (data.version) setVersion(data.version);
        if (data.serverPort) setServerPort(data.serverPort);
        setDetectedSuccess(true);
        setTimeout(() => setDetectedSuccess(false), 4500);
      }
    } catch {
      // ignore
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSessionChange = (val: string) => {
    setSessionCookie(val);
    if (val.trim().length > 10) {
      handleAutoDetect(val, serverCookie);
    }
  };

  const handleServerCookieChange = (val: string) => {
    setServerCookie(val);
    if (sessionCookie && sessionCookie.trim().length >= 40) {
      handleAutoDetect(sessionCookie, val);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddress = serverAddress.trim();
    if (!cleanAddress) return;

    const formattedAddress = cleanAddress.includes('.') ? cleanAddress : `${cleanAddress}.aternos.me`;

    if (isAddingNew) {
      onAddServer({
        name: formattedAddress,
        serverIp: formattedAddress,
        serverPort: serverPort.trim() || '25565',
        software,
        version: version.trim() || '1.20.4',
        sessionCookie: sessionCookie.trim(),
        serverCookie: serverCookie.trim(),
      });
      setIsAddingNew(false);
    } else if (editingId) {
      onUpdateServer(editingId, {
        name: formattedAddress,
        serverIp: formattedAddress,
        serverPort: serverPort.trim() || '25565',
        software,
        version: version.trim() || '1.20.4',
        sessionCookie: sessionCookie.trim(),
        serverCookie: serverCookie.trim(),
      });
      setEditingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Server className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                Server Profiles
              </h3>
              <p className="text-xs text-zinc-400">
                Switch and control multiple Minecraft servers with independent credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Action row */}
          {!isAddingNew && !editingId && (
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-mono text-zinc-400">
                {servers.length} {servers.length === 1 ? 'Server' : 'Servers'}
              </span>
              <button
                onClick={startCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-black bg-white hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Server</span>
              </button>
            </div>
          )}

          {/* Form (Add or Edit) */}
          {(isAddingNew || editingId) ? (
            <form onSubmit={handleSaveForm} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <span className="text-xs font-mono font-bold text-white">
                  {isAddingNew ? 'Create New Server' : 'Edit Server'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingId(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white font-mono cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Combined Server Address Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-bold text-zinc-200">
                    Server Address
                  </label>
                  {isDetecting ? (
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Auto-fetching from Aternos...
                    </span>
                  ) : detectedSuccess ? (
                    <span className="text-[11px] font-mono text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Auto-detected!
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Server className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={serverAddress}
                    onChange={e => setServerAddress(e.target.value)}
                    placeholder="e.g. server.aternos.me"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Unified address & display title. Auto-filled when entering session cookies below.
                </p>
              </div>

              {/* Cookies with Auto-Detect */}
              <div className="space-y-3 pt-1 border-t border-zinc-850">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-mono text-zinc-300">
                      ATERNOS_SESSION Cookie
                    </label>
                    {sessionCookie && (
                      <button
                        type="button"
                        onClick={() => handleAutoDetect()}
                        disabled={isDetecting}
                        className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-fetch Address</span>
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={sessionCookie}
                    onChange={e => handleSessionChange(e.target.value)}
                    placeholder="Paste ATERNOS_SESSION cookie to auto-fill address..."
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white break-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1">
                    ATERNOS_SERVER Cookie
                  </label>
                  <input
                    type="text"
                    value={serverCookie}
                    onChange={e => handleServerCookieChange(e.target.value)}
                    placeholder="e.g. ATobOAQ3Dq2guih6"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Extra Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-zinc-850">
                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    value={serverPort}
                    onChange={e => setServerPort(e.target.value)}
                    placeholder="25565"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1">
                    Software
                  </label>
                  <select
                    value={software}
                    onChange={e => setSoftware(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-white cursor-pointer"
                  >
                    {SOFTWARE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    placeholder="1.20.4"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-black bg-white hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
                >
                  {isAddingNew ? 'Save Server' : 'Update Server'}
                </button>
              </div>
            </form>
          ) : (
            /* Server list */
            <div className="space-y-2.5">
              {servers.map(server => {
                const isActive = server.id === activeServerId;
                const hasCookies = Boolean(server.sessionCookie && server.sessionCookie.trim());

                return (
                  <div
                    key={server.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-zinc-950 border-zinc-600 shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white font-mono">
                          {server.serverIp || server.name}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white text-black">
                            ACTIVE
                          </span>
                        )}
                        {!hasCookies && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            (No cookies set)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <span>Port {server.serverPort || '25565'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{server.software} {server.version}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => {
                            onSelectServer(server.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
                        >
                          Switch To
                        </button>
                      )}

                      <button
                        onClick={() => startEdit(server)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit server"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {servers.length > 1 && (
                        <button
                          onClick={() => onDeleteServer(server.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Delete server profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
