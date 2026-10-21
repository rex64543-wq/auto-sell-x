const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

function startDashboard(client, port = process.env.PORT || 3000) {
  const listenPort = parseInt(process.env.PORT || port, 10) || 3000;
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Prevent browser caching of dashboard HTML, JS, and CSS
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Serve static files with no caching
  app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: 0
  }));

  // Mount API
  app.use('/api', apiRoutes(client));

  // Web Dashboard routes (Discord Bot Control Center)
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(listenPort, '0.0.0.0', () => {
    console.log('=============================================');
    console.log(`🌐 Web Dashboard running at: http://0.0.0.0:${listenPort} (Port ${listenPort})`);
    console.log('=============================================');
  });

  // 24/7 Keep-Alive self-pinger to prevent cloud services (Render) from idling or sleeping
  const externalUrl = process.env.RENDER_EXTERNAL_URL || 'https://white-x-store.onrender.com';
  const keepAliveTimer = setInterval(() => {
    fetch(`${externalUrl}/api/auth/captcha`)
      .then(() => console.log('💓 Cloud 24/7 Keep-Alive Heartbeat sent.'))
      .catch(() => {});
  }, 10 * 60 * 1000);
  if (keepAliveTimer && keepAliveTimer.unref) keepAliveTimer.unref();

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is in use. Trying port ${Number(port) + 1}...`);
      startDashboard(client, Number(port) + 1);
    } else {
      console.error('Web dashboard server error:', err);
    }
  });

  return server;
}

module.exports = { startDashboard };
