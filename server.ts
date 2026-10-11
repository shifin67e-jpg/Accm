import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { aternosService } from './src/server/aternosAutomation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.get('/api/status', async (req, res) => {
    try {
      if (Date.now() - aternosService.getState().lastUpdated > 1000) {
        await aternosService.syncState();
      }
    } catch {
      // fallback
    }
    res.json(aternosService.getState());
  });

  app.get('/api/logs', (req, res) => {
    res.json(aternosService.getLogs());
  });

  app.delete('/api/logs', (req, res) => {
    aternosService.clearLogs();
    res.json({ success: true, message: 'Logs cleared.' });
  });

  app.post('/api/action/start', async (req, res) => {
    const result = await aternosService.startServer();
    res.json(result);
  });

  app.post('/api/action/stop', async (req, res) => {
    const result = await aternosService.stopServer();
    res.json(result);
  });

  app.post('/api/action/restart', async (req, res) => {
    const result = await aternosService.restartServer();
    res.json(result);
  });

  app.post('/api/action/extend', async (req, res) => {
    const result = await aternosService.extendTimer();
    res.json(result);
  });

  app.post('/api/action/test-start', async (req, res) => {
    const result = await aternosService.runSelfTest();
    res.json(result);
  });

  app.get('/api/macros', (req, res) => {
    res.json(aternosService.getMacros());
  });

  app.post('/api/macros', (req, res) => {
    const { rules } = req.body || {};
    const updated = aternosService.updateMacros(rules);
    res.json(updated);
  });

  app.post('/api/macros/trigger/:id', async (req, res) => {
    const result = await aternosService.triggerMacro(req.params.id);
    res.json(result);
  });

  app.post('/api/action/command', async (req, res) => {
    const { command } = req.body || {};
    const result = await aternosService.executeCliCommand(command || '');
    res.json(result);
  });

  app.get('/api/config', (req, res) => {
    res.json(aternosService.getConfig());
  });

  app.post('/api/config', async (req, res) => {
    const { sessionCookie, serverCookie, serverAddress, software, version, serverPort } = req.body || {};
    await aternosService.updateConfig({ sessionCookie, serverCookie, serverAddress, software, version, serverPort });
    res.json({ success: true, message: 'Settings updated successfully.' });
  });

  app.post('/api/servers/sync', async (req, res) => {
    const { servers } = req.body || {};
    await aternosService.syncProfiles(servers);
    res.json({ success: true });
  });

  app.post('/api/server/detect', async (req, res) => {
    const { sessionCookie, serverCookie } = req.body || {};
    const result = await aternosService.detectServerFromCookies(sessionCookie, serverCookie);
    res.json(result);
  });

  // Vite Integration
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aternos Command Center] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});
