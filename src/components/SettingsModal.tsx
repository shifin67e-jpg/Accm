import React, { useState, useEffect } from 'react';
import { X, Key, Server, Save, RotateCcw, Eye, EyeOff, ShieldCheck, Loader2, Check, Sparkles } from 'lucide-react';
import type { SessionConfig } from '../types/aternos.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Partial<SessionConfig>) => Promise<void>;
  currentConfig: SessionConfig;
  serverName?: string;
}

const DEFAULT_SESSION = '';
const DEFAULT_SERVER = '';
const DEFAULT_ADDRESS = 'myserver.aternos.me';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  serverName = 'Active Server',
}) => {
  const [sessionCookie, setSessionCookie] = useState('');
  const [serverCookie, setServerCookie] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [showSession, setShowSession] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedSuccess, setDetectedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSessionCookie(currentConfig.sessionCookie || DEFAULT_SESSION);
      setServerCookie(currentConfig.serverCookie || DEFAULT_SERVER);
      setServerAddress(currentConfig.serverAddress || DEFAULT_ADDRESS);
      setDetectedSuccess(false);
    }
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setSessionCookie(DEFAULT_SESSION);
    setServerCookie(DEFAULT_SERVER);
    setServerAddress(DEFAULT_ADDRESS);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        sessionCookie,
        serverCookie,
        serverAddress,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                Aternos Session Authentication
              </h3>
              <p className="text-xs text-zinc-400">
                Configure credentials for {serverName}
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

        {/* Security Notice & Instructions */}
        <div className="mt-4 space-y-2">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400 leading-relaxed">
              When you paste your session cookies below, your server address is automatically fetched from Aternos.
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* ATERNOS_SESSION */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-bold text-zinc-200">
                ATERNOS_SESSION Cookie
              </label>
              <button
                type="button"
                onClick={() => setShowSession(!showSession)}
                className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {showSession ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Reveal
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={sessionCookie}
              onChange={e => handleSessionChange(e.target.value)}
              placeholder="Paste your ATERNOS_SESSION cookie here..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors break-all"
              required
            />
          </div>

          {/* ATERNOS_SERVER */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-bold text-zinc-200">
                ATERNOS_SERVER Cookie
              </label>
              {sessionCookie && (
                <button
                  type="button"
                  onClick={() => handleAutoDetect()}
                  disabled={isDetecting}
                  className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching server...
                    </>
                  ) : detectedSuccess ? (
                    <>
                      <Check className="w-3 h-3 text-white" /> Fetched!
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" /> Auto-fetch address
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="text"
              value={serverCookie}
              onChange={e => handleServerCookieChange(e.target.value)}
              placeholder="e.g. ATobOAQ3Dq2guih6"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
              required
            />
          </div>

          {/* Combined Display & Server Address Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-bold text-zinc-200">
                Server Address
              </label>
              {detectedSuccess && (
                <span className="text-[10px] font-mono text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  Auto-detected from Aternos
                </span>
              )}
            </div>
            <div className="relative">
              <Server className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={serverAddress}
                onChange={e => setServerAddress(e.target.value)}
                placeholder="e.g. server.aternos.me"
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                required
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 font-mono">
              Auto-filled as your server.aternos address when cookies are entered.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-black text-black bg-white hover:bg-zinc-200 transition-colors shadow-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Connecting...' : 'Save & Reconnect'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
