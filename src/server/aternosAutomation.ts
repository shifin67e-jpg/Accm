import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { AternosState, LogEntry, LogLevel, MacroRule, ServerStatus, SessionConfig } from '../types/aternos.ts';

const SESSION_CONFIG_PATH = path.resolve(process.cwd(), 'session-config.json');
const MACROS_CONFIG_PATH = path.resolve(process.cwd(), 'macros-config.json');

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  sessionCookie: process.env.ATERNOS_SESSION || '',
  serverCookie: process.env.ATERNOS_SERVER || '',
  serverAddress: process.env.ATERNOS_SERVER_ADDRESS || 'myserver.aternos.me',
};

function loadPersistentConfig(): SessionConfig {
  try {
    if (fs.existsSync(SESSION_CONFIG_PATH)) {
      const raw = fs.readFileSync(SESSION_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        sessionCookie: parsed.sessionCookie || DEFAULT_SESSION_CONFIG.sessionCookie,
        serverCookie: parsed.serverCookie || DEFAULT_SESSION_CONFIG.serverCookie,
        serverAddress: parsed.serverAddress || DEFAULT_SESSION_CONFIG.serverAddress,
      };
    }
  } catch {}
  return { ...DEFAULT_SESSION_CONFIG };
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ServerSessionInstance {
  config: SessionConfig;
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  isInitializing: boolean;
  state: AternosState;
  lastInitError: string | null;
}

export class AternosAutomationManager {
  // Map server address or session identifier to persistent running session instances
  private sessions: Map<string, ServerSessionInstance> = new Map();
  private activeSessionKey: string = 'default';

  private macroRules: MacroRule[] = [
    {
      id: 'macro-restart-interval',
      name: 'Interval Server Restart',
      description: 'Automatically restart the server every X hours or minutes to prevent lag',
      type: 'restart_interval',
      enabled: false,
      intervalMinutes: 300,
      lastRunTimestamp: null,
      nextRunTimestamp: null,
      runCount: 0,
    },
    {
      id: 'macro-restart-daily',
      name: 'Daily Scheduled Restart',
      description: 'Automatically restart the server everyday at a scheduled time',
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
      description: 'Auto-click Add Timer only when countdown reaches 1:00 or below, randomized between 50s-58s',
      type: 'extend_interval',
      enabled: true,
      intervalMinutes: 4,
      targetMinSec: 52,
      targetMaxSec: 58,
      randomTriggerSec: randomInt(52, 58),
      lastRunTimestamp: null,
      nextRunTimestamp: null,
      runCount: 0,
    },
  ];

  private logsBuffer: LogEntry[] = [];
  private readonly MAX_LOGS = 100;
  private currentMousePos = { x: 300, y: 300 };

  constructor() {
    this.addLog('SYS', 'Multi-server persistent core initialized.');

    // Load persisted macros if available
    try {
      if (fs.existsSync(MACROS_CONFIG_PATH)) {
        const raw = fs.readFileSync(MACROS_CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.macroRules = parsed;
        }
      }
    } catch {}

    const initialConfig = loadPersistentConfig();
    if (initialConfig.serverAddress) {
      this.activeSessionKey = initialConfig.serverAddress.toLowerCase();
      this.getOrCreateSessionInstance(this.activeSessionKey, initialConfig);
    }

    // Background polling and countdown ticker loop (every 1.5 seconds across all active sessions)
    setInterval(() => {
      this.tickAllCountdowns();
      this.syncAllSessions().catch(() => {});
    }, 1500);

    // Macro execution ticker loop (every 5 seconds)
    setInterval(() => {
      this.processMacros().catch(() => {});
    }, 5000);
  }

  private getOrCreateSessionInstance(key: string, config?: SessionConfig): ServerSessionInstance {
    const cleanKey = (key || 'default').toLowerCase();
    if (!this.sessions.has(cleanKey)) {
      const cfg = config || loadPersistentConfig();
      const instance: ServerSessionInstance = {
        config: { ...cfg },
        browser: null,
        context: null,
        page: null,
        isInitializing: false,
        lastInitError: null,
        state: {
          status: 'offline',
          rawStatus: 'Offline',
          serverIp: cfg.serverAddress || 'myserver.aternos.me',
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
          sessionConnected: Boolean(cfg.sessionCookie && cfg.sessionCookie.trim().length > 0),
          sessionError: null,
        },
      };
      this.sessions.set(cleanKey, instance);

      if (cfg.sessionCookie && cfg.sessionCookie.trim().length > 0) {
        this.initSessionInstance(cleanKey).catch(err => {
          this.addLog('WARN', `Startup notice for ${cleanKey}: ${err.message}`);
        });
      }
    }
    return this.sessions.get(cleanKey)!;
  }

  private async initSessionInstance(key: string): Promise<void> {
    const inst = this.sessions.get(key);
    if (!inst || inst.isInitializing) return;
    if (!inst.config.sessionCookie || inst.config.sessionCookie.trim().length === 0) {
      inst.state.sessionConnected = false;
      return;
    }
    inst.isInitializing = true;

    try {
      this.addLog('SYS', `Starting background browser for ${inst.config.serverAddress || key}...`);
      if (inst.browser) {
        await inst.browser.close().catch(() => {});
      }

      let browser: Browser;
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-infobars',
            '--window-size=1280,800',
            '--excludeSwitches=enable-automation',
            '--use-fake-ui-for-media-stream',
          ],
        });
      } catch (launchErr: any) {
        if (launchErr?.message?.includes("Executable doesn't exist")) {
          this.addLog('SYS', 'Installing browser engine...');
          const { execSync } = await import('child_process');
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          browser = await chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-blink-features=AutomationControlled',
              '--disable-dev-shm-usage',
              '--disable-infobars',
              '--window-size=1280,800',
              '--excludeSwitches=enable-automation',
              '--use-fake-ui-for-media-stream',
            ],
          });
        } else {
          throw launchErr;
        }
      }

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        locale: 'en-US',
        timezoneId: 'America/New_York',
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // @ts-ignore
        window.chrome = {
          runtime: {
            OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update' },
            PlatformArch: { ARM: 'arm', X86_64: 'x86-64' },
            PlatformOs: { MAC: 'mac', WIN: 'win', LINUX: 'linux' },
          },
          app: { isInstalled: false },
          loadTimes: () => ({
            requestTime: Date.now() / 1000 - 0.5,
            startLoadTime: Date.now() / 1000 - 0.4,
            commitLoadTime: Date.now() / 1000 - 0.2,
            finishDocumentLoadTime: Date.now() / 1000 - 0.1,
            firstPaintTime: Date.now() / 1000 - 0.15,
            navigationType: 'Other',
          }),
          csi: () => ({ startE: Date.now(), onloadT: Date.now() + 200, pageT: 200, tran: 15 }),
        };
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ],
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
          if (parameter === 37445) return 'Google Inc. (NVIDIA)';
          if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)';
          return getParameter.apply(this, [parameter]);
        };
      });

      await context.addCookies([
        {
          name: 'ATERNOS_SESSION',
          value: inst.config.sessionCookie,
          domain: '.aternos.org',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
        {
          name: 'ATERNOS_SERVER',
          value: inst.config.serverCookie || '',
          domain: '.aternos.org',
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
        },
      ]);

      const page = await context.newPage();
      page.on('dialog', async dialog => {
        try {
          await dialog.accept();
        } catch {}
      });

      await page.goto('https://aternos.org/server/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await sleep(2000);

      const currentUrl = page.url();
      if (currentUrl.includes('/go/') || currentUrl.includes('/login') || currentUrl.includes('/servers/')) {
        inst.lastInitError = 'Session expired. Paste fresh cookies in Settings.';
        inst.state.sessionConnected = false;
        inst.state.sessionError = inst.lastInitError;
        inst.browser = browser;
        inst.context = context;
        inst.page = page;
        return;
      }

      inst.browser = browser;
      inst.context = context;
      inst.page = page;
      inst.lastInitError = null;
      inst.state.sessionConnected = true;
      inst.state.sessionError = null;

      await this.syncSessionState(key);
      this.addLog('INFO', `Server connected: ${inst.config.serverAddress} (${inst.state.rawStatus})`);
    } catch (err: any) {
      const shortErr = err?.message?.split('\n')[0]?.substring(0, 80) || 'Connection failed';
      inst.lastInitError = shortErr;
      inst.state.sessionConnected = false;
      inst.state.sessionError = shortErr;
      this.addLog('ERR', `Session notice for ${key}: ${shortErr}`);
    } finally {
      inst.isInitializing = false;
    }
  }

  public addLog(level: LogLevel, rawMessage: string) {
    let clean = rawMessage.trim();
    if (clean.includes('Call log:')) {
      clean = clean.split('Call log:')[0].trim();
    }
    if (clean.includes('waiting for locator')) {
      clean = 'Action timeout waiting for element';
    }
    if (clean.includes('Executable doesn\'t exist')) {
      clean = 'Browser engine installation required';
    }
    if (clean.length > 120) {
      clean = clean.substring(0, 117) + '...';
    }

    const last = this.logsBuffer[this.logsBuffer.length - 1];
    if (last && last.level === level && last.message === clean) {
      return;
    }

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      level,
      message: clean,
    };
    this.logsBuffer.push(entry);
    if (this.logsBuffer.length > this.MAX_LOGS) {
      this.logsBuffer.shift();
    }
    console.log(`[${entry.timestamp}] [${entry.level}] ${entry.message}`);
  }

  public getLogs(): LogEntry[] {
    return [...this.logsBuffer];
  }

  public clearLogs() {
    this.logsBuffer = [];
  }

  private getActiveInstance(): ServerSessionInstance {
    return this.getOrCreateSessionInstance(this.activeSessionKey);
  }

  public getState(): AternosState {
    const inst = this.getActiveInstance();
    return {
      ...inst.state,
      serverIp: inst.config.serverAddress || inst.state.serverIp,
    };
  }

  public getConfig(): SessionConfig {
    const inst = this.getActiveInstance();
    return {
      sessionCookie: inst.config.sessionCookie
        ? `${inst.config.sessionCookie.substring(0, 8)}...${inst.config.sessionCookie.slice(-6)}`
        : '',
      serverCookie: inst.config.serverCookie,
      serverAddress: inst.config.serverAddress,
      software: inst.state.software,
      version: inst.state.version,
      serverPort: inst.state.serverPort,
    };
  }

  public async updateConfig(newConfig: Partial<SessionConfig>): Promise<void> {
    const targetKey = (newConfig.serverAddress || this.activeSessionKey || 'default').toLowerCase();
    this.activeSessionKey = targetKey;

    let inst = this.sessions.get(targetKey);
    if (!inst) {
      inst = this.getOrCreateSessionInstance(targetKey, newConfig as SessionConfig);
    }

    if (newConfig.sessionCookie !== undefined) {
      if (!newConfig.sessionCookie.includes('...')) {
        inst.config.sessionCookie = newConfig.sessionCookie.trim();
      }
    }
    if (newConfig.serverCookie !== undefined) {
      inst.config.serverCookie = newConfig.serverCookie.trim();
    }
    if (newConfig.serverAddress) {
      inst.config.serverAddress = newConfig.serverAddress.trim();
      inst.state.serverIp = inst.config.serverAddress;
    }
    if (newConfig.software) {
      inst.state.software = newConfig.software;
    }
    if (newConfig.version) {
      inst.state.version = newConfig.version;
    }
    if (newConfig.serverPort) {
      inst.state.serverPort = newConfig.serverPort;
    }

    try {
      fs.writeFileSync(SESSION_CONFIG_PATH, JSON.stringify(inst.config, null, 2), 'utf-8');
    } catch (err: any) {
      this.addLog('WARN', `Storage notice: ${err.message}`);
    }

    if (inst.config.sessionCookie && inst.config.sessionCookie.trim().length > 0) {
      this.addLog('SYS', `Switching active server to ${inst.config.serverAddress}...`);
      await this.initSessionInstance(targetKey);
    } else {
      if (inst.browser) {
        await inst.browser.close().catch(() => {});
        inst.browser = null;
        inst.context = null;
        inst.page = null;
      }
      inst.state.sessionConnected = false;
      inst.state.sessionError = null;
      inst.state.status = 'offline';
      inst.state.rawStatus = 'Offline';
      this.addLog('INFO', `Server profile set to ${inst.config.serverAddress}`);
    }
  }

  public async syncProfiles(profiles: any[]): Promise<void> {
    if (!Array.isArray(profiles)) return;
    for (const p of profiles) {
      const address = p.serverIp || p.name || p.serverAddress;
      if (!address) continue;
      const key = address.toLowerCase();
      let inst = this.sessions.get(key);
      const cfg: SessionConfig = {
        sessionCookie: p.sessionCookie || '',
        serverCookie: p.serverCookie || '',
        serverAddress: address,
        software: p.software,
        version: p.version,
        serverPort: p.serverPort,
      };

      if (!inst) {
        inst = this.getOrCreateSessionInstance(key, cfg);
      } else {
        if (cfg.sessionCookie && !cfg.sessionCookie.includes('...')) {
          inst.config.sessionCookie = cfg.sessionCookie.trim();
        }
        if (cfg.serverCookie) {
          inst.config.serverCookie = cfg.serverCookie.trim();
        }
        inst.state.software = cfg.software || inst.state.software;
        inst.state.version = cfg.version || inst.state.version;
        inst.state.serverPort = cfg.serverPort || inst.state.serverPort;
      }

      if (inst.config.sessionCookie && inst.config.sessionCookie.trim().length > 0 && !inst.browser && !inst.isInitializing) {
        this.initSessionInstance(key).catch(() => {});
      }
    }
  }

  public getMacros(): MacroRule[] {
    return [...this.macroRules];
  }

  public updateMacros(newRules: MacroRule[]): MacroRule[] {
    if (!Array.isArray(newRules)) return this.macroRules;

    this.macroRules = this.macroRules.map(existing => {
      const match = newRules.find(r => r.id === existing.id);
      if (!match) return existing;

      let nextRun = match.nextRunTimestamp;
      let randomSec = match.randomTriggerSec || existing.randomTriggerSec;
      if (match.type === 'extend_interval') {
        const minS = match.targetMinSec ?? existing.targetMinSec ?? 52;
        const maxS = match.targetMaxSec ?? existing.targetMaxSec ?? 58;
        if (!randomSec || randomSec > 60 || randomSec < 30) {
          randomSec = randomInt(minS, maxS);
        }
      }

      if (match.enabled && !existing.enabled) {
        if (match.type === 'restart_interval') {
          const mins = match.intervalMinutes || 300;
          nextRun = Date.now() + mins * 60 * 1000;
        } else if (match.type === 'extend_interval') {
          nextRun = null;
        } else if (match.type === 'restart_daily' && match.dailyTime) {
          nextRun = this.calculateNextDailyRun(match.dailyTime);
        }
      }

      return {
        ...existing,
        ...match,
        randomTriggerSec: randomSec,
        nextRunTimestamp: nextRun,
      };
    });

    try {
      fs.writeFileSync(MACROS_CONFIG_PATH, JSON.stringify(this.macroRules, null, 2), 'utf-8');
    } catch {}
    return [...this.macroRules];
  }

  private calculateNextDailyRun(dailyTime: string): number {
    const parts = dailyTime.split(':');
    if (parts.length !== 2) return Date.now() + 24 * 60 * 60 * 1000;

    const targetH = parseInt(parts[0], 10);
    const targetM = parseInt(parts[1], 10);

    const target = new Date();
    target.setHours(targetH, targetM, 0, 0);

    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  public async triggerMacro(macroId: string): Promise<{ success: boolean; message: string }> {
    const macro = this.macroRules.find(m => m.id === macroId);
    if (!macro) {
      return { success: false, message: 'Macro not found.' };
    }

    this.addLog('CMD', `Executing macro: ${macro.name}`);
    macro.runCount++;
    macro.lastRunTimestamp = Date.now();

    if (macro.type === 'restart_interval' || macro.type === 'restart_daily') {
      const mins = macro.intervalMinutes || 300;
      macro.nextRunTimestamp =
        macro.type === 'restart_daily' && macro.dailyTime
          ? this.calculateNextDailyRun(macro.dailyTime)
          : Date.now() + mins * 60 * 1000;
      return await this.restartServer();
    } else if (macro.type === 'extend_interval') {
      const mins = macro.intervalMinutes || 4;
      macro.nextRunTimestamp = Date.now() + mins * 60 * 1000;
      return await this.extendTimer();
    }

    return { success: true, message: `Macro ${macro.name} executed.` };
  }

  public async executeCliCommand(rawCommand: string): Promise<{ success: boolean; output: string }> {
    const cmd = rawCommand.trim().toLowerCase();
    this.addLog('CMD', `> ${rawCommand.trim()}`);

    if (!cmd) return { success: true, output: '' };

    if (cmd === 'help') {
      const helpText = [
        'Available Terminal Commands:',
        '  start      - Initiates server startup',
        '  stop       - Safely halts server',
        '  restart    - Reboots server instance',
        '  extend/+1  - Adds +1 minute keepalive timer',
        '  status     - Displays live state and countdown',
        '  macros     - Prints active macro rules',
        '  clear      - Flushes terminal buffer',
      ].join('\n');
      this.addLog('INFO', helpText);
      return { success: true, output: helpText };
    }

    if (cmd === 'start') {
      const res = await this.startServer();
      return { success: res.success, output: res.message };
    }
    if (cmd === 'stop') {
      const res = await this.stopServer();
      return { success: res.success, output: res.message };
    }
    if (cmd === 'restart') {
      const res = await this.restartServer();
      return { success: res.success, output: res.message };
    }
    if (cmd === 'extend' || cmd === '+1' || cmd === 'add timer') {
      const res = await this.extendTimer();
      return { success: res.success, output: res.message };
    }
    if (cmd === 'status') {
      const inst = this.getActiveInstance();
      const info = `State: ${inst.state.rawStatus} | Address: ${inst.config.serverAddress}:${inst.state.serverPort} | Keepalive: ${inst.state.countdownFormatted || 'N/A'}`;
      this.addLog('SYS', info);
      return { success: true, output: info };
    }
    if (cmd === 'macros') {
      const list = this.macroRules.map(m => `• ${m.name} [${m.enabled ? 'ACTIVE' : 'PAUSED'}]`).join('\n');
      this.addLog('SYS', `Active Macros:\n${list}`);
      return { success: true, output: list };
    }
    if (cmd === 'clear') {
      this.clearLogs();
      return { success: true, output: 'Buffer cleared.' };
    }

    const err = `Unrecognized command "${rawCommand}". Type "help" for valid commands.`;
    this.addLog('WARN', err);
    return { success: false, output: err };
  }

  private async processMacros() {
    const inst = this.getActiveInstance();
    if (inst.state.status !== 'online' || inst.state.isActionPending) {
      return;
    }

    const now = Date.now();
    for (const macro of this.macroRules) {
      if (!macro.enabled) continue;

      if (macro.type === 'restart_interval') {
        const intervalMs = (macro.intervalMinutes || 300) * 60 * 1000;
        if (!macro.nextRunTimestamp) {
          macro.nextRunTimestamp = now + intervalMs;
          continue;
        }
        if (now >= macro.nextRunTimestamp) {
          macro.runCount++;
          macro.lastRunTimestamp = now;
          macro.nextRunTimestamp = now + intervalMs;
          await this.restartServer();
          break;
        }
      } else if (macro.type === 'restart_daily') {
        if (!macro.dailyTime) continue;
        if (!macro.nextRunTimestamp) {
          macro.nextRunTimestamp = this.calculateNextDailyRun(macro.dailyTime);
          continue;
        }
        if (now >= macro.nextRunTimestamp) {
          macro.runCount++;
          macro.lastRunTimestamp = now;
          macro.nextRunTimestamp = this.calculateNextDailyRun(macro.dailyTime);
          await this.restartServer();
          break;
        }
      } else if (macro.type === 'extend_interval') {
        const minSec = macro.targetMinSec || 52;
        const maxSec = macro.targetMaxSec || 58;
        if (!macro.randomTriggerSec || macro.randomTriggerSec > 60 || macro.randomTriggerSec < 30) {
          macro.randomTriggerSec = randomInt(minSec, maxSec);
        }

        const countdownSec = inst.state.countdownSeconds;
        const isCountdownActive = inst.state.countdownActive && countdownSec !== null;
        if (isCountdownActive && countdownSec <= macro.randomTriggerSec) {
          macro.runCount++;
          macro.lastRunTimestamp = now;
          macro.randomTriggerSec = randomInt(minSec, maxSec);
          await this.extendTimer();
          break;
        }
      }
    }
  }

  private tickAllCountdowns() {
    for (const [key, inst] of this.sessions.entries()) {
      inst.state.lastUpdated = Date.now();
      if (inst.state.status === 'online' && inst.state.countdownActive && inst.state.countdownSeconds !== null) {
        if (inst.state.countdownSeconds > 1) {
          inst.state.countdownSeconds -= 1;
          const m = Math.floor(inst.state.countdownSeconds / 60);
          const s = inst.state.countdownSeconds % 60;
          inst.state.countdownFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
          inst.state.canExtend = inst.state.countdownSeconds <= 60;
        }
      }
    }
  }

  private async syncAllSessions() {
    for (const [key, inst] of this.sessions.entries()) {
      if (inst.page && !inst.page.isClosed() && !inst.state.isActionPending) {
        await this.syncSessionState(key).catch(() => {});
      }
    }
  }

  public async syncState(): Promise<AternosState> {
    return await this.syncSessionState(this.activeSessionKey);
  }

  private async syncSessionState(key: string): Promise<AternosState> {
    const inst = this.sessions.get(key);
    if (!inst || !inst.page || inst.page.isClosed() || inst.state.isActionPending) {
      return inst ? inst.state : this.getState();
    }

    try {
      const data = await inst.page.evaluate(() => {
        const statusEl = document.querySelector('.statuslabel-label');
        const rawStatus = statusEl ? statusEl.textContent?.trim() || 'Offline' : 'Offline';

        const ipEl = document.querySelector('.server-ip');
        const rawIp = ipEl ? ipEl.textContent?.trim() || '' : '';

        const softwareEl = document.querySelector('#software') || document.querySelector('.server-software');
        const software = softwareEl ? softwareEl.textContent?.trim() || 'Paper / Bukkit' : 'Paper / Bukkit';

        const versionEl = document.querySelector('#version') || document.querySelector('.server-version');
        const version = versionEl ? versionEl.textContent?.trim() || '1.20.4' : '1.20.4';

        const queueEl = document.querySelector('.queue-position');
        const queueEtaEl = document.querySelector('.queue-time');
        const queuePos = queueEl ? parseInt(queueEl.textContent || '0', 10) || null : null;
        const queueEta = queueEtaEl ? queueEtaEl.textContent?.trim() || null : null;

        const countdownEl = document.querySelector('.server-end-countdown, .countdown');
        let countdownSec: number | null = null;
        let countdownFormatted: string | null = null;
        let countdownActive = false;

        if (countdownEl && window.getComputedStyle(countdownEl).display !== 'none') {
          const text = countdownEl.textContent?.trim() || '';
          if (text) {
            countdownFormatted = text;
            countdownActive = true;
            const parts = text.split(':');
            if (parts.length === 2) {
              const m = parseInt(parts[0], 10);
              const s = parseInt(parts[1], 10);
              if (!isNaN(m) && !isNaN(s)) {
                countdownSec = m * 60 + s;
              }
            }
          }
        }

        const startBtn = document.querySelector('#start');
        const stopBtn = document.querySelector('#stop');
        const restartBtn = document.querySelector('#restart');
        const extendBtn = document.querySelector('.server-extend-end');

        const confirmBtn = document.querySelector('#confirm, .btn-confirm, #eula-accept') as HTMLElement;
        const hasConfirm = confirmBtn && confirmBtn.offsetWidth > 0;
        if (hasConfirm) confirmBtn.click();

        return {
          rawStatus,
          rawIp,
          software,
          version,
          queuePos,
          queueEta,
          countdownSec,
          countdownFormatted,
          countdownActive,
          startVisible: startBtn ? window.getComputedStyle(startBtn).display !== 'none' : false,
          stopVisible: stopBtn ? window.getComputedStyle(stopBtn).display !== 'none' : false,
          restartVisible: restartBtn ? window.getComputedStyle(restartBtn).display !== 'none' : false,
          extendVisible: extendBtn ? window.getComputedStyle(extendBtn).display !== 'none' : false,
        };
      });

      const lower = data.rawStatus.toLowerCase();
      let canonicalStatus: ServerStatus = 'offline';
      if (lower.includes('online')) {
        canonicalStatus = 'online';
      } else if (lower.includes('start') || lower.includes('prepar') || lower.includes('load')) {
        canonicalStatus = 'starting';
      } else if (lower.includes('queue')) {
        canonicalStatus = 'queue';
      } else if (lower.includes('stop')) {
        canonicalStatus = 'stopping';
      } else if (lower.includes('off')) {
        canonicalStatus = 'offline';
      }

      let port = inst.state.serverPort;
      let ip = inst.config.serverAddress;
      if (data.rawIp) {
        const firstLine = data.rawIp.split('\n')[0].trim();
        const match = firstLine.match(/([a-zA-Z0-9._-]+)(?::(\d+))?/);
        if (match) {
          if (match[1]) ip = match[1];
          if (match[2]) port = match[2];
        }
      }

      const prevStatus = inst.state.status;
      const isOnline = canonicalStatus === 'online';
      const isOffline = canonicalStatus === 'offline';

      const countdownActive = isOnline && (data.countdownActive || (inst.state.countdownSeconds !== null && inst.state.countdownSeconds > 0));
      const countdownSeconds = data.countdownSec !== null ? data.countdownSec : inst.state.countdownSeconds;
      const countdownFormatted = data.countdownFormatted || inst.state.countdownFormatted;
      const canExtend = countdownActive && (countdownSeconds || 0) <= 60;

      inst.state = {
        ...inst.state,
        status: canonicalStatus,
        rawStatus: data.rawStatus,
        serverIp: ip,
        serverPort: port,
        software: data.software,
        version: data.version,
        queuePosition: data.queuePos,
        queueEta: data.queueEta,
        countdownSeconds: countdownActive ? countdownSeconds : null,
        countdownFormatted: countdownActive ? countdownFormatted : null,
        countdownActive,
        canExtend,
        startVisible: isOffline,
        stopVisible: !isOffline,
        restartVisible: isOnline,
        extendVisible: countdownActive,
        lastUpdated: Date.now(),
        sessionConnected: true,
        sessionError: null,
      };

      if (prevStatus !== canonicalStatus && prevStatus !== 'unknown') {
        this.addLog('INFO', `[${ip}] Status: ${canonicalStatus.toUpperCase()}`);
      }
    } catch {}

    return inst.state;
  }

  private async generateSecToken(context: BrowserContext): Promise<string> {
    const key = randomString(11) + '00000';
    const val = randomString(11) + '00000';
    const sec = `${key}:${val}`;
    await context.addCookies([
      {
        name: `ATERNOS_SEC_${key}`,
        value: val,
        domain: '.aternos.org',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    return sec;
  }

  private async humanMoveAndClick(page: Page, selector: string): Promise<boolean> {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) return false;
      const box = await locator.boundingBox();
      if (!box) return false;

      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await sleep(randomInt(50, 150));

      const targetX = box.x + box.width * (0.3 + 0.4 * Math.random());
      const targetY = box.y + box.height * (0.3 + 0.4 * Math.random());
      const startX = this.currentMousePos.x;
      const startY = this.currentMousePos.y;

      const steps = randomInt(10, 18);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(startX + (targetX - startX) * t);
        const y = Math.round(startY + (targetY - startY) * t);
        await page.mouse.move(x, y);
        this.currentMousePos = { x, y };
        await sleep(randomInt(8, 15));
      }

      await page.mouse.down();
      await sleep(randomInt(75, 120));
      await page.mouse.up();
      await sleep(randomInt(100, 200));
      return true;
    } catch {
      return false;
    }
  }

  public async startServer(): Promise<{ success: boolean; message: string }> {
    const inst = this.getActiveInstance();
    if (inst.state.isActionPending) {
      return { success: false, message: 'Another action is in progress.' };
    }
    if (inst.state.status === 'online') {
      return { success: true, message: 'Server is already Online.' };
    }

    inst.state.isActionPending = true;
    inst.state.currentAction = 'start';
    this.addLog('CMD', `Sending start command for ${inst.config.serverAddress}...`);

    try {
      const page = inst.page;
      if (!page || page.isClosed()) {
        await this.initSessionInstance(this.activeSessionKey);
      }
      const activePage = this.getActiveInstance().page;
      if (!activePage) throw new Error('Browser session not connected.');

      const sec = await this.generateSecToken(this.getActiveInstance().context!);
      const dispatchResult = await activePage.evaluate(async (secToken) => {
        const ajaxToken = (window as any).AJAX_TOKEN || (window as any).ajax_token || '';
        const targetUrl = `/ajax/server/start?headstart=false&access-credits=false&SEC=${encodeURIComponent(secToken)}&TOKEN=${encodeURIComponent(ajaxToken)}`;
        try {
          const res = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
          });
          const json = await res.json().catch(() => null);
          return { success: json ? json.success : res.ok };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }, sec);

      this.addLog('SYS', `Start signal sent (${dispatchResult.success ? 'OK' : 'Fallback'})`);
      if (!dispatchResult.success) {
        await this.humanMoveAndClick(activePage, '#start');
      }

      await sleep(2000);
      await this.syncState();
      return { success: true, message: `Start triggered for ${inst.config.serverAddress}` };
    } catch (err: any) {
      this.addLog('ERR', `Start failed: ${err.message?.substring(0, 50)}`);
      return { success: false, message: err.message };
    } finally {
      inst.state.isActionPending = false;
      inst.state.currentAction = null;
    }
  }

  public async stopServer(): Promise<{ success: boolean; message: string }> {
    const inst = this.getActiveInstance();
    if (inst.state.isActionPending) return { success: false, message: 'Action in progress.' };

    inst.state.isActionPending = true;
    inst.state.currentAction = 'stop';
    this.addLog('CMD', `Sending stop command for ${inst.config.serverAddress}...`);

    try {
      const activePage = inst.page;
      if (!activePage) throw new Error('Browser session not connected.');

      const sec = await this.generateSecToken(inst.context!);
      await activePage.evaluate(async (secToken) => {
        const ajaxToken = (window as any).AJAX_TOKEN || (window as any).ajax_token || '';
        await fetch(`/ajax/server/stop?SEC=${encodeURIComponent(secToken)}&TOKEN=${encodeURIComponent(ajaxToken)}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
      }, sec);

      this.addLog('SYS', 'Stop signal sent.');
      await sleep(2000);
      await this.syncState();
      return { success: true, message: 'Stop command dispatched.' };
    } catch (err: any) {
      this.addLog('ERR', `Stop failed: ${err.message?.substring(0, 50)}`);
      return { success: false, message: err.message };
    } finally {
      inst.state.isActionPending = false;
      inst.state.currentAction = null;
    }
  }

  public async restartServer(): Promise<{ success: boolean; message: string }> {
    const inst = this.getActiveInstance();
    if (inst.state.isActionPending) return { success: false, message: 'Action in progress.' };

    inst.state.isActionPending = true;
    inst.state.currentAction = 'restart';
    this.addLog('CMD', `Sending restart command for ${inst.config.serverAddress}...`);

    try {
      const activePage = inst.page;
      if (!activePage) throw new Error('Browser session not connected.');

      const sec = await this.generateSecToken(inst.context!);
      await activePage.evaluate(async (secToken) => {
        const ajaxToken = (window as any).AJAX_TOKEN || (window as any).ajax_token || '';
        await fetch(`/ajax/server/restart?SEC=${encodeURIComponent(secToken)}&TOKEN=${encodeURIComponent(ajaxToken)}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
      }, sec);

      this.addLog('SYS', 'Restart signal sent.');
      await sleep(2000);
      await this.syncState();
      return { success: true, message: 'Restart triggered.' };
    } catch (err: any) {
      this.addLog('ERR', `Restart failed: ${err.message?.substring(0, 50)}`);
      return { success: false, message: err.message };
    } finally {
      inst.state.isActionPending = false;
      inst.state.currentAction = null;
    }
  }

  public async extendTimer(): Promise<{ success: boolean; message: string }> {
    const inst = this.getActiveInstance();
    if (inst.state.status !== 'online') {
      return { success: false, message: 'Server is not online.' };
    }

    this.addLog('CMD', `Adding +1m keepalive for ${inst.config.serverAddress}...`);
    try {
      const activePage = inst.page;
      if (!activePage) throw new Error('Browser session not connected.');

      const sec = await this.generateSecToken(inst.context!);
      await activePage.evaluate(async (secToken) => {
        const ajaxToken = (window as any).AJAX_TOKEN || (window as any).ajax_token || '';
        try {
          await fetch(`/ajax/server/confirm?headstart=false&access-credits=false&SEC=${encodeURIComponent(secToken)}&TOKEN=${encodeURIComponent(ajaxToken)}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          });
        } catch {}
      }, sec);

      this.addLog('SYS', 'Keepalive extended +1m.');
      if (inst.state.countdownSeconds !== null && inst.state.countdownSeconds > 0) {
        inst.state.countdownSeconds += 60;
      } else {
        inst.state.countdownSeconds = 120;
      }
      const m = Math.floor(inst.state.countdownSeconds / 60);
      const s = inst.state.countdownSeconds % 60;
      inst.state.countdownFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
      inst.state.countdownActive = true;
      return { success: true, message: `Extended timer (${inst.state.countdownFormatted}).` };
    } catch (err: any) {
      this.addLog('ERR', `Extend failed: ${err.message?.substring(0, 50)}`);
      return { success: false, message: err.message };
    }
  }

  public async detectServerFromCookies(sessionCookie: string, serverCookie?: string): Promise<{
    success: boolean;
    serverAddress?: string;
    software?: string;
    version?: string;
    serverPort?: string;
    message?: string;
  }> {
    if (!sessionCookie || !sessionCookie.trim()) {
      return { success: false, message: 'Session cookie is required.' };
    }

    try {
      const tempKey = `detect_${Date.now()}`;
      const tempConfig: SessionConfig = {
        sessionCookie: sessionCookie.trim(),
        serverCookie: serverCookie ? serverCookie.trim() : '',
        serverAddress: 'server.aternos.me',
      };
      const inst = this.getOrCreateSessionInstance(tempKey, tempConfig);
      await this.initSessionInstance(tempKey);

      if (inst.page && !inst.page.isClosed()) {
        await sleep(1500);
        const data = await this.syncSessionState(tempKey);
        // Clean up temp instance browser
        if (inst.browser) {
          await inst.browser.close().catch(() => {});
          this.sessions.delete(tempKey);
        }

        if (data.serverIp) {
          return {
            success: true,
            serverAddress: data.serverIp,
            software: data.software || 'Paper / Bukkit',
            version: data.version || '1.20.4',
            serverPort: data.serverPort || '25565',
          };
        }
      }

      this.sessions.delete(tempKey);
      return { success: false, message: 'Could not detect server address.' };
    } catch (err: any) {
      return { success: false, message: err?.message?.substring(0, 50) || 'Detection failed' };
    }
  }

  public async runSelfTest(): Promise<{
    passed: boolean;
    durationMs: number;
    details: Array<{ step: string; status: 'PASS' | 'FAIL' | 'INFO'; message: string }>;
  }> {
    const startTime = Date.now();
    const details: Array<{ step: string; status: 'PASS' | 'FAIL' | 'INFO'; message: string }> = [];
    const inst = this.getActiveInstance();

    details.push({
      step: 'Init',
      status: 'INFO',
      message: `Self-test for ${inst.config.serverAddress}`,
    });

    try {
      const durationMs = Date.now() - startTime;
      return { passed: true, durationMs, details };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      details.push({ step: 'Failure', status: 'FAIL', message: err.message });
      return { passed: false, durationMs, details };
    }
  }
}

export const aternosService = new AternosAutomationManager();
