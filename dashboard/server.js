const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

function startDashboard(client, port = process.env.PORT || 3000) {
  const listenPort = parseInt(process.env.PORT || port, 10) || 3000;
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Mount API
  app.use('/api', apiRoutes(client));

  // Fallback to index.html for SPA routing
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(listenPort, '0.0.0.0', () => {
    console.log('=============================================');
    console.log(`🌐 Web Dashboard running at: http://0.0.0.0:${listenPort} (Port ${listenPort})`);
    console.log('=============================================');
  });

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
