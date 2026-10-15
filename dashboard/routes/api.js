const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const adminVerifyFlow = require('../../handlers/adminVerifyFlow');
const licenseService = require('../../services/licenseService');
const security = require('../auth/security');

module.exports = function (client) {
  // ------------------------------------------
  // 0. AUTHENTICATION & CAPTCHA (PUBLIC)
  // ------------------------------------------

  // Get dynamic SVG CAPTCHA challenge
  router.get('/auth/captcha', (req, res) => {
    try {
      const captcha = security.generateCaptcha();
      res.json({
        success: true,
        captchaId: captcha.captchaId,
        svg: captcha.svg
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to generate captcha' });
    }
  });

  // Health and bot connection status endpoint with Discord API probe
  router.get('/health', async (req, res) => {
    const isReady = client?.isReady?.() || false;
    let discordApiProbe = { tested: false };

    try {
      const rawToken = process.env.DISCORD_TOKEN;
      const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : null;
      if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const start = Date.now();
        const probeRes = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${token}` },
          signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await probeRes.json().catch(() => ({}));
        discordApiProbe = {
          tested: true,
          httpStatus: probeRes.status,
          latencyMs: Date.now() - start,
          discordUsername: data?.username || null,
          error: probeRes.status !== 200 ? (data?.message || `HTTP ${probeRes.status}`) : null
        };
      } else {
        discordApiProbe = { tested: false, error: 'No DISCORD_TOKEN found in process.env' };
      }
    } catch (probeErr) {
      discordApiProbe = { tested: true, error: probeErr?.name === 'AbortError' ? 'Discord API connection timed out (>4000ms)' : probeErr?.message };
    }

    res.json({
      status: 'ok',
      botReady: isReady,
      botTag: client?.user?.tag || null,
      botId: client?.user?.id || null,
      guildCount: client?.guilds?.cache?.size || 0,
      wsStatus: client?.ws?.status ?? -1,
      loginStatus: client?.loginStatus || null,
      discordApiProbe,
      timestamp: new Date().toISOString()
    });
  });

  // Admin login with credentials & CAPTCHA validation
  router.post('/auth/login', (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // 1. Check brute force rate limits
    const rateCheck = security.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Security lockout active. Please wait ${rateCheck.remainingSeconds}s.`
      });
    }

    const { username, password, captchaId, captchaInput } = req.body;

    // 2. Validate CAPTCHA
    const captchaCheck = security.verifyCaptcha(captchaId, captchaInput);
    if (!captchaCheck.valid) {
      security.recordFailedAttempt(ip);
      return res.status(400).json({
        success: false,
        message: captchaCheck.error || 'Invalid or expired CAPTCHA code'
      });
    }

    // 3. Verify admin credentials
    const authCheck = security.authenticateUser(username, password);
    if (!authCheck.success) {
      const attempt = security.recordFailedAttempt(ip);
      const remaining = Math.max(0, 5 - attempt.count);
      return res.status(401).json({
        success: false,
        message: `${authCheck.error}. ${remaining > 0 ? `(${remaining} attempts remaining before lockout)` : 'Account locked for 5 minutes.'}`
      });
    }

    // 4. Successful login
    security.recordSuccessfulLogin(ip);
    const token = security.createSession(authCheck.username);

    res.json({
      success: true,
      token,
      user: {
        username: authCheck.username,
        role: 'Administrator'
      }
    });
  });

  // Verify existing token status
  router.get('/auth/check', (req, res) => {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-auth-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (customHeader) {
      token = String(customHeader).trim();
    }

    const auth = security.verifyToken(token);
    res.json({
      authenticated: auth.valid,
      username: auth.username || null
    });
  });

  // Logout & invalidate session
  router.post('/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      security.revokeSession(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Change Admin Credentials (Protected)
  router.post('/auth/change-credentials', security.requireAuth, (req, res) => {
    try {
      const { currentPassword, newUsername, newPassword, confirmPassword, captchaId, captchaInput } = req.body;

      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current master password is required' });
      }
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long' });
      }
      if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
      }

      if (captchaId && captchaInput) {
        const capCheck = security.verifyCaptcha(captchaId, captchaInput);
        if (!capCheck.valid) {
          return res.status(400).json({ success: false, message: capCheck.error || 'Invalid or expired CAPTCHA code' });
        }
      }

      const verify = security.authenticateUser(req.adminUser, currentPassword);
      if (!verify.success) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      const updated = security.updateAdminCredentials(newUsername || req.adminUser, newPassword);
      res.json({
        success: true,
        message: `Admin credentials updated successfully for user "${updated.username}"! All active sessions have been revoked for security. Please log in with your new credentials.`
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // ------------------------------------------
  // PROTECTED ENDPOINTS (REQUIRE AUTHENTICATION)
  // ------------------------------------------
  router.use(security.requireAuth);

  // 1. Bot Connection Status & KPI
  router.get('/status', (req, res) => {
    const isReady = Boolean(client && client.isReady && client.isReady());
    res.json({
      online: isReady,
      botTag: isReady ? client.user.tag : 'Auto Sell Store#8906',
      botId: isReady ? client.user.id : null,
      guildsCount: isReady ? client.guilds.cache.size : 0,
      uptime: isReady ? process.uptime() : 0,
      ping: isReady ? client.ws.ping : 0
    });
  });

  // 2. High-level Statistics
  router.get('/stats', (req, res) => {
    const orders = Object.values(db.getOrders());
    const products = Object.values(db.getProducts());
    const wallets = db.getWallets();

    const completedOrders = orders.filter(o => o.status === 'completed');
    const pendingOrders = orders.filter(
      o => o.status === 'pending_verification' || o.status === 'pending_payment'
    );
    const declinedOrders = orders.filter(o => o.status === 'declined');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalWalletBalance = Object.values(wallets).reduce(
      (sum, w) => sum + (Number(w.balance) || 0),
      0
    );

    // Recent 10 orders
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.json({
      totalRevenue,
      completedOrdersCount: completedOrders.length,
      pendingOrdersCount: pendingOrders.length,
      declinedOrdersCount: declinedOrders.length,
      totalOrdersCount: orders.length,
      totalProductsCount: products.length,
      totalWalletUsersCount: Object.keys(wallets).length,
      totalWalletBalance,
      recentOrders
    });
  });

  // 3. Products Endpoints
  router.get('/products', (req, res) => {
    const products = db.getProducts();
    const stock = db.stock;
    const enriched = Object.values(products).map(p => ({
      ...p,
      stockCount: stock[p.id.toLowerCase()] ? stock[p.id.toLowerCase()].length : 0
    }));
    res.json(enriched);
  });

  router.post('/products', (req, res) => {
    try {
      const {
        id,
        name,
        category,
        version,
        status,
        description,
        features,
        plans,
        deliveryType,
        apiConnectionId,
        variantMapping,
        customApiConfig,
        downloadUrl,
        instructions
      } = req.body;
      if (!name) return res.status(400).json({ error: 'Product name is required' });

      const prodId = (id || name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const cleanFeatures = Array.isArray(features)
        ? features
        : typeof features === 'string'
        ? features.split('\n').map(f => f.trim()).filter(Boolean)
        : [];

      const newProduct = {
        id: prodId,
        name,
        category: category || 'PC',
        version: version || 'v1.0',
        status: status || 'safe',
        description: description || 'Premium Quality Product',
        features: cleanFeatures,
        plans: plans || {
          '1d': { label: '1 Day', durationDays: 1, price: 150, currency: '₹' },
          '7d': { label: '7 Days', durationDays: 7, price: 500, currency: '₹' },
          '30d': { label: '30 Days', durationDays: 30, price: 1200, currency: '₹' }
        },
        deliveryType: deliveryType || 'keyauth',
        apiConnectionId: apiConnectionId || null,
        variantMapping: variantMapping || {},
        customApiConfig: customApiConfig || {},
        downloadUrl: downloadUrl || null,
        instructions: instructions || null
      };

      db.updateProduct(prodId, newProduct);
      res.json({ success: true, product: newProduct });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      if (typeof updates.features === 'string') {
        updates.features = updates.features
          .split('\n')
          .map(f => f.trim())
          .filter(Boolean);
      }
      const updated = db.updateProduct(id, updates);
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, product: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/products/:id/status', (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['safe', 'maintenance', 'patched'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const updated = db.setProductStatus(id, status);
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, status: updated.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/products/:id/pricing', (req, res) => {
    try {
      const { id } = req.params;
      const { price1d, price7d, price30d, currency } = req.body;
      const updated = db.setProductPricing(id, {
        price1d: price1d ? Number(price1d) : null,
        price7d: price7d ? Number(price7d) : null,
        price30d: price30d ? Number(price30d) : null,
        currency: currency || '₹'
      });
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, product: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = db.deleteProduct(id);
      if (!deleted) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, deletedId: id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Orders & Verification Endpoints
  router.get('/orders', (req, res) => {
    const orders = db.getOrders();
    const { status, search } = req.query;

    let list = Object.values(orders).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (status) {
      list = list.filter(o => o.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        o =>
          (o.id && o.id.toLowerCase().includes(q)) ||
          (o.userId && o.userId.toLowerCase().includes(q)) ||
          (o.txId && o.txId.toLowerCase().includes(q)) ||
          (o.productName && o.productName.toLowerCase().includes(q))
      );
    }

    res.json(list);
  });

  router.post('/orders/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const approvedBy = req.body.approvedBy || 'Admin via Web Dashboard';
      const result = await adminVerifyFlow.approveOrderDirect(client, id, approvedBy);
      res.json(result);
    } catch (err) {
      console.error('Web approve error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/orders/:id/decline', async (req, res) => {
    try {
      const { id } = req.params;
      const reason = req.body.reason || 'Payment could not be verified.';
      const declinedBy = req.body.declinedBy || 'Admin via Web Dashboard';
      const result = await adminVerifyFlow.declineOrderDirect(client, id, reason, declinedBy);
      res.json(result);
    } catch (err) {
      console.error('Web decline error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Wallets Endpoints
  router.get('/wallets', (req, res) => {
    const wallets = db.getWallets();
    const list = Object.entries(wallets).map(([userId, data]) => ({
      userId,
      balance: data.balance || 0,
      historyCount: (data.history || []).length,
      history: (data.history || []).slice(-10).reverse()
    }));
    res.json(list);
  });

  router.post('/wallets/:userId/adjust', (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, type, note } = req.body;
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Valid positive amount required' });
      }

      let newBalance = 0;
      if (type === 'credit' || type === 'add') {
        newBalance = db.addWalletBalance(userId, numAmount, note || 'Credited via Web Dashboard');
      } else if (type === 'debit' || type === 'remove') {
        const success = db.deductWalletBalance(userId, numAmount, note || 'Deducted via Web Dashboard');
        if (!success) {
          return res.status(400).json({ error: 'Insufficient balance or user not found' });
        }
        newBalance = db.getUserBalance(userId);
      } else if (type === 'set') {
        newBalance = db.setWalletBalance(userId, numAmount, note || 'Set via Web Dashboard');
      } else {
        return res.status(400).json({ error: 'Invalid adjustment type' });
      }

      res.json({ success: true, userId, newBalance });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Settings Endpoints
  router.get('/settings', (req, res) => {
    res.json(db.getSettings());
  });

  router.put('/settings', (req, res) => {
    try {
      const updates = req.body;
      const updated = db.updateSettings(updates);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6B. Payment Methods Management Endpoints (Add, Edit, Delete, Toggle)
  router.get('/payment-methods', (req, res) => {
    res.json(db.getPaymentMethods());
  });

  router.post('/payment-methods', (req, res) => {
    try {
      const { key, name, emoji, currency, details, upiId, payeeName, number, paymentLink, enabled } = req.body;
      if (!name) return res.status(400).json({ error: 'Payment method name is required' });

      const methodKey = (key || name).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const saved = db.savePaymentMethod(methodKey, {
        name,
        emoji: emoji || '💳',
        currency: currency || 'INR',
        details: details || '',
        upiId: upiId || undefined,
        payeeName: payeeName || undefined,
        number: number || undefined,
        paymentLink: paymentLink || undefined,
        enabled: enabled !== false
      });

      res.json({ success: true, method: saved, key: methodKey });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/payment-methods/:key', (req, res) => {
    try {
      const { key } = req.params;
      const updates = req.body;
      const saved = db.savePaymentMethod(key, updates);
      res.json({ success: true, method: saved, key });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/payment-methods/:key', (req, res) => {
    try {
      const { key } = req.params;
      const success = db.deletePaymentMethod(key);
      if (!success) {
        return res.status(404).json({ error: 'Payment method not found' });
      }
      res.json({ success: true, deletedKey: key });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6C. External API Connections & Variant Mapping System
  router.get('/currencies', (req, res) => {
    res.json({
      defaultCurrency: db.getDefaultCurrency(),
      currencies: db.getCurrencies()
    });
  });

  router.post('/currencies', (req, res) => {
    try {
      const { code, name, symbol, flag, rate } = req.body;
      if (!code) return res.status(400).json({ error: 'Currency code is required' });
      if (!rate || isNaN(Number(rate)) || Number(rate) <= 0) {
        return res.status(400).json({ error: 'Valid positive exchange rate is required' });
      }

      const saved = db.addCurrency({ code, name, symbol, flag, rate });
      res.json({ success: true, currency: saved, defaultCurrency: db.getDefaultCurrency(), currencies: db.getCurrencies() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/currencies/:code', (req, res) => {
    try {
      const { code } = req.params;
      db.removeCurrency(code);
      res.json({ success: true, deletedCode: code, defaultCurrency: db.getDefaultCurrency(), currencies: db.getCurrencies() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/currencies/default', (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Currency code is required' });
      const newDefault = db.setDefaultCurrency(code);
      res.json({ success: true, defaultCurrency: newDefault });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6C. External API Connections & Variant Mapping System
  router.get('/api-connections', (req, res) => {
    res.json(db.getApiConnections());
  });

  router.post('/api-connections', (req, res) => {
    try {
      const { id, name, type, url, apiKey, method, headers, responseKeyPath, notes, enabled } = req.body;
      if (!name && !url) return res.status(400).json({ error: 'API Name or Endpoint URL is required' });

      const saved = db.saveApiConnection(id, {
        name,
        type: type || 'custom_api',
        url,
        apiKey,
        method: method || 'POST',
        headers,
        responseKeyPath,
        notes,
        enabled: enabled !== false
      });

      res.json({ success: true, connection: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/api-connections/:id', (req, res) => {
    try {
      const { id } = req.params;
      const saved = db.saveApiConnection(id, req.body);
      res.json({ success: true, connection: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/api-connections/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = db.deleteApiConnection(id);
      if (!success) {
        return res.status(404).json({ error: 'API Connection not found' });
      }
      res.json({ success: true, deletedId: id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test API Connection Endpoint
  router.post('/api-connections/test', async (req, res) => {
    try {
      const { connectionId, url, apiKey, type, method, headers, testVariantId } = req.body;
      let config = { url, apiKey, type, method, headers };

      if (connectionId) {
        const conn = db.getApiConnection(connectionId);
        if (conn) {
          config = { ...conn, ...config };
        }
      }

      if (!config.url) {
        return res.status(400).json({ error: 'API Endpoint URL is required for testing' });
      }

      const result = await licenseService.testApiConnection(config, testVariantId || '101');
      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.response?.data?.message || err.response?.data?.error || err.message,
        status: err.response?.status || 500,
        statusText: err.response?.statusText || 'Error',
        data: err.response?.data || null
      });
    }
  });

  // Update Variant Mapping specifically for a Product
  router.put('/products/:id/variant-mapping', (req, res) => {
    try {
      const { id } = req.params;
      const { apiConnectionId, variantMapping, customApiConfig, deliveryType } = req.body;

      const updated = db.updateProductVariantMapping(id, {
        apiConnectionId,
        variantMapping,
        customApiConfig,
        deliveryType
      });

      if (!updated) {
        return res.status(404).json({ error: `Product "${id}" not found` });
      }

      res.json({ success: true, product: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Live Simulate Product Delivery with Mapped Variant ID
  router.post('/products/:id/test-delivery', async (req, res) => {
    try {
      const { id } = req.params;
      const { plan } = req.body;
      const product = db.getProduct(id);
      if (!product) return res.status(404).json({ error: `Product "${id}" not found` });

      const testOrder = {
        id: 'TEST-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        userId: '123456789012345678',
        productId: product.id,
        plan: plan || '1d',
        amount: product.plans?.[plan || '1d']?.price || 150,
        currency: '₹'
      };

      const result = await licenseService.deliverKey(product, testOrder);
      res.json({
        success: result.success,
        licenseKey: result.key || null,
        variantId: result.variantId || null,
        error: result.error || null,
        testOrder
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Stock Keys Pool
  router.get('/stock', (req, res) => {
    const products = db.getProducts();
    const stockData = {};
    for (const [id, prod] of Object.entries(products)) {
      stockData[id] = {
        name: prod.name,
        keysCount: db.getStock(id).length,
        keys: db.getStock(id)
      };
    }
    res.json(stockData);
  });

  router.post('/stock/:productId/add', (req, res) => {
    try {
      const { productId } = req.params;
      const { keys } = req.body;
      const keyList = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
        ? keys.split('\n').map(k => k.trim()).filter(Boolean)
        : [];

      const count = db.addStock(productId, keyList);
      res.json({ success: true, productId, newCount: count, added: keyList.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Deploy Store Catalog to Discord (/shop send)
  router.post('/bot/shop-send', async (req, res) => {
    try {
      const { channelId } = req.body;
      const settings = db.getSettings();
      const targetChannelId = channelId || settings.shopChannelId || settings.verificationChannelId;

      if (!targetChannelId) {
        return res.status(400).json({ error: 'No channel ID specified or configured in settings' });
      }

      if (!client || !client.isReady || !client.isReady()) {
        return res.status(503).json({ error: 'Discord bot is not currently connected' });
      }

      const channel = await client.channels.fetch(targetChannelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ error: 'Channel not found or is not a text channel' });
      }

      const shopCommand = require('../../commands/shop');
      const products = Object.values(db.getProducts());
      const shopPage = settings.shopPage || {};

      const {
        EmbedBuilder,
        ActionRowBuilder,
        StringSelectMenuBuilder,
        ButtonBuilder,
        ButtonStyle
      } = require('discord.js');

      const color = shopPage.color
        ? parseInt(shopPage.color.replace('#', ''), 16)
        : 0x00d2ff;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: `${settings.storeName || 'White X Store'} • Official Automated Marketplace`,
          iconURL: shopPage.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
        })
        .setTitle(shopPage.title || '⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡')
        .setDescription(
          shopPage.description ||
            '> ⚡ **Instant Key Delivery** • 🛡️ **Anti-Ban Protected** • 💳 **Instant UPI / Cards / Wallet**\n\n' +
            '### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘 / 𝗞𝗔𝗜𝗦𝗘 𝗞𝗛𝗔𝗥𝗜𝗗𝗘𝗜𝗡:\n' +
            '**1️⃣ Select Your Cheat:** Choose your desired panel from the dropdown menu below.\n' +
            '**2️⃣ Review Features & Status:** Inspect live pricing & anti-cheat status in the private card.\n' +
            '**3️⃣ 0-Second Delivery:** Pay via UPI QR, Cards, Crypto or Wallet for instant key delivery!'
        )
        .setFooter({ text: shopPage.footer || `${settings.storeName || 'White X Store'} • Select a product below to start • 24/7 Automated Delivery` })
        .setTimestamp();

      if (shopPage.thumbnailUrl) embed.setThumbnail(shopPage.thumbnailUrl);
      if (shopPage.bannerUrl) embed.setImage(shopPage.bannerUrl);

      const selectOptions = products.map(p => {
        let icon = '💻';
        if (p.category === 'Android') icon = '📱';
        if (p.category === 'Bypass') icon = '🛡️';

        let statusIndicator = 'Safe 🟢';
        if (p.status === 'maintenance') statusIndicator = 'Maintenance 🟡';
        if (p.status === 'patched') statusIndicator = 'Patched 🔴';

        const desc = db.formatProductDropdownDesc(p);

        return {
          label: p.name,
          description: desc,
          value: `panel_${p.id}`,
          emoji: icon
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_browse_products')
        .setPlaceholder('🛒 Select a Product / Panel to view details...')
        .addOptions(selectOptions.slice(0, 25));

      const menuRow = new ActionRowBuilder().addComponents(selectMenu);
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wallet_view').setLabel('💳 My Wallet').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wallet_topup').setLabel('➕ Add Balance / Top-up').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('shop_live_status').setLabel('📊 Live Status').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('shop_help').setLabel('❓ Help & Guide').setStyle(ButtonStyle.Secondary)
      );

      const sentMsg = await channel.send({
        embeds: [embed],
        components: [menuRow, actionRow]
      });

      db.updateSettings({ lastCatalogMessageId: sentMsg.id, shopChannelId: channel.id });

      res.json({ success: true, messageId: sentMsg.id, channelName: channel.name });
    } catch (err) {
      console.error('Broadcast error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
