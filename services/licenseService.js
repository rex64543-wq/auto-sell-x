const axios = require('axios');
const db = require('../database/db');

/**
 * Service to generate or retrieve license keys from:
 * 1. KeyAuth Seller API
 * 2. Connected External API / Reseller Panel with Variant ID Mapping
 * 3. Local Stock Pool
 */
class LicenseService {
  /**
   * Generates or fetches a license key for a given order and product.
   * @param {Object} product
   * @param {Object} order
   * @returns {Promise<{ success: boolean, key?: string, error?: string, variantId?: string }>}
   */
  async deliverKey(product, order) {
    const deliveryType = product.deliveryType || (product.apiConnectionId ? 'custom_api' : 'stock');

    try {
      if (deliveryType === 'keyauth') {
        return await this.fetchKeyAuthKey(product, order);
      } else if (deliveryType === 'custom_api' || deliveryType === 'api' || product.apiConnectionId) {
        return await this.fetchCustomApiKey(product, order);
      } else {
        // Default: Local stock pool
        return await this.fetchStockKey(product);
      }
    } catch (err) {
      console.error(`Error generating license key for product ${product.id}:`, err);
      return {
        success: false,
        error: err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown API error'
      };
    }
  }

  /**
   * Fetch/generate key using KeyAuth Seller API
   */
  async fetchKeyAuthKey(product, order) {
    const config = product.keyauthConfig || {};
    const sellerKey = config.sellerKey || process.env.KEYAUTH_SELLER_KEY;

    if (!sellerKey) {
      return {
        success: false,
        error: 'KeyAuth Seller Key is not configured for this product or in .env'
      };
    }

    const expiry = config.expiry || 30; // in days
    const mask = config.mask || 'XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX';
    const level = config.level || 1;
    const amount = 1;

    // KeyAuth Seller API URL
    const url = `https://keyauth.win/api/seller/?sellerkey=${encodeURIComponent(
      sellerKey
    )}&type=add&expiry=${encodeURIComponent(expiry)}&mask=${encodeURIComponent(
      mask
    )}&level=${encodeURIComponent(level)}&amount=${amount}&format=json`;

    const response = await axios.get(url, { timeout: 10000 });

    if (response.data && response.data.success) {
      const keys = response.data.keys || (response.data.key ? [response.data.key] : []);
      const key = keys[0];

      if (key) {
        return { success: true, key: key.trim() };
      }
    }

    if (typeof response.data === 'string' && !response.data.includes('error')) {
      return { success: true, key: response.data.trim() };
    }

    return {
      success: false,
      error: response.data?.message || 'Failed to generate key from KeyAuth API'
    };
  }

  /**
   * Fetch/generate key using Connected External API with Variant ID Mapping
   */
  async fetchCustomApiKey(product, order) {
    // 1. Resolve configuration from connected API provider or direct customApiConfig
    let config = { ...(product.customApiConfig || {}) };
    if (product.apiConnectionId) {
      const savedConn = db.getApiConnection(product.apiConnectionId);
      if (savedConn) {
        config = { ...savedConn, ...config };
      }
    }

    const apiUrl = config.url || process.env.CUSTOM_API_URL;
    if (!apiUrl) {
      return {
        success: false,
        error: `Custom API URL is not configured for product "${product.name}"`
      };
    }

    // 2. Resolve mapped Variant ID for this specific plan (e.g. 1d, 7d, 30d)
    const planKey = (order.plan || '').toLowerCase();
    const variantId =
      product.plans?.[order.plan]?.variantId ||
      product.plans?.[planKey]?.variantId ||
      product.variantMapping?.[order.plan] ||
      product.variantMapping?.[planKey] ||
      config.variantMapping?.[order.plan] ||
      config.variantMapping?.[planKey] ||
      config.variantId ||
      order.plan ||
      'default';

    const method = (config.method || 'POST').toUpperCase();
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'WhiteXStore-AutoSell/2.0',
      ...(config.headers || {})
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['x-api-key'] = config.apiKey;
    }

    // 3. Build comprehensive payload with variant ID mapping
    const payload = {
      orderId: order.id,
      buyerId: order.userId,
      productId: product.id,
      productName: product.name,
      plan: order.plan,
      planLabel: product.plans?.[order.plan]?.label || order.plan,
      variantId: variantId,
      variant_id: variantId,
      service: variantId,
      service_id: variantId,
      package_id: variantId,
      item_id: variantId,
      amount: order.amount,
      currency: order.currency,
      apiKey: config.apiKey,
      key: config.apiKey,
      timestamp: new Date().toISOString(),
      ...(config.customPayload || {})
    };

    // Reseller / SMM Panel Standard Support
    if (config.type === 'smm_panel') {
      payload.key = config.apiKey;
      payload.action = 'add';
      payload.service = variantId;
      payload.link = order.userId;
      payload.quantity = 1;
    }

    console.log(`[API Connect] Requesting delivery for Product "${product.name}" [Plan: ${order.plan} -> Variant ID: ${variantId}] at ${apiUrl}`);

    let response;
    if (method === 'GET') {
      response = await axios.get(apiUrl, {
        params: payload,
        headers,
        timeout: 12000
      });
    } else {
      response = await axios.post(apiUrl, payload, {
        headers,
        timeout: 12000
      });
    }

    const data = response.data;
    let extractedKey = null;

    // 4. Extract key based on configured responseKeyPath (e.g. "license_key", "data.key")
    if (config.responseKeyPath) {
      const parts = config.responseKeyPath.split('.');
      let current = data;
      for (const part of parts) {
        if (current && current[part] !== undefined) {
          current = current[part];
        } else {
          current = null;
          break;
        }
      }
      extractedKey = current;
    } else if (typeof data === 'string') {
      extractedKey = data;
    } else if (data && typeof data === 'object') {
      // Standard license & reseller response formats
      extractedKey =
        data.key ||
        data.license ||
        data.licenseKey ||
        data.license_key ||
        data.serial ||
        data.token ||
        data.code ||
        data.account ||
        (data.data && (data.data.key || data.data.license || data.data.serial || data.data.license_key)) ||
        (data.order ? `ORDER-ID: ${data.order} (Service: ${variantId})` : null);
    }

    if (extractedKey) {
      return {
        success: true,
        key: String(extractedKey).trim(),
        variantId
      };
    }

    return {
      success: false,
      variantId,
      error: `API returned response without license key: ${JSON.stringify(data).slice(0, 150)}`
    };
  }

  /**
   * Live Test Connection endpoint runner
   */
  async testApiConnection(config, testVariantId = '101') {
    const startTime = Date.now();
    const apiUrl = config.url;
    if (!apiUrl) throw new Error('API URL is required');

    const method = (config.method || 'POST').toUpperCase();
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'WhiteXStore-Tester/2.0',
      ...(config.headers || {})
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['x-api-key'] = config.apiKey;
    }

    const payload = {
      test: true,
      action: config.type === 'smm_panel' ? 'status' : 'test_order',
      variantId: testVariantId,
      variant_id: testVariantId,
      service: testVariantId,
      apiKey: config.apiKey,
      key: config.apiKey,
      timestamp: new Date().toISOString()
    };

    let res;
    if (method === 'GET') {
      res = await axios.get(apiUrl, { params: payload, headers, timeout: 8000 });
    } else {
      res = await axios.post(apiUrl, payload, { headers, timeout: 8000 });
    }

    const duration = Date.now() - startTime;
    return {
      success: true,
      status: res.status,
      statusText: res.statusText,
      durationMs: duration,
      data: res.data
    };
  }

  /**
   * Fetch key from local stock database
   */
  async fetchStockKey(product) {
    const key = db.popStockKey(product.id);
    if (!key) {
      return {
        success: false,
        error: `Product "${product.name}" is currently OUT OF STOCK in the local database!`
      };
    }
    return { success: true, key };
  }
}

module.exports = new LicenseService();
