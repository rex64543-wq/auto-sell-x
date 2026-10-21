// ==========================================
// White X Store Dashboard Client Controller
// ==========================================

// Global Authenticated Fetch Interceptor
const _originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
  const url = typeof resource === 'string' ? resource : resource?.url;
  if (url && url.startsWith('/api/') && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/captcha')) {
    const token = localStorage.getItem('white_x_admin_token');
    options = options || {};
    options.headers = options.headers || {};
    if (token) {
      if (options.headers instanceof Headers) {
        options.headers.set('Authorization', `Bearer ${token}`);
      } else {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  const res = await _originalFetch(resource, options);
  if (res.status === 401 && url && !url.includes('/api/auth/login') && !url.includes('/api/auth/check')) {
    localStorage.removeItem('white_x_admin_token');
    showLoginScreen('Session expired or unauthorized. Please authenticate.');
  }
  return res;
};

let state = {
  currentTab: 'overview',
  stats: {},
  botStatus: {},
  products: [],
  orders: [],
  wallets: [],
  stock: {},
  settings: {},
  apiConnections: {},
  productFilterCat: 'all',
  orderFilterStatus: 'all',
  orderSearchQuery: '',
  walletSearchQuery: ''
};

let pollInterval = null;
let isInitialized = false;

// Global HTML Escape Utility
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

// ------------------------------------------
// Initialization & Security Gate
// ------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupAuthHandlers();
  checkAuthStatus();
  fetchBotStatus();
  setInterval(fetchBotStatus, 5000);
});

async function checkAuthStatus() {
  const token = localStorage.getItem('white_x_admin_token');
  if (!token) {
    showLoginScreen();
    return;
  }

  try {
    const res = await _originalFetch('/api/auth/check', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.authenticated) {
      enterDashboard();
    } else {
      localStorage.removeItem('white_x_admin_token');
      showLoginScreen('Session expired. Please log in again.');
    }
  } catch (err) {
    showLoginScreen();
  }
}

function enterDashboard() {
  const loginScreen = document.getElementById('loginScreen');
  const appLayout = document.getElementById('appLayout');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appLayout) appLayout.style.display = 'flex';

  if (!isInitialized) {
    setupNavigation();
    setupEventHandlers();
    isInitialized = true;
  }

  loadAllData();
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadAllData, 8000);
}

function showLoginScreen(msg = '') {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  const loginScreen = document.getElementById('loginScreen');
  const appLayout = document.getElementById('appLayout');
  const alertBox = document.getElementById('loginAlertBox');
  const alertMsg = document.getElementById('loginAlertMsg');

  if (appLayout) appLayout.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';

  if (msg && alertBox && alertMsg) {
    alertMsg.textContent = msg;
    alertBox.style.display = 'flex';
  } else if (alertBox) {
    alertBox.style.display = 'none';
  }

  loadCaptcha();
  setTimeout(() => {
    document.getElementById('loginUsername')?.focus();
  }, 100);
}

async function loadCaptcha() {
  const svgBox = document.getElementById('captchaSvgContainer');
  const captchaIdInput = document.getElementById('captchaId');
  const captchaInput = document.getElementById('captchaInput');
  if (!svgBox) return;

  svgBox.innerHTML = '<span class="captcha-loading">⚡ Loading secure captcha...</span>';
  if (captchaInput) captchaInput.value = '';

  try {
    const res = await _originalFetch('/api/auth/captcha');
    const data = await res.json();
    if (data.success && data.svg) {
      svgBox.innerHTML = data.svg;
      if (captchaIdInput) captchaIdInput.value = data.captchaId;
    } else {
      svgBox.innerHTML = '<span class="text-danger" style="font-size: 11px;">⚠️ Failed to load. Click Refresh.</span>';
    }
  } catch (err) {
    svgBox.innerHTML = '<span class="text-danger" style="font-size: 11px;">⚠️ Server error loading captcha.</span>';
  }
}

function setupAuthHandlers() {
  // Login Form Submission
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnLoginSubmit');
      const alertBox = document.getElementById('loginAlertBox');
      const alertMsg = document.getElementById('loginAlertMsg');

      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const captchaId = document.getElementById('captchaId').value;
      const captchaInput = document.getElementById('captchaInput').value.trim();

      if (!captchaInput || captchaInput.length < 5) {
        alertMsg.textContent = 'Please enter the 5-character security CAPTCHA code.';
        alertBox.style.display = 'flex';
        document.getElementById('captchaInput').focus();
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">⏳</span> Authenticating & Checking Captcha...';
      alertBox.style.display = 'none';

      try {
        const res = await _originalFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, captchaId, captchaInput })
        });
        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem('white_x_admin_token', data.token);
          document.getElementById('loginPassword').value = '';
          document.getElementById('captchaInput').value = '';
          enterDashboard();
        } else {
          alertMsg.textContent = data.message || 'Authentication failed. Please verify credentials.';
          alertBox.style.display = 'flex';
          loadCaptcha();
          document.getElementById('captchaInput').value = '';
          document.getElementById('captchaInput').focus();
        }
      } catch (err) {
        alertMsg.textContent = 'Network or server error during authentication. Please retry.';
        alertBox.style.display = 'flex';
        loadCaptcha();
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔐</span> Authenticate & Enter Dashboard';
      }
    });
  }

  // Toggle Password Visibility
  const btnTogglePwd = document.getElementById('btnToggleLoginPwd');
  if (btnTogglePwd) {
    btnTogglePwd.addEventListener('click', () => {
      const pwdInput = document.getElementById('loginPassword');
      if (!pwdInput) return;
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      btnTogglePwd.textContent = isPwd ? '🔒' : '👁️';
    });
  }

  // Refresh CAPTCHA Button
  const btnReload = document.getElementById('btnReloadCaptcha');
  if (btnReload) {
    btnReload.addEventListener('click', () => {
      loadCaptcha();
    });
  }

  // Logout Button
  const btnLogout = document.getElementById('btnAdminLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to log out from the Control Center?')) return;
      try {
        await _originalFetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      localStorage.removeItem('white_x_admin_token');
      showLoginScreen('You have successfully logged out.');
    });
  }

  // Change Admin Credentials Form (In Settings)
  const credForm = document.getElementById('adminCredentialsForm');
  if (credForm) {
    credForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('credAlertBox');
      const currentPassword = document.getElementById('credCurrentPassword').value;
      const newUsername = document.getElementById('credNewUsername').value.trim();
      const newPassword = document.getElementById('credNewPassword').value;

      try {
        const res = await fetch('/api/auth/change-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newUsername, newPassword })
        });
        const data = await res.json();
        if (data.success) {
          alertBox.className = 'alert-box alert-success';
          alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
          alertBox.style.border = '1px solid #10b981';
          alertBox.style.color = '#10b981';
          alertBox.textContent = '✅ ' + data.message;
          alertBox.style.display = 'block';
          credForm.reset();
          setTimeout(() => {
            localStorage.removeItem('white_x_admin_token');
            showLoginScreen('Credentials updated successfully. Please log in with your new password.');
          }, 1500);
        } else {
          alertBox.className = 'alert-box alert-danger';
          alertBox.textContent = '⚠️ ' + (data.message || 'Failed to update credentials');
          alertBox.style.display = 'block';
        }
      } catch (err) {
        alertBox.className = 'alert-box alert-danger';
        alertBox.textContent = '⚠️ Network error: ' + err.message;
        alertBox.style.display = 'block';
      }
    });
  }

  // Password Portal Modal Listeners
  setupPasswordPortalListeners();
}

function setupPasswordPortalListeners() {
  // Toggle Visibility for Current Password
  document.getElementById('btnToggleCurrentPwd')?.addEventListener('click', () => {
    const input = document.getElementById('portalCurrentPwd');
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    document.getElementById('btnToggleCurrentPwd').textContent = isPwd ? '🔒' : '👁️';
  });

  // Toggle Visibility for New Password
  document.getElementById('btnToggleNewPwd')?.addEventListener('click', () => {
    const input = document.getElementById('portalNewPwd');
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    document.getElementById('btnToggleNewPwd').textContent = isPwd ? '🔒' : '👁️';
  });

  // Reload Portal Captcha
  document.getElementById('btnReloadPortalCaptcha')?.addEventListener('click', () => {
    loadPortalCaptcha();
  });

  // Live Password Strength Meter
  document.getElementById('portalNewPwd')?.addEventListener('input', e => {
    updatePasswordStrengthMeter(e.target.value);
    validatePasswordMatch();
  });

  // Live Match Check
  document.getElementById('portalConfirmPwd')?.addEventListener('input', () => {
    validatePasswordMatch();
  });

  // Form Submit for Password Portal Modal
  const portalForm = document.getElementById('portalPasswordForm');
  if (portalForm) {
    portalForm.addEventListener('submit', async e => {
      e.preventDefault();
      const alertBox = document.getElementById('portalAlertBox');
      const submitBtn = document.getElementById('btnSubmitPasswordPortal');

      const currentPassword = document.getElementById('portalCurrentPwd').value;
      const newUsername = document.getElementById('portalNewUsername').value.trim();
      const newPassword = document.getElementById('portalNewPwd').value;
      const confirmPassword = document.getElementById('portalConfirmPwd').value;
      const captchaId = document.getElementById('portalCaptchaId').value;
      const captchaInput = document.getElementById('portalCaptchaInput').value.trim();

      if (newPassword !== confirmPassword) {
        showPortalAlert('⚠️ New password and confirm password do not match!', 'danger');
        return;
      }

      if (newPassword.length < 4) {
        showPortalAlert('⚠️ New password must be at least 4 characters long.', 'danger');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Saving & Revoking Sessions...';
      alertBox.style.display = 'none';

      try {
        const res = await fetch('/api/auth/change-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword,
            newUsername,
            newPassword,
            confirmPassword,
            captchaId,
            captchaInput
          })
        });

        const data = await res.json();
        if (data.success) {
          showPortalAlert('✅ ' + data.message, 'success');
          portalForm.reset();
          setTimeout(() => {
            closePasswordPortalModal();
            localStorage.removeItem('white_x_admin_token');
            showLoginScreen('Password changed successfully! Please log in with your new credentials.');
          }, 2000);
        } else {
          showPortalAlert('⚠️ ' + (data.message || 'Failed to update credentials'), 'danger');
          loadPortalCaptcha();
          document.getElementById('portalCaptchaInput').value = '';
        }
      } catch (err) {
        showPortalAlert('⚠️ Network error: ' + err.message, 'danger');
        loadPortalCaptcha();
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-icon">💾</span> Save & Update Password';
      }
    });
  }
}

function validatePasswordMatch() {
  const newPwd = document.getElementById('portalNewPwd')?.value || '';
  const confirmPwd = document.getElementById('portalConfirmPwd')?.value || '';
  const indicator = document.getElementById('pwdMatchIndicator');
  if (!indicator) return;

  if (!confirmPwd) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';
  if (newPwd === confirmPwd) {
    indicator.textContent = '✅ Passwords match perfectly!';
    indicator.style.color = '#10b981';
  } else {
    indicator.textContent = '❌ Passwords do not match yet';
    indicator.style.color = '#f43f5e';
  }
}

function showPortalAlert(message, type = 'danger') {
  const alertBox = document.getElementById('portalAlertBox');
  if (!alertBox) return;

  alertBox.className = `alert-box alert-${type}`;
  if (type === 'success') {
    alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
    alertBox.style.border = '1px solid #10b981';
    alertBox.style.color = '#10b981';
  } else {
    alertBox.style.background = 'rgba(244, 63, 94, 0.12)';
    alertBox.style.border = '1px solid rgba(244, 63, 94, 0.4)';
    alertBox.style.color = '#ff6b6b';
  }
  alertBox.textContent = message;
  alertBox.style.display = 'block';
}

function openPasswordPortalModal(e) {
  if (e && e.preventDefault) e.preventDefault();
  const modal = document.getElementById('passwordPortalModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const alertBox = document.getElementById('portalAlertBox');
  if (alertBox) alertBox.style.display = 'none';
  const currentPwd = document.getElementById('portalCurrentPwd');
  const newPwd = document.getElementById('portalNewPwd');
  const confirmPwd = document.getElementById('portalConfirmPwd');
  const matchIndicator = document.getElementById('pwdMatchIndicator');
  if (currentPwd) currentPwd.value = '';
  if (newPwd) newPwd.value = '';
  if (confirmPwd) confirmPwd.value = '';
  if (matchIndicator) matchIndicator.style.display = 'none';

  updatePasswordStrengthMeter('');
  loadPortalCaptcha();
  setTimeout(() => currentPwd?.focus(), 150);
}

function closePasswordPortalModal() {
  const modal = document.getElementById('passwordPortalModal');
  if (modal) modal.style.display = 'none';
}

async function loadPortalCaptcha() {
  const svgBox = document.getElementById('portalCaptchaSvgContainer');
  const idInput = document.getElementById('portalCaptchaId');
  const input = document.getElementById('portalCaptchaInput');
  if (!svgBox) return;

  svgBox.innerHTML = '<span class="captcha-loading">Loading challenge...</span>';
  if (input) input.value = '';

  try {
    const res = await _originalFetch('/api/auth/captcha');
    const data = await res.json();
    if (data.success && data.svg) {
      svgBox.innerHTML = data.svg;
      if (idInput) idInput.value = data.captchaId;
    }
  } catch (_) {
    svgBox.innerHTML = '<span class="text-danger" style="font-size: 11px;">⚠️ Failed. Click refresh.</span>';
  }
}

function updatePasswordStrengthMeter(pwd) {
  const bar = document.getElementById('pwdStrengthBar');
  const text = document.getElementById('pwdStrengthText');
  if (!bar || !text) return;

  if (!pwd || pwd.length === 0) {
    bar.style.width = '0%';
    bar.style.background = '#f43f5e';
    text.textContent = 'Password strength: none';
    text.style.color = 'var(--text-muted)';
    return;
  }

  let score = 0;
  if (pwd.length >= 4) score += 25;
  if (pwd.length >= 8) score += 25;
  if (/[0-9]/.test(pwd)) score += 25;
  if (/[A-Z]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;

  bar.style.width = `${score}%`;
  if (score <= 25) {
    bar.style.background = '#f43f5e';
    text.textContent = 'Weak (Needs more characters)';
    text.style.color = '#f43f5e';
  } else if (score <= 50) {
    bar.style.background = '#f59e0b';
    text.textContent = 'Fair (Add numbers or symbols)';
    text.style.color = '#f59e0b';
  } else if (score <= 75) {
    bar.style.background = '#00e5ff';
    text.textContent = 'Good (Strong)';
    text.style.color = '#00e5ff';
  } else {
    bar.style.background = '#10b981';
    text.textContent = 'Excellent (Very Strong)';
    text.style.color = '#10b981';
  }
}

// ------------------------------------------
// Navigation & Tab Switching
// ------------------------------------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Handle URL hash on load
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`view-${hash}`)) {
    switchTab(hash);
  }
}

function switchTab(tabName) {
  state.currentTab = tabName;
  window.location.hash = tabName;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabName);
  });

  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.toggle('active', el.id === `view-${tabName}`);
  });

  // Dynamic titles
  const titles = {
    overview: { title: 'Store Overview', sub: 'Live sales analytics, bot status, and pending approvals.' },
    products: { title: 'Products & Cheats', sub: 'Manage panel features, live status (Safe / Patched), and pricing.' },
    orders: { title: 'Orders & Verifications', sub: 'Review payment screenshots, UTR IDs, and approve or decline orders.' },
    wallets: { title: 'Customer Wallets', sub: 'View customer virtual balances, credit/debit funds, and audit history.' },
    stock: { title: 'Stock & License Keys Pool', sub: 'Manage local license key reserves for automated delivery.' },
    settings: { title: 'Store Settings', sub: 'Configure UPI QR details, payment gateway links, banner media, and channels.' },
    apiconnect: { title: '🔌 API Key Connections & Variant Mapping', sub: 'Connect external reseller APIs using API Keys and map Product Variant IDs for automated 0-second delivery.' },
    broadcast: { title: 'Discord Store Deploy', sub: 'Deploy or refresh the store catalog into your Discord server channel.' },
    'discord-designer': { title: '🎨 Discord Bot Embed Designer', sub: 'Easily edit Discord bot embeds, ASCII frames, colors, instructions & preview live in Discord Dark Mode.' },
    'website-editor': { title: '🎨 Website Storefront Editor & Live CMS', sub: 'Customize public website branding, announcement marquee, hero showcase, features, reviews, and FAQs in real time.' },
    'redeem-codes': { title: '🎁 Redeem Codes & Gift Engine', sub: 'Generate single or bulk promotional codes for cheats and wallet credits claimed via /claim in Discord.' }
  };

  if (titles[tabName]) {
    document.getElementById('pageTitle').textContent = titles[tabName].title;
    document.getElementById('pageSubtitle').textContent = titles[tabName].sub;
  }

  if (tabName === 'discord-designer') {
    loadDiscordDesignerData();
  }

  if (tabName === 'website-editor') {
    loadWebsiteEditorData();
  }

  if (tabName === 'redeem-codes') {
    loadRedeemCodes();
  }
}

// ------------------------------------------
// Data Loading & API Fetching
// ------------------------------------------
async function loadAllData() {
  try {
    await Promise.all([
      fetchBotStatus(),
      fetchStats(),
      fetchProducts(),
      fetchOrders(),
      fetchWallets(),
      fetchSettings(),
      fetchStock(),
      fetchApiConnections()
    ]);
  } catch (err) {
    console.error('Data load error:', err);
  }
}

async function fetchBotStatus() {
  try {
    let res = await fetch('/api/status?_t=' + Date.now());
    let data = {};
    if (res.ok) {
      data = await res.json();
    } else {
      const healthRes = await fetch('/api/health?_t=' + Date.now());
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        data = {
          online: Boolean(healthData.botReady || healthData.online),
          botTag: healthData.botTag,
          guildsCount: healthData.guildCount,
          ping: 42,
          error: healthData.loginStatus?.error
        };
      }
    }

    state.botStatus = data;

    const pulseDot = document.getElementById('botPulseDot');
    const statusText = document.getElementById('botStatusText');
    const metaText = document.getElementById('botMetaText');

    if (data.online || data.botReady) {
      if (pulseDot) pulseDot.classList.remove('offline');
      if (statusText) statusText.textContent = 'Bot Connected';
      if (metaText) metaText.textContent = `${data.botTag || 'Auto Sell Store#8906'} • ${data.guildsCount || data.guildCount || 1} Server(s) • ${data.ping || 42}ms`;
    } else {
      if (pulseDot) pulseDot.classList.add('offline');
      if (statusText) statusText.textContent = 'Bot Offline';
      if (metaText) {
        metaText.textContent = data.error || 'Connecting to Discord...';
      }
    }
  } catch (e) {
    console.error('Error fetching bot status:', e);
  }
}

async function fetchStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  state.stats = data;

  document.getElementById('kpiRevenue').textContent = `₹${data.totalRevenue.toLocaleString()}`;
  document.getElementById('kpiCompletedOrders').textContent = data.completedOrdersCount;
  document.getElementById('kpiPendingOrders').textContent = data.pendingOrdersCount;
  document.getElementById('kpiWalletBalance').textContent = `₹${data.totalWalletBalance.toLocaleString()}`;
  document.getElementById('kpiProductsCount').textContent = data.totalProductsCount;

  // Sidebar badge
  const badge = document.getElementById('pendingOrdersBadge');
  if (data.pendingOrdersCount > 0) {
    badge.textContent = data.pendingOrdersCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  renderPendingWidget(data.recentOrders || []);
  renderRecentOrdersTable(data.recentOrders || []);
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  const data = await res.json();
  state.products = data;
  renderProductsGrid();
  renderOverviewCheatMatrix();
}

async function fetchOrders() {
  const res = await fetch('/api/orders');
  const data = await res.json();
  state.orders = data;
  renderAllOrdersTable();
}

async function fetchWallets() {
  const res = await fetch('/api/wallets');
  const data = await res.json();
  state.wallets = data;
  renderWalletsTable();
}

async function fetchSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  state.settings = data;
  populateSettingsForm(data);
}

async function fetchStock() {
  const res = await fetch('/api/stock');
  const data = await res.json();
  state.stock = data;
  renderStockGrid();
}

// ------------------------------------------
// 1. Overview Rendering
// ------------------------------------------
function renderPendingWidget(orders) {
  const pendingOrders = orders.filter(
    o => o.status === 'pending_verification' || o.status === 'pending_payment'
  );
  const widget = document.getElementById('pendingApprovalsWidget');
  const list = document.getElementById('pendingOrdersList');
  const countPill = document.getElementById('pendingCountPill');

  if (pendingOrders.length === 0) {
    widget.style.display = 'none';
    return;
  }

  widget.style.display = 'block';
  countPill.textContent = `${pendingOrders.length} Order(s) Awaiting Review`;

  list.innerHTML = pendingOrders
    .map(order => {
      const isTopup = order.type === 'wallet_topup';
      const itemName = isTopup ? '💳 Wallet Top-up' : order.productName;
      const proofImg = order.proofUrl
        ? `<img src="${order.proofUrl}" class="proof-thumb-preview" alt="Proof" onclick="openProofModal('${order.id}', '${order.proofUrl}', '${order.txId || ''}')" title="Click to view full screenshot">`
        : `<div class="proof-thumb-preview" style="display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:10px;color:#94a3b8;">No Pic</div>`;

      return `
        <div class="pending-order-item">
          <div class="pending-order-details">
            ${proofImg}
            <div>
              <div style="font-weight:700;font-size:14px;color:#fff;">
                #${order.id} — ${itemName}
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
                Buyer: <strong style="color:#00e5ff;">${order.userId}</strong> • Amount: <strong style="color:#10b981;">${order.currency}${order.amount}</strong> • Method: <code>${(order.paymentMethod || 'upi').toUpperCase()}</code>
              </div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
                UTR / Ref: <code>${order.txId || 'None submitted'}</code>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-success btn-sm" onclick="approveOrder('${order.id}')">
              ✅ Approve & Deliver Key
            </button>
            <button class="btn btn-danger btn-sm" onclick="openDeclineModal('${order.id}')">
              ❌ Decline
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRecentOrdersTable(orders) {
  const tbody = document.getElementById('recentOrdersTbody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center muted">No orders recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = orders
    .map(o => {
      const isTopup = o.type === 'wallet_topup';
      const statusBadge = getStatusBadge(o.status);
      const timeStr = new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let actionBtn = '';
      if (o.status === 'pending_verification' || o.status === 'pending_payment') {
        actionBtn = `
          <button class="btn btn-success btn-sm" onclick="approveOrder('${o.id}')" style="padding:4px 8px;font-size:11px;">✅ Approve</button>
          <button class="btn btn-danger btn-sm" onclick="openDeclineModal('${o.id}')" style="padding:4px 8px;font-size:11px;">❌ Decline</button>
        `;
      } else if (o.status === 'completed') {
        actionBtn = `<span class="muted code-font">Key: ${o.licenseKey ? o.licenseKey.slice(0, 10) + '...' : 'Delivered'}</span>`;
      }

      return `
        <tr>
          <td><strong style="color:#00e5ff;">#${o.id}</strong></td>
          <td><code>${o.userId}</code></td>
          <td>${isTopup ? '💳 Wallet Top-up' : o.productName} ${o.planDuration ? `(${o.planDuration})` : ''}</td>
          <td><strong>${o.currency}${o.amount}</strong></td>
          <td><code>${(o.paymentMethod || 'upi').toUpperCase()}</code></td>
          <td>${statusBadge}</td>
          <td class="muted">${timeStr}</td>
          <td><div style="display:flex;gap:4px;">${actionBtn}</div></td>
        </tr>
      `;
    })
    .join('');
}

function formatMultiPriceBadge(plan) {
  if (!plan) return '—';
  const inr = Number(plan.priceInr || plan.price || 0);
  const rates = state.settings?.currencyRates || { INR: 1, USD: 0.012, NPR: 1.6 };
  const usd = plan.priceUsd !== undefined && plan.priceUsd !== null ? plan.priceUsd : Math.round(inr * (rates.USD || 0.012) * 100) / 100;
  const npr = plan.priceNpr !== undefined && plan.priceNpr !== null ? plan.priceNpr : Math.round(inr * (rates.NPR || 1.6));
  return `<span style="color:#00e5ff;font-weight:700;">₹${inr}</span> <span style="opacity:0.4;">|</span> <span style="color:#10b981;font-weight:700;">रू${npr}</span> <span style="opacity:0.4;">|</span> <span style="color:#a855f7;font-weight:700;">$${usd}</span>`;
}

function renderOverviewCheatMatrix() {
  const tbody = document.getElementById('overviewMatrixTbody');
  if (!tbody) return;

  if (!state.products || state.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center muted">No cheats configured yet.</td></tr>';
    return;
  }

  tbody.innerHTML = state.products.map(p => {
    const plans = p.plans || {};
    const price1d = formatMultiPriceBadge(plans['1d']);
    const price7d = formatMultiPriceBadge(plans['7d']);
    const price30d = formatMultiPriceBadge(plans['30d']);

    let statusPillClass = 'safe';
    let statusLabel = 'Safe 🟢';
    if (p.status === 'maintenance') {
      statusPillClass = 'maintenance';
      statusLabel = 'Maintenance 🟡';
    } else if (p.status === 'patched') {
      statusPillClass = 'patched';
      statusLabel = 'Patched 🔴';
    }

    const stockCount = p.stockCount || 0;
    const stockBadge = stockCount > 0
      ? `<span class="badge badge-success">${stockCount} keys</span>`
      : `<span class="badge badge-secondary" style="opacity:0.6;">0 keys</span>`;

    return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-primary">${p.category || 'PC'}</span></td>
        <td><code>${p.version || 'v1.0'}</code></td>
        <td><span class="badge badge-${statusPillClass === 'safe' ? 'success' : (statusPillClass === 'maintenance' ? 'warning' : 'danger')}">${statusLabel}</span></td>
        <td>${price1d}</td>
        <td>${price7d}</td>
        <td>${price30d}</td>
        <td>${stockBadge}</td>
        <td>
          <select class="status-dropdown-select" onchange="quickChangeStatus('${p.id}', this.value)" style="padding:4px 8px;font-size:11px;">
            <option value="safe" ${p.status === 'safe' ? 'selected' : ''}>🟢 Safe</option>
            <option value="maintenance" ${p.status === 'maintenance' ? 'selected' : ''}>🟡 Maint</option>
            <option value="patched" ${p.status === 'patched' ? 'selected' : ''}>🔴 Patched</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------
// 2. Products Rendering
// ------------------------------------------
function renderProductsGrid() {
  const grid = document.getElementById('productsGrid');
  let filtered = state.products;

  if (state.productFilterCat !== 'all') {
    filtered = filtered.filter(p => p.category === state.productFilterCat);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="muted text-center" style="grid-column: 1/-1; padding: 40px;">No products found in this category.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map(p => {
      const plans = p.plans || {};
      const price1d = plans['1d'] ? `${plans['1d'].currency || '₹'}${plans['1d'].price}` : '—';
      const price7d = plans['7d'] ? `${plans['7d'].currency || '₹'}${plans['7d'].price}` : '—';
      const price30d = plans['30d'] ? `${plans['30d'].currency || '₹'}${plans['30d'].price}` : '—';

      const featuresHtml = (p.features || [])
        .slice(0, 4)
        .map(f => `<li>${f}</li>`)
        .join('');

      return `
        <div class="product-card">
          <div class="product-card-header">
            <div class="product-title">
              <span class="product-category-tag">${p.category || 'PC'} • ${p.version || 'v1.0'}</span>
              <h4>${p.name}</h4>
            </div>
            <div>
              <select class="status-dropdown-select" onchange="quickChangeStatus('${p.id}', this.value)">
                <option value="safe" ${p.status === 'safe' ? 'selected' : ''}>🟢 Safe</option>
                <option value="maintenance" ${p.status === 'maintenance' ? 'selected' : ''}>🟡 Maintenance</option>
                <option value="patched" ${p.status === 'patched' ? 'selected' : ''}>🔴 Patched</option>
              </select>
            </div>
          </div>

          <p class="product-desc">${p.description || 'Premium Undetected Quality'}</p>

          <ul class="features-list">
            ${featuresHtml}
          </ul>

          <div class="pricing-cards-row">
            <div class="plan-price-box">
              <div class="plan-label">1 DAY</div>
              <div class="plan-amount" style="font-size:13px;">${formatMultiPriceBadge(plans['1d'])}</div>
            </div>
            <div class="plan-price-box">
              <div class="plan-label">7 DAYS</div>
              <div class="plan-amount" style="font-size:13px;">${formatMultiPriceBadge(plans['7d'])}</div>
            </div>
            <div class="plan-price-box">
              <div class="plan-label">30 DAYS</div>
              <div class="plan-amount" style="font-size:13px;">${formatMultiPriceBadge(plans['30d'])}</div>
            </div>
          </div>

          <div class="product-card-footer">
            <span class="muted">Stock: <strong>${p.stockCount || 0}</strong> keys</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="openPricingModal('${p.id}')">💰 Pricing</button>
              <button class="btn btn-secondary btn-sm" onclick="openVariantMappingModal('${p.id}')" title="Configure API & Variant ID Mapping">🔌 API / Variant</button>
              <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${p.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${p.name}')">🗑️</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

async function quickChangeStatus(prodId, newStatus) {
  try {
    const res = await fetch(`/api/products/${prodId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showToast(`Product status updated to ${newStatus.toUpperCase()}`, 'success');
      fetchProducts();
    } else {
      showToast('Failed to update status', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ------------------------------------------
// 3. Orders Rendering
// ------------------------------------------
function renderAllOrdersTable() {
  const tbody = document.getElementById('allOrdersTbody');
  let list = state.orders;

  if (state.orderFilterStatus !== 'all') {
    list = list.filter(o => o.status === state.orderFilterStatus);
  }

  if (state.orderSearchQuery) {
    const q = state.orderSearchQuery.toLowerCase();
    list = list.filter(
      o =>
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.userId && o.userId.toLowerCase().includes(q)) ||
        (o.txId && o.txId.toLowerCase().includes(q)) ||
        (o.productName && o.productName.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center muted">No orders match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map(o => {
      const isTopup = o.type === 'wallet_topup';
      const statusBadge = getStatusBadge(o.status);
      const dateStr = new Date(o.createdAt).toLocaleString();

      const proofCell = o.proofUrl
        ? `<img src="${o.proofUrl}" class="proof-thumb-preview" alt="Proof" onclick="openProofModal('${o.id}', '${o.proofUrl}', '${o.txId || ''}')" title="Click to view full screenshot">`
        : '<span class="muted">—</span>';

      let actions = '';
      if (o.status === 'pending_verification' || o.status === 'pending_payment') {
        actions = `
          <button class="btn btn-success btn-sm" onclick="approveOrder('${o.id}')">✅ Approve</button>
          <button class="btn btn-danger btn-sm" onclick="openDeclineModal('${o.id}')">❌ Decline</button>
        `;
      } else if (o.status === 'completed') {
        actions = `<span class="badge badge-safe">Delivered</span>`;
      } else {
        actions = `<span class="badge badge-declined">Closed</span>`;
      }

      return `
        <tr>
          <td><strong style="color:#00e5ff;">#${o.id}</strong></td>
          <td><code>${o.userId}</code></td>
          <td>${isTopup ? '💳 Wallet Top-up' : o.productName} <span class="muted">${o.planDuration ? `(${o.planDuration})` : ''}</span></td>
          <td><strong>${o.currency}${o.amount}</strong></td>
          <td><code>${(o.paymentMethod || 'upi').toUpperCase()}</code></td>
          <td><code>${o.txId || 'None'}</code></td>
          <td>${proofCell}</td>
          <td>${statusBadge}</td>
          <td class="muted" style="font-size:11px;">${dateStr}</td>
          <td><div style="display:flex;gap:6px;">${actions}</div></td>
        </tr>
      `;
    })
    .join('');
}

async function approveOrder(orderId) {
  if (!confirm(`Are you sure you want to approve Order #${orderId} and deliver the license key to the buyer?`)) return;

  try {
    const res = await fetch(`/api/orders/${orderId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'Admin via Web Dashboard' })
    });
    const result = await res.json();
    if (res.ok) {
      showToast(`Order #${orderId} approved & key delivered!`, 'success');
      closeModal('proofModal');
      loadAllData();
    } else {
      showToast(result.error || 'Failed to approve order', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openDeclineModal(orderId) {
  document.getElementById('declineOrderId').value = orderId;
  document.getElementById('declineModalTitle').textContent = `Decline Order #${orderId}`;
  document.getElementById('declineReasonInput').value = '';
  openModal('declineModal');
}

function setDeclineReason(text) {
  document.getElementById('declineReasonInput').value = text;
}

// ------------------------------------------
// 4. Wallets Rendering
// ------------------------------------------
function renderWalletsTable() {
  const tbody = document.getElementById('walletsTbody');
  let list = state.wallets;

  if (state.walletSearchQuery) {
    const q = state.walletSearchQuery.toLowerCase();
    list = list.filter(w => w.userId && w.userId.toLowerCase().includes(q));
  }

  document.getElementById('walletsSummaryText').textContent = `${list.length} Registered Customer Wallets`;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">No wallets match your query.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map(w => {
      const recentNote = w.history && w.history.length > 0 ? w.history[0].note : 'None';
      return `
        <tr>
          <td><strong style="color:#00e5ff;font-family:var(--font-mono);">${w.userId}</strong></td>
          <td><strong style="color:#10b981;font-size:16px;">₹${(w.balance || 0).toFixed(2)}</strong></td>
          <td><span class="count-pill">${w.historyCount || 0} Records</span></td>
          <td class="muted">${recentNote}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="openWalletModal('${w.userId}', ${w.balance})">➕ Adjust Balance</button>
              <button class="btn btn-secondary btn-sm" onclick="openWalletHistoryModal('${w.userId}')">📜 Ledger</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function openWalletModal(userId, currentBal) {
  document.getElementById('walletUserId').value = userId;
  document.getElementById('walletUserBanner').innerHTML = `User: <strong>${userId}</strong> • Current Balance: <strong style="color:#10b981;">₹${(currentBal || 0).toFixed(2)}</strong>`;
  document.getElementById('walletAmountInput').value = '';
  document.getElementById('walletNoteInput').value = '';
  openModal('walletModal');
}

function openWalletHistoryModal(userId) {
  const wallet = state.wallets.find(w => w.userId === userId);
  const tbody = document.getElementById('walletHistoryTbody');
  document.getElementById('walletHistoryTitle').textContent = `Transaction Ledger — ${userId}`;

  if (!wallet || !wallet.history || wallet.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">No transaction records found.</td></tr>';
  } else {
    tbody.innerHTML = wallet.history
      .map(h => {
        const isCredit = h.type === 'credit';
        return `
          <tr>
            <td><span class="badge ${isCredit ? 'badge-safe' : 'badge-declined'}">${isCredit ? '🟢 Credit' : '🔴 Debit'}</span></td>
            <td><strong>₹${h.amount}</strong></td>
            <td>${h.note || 'None'}</td>
            <td class="muted">${new Date(h.date).toLocaleString()}</td>
          </tr>
        `;
      })
      .join('');
  }

  openModal('walletHistoryModal');
}

// ------------------------------------------
// 5. Stock Keys Rendering
// ------------------------------------------
function renderStockGrid() {
  const grid = document.getElementById('stockGrid');
  const products = state.products;

  grid.innerHTML = products
    .map(p => {
      const stockInfo = state.stock[p.id.toLowerCase()] || { keysCount: 0, keys: [] };
      return `
        <div class="card glass-card">
          <div class="card-header">
            <div>
              <span class="muted">${p.category || 'PC'}</span>
              <h4>${p.name}</h4>
            </div>
            <span class="count-pill" style="font-size:14px;">${stockInfo.keysCount} Keys Available</span>
          </div>
          <p class="muted" style="margin-bottom:14px;">Delivery Type: <code>${(p.deliveryType || 'keyauth').toUpperCase()}</code></p>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="openStockModal('${p.id}', '${p.name}')">➕ Deposit Keys</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function openStockModal(productId, productName) {
  document.getElementById('stockProductId').value = productId;
  document.getElementById('stockModalTitle').textContent = `Add Keys — ${productName}`;
  document.getElementById('stockKeysInput').value = '';
  openModal('stockModal');
}

// ------------------------------------------
// 6. Settings Population & Saving
// ------------------------------------------
function populateSettingsForm(s) {
  const shopPage = s.shopPage || {};

  document.getElementById('settingStoreName').value = s.storeName || 'White X Store';
  document.getElementById('settingCheckoutMode').value = s.mode || 'direct';
  // Render dynamic currencies table and default selector
  renderCurrenciesTable(s.currencies || [], s.defaultCurrency || 'USD');
  updateCurrencyCalcPreview();

  document.getElementById('settingBannerUrl').value = shopPage.bannerUrl || '';
  document.getElementById('settingEmbedColor').value = shopPage.color || '#00d2ff';
  document.getElementById('settingShopTitle').value = shopPage.title || '';
  document.getElementById('settingShopDescription').value = shopPage.description || '';

  document.getElementById('settingVerificationChannelId').value = s.verificationChannelId || '';
  document.getElementById('settingLogChannelId').value = s.logChannelId || '';
  document.getElementById('settingAdminRoleId').value = s.adminRoleId || s.staffRoleId || '';
  document.getElementById('settingOwnerId').value = s.ownerId || '';
  document.getElementById('settingCustomerRoleId').value = s.customerRoleId || '';
  document.getElementById('settingTicketCategoryId').value = s.ticketCategoryId || '';

  updateBannerPreview(shopPage.bannerUrl);

  // Render dynamic payment methods list
  renderPaymentMethodsList(s.paymentMethods || {});
}

// ------------------------------------------
// Payment Methods Management (Add / Edit / Delete)
// ------------------------------------------
function renderPaymentMethodsList(methods) {
  const container = document.getElementById('paymentMethodsList');
  if (!container) return;

  const entries = Object.entries(methods || {});
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state text-center" style="grid-column: 1 / -1; padding: 30px;">
        <span style="font-size: 32px;">💳</span>
        <h4 style="margin: 10px 0 4px 0;">No Payment Methods Configured</h4>
        <p class="muted">Click "Add Payment Method" above to configure your first payment gateway!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([key, m]) => {
    const isEnabled = m.enabled !== false;
    const emoji = m.emoji || (key === 'upi' ? '🇮🇳' : key === 'esewa' ? '🇳🇵' : key === 'binance' ? '🌐' : key === 'credit' ? '💳' : key === 'crypto' ? '🪙' : key === 'paypal' ? '🅿️' : '💳');
    const name = m.name || key.toUpperCase();
    const currency = m.currency || 'INR';
    const account = m.number || m.upiId || m.paymentLink || '';
    const details = m.details || m.instructions || 'No special instructions configured.';
    const qrCode = m.qrCodeUrl || m.qrCode || '';

    return `
      <div class="pm-item-card ${isEnabled ? '' : 'is-disabled'}" id="pm-card-${key}">
        <div class="pm-card-top">
          <div class="pm-title-group">
            <div class="pm-emoji-badge">${escapeHtml(emoji)}</div>
            <div class="pm-name-box">
              <h4>${escapeHtml(name)}</h4>
              <span class="pm-key-badge">${escapeHtml(key)} • ${escapeHtml(currency)}</span>
            </div>
          </div>
          <span class="badge ${isEnabled ? 'badge-safe' : 'badge-patched'}">${isEnabled ? '🟢 Active' : '⚪ Disabled'}</span>
        </div>

        <div class="pm-card-body">
          ${account ? `<div style="font-weight: 600; color: #fff; margin-bottom: 6px;">Account: <code>${escapeHtml(account)}</code></div>` : ''}
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">${escapeHtml(details)}</div>

          ${qrCode ? `
            <div class="pm-qr-preview-badge" style="display: flex; align-items: center; gap: 10px; background: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: 6px; padding: 6px 10px; margin-top: 6px;">
              <img src="${escapeHtml(qrCode)}" alt="QR" style="width: 38px; height: 38px; object-fit: contain; background: #fff; border-radius: 4px; padding: 2px; cursor: pointer;" onclick="window.open('${escapeHtml(qrCode)}', '_blank')">
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #00e5ff; display: block;">📷 QR Code Attached</span>
                <small class="muted" style="font-size: 10px;">Embedded in Discord Checkout</small>
              </div>
            </div>
          ` : `
            <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px;">
              <span>No custom QR code (Using text instructions)</span>
            </div>
          `}
        </div>

        <div class="pm-card-footer">
          <label class="pm-toggle-wrap">
            <input type="checkbox" onchange="togglePaymentMethod('${key}', this.checked)" ${isEnabled ? 'checked' : ''} style="cursor: pointer;">
            <span>${isEnabled ? 'Active in Store' : 'Disabled'}</span>
          </label>
          <div class="pm-actions-group">
            <button class="btn btn-secondary btn-sm" onclick="openEditPaymentMethodModal('${key}')" title="Edit details & QR Code">
              ✏️ Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="deletePaymentMethod('${key}', '${escapeHtml(name)}')" title="Delete payment method">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateQrPreview(url) {
  const container = document.getElementById('pmQrPreviewContainer');
  const img = document.getElementById('pmQrPreviewImg');
  if (!container || !img) return;
  const clean = (url || '').trim();
  if (clean) {
    img.src = clean;
    container.style.display = 'flex';
  } else {
    img.src = '';
    container.style.display = 'none';
  }
}

function clearQrCode() {
  const input = document.getElementById('pmQrCode');
  const fileInput = document.getElementById('pmQrFileInput');
  if (input) input.value = '';
  if (fileInput) fileInput.value = '';
  updateQrPreview('');
}

async function handleQrFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, WEBP)', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image file too large (Max 5MB)', 'error');
    return;
  }

  showToast('Processing QR code image...', 'info');

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64Data = evt.target.result;
    try {
      const res = await fetch('/api/upload-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data, filename: file.name })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.getElementById('pmQrCode').value = data.url;
        updateQrPreview(data.url);
        showToast('QR Code uploaded and attached successfully!', 'success');
      } else {
        document.getElementById('pmQrCode').value = base64Data;
        updateQrPreview(base64Data);
        showToast('QR Code loaded as image preview!', 'success');
      }
    } catch (err) {
      document.getElementById('pmQrCode').value = base64Data;
      updateQrPreview(base64Data);
      showToast('QR Code loaded as image preview!', 'info');
    }
  };
  reader.readAsDataURL(file);
}

function openNewPaymentMethodModal() {
  document.getElementById('pmModalTitle').textContent = '💳 Add New Payment Method';
  document.getElementById('pmIsEdit').value = 'false';
  document.getElementById('pmKey').value = '';
  document.getElementById('pmKey').disabled = false;
  document.getElementById('pmEmoji').value = '💳';
  document.getElementById('pmName').value = '';
  document.getElementById('pmCurrency').value = 'INR';
  document.getElementById('pmAccount').value = '';
  document.getElementById('pmPayee').value = '';
  document.getElementById('pmDetails').value = '';
  document.getElementById('pmQrCode').value = '';
  updateQrPreview('');
  document.getElementById('pmEnabled').checked = true;
  openModal('paymentMethodModal');
}

function openEditPaymentMethodModal(key) {
  const methods = state.settings.paymentMethods || {};
  const m = methods[key];
  if (!m) return;

  document.getElementById('pmModalTitle').textContent = `✏️ Edit Payment Method — ${m.name || key}`;
  document.getElementById('pmIsEdit').value = 'true';
  document.getElementById('pmKey').value = key;
  document.getElementById('pmKey').disabled = true;
  document.getElementById('pmEmoji').value = m.emoji || '💳';
  document.getElementById('pmName').value = m.name || key;
  document.getElementById('pmCurrency').value = m.currency || 'INR';
  document.getElementById('pmAccount').value = m.number || m.upiId || m.paymentLink || '';
  document.getElementById('pmPayee').value = m.payeeName || '';
  document.getElementById('pmDetails').value = m.details || m.instructions || '';
  const qr = m.qrCodeUrl || m.qrCode || '';
  document.getElementById('pmQrCode').value = qr;
  updateQrPreview(qr);
  document.getElementById('pmEnabled').checked = m.enabled !== false;
  openModal('paymentMethodModal');
}

async function savePaymentMethodForm(e) {
  e.preventDefault();
  const isEdit = document.getElementById('pmIsEdit').value === 'true';
  const key = document.getElementById('pmKey').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const name = document.getElementById('pmName').value.trim();
  const emoji = document.getElementById('pmEmoji').value.trim() || '💳';
  const currency = document.getElementById('pmCurrency').value.trim() || 'INR';
  const account = document.getElementById('pmAccount').value.trim();
  const payeeName = document.getElementById('pmPayee').value.trim();
  const details = document.getElementById('pmDetails').value.trim();
  const qrCodeUrl = document.getElementById('pmQrCode').value.trim();
  const enabled = document.getElementById('pmEnabled').checked;

  if (!key || !name) {
    showToast('Method key and name are required!', 'error');
    return;
  }

  const payload = {
    key,
    name,
    emoji,
    currency,
    details,
    payeeName,
    qrCodeUrl: qrCodeUrl || undefined,
    enabled
  };

  if (account) {
    if (key === 'upi') payload.upiId = account;
    else if (key === 'credit') payload.paymentLink = account;
    else payload.number = account;
  }

  try {
    const url = isEdit ? `/api/payment-methods/${encodeURIComponent(key)}` : '/api/payment-methods';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save payment method');

    closeModal('paymentMethodModal');
    showToast(`Payment method "${name}" saved successfully!`, 'success');
    await fetchSettings();
  } catch (err) {
    console.error('Error saving payment method:', err);
    showToast(err.message, 'error');
  }
}

async function deletePaymentMethod(key, name) {
  if (!confirm(`Are you sure you want to delete "${name || key}" from payment methods?\nCustomers on Discord will no longer see this payment method at checkout.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/payment-methods/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete payment method');

    showToast(`Payment method "${name || key}" deleted!`, 'success');
    await fetchSettings();
  } catch (err) {
    console.error('Error deleting payment method:', err);
    showToast(err.message, 'error');
  }
}

async function togglePaymentMethod(key, enabled) {
  try {
    const res = await fetch(`/api/payment-methods/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update payment method');

    showToast(`Payment method "${key}" ${enabled ? 'enabled' : 'disabled'}!`, 'info');
    await fetchSettings();
  } catch (err) {
    console.error('Error toggling payment method:', err);
    showToast(err.message, 'error');
  }
}

window.openNewPaymentMethodModal = openNewPaymentMethodModal;
window.openEditPaymentMethodModal = openEditPaymentMethodModal;
window.deletePaymentMethod = deletePaymentMethod;
window.togglePaymentMethod = togglePaymentMethod;
window.savePaymentMethodForm = savePaymentMethodForm;
window.updateQrPreview = updateQrPreview;
window.clearQrCode = clearQrCode;
window.handleQrFileUpload = handleQrFileUpload;

function updateBannerPreview(url) {
  const img = document.getElementById('bannerPreviewImg');
  const placeholder = document.getElementById('bannerPlaceholder');
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

// ------------------------------------------
// Event Handlers & Forms
// ------------------------------------------
function setupEventHandlers() {
  // Refresh button
  document.getElementById('btnRefreshData').addEventListener('click', () => {
    loadAllData();
    showToast('Dashboard data refreshed!', 'info');
  });

  // Quick buttons
  document.getElementById('btnQuickAddProduct').addEventListener('click', () => openNewProductModal());
  document.getElementById('btnAddNewProduct').addEventListener('click', () => openNewProductModal());
  document.getElementById('btnQuickDeploy').addEventListener('click', () => switchTab('broadcast'));

  // Payment Method buttons
  const btnAddPM = document.getElementById('btnAddNewPaymentMethod');
  if (btnAddPM) btnAddPM.addEventListener('click', () => openNewPaymentMethodModal());

  const pmForm = document.getElementById('paymentMethodForm');
  if (pmForm) pmForm.addEventListener('submit', savePaymentMethodForm);

  // Product Category Filters
  document.getElementById('categoryFilterPills').addEventListener('click', e => {
    if (e.target.classList.contains('pill-btn')) {
      document.querySelectorAll('#categoryFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.productFilterCat = e.target.getAttribute('data-cat');
      renderProductsGrid();
    }
  });

  // Orders Status Filters
  document.getElementById('orderStatusFilters').addEventListener('click', e => {
    if (e.target.classList.contains('pill-btn')) {
      document.querySelectorAll('#orderStatusFilters .pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.orderFilterStatus = e.target.getAttribute('data-status');
      renderAllOrdersTable();
    }
  });

  // Orders Search
  document.getElementById('orderSearchInput').addEventListener('input', e => {
    state.orderSearchQuery = e.target.value.trim();
    renderAllOrdersTable();
  });

  // Wallets Search
  document.getElementById('walletSearchInput').addEventListener('input', e => {
    state.walletSearchQuery = e.target.value.trim();
    renderWalletsTable();
  });

  // Banner Live Preview
  document.getElementById('settingBannerUrl').addEventListener('input', e => {
    updateBannerPreview(e.target.value.trim());
  });

  // Save Settings Form
  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const payload = {
      storeName: document.getElementById('settingStoreName').value.trim(),
      mode: document.getElementById('settingCheckoutMode').value,
      verificationChannelId: document.getElementById('settingVerificationChannelId').value.trim() || null,
      logChannelId: document.getElementById('settingLogChannelId').value.trim() || null,
      adminRoleId: document.getElementById('settingAdminRoleId')?.value.trim() || null,
      ownerId: document.getElementById('settingOwnerId')?.value.trim() || null,
      customerRoleId: document.getElementById('settingCustomerRoleId').value.trim() || null,
      ticketCategoryId: document.getElementById('settingTicketCategoryId').value.trim() || null,
      defaultCurrency: state.settings.defaultCurrency || 'USD',
      currencies: state.settings.currencies || [],
      currencyRates: state.settings.currencyRates || {},
      paymentMethods: state.settings.paymentMethods || {},
      shopPage: {
        ...(state.settings.shopPage || {}),
        bannerUrl: document.getElementById('settingBannerUrl').value.trim(),
        color: document.getElementById('settingEmbedColor').value.trim() || '#00d2ff',
        title: document.getElementById('settingShopTitle').value.trim(),
        description: document.getElementById('settingShopDescription').value.trim()
      }
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Settings saved successfully!', 'success');
        fetchSettings();
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Product Form Submit (Add/Edit)
  document.getElementById('productForm').addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('prodEditId').value;
    const isEdit = Boolean(editId);

    const payload = {
      id: document.getElementById('prodInputId').value.trim(),
      name: document.getElementById('prodInputName').value.trim(),
      category: document.getElementById('prodInputCategory').value,
      status: document.getElementById('prodInputStatus').value,
      version: document.getElementById('prodInputVersion').value.trim() || 'v1.0',
      features: document.getElementById('prodInputFeatures').value,
      plans: {
        '1d': { label: '1 Day', durationDays: 1, price: Number(document.getElementById('prodInput1d').value), currency: '₹', variantId: document.getElementById('prodInputVar1d')?.value.trim() || '' },
        '7d': { label: '7 Days', durationDays: 7, price: Number(document.getElementById('prodInput7d').value), currency: '₹', variantId: document.getElementById('prodInputVar7d')?.value.trim() || '' },
        '30d': { label: '30 Days', durationDays: 30, price: Number(document.getElementById('prodInput30d').value), currency: '₹', variantId: document.getElementById('prodInputVar30d')?.value.trim() || '' }
      },
      deliveryType: document.getElementById('prodInputDelivery').value,
      apiConnectionId: document.getElementById('prodInputApiConnection')?.value || null,
      variantMapping: {
        '1d': document.getElementById('prodInputVar1d')?.value.trim() || '',
        '7d': document.getElementById('prodInputVar7d')?.value.trim() || '',
        '30d': document.getElementById('prodInputVar30d')?.value.trim() || ''
      },
      downloadUrl: document.getElementById('prodInputDownload').value.trim() || null,
      instructions: document.getElementById('prodInputInstructions').value.trim() || null
    };

    try {
      const url = isEdit ? `/api/products/${editId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Product ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
        closeModal('productModal');
        fetchProducts();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save product', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Pricing Form Submit
  document.getElementById('pricingForm').addEventListener('submit', async e => {
    e.preventDefault();
    const prodId = document.getElementById('pricingProdId').value;
    const payload = {
      price1d: document.getElementById('pricingInput1d').value,
      price7d: document.getElementById('pricingInput7d').value,
      price30d: document.getElementById('pricingInput30d').value,
      currency: '₹'
    };

    try {
      const res = await fetch(`/api/products/${prodId}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Prices updated successfully!', 'success');
        closeModal('pricingModal');
        fetchProducts();
      } else {
        showToast('Failed to update prices', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Decline Order Form Submit
  document.getElementById('declineForm').addEventListener('submit', async e => {
    e.preventDefault();
    const orderId = document.getElementById('declineOrderId').value;
    const reason = document.getElementById('declineReasonInput').value.trim();

    try {
      const res = await fetch(`/api/orders/${orderId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        showToast(`Order #${orderId} declined. Customer notified via DM.`, 'info');
        closeModal('declineModal');
        closeModal('proofModal');
        loadAllData();
      } else {
        showToast('Failed to decline order', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Wallet Form Submit
  document.getElementById('walletForm').addEventListener('submit', async e => {
    e.preventDefault();
    const userId = document.getElementById('walletUserId').value;
    const type = document.getElementById('walletActionType').value;
    const amount = document.getElementById('walletAmountInput').value;
    const note = document.getElementById('walletNoteInput').value.trim();

    try {
      const res = await fetch(`/api/wallets/${userId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount, note })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Wallet for ${userId} updated! New balance: ₹${data.newBalance}`, 'success');
        closeModal('walletModal');
        fetchWallets();
        fetchStats();
      } else {
        showToast(data.error || 'Failed to adjust wallet', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Stock Form Submit
  document.getElementById('stockForm').addEventListener('submit', async e => {
    e.preventDefault();
    const productId = document.getElementById('stockProductId').value;
    const rawKeys = document.getElementById('stockKeysInput').value;

    try {
      const res = await fetch(`/api/stock/${productId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: rawKeys })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Deposited ${data.added} keys! Total available: ${data.newCount}`, 'success');
        closeModal('stockModal');
        fetchStock();
        fetchProducts();
      } else {
        showToast('Failed to add keys', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Broadcast / Deploy Button
  document.getElementById('btnExecuteBroadcast').addEventListener('click', async () => {
    const channelId = document.getElementById('broadcastChannelId').value.trim();
    const statusBox = document.getElementById('broadcastStatus');
    statusBox.style.display = 'block';
    statusBox.textContent = '⏳ Deploying White X Store catalog to Discord...';
    statusBox.style.color = '#00e5ff';

    try {
      const res = await fetch('/api/bot/shop-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });
      const data = await res.json();
      if (res.ok) {
        statusBox.textContent = `✅ Store catalog successfully sent to #${data.channelName || 'channel'}! (Message ID: ${data.messageId})`;
        statusBox.style.color = '#10b981';
        showToast('Store catalog sent to Discord!', 'success');
      } else {
        statusBox.textContent = `❌ Error: ${data.error}`;
        statusBox.style.color = '#f43f5e';
        showToast(data.error, 'error');
      }
    } catch (err) {
      statusBox.textContent = `❌ Network Error: ${err.message}`;
      statusBox.style.color = '#f43f5e';
    }
  });

  // API Connection Form Submit
  const apiConnForm = document.getElementById('apiConnectionForm');
  if (apiConnForm) {
    apiConnForm.addEventListener('submit', saveApiConnectionForm);
  }

  // Variant Mapping Form Submit
  const vmForm = document.getElementById('variantMappingForm');
  if (vmForm) {
    vmForm.addEventListener('submit', saveVariantMappingForm);
  }

}

// ------------------------------------------
// Modal Helpers
// ------------------------------------------
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}
window.openModal = openModal;
window.closeModal = closeModal;

function openNewProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add New Product / Panel';
  document.getElementById('prodEditId').value = '';
  document.getElementById('prodInputId').value = '';
  document.getElementById('prodInputId').disabled = false;
  document.getElementById('prodInputName').value = '';
  document.getElementById('prodInputCategory').value = 'Android';
  document.getElementById('prodInputStatus').value = 'safe';
  document.getElementById('prodInputVersion').value = 'v1.0';
  document.getElementById('prodInputFeatures').value = '';
  document.getElementById('prodInput1d').value = 150;
  document.getElementById('prodInput7d').value = 500;
  document.getElementById('prodInput30d').value = 1200;
  document.getElementById('prodInputDownload').value = '';
  document.getElementById('prodInputInstructions').value = '';

  populateApiConnectionDropdown('prodInputApiConnection', '');
  if (document.getElementById('prodInputVar1d')) document.getElementById('prodInputVar1d').value = '';
  if (document.getElementById('prodInputVar7d')) document.getElementById('prodInputVar7d').value = '';
  if (document.getElementById('prodInputVar30d')) document.getElementById('prodInputVar30d').value = '';

  openModal('productModal');
}

function openEditProductModal(prodId) {
  const p = state.products.find(x => x.id === prodId);
  if (!p) return;

  document.getElementById('productModalTitle').textContent = `Edit Product: ${p.name}`;
  document.getElementById('prodEditId').value = p.id;
  document.getElementById('prodInputId').value = p.id;
  document.getElementById('prodInputId').disabled = true;
  document.getElementById('prodInputName').value = p.name;
  document.getElementById('prodInputCategory').value = p.category || 'PC';
  document.getElementById('prodInputStatus').value = p.status || 'safe';
  document.getElementById('prodInputVersion').value = p.version || 'v1.0';
  document.getElementById('prodInputFeatures').value = (p.features || []).join('\n');

  const plans = p.plans || {};
  document.getElementById('prodInput1d').value = plans['1d'] ? plans['1d'].price : 150;
  document.getElementById('prodInput7d').value = plans['7d'] ? plans['7d'].price : 500;
  document.getElementById('prodInput30d').value = plans['30d'] ? plans['30d'].price : 1200;

  document.getElementById('prodInputDelivery').value = p.deliveryType || 'keyauth';
  document.getElementById('prodInputDownload').value = p.downloadUrl || '';
  document.getElementById('prodInputInstructions').value = p.instructions || '';

  populateApiConnectionDropdown('prodInputApiConnection', p.apiConnectionId || '');
  const vm = p.variantMapping || {};
  if (document.getElementById('prodInputVar1d')) {
    document.getElementById('prodInputVar1d').value = vm['1d'] || plans['1d']?.variantId || '';
  }
  if (document.getElementById('prodInputVar7d')) {
    document.getElementById('prodInputVar7d').value = vm['7d'] || plans['7d']?.variantId || '';
  }
  if (document.getElementById('prodInputVar30d')) {
    document.getElementById('prodInputVar30d').value = vm['30d'] || plans['30d']?.variantId || '';
  }

  openModal('productModal');
}

function openPricingModal(prodId) {
  const p = state.products.find(x => x.id === prodId);
  if (!p) return;

  document.getElementById('pricingProdId').value = p.id;
  document.getElementById('pricingModalTitle').textContent = `Edit Prices: ${p.name}`;

  const plans = p.plans || {};
  document.getElementById('pricingInput1d').value = plans['1d'] ? plans['1d'].price : 150;
  document.getElementById('pricingInput7d').value = plans['7d'] ? plans['7d'].price : 500;
  document.getElementById('pricingInput30d').value = plans['30d'] ? plans['30d'].price : 1200;

  openModal('pricingModal');
}

async function deleteProduct(prodId, prodName) {
  if (!confirm(`Are you sure you want to permanently delete "${prodName}" from the store?`)) return;

  try {
    const res = await fetch(`/api/products/${prodId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Product "${prodName}" deleted!`, 'info');
      fetchProducts();
      fetchStats();
    } else {
      showToast('Failed to delete product', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openProofModal(orderId, imgUrl, utrId) {
  document.getElementById('proofModalImg').src = imgUrl;
  document.getElementById('proofModalTitle').textContent = `Payment Proof — Order #${orderId}`;
  document.getElementById('proofModalMeta').innerHTML = `
    <div><strong>UTR / Ref ID:</strong> <code>${utrId || 'None'}</code></div>
  `;

  document.getElementById('proofModalActions').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('proofModal')">Close</button>
    <button class="btn btn-danger" onclick="openDeclineModal('${orderId}')">❌ Decline</button>
    <button class="btn btn-success" onclick="approveOrder('${orderId}')">✅ Approve & Deliver Key</button>
  `;

  openModal('proofModal');
}

// ------------------------------------------
// Helper: Badges & Toast Notifications
// ------------------------------------------
function getStatusBadge(status) {
  switch (status) {
    case 'safe':
      return '<span class="badge badge-safe">🟢 Safe</span>';
    case 'maintenance':
      return '<span class="badge badge-maintenance">🟡 Maintenance</span>';
    case 'patched':
      return '<span class="badge badge-patched">🔴 Patched</span>';
    case 'completed':
      return '<span class="badge badge-completed">✅ Approved</span>';
    case 'pending_verification':
    case 'pending_payment':
      return '<span class="badge badge-pending">⏳ Pending Review</span>';
    case 'declined':
      return '<span class="badge badge-declined">❌ Declined</span>';
    default:
      return `<span class="badge">${status}</span>`;
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// API Connections & Variant ID Mapping System
// ==========================================

async function fetchApiConnections() {
  try {
    const res = await fetch('/api/api-connections');
    if (res.ok) {
      state.apiConnections = await res.json();
      renderApiConnections();
      renderVariantMappingTable();
    }
  } catch (err) {
    console.error('Failed to fetch API connections:', err);
  }
}

function populateApiConnectionDropdown(elementId, selectedId) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const connections = Object.values(state.apiConnections || {});
  let html = '<option value="">-- Direct / Custom API Config --</option>';
  connections.forEach(conn => {
    const isSelected = conn.id === selectedId ? 'selected' : '';
    const statusDot = conn.enabled !== false ? '🟢' : '🔴';
    html += `<option value="${conn.id}" ${isSelected}>${statusDot} ${conn.name} (${conn.type.toUpperCase()})</option>`;
  });
  select.innerHTML = html;
}

function renderApiConnections() {
  const container = document.getElementById('apiConnectionsList');
  if (!container) return;

  const connections = Object.values(state.apiConnections || {});

  if (connections.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 36px 20px; background: rgba(0,0,0,0.2); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
        <p style="font-size: 28px; margin-bottom: 8px;">🔌</p>
        <h4 style="margin-bottom: 6px;">No External API Gateways Connected</h4>
        <p class="muted" style="margin-bottom: 16px;">Connect your KeyAuth seller key, SMM panel, or custom reseller API to enable 100% automated key generation with Variant ID mapping.</p>
        <button class="btn btn-primary" onclick="openNewApiConnectionModal()">➕ Connect First API Provider</button>
      </div>
    `;
    return;
  }

  container.innerHTML = connections.map(conn => {
    const isEnabled = conn.enabled !== false;
    const typeLabel = conn.type === 'keyauth' ? '🔑 KeyAuth Seller' : (conn.type === 'smm_panel' ? '📦 SMM / Reseller Panel' : '🌐 Custom REST API');
    const maskedKey = conn.apiKey ? (conn.apiKey.slice(0, 4) + '••••••••' + conn.apiKey.slice(-4)) : '<No Key Configured>';

    return `
      <div class="api-provider-card" id="api-card-${conn.id}">
        <div>
          <div class="api-card-header">
            <div class="api-provider-title">
              <div class="api-icon-badge">${conn.type === 'keyauth' ? '🔑' : (conn.type === 'smm_panel' ? '📦' : '⚡')}</div>
              <div class="api-name-box">
                <h4>${conn.name}</h4>
                <span class="api-type-tag">${typeLabel} • ${conn.method || 'POST'}</span>
              </div>
            </div>
            <span class="badge ${isEnabled ? 'badge-safe' : 'badge-declined'}">${isEnabled ? '🟢 Active' : '🔴 Disabled'}</span>
          </div>

          <div class="api-card-url-box" title="${conn.url}">
            <strong>URL:</strong> ${conn.url || 'Not set'}
          </div>

          <div class="api-key-reveal-box">
            <span><strong>Key:</strong> <code id="key-text-${conn.id}">${maskedKey}</code></span>
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 10px;" onclick="toggleCardApiKey('${conn.id}', '${conn.apiKey || ''}')">Show</button>
          </div>
        </div>

        <div class="api-card-footer">
          <button class="btn btn-gradient btn-sm" onclick="runInlineApiTest('${conn.id}')">⚡ Test</button>
          <div class="pm-actions-group">
            <button class="btn btn-secondary btn-sm" onclick="toggleApiConnection('${conn.id}', ${!isEnabled})">${isEnabled ? 'Disable' : 'Enable'}</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditApiConnectionModal('${conn.id}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteApiConnection('${conn.id}', '${conn.name}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleCardApiKey(connId, rawKey) {
  const el = document.getElementById(`key-text-${connId}`);
  if (!el) return;
  if (el.textContent.includes('••••')) {
    el.textContent = rawKey;
  } else {
    el.textContent = rawKey.slice(0, 4) + '••••••••' + rawKey.slice(-4);
  }
}

function renderVariantMappingTable() {
  const tbody = document.getElementById('variantMappingTbody');
  if (!tbody) return;

  const products = state.products || [];
  const connections = Object.values(state.apiConnections || {});

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center muted" style="padding: 30px;">No products available. Add products in the Products tab first.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const vm = p.variantMapping || {};
    const plans = p.plans || {};
    const var1d = vm['1d'] || plans['1d']?.variantId || '';
    const var7d = vm['7d'] || plans['7d']?.variantId || '';
    const var30d = vm['30d'] || plans['30d']?.variantId || '';

    let apiOptions = '<option value="">-- Direct / Default API --</option>';
    connections.forEach(conn => {
      const selected = conn.id === p.apiConnectionId ? 'selected' : '';
      apiOptions += `<option value="${conn.id}" ${selected}>${conn.name}</option>`;
    });

    return `
      <tr id="vm-row-${p.id}" data-prod-name="${p.name.toLowerCase()}">
        <td>
          <strong>${p.name}</strong><br>
          <small class="muted"><code>${p.id}</code></small>
        </td>
        <td><span class="badge badge-primary">${p.category || 'PC'}</span></td>
        <td>
          <select class="form-input form-input-sm" id="vm-api-select-${p.id}" style="min-width: 150px; font-size: 12px;">
            ${apiOptions}
          </select>
        </td>
        <td>
          <input type="text" class="variant-input-badge" id="vm-input-1d-${p.id}" value="${var1d}" placeholder="1D Variant ID">
        </td>
        <td>
          <input type="text" class="variant-input-badge" id="vm-input-7d-${p.id}" value="${var7d}" placeholder="7D Variant ID">
        </td>
        <td>
          <input type="text" class="variant-input-badge" id="vm-input-30d-${p.id}" value="${var30d}" placeholder="30D Variant ID">
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-primary btn-sm" onclick="saveQuickVariantRow('${p.id}')">💾 Save</button>
            <button class="btn btn-gradient btn-sm" onclick="testQuickVariantRow('${p.id}')" title="Test Delivery Simulation">⚡ Test</button>
            <button class="btn btn-secondary btn-sm" onclick="openVariantMappingModal('${p.id}')">⚙️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterVariantMappingTable() {
  const query = (document.getElementById('variantFilterSearch')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#variantMappingTbody tr');
  rows.forEach(row => {
    const name = row.getAttribute('data-prod-name') || '';
    row.style.display = name.includes(query) ? '' : 'none';
  });
}

async function saveQuickVariantRow(prodId) {
  const apiConnectionId = document.getElementById(`vm-api-select-${prodId}`)?.value || null;
  const var1d = document.getElementById(`vm-input-1d-${prodId}`)?.value.trim() || '';
  const var7d = document.getElementById(`vm-input-7d-${prodId}`)?.value.trim() || '';
  const var30d = document.getElementById(`vm-input-30d-${prodId}`)?.value.trim() || '';

  try {
    const res = await fetch(`/api/products/${prodId}/variant-mapping`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiConnectionId,
        variantMapping: { '1d': var1d, '7d': var7d, '30d': var30d }
      })
    });

    if (res.ok) {
      showToast(`Variant ID mapping saved for "${prodId}"!`, 'success');
      fetchProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save variant mapping', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function testQuickVariantRow(prodId) {
  showToast(`Simulating automated delivery for "${prodId}"...`, 'info');
  try {
    const res = await fetch(`/api/products/${prodId}/test-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: '1d' })
    });
    const data = await res.json();

    if (data.success && data.licenseKey) {
      alert(`✅ Automated Delivery Successful!\n\nProduct: ${prodId}\nPlan: 1d\nMapped Variant ID: ${data.variantId}\nDelivered Key: ${data.licenseKey}`);
    } else {
      alert(`⚠️ Test Delivery Result:\n\nStatus: ${data.success ? 'Success' : 'Failed'}\nMapped Variant ID: ${data.variantId || 'None'}\nDetails: ${data.error || JSON.stringify(data)}`);
    }
  } catch (err) {
    alert(`❌ Test Error: ${err.message}`);
  }
}

function openNewApiConnectionModal() {
  document.getElementById('apiConnectionModalTitle').textContent = '🔌 Connect New API Provider';
  document.getElementById('apiConnIsEdit').value = 'false';
  document.getElementById('apiConnId').value = '';
  document.getElementById('apiConnId').disabled = false;
  document.getElementById('apiConnName').value = '';
  document.getElementById('apiConnType').value = 'custom_api';
  document.getElementById('apiConnMethod').value = 'POST';
  document.getElementById('apiConnUrl').value = '';
  document.getElementById('apiConnKey').value = '';
  document.getElementById('apiConnResponsePath').value = '';
  document.getElementById('apiConnTestVariantId').value = '101';
  document.getElementById('apiConnHeaders').value = '';
  document.getElementById('apiConnEnabled').checked = true;

  const testBox = document.getElementById('apiConnTestResult');
  testBox.style.display = 'none';
  testBox.textContent = '';

  updateApiConnFormHints();
  openModal('apiConnectionModal');
}

function openEditApiConnectionModal(id) {
  const conn = state.apiConnections[id];
  if (!conn) return;

  document.getElementById('apiConnectionModalTitle').textContent = `Edit API: ${conn.name}`;
  document.getElementById('apiConnIsEdit').value = 'true';
  document.getElementById('apiConnId').value = conn.id;
  document.getElementById('apiConnId').disabled = true;
  document.getElementById('apiConnName').value = conn.name || '';
  document.getElementById('apiConnType').value = conn.type || 'custom_api';
  document.getElementById('apiConnMethod').value = conn.method || 'POST';
  document.getElementById('apiConnUrl').value = conn.url || '';
  document.getElementById('apiConnKey').value = conn.apiKey || '';
  document.getElementById('apiConnResponsePath').value = conn.responseKeyPath || '';
  document.getElementById('apiConnTestVariantId').value = '101';
  document.getElementById('apiConnHeaders').value = conn.headers ? JSON.stringify(conn.headers, null, 2) : '';
  document.getElementById('apiConnEnabled').checked = conn.enabled !== false;

  const testBox = document.getElementById('apiConnTestResult');
  testBox.style.display = 'none';
  testBox.textContent = '';

  updateApiConnFormHints();
  openModal('apiConnectionModal');
}

function updateApiConnFormHints() {
  const type = document.getElementById('apiConnType').value;
  const hint = document.getElementById('apiConnUrlHint');
  if (type === 'keyauth') {
    hint.textContent = 'KeyAuth Seller API endpoint (e.g. https://keyauth.win/api/seller/)';
  } else if (type === 'smm_panel') {
    hint.textContent = 'SMM / Reseller Panel standard API v2 endpoint (e.g. https://panel.com/api/v2)';
  } else {
    hint.textContent = 'Generic custom REST API endpoint receiving JSON payloads with mapped Variant IDs.';
  }
}

function toggleApiKeyInputVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

async function runModalApiConnectionTest() {
  const testBox = document.getElementById('apiConnTestResult');
  testBox.style.display = 'block';
  testBox.className = 'api-test-output-box';
  testBox.textContent = '⏳ Sending test ping to API with sample Variant ID...';

  const url = document.getElementById('apiConnUrl').value.trim();
  const apiKey = document.getElementById('apiConnKey').value.trim();
  const type = document.getElementById('apiConnType').value;
  const method = document.getElementById('apiConnMethod').value;
  const testVariantId = document.getElementById('apiConnTestVariantId').value.trim() || '101';

  let headers = {};
  try {
    const rawHeaders = document.getElementById('apiConnHeaders').value.trim();
    if (rawHeaders) headers = JSON.parse(rawHeaders);
  } catch (err) {
    testBox.className = 'api-test-output-box api-test-error';
    testBox.textContent = '❌ Invalid JSON in Custom Headers field.';
    return;
  }

  try {
    const res = await fetch('/api/api-connections/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, apiKey, type, method, headers, testVariantId })
    });
    const result = await res.json();

    if (result.success) {
      testBox.className = 'api-test-output-box api-test-success';
      testBox.textContent = `✅ Connection Succeeded! (${result.durationMs}ms)\nHTTP Status: ${result.status} ${result.statusText}\n\nResponse Preview:\n${JSON.stringify(result.data, null, 2).slice(0, 400)}`;
    } else {
      testBox.className = 'api-test-output-box api-test-error';
      testBox.textContent = `❌ Connection Check Failed!\nStatus: ${result.status || 'Network Error'}\nError: ${result.error}\n\nData:\n${JSON.stringify(result.data || {}, null, 2)}`;
    }
  } catch (err) {
    testBox.className = 'api-test-output-box api-test-error';
    testBox.textContent = `❌ Test request failed: ${err.message}`;
  }
}

async function runInlineApiTest(connId) {
  const conn = state.apiConnections[connId];
  if (!conn) return;

  showToast(`Testing API "${conn.name}"...`, 'info');
  try {
    const res = await fetch('/api/api-connections/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: connId, testVariantId: '101' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ API Connection Active!\n\nName: ${conn.name}\nLatency: ${data.durationMs}ms\nStatus: ${data.status} ${data.statusText}\n\nResponse:\n${JSON.stringify(data.data, null, 2).slice(0, 300)}`);
    } else {
      alert(`❌ API Error: ${data.error || 'Connection Failed'}\nStatus: ${data.status}`);
    }
  } catch (err) {
    alert(`❌ Test Error: ${err.message}`);
  }
}

async function saveApiConnectionForm(e) {
  e.preventDefault();
  const isEdit = document.getElementById('apiConnIsEdit').value === 'true';
  const id = document.getElementById('apiConnId').value.trim();

  let headers = {};
  try {
    const rawHeaders = document.getElementById('apiConnHeaders').value.trim();
    if (rawHeaders) headers = JSON.parse(rawHeaders);
  } catch (err) {
    showToast('Invalid JSON in Custom Headers', 'error');
    return;
  }

  const payload = {
    id,
    name: document.getElementById('apiConnName').value.trim(),
    type: document.getElementById('apiConnType').value,
    method: document.getElementById('apiConnMethod').value,
    url: document.getElementById('apiConnUrl').value.trim(),
    apiKey: document.getElementById('apiConnKey').value.trim(),
    responseKeyPath: document.getElementById('apiConnResponsePath').value.trim(),
    headers,
    enabled: document.getElementById('apiConnEnabled').checked
  };

  try {
    const url = isEdit ? `/api/api-connections/${id}` : '/api/api-connections';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast(`API Connection "${payload.name}" saved!`, 'success');
      closeModal('apiConnectionModal');
      fetchApiConnections();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save API Connection', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteApiConnection(id, name) {
  if (!confirm(`Are you sure you want to delete the API Connection "${name || id}"? Products linked to this API will no longer send orders to it.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/api-connections/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`API Connection deleted.`, 'info');
      fetchApiConnections();
    } else {
      showToast('Failed to delete API Connection', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleApiConnection(id, enabled) {
  try {
    const res = await fetch(`/api/api-connections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (res.ok) {
      showToast(`API Connection ${enabled ? 'enabled' : 'disabled'}!`, 'success');
      fetchApiConnections();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openVariantMappingModal(prodId) {
  const p = state.products.find(x => x.id === prodId);
  if (!p) return;

  document.getElementById('variantModalTitle').textContent = `🔌 API & Variant Mapping: ${p.name}`;
  document.getElementById('vmProductId').value = p.id;

  const metaBox = document.getElementById('vmProductMeta');
  metaBox.innerHTML = `
    <div>
      <h4 style="margin:0 0 2px 0;">${p.name}</h4>
      <span class="muted">Slug: <code>${p.id}</code> • Category: <strong>${p.category || 'PC'}</strong></span>
    </div>
    <span class="badge badge-primary">${(p.version || 'v1.0')}</span>
  `;

  document.getElementById('vmDeliveryType').value = p.deliveryType || 'custom_api';
  populateApiConnectionDropdown('vmApiConnectionId', p.apiConnectionId || '');

  renderVariantPlanInputs(p);

  const testBox = document.getElementById('vmTestResult');
  testBox.style.display = 'none';
  testBox.textContent = '';

  openModal('variantMappingModal');
}

function renderVariantPlanInputs(overrideProduct = null) {
  const prodId = document.getElementById('vmProductId').value;
  const p = overrideProduct || state.products.find(x => x.id === prodId);
  const container = document.getElementById('vmPlansContainer');
  if (!p || !container) return;

  const plans = p.plans || {
    '1d': { label: '1 Day', price: 150 },
    '7d': { label: '7 Days', price: 500 },
    '30d': { label: '30 Days', price: 1200 }
  };
  const vm = p.variantMapping || {};

  container.innerHTML = Object.entries(plans).map(([planKey, planData]) => {
    const currentVarId = vm[planKey] || planData.variantId || '';
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm);">
        <div style="flex: 1;">
          <strong>${planData.label || planKey}</strong>
          <span class="muted" style="margin-left: 8px;">(${planData.currency || '₹'}${planData.price || 0})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="muted" style="font-size: 11px;">External Variant ID:</span>
          <input type="text" class="form-input form-input-sm vm-plan-input" data-plan="${planKey}" value="${currentVarId}" placeholder="e.g. 101 or sku_1" style="width: 140px; font-family: var(--font-mono);">
        </div>
      </div>
    `;
  }).join('');
}

async function saveVariantMappingForm(e) {
  e.preventDefault();
  const prodId = document.getElementById('vmProductId').value;
  const apiConnectionId = document.getElementById('vmApiConnectionId').value || null;
  const deliveryType = document.getElementById('vmDeliveryType').value;

  const variantMapping = {};
  document.querySelectorAll('.vm-plan-input').forEach(input => {
    const plan = input.getAttribute('data-plan');
    variantMapping[plan] = input.value.trim();
  });

  try {
    const res = await fetch(`/api/products/${prodId}/variant-mapping`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiConnectionId, variantMapping, deliveryType })
    });

    if (res.ok) {
      showToast('Variant ID mapping saved successfully!', 'success');
      closeModal('variantMappingModal');
      fetchProducts();
      fetchApiConnections();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update variant mapping', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function simulateProductDeliveryTest() {
  const prodId = document.getElementById('vmProductId').value;
  const testBox = document.getElementById('vmTestResult');
  testBox.style.display = 'block';
  testBox.className = 'api-test-output-box';
  testBox.textContent = `⏳ Simulating test order delivery for product "${prodId}" with configured Variant ID...`;

  try {
    const res = await fetch(`/api/products/${prodId}/test-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: '1d' })
    });
    const data = await res.json();

    if (data.success && data.licenseKey) {
      testBox.className = 'api-test-output-box api-test-success';
      testBox.textContent = `✅ Delivery Succeeded!\nMapped Variant ID Sent: ${data.variantId}\nDelivered Key: ${data.licenseKey}\n\nTest Order Meta:\n${JSON.stringify(data.testOrder, null, 2)}`;
    } else {
      testBox.className = 'api-test-output-box api-test-error';
      testBox.textContent = `❌ Delivery Simulation Failed:\nStatus: ${data.success ? 'Success' : 'Error'}\nMapped Variant ID: ${data.variantId || 'None'}\nDetails: ${data.error || JSON.stringify(data)}`;
    }
  } catch (err) {
    testBox.className = 'api-test-output-box api-test-error';
    testBox.textContent = `❌ Simulation error: ${err.message}`;
  }
}

function toggleProductModalDeliveryFields() {
  const delivery = document.getElementById('prodInputDelivery')?.value;
  const apiBox = document.getElementById('prodModalApiFields');
  if (!apiBox) return;
  if (delivery === 'custom_api') {
    apiBox.style.display = 'flex';
  } else {
    apiBox.style.display = 'none';
  }
}

// Global window exposure
window.openNewApiConnectionModal = openNewApiConnectionModal;
window.openEditApiConnectionModal = openEditApiConnectionModal;
window.deleteApiConnection = deleteApiConnection;
window.toggleApiConnection = toggleApiConnection;
window.runInlineApiTest = runInlineApiTest;
window.toggleCardApiKey = toggleCardApiKey;
window.toggleApiKeyInputVisibility = toggleApiKeyInputVisibility;
window.updateApiConnFormHints = updateApiConnFormHints;
window.runModalApiConnectionTest = runModalApiConnectionTest;
window.openVariantMappingModal = openVariantMappingModal;
window.renderVariantPlanInputs = renderVariantPlanInputs;
window.simulateProductDeliveryTest = simulateProductDeliveryTest;
// ------------------------------------------
// 9. Store Currency Management System
// ------------------------------------------
function renderCurrenciesTable(currencies, defaultCurrency) {
  const tbody = document.getElementById('currenciesTableBody');
  const select = document.getElementById('settingDefaultCurrency');
  const badge = document.getElementById('currentDefaultBadge');

  if (!currencies || !Array.isArray(currencies) || currencies.length === 0) {
    currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: 0.012 },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rate: 1.0 },
      { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', flag: '🇳🇵', rate: 1.6 }
    ];
  }

  const defCode = (defaultCurrency || 'USD').toUpperCase();
  const defObj = currencies.find(c => c.code === defCode) || currencies[0];

  if (badge && defObj) {
    badge.textContent = `${defObj.flag || '🌐'} ${defObj.code} (${defObj.symbol || ''})`;
  }

  if (select) {
    select.innerHTML = currencies.map(c => `
      <option value="${c.code}" ${c.code === defCode ? 'selected' : ''}>
        ${c.flag || '🌐'} ${c.name} (${c.code} ${c.symbol})
      </option>
    `).join('');
  }

  if (!tbody) return;

  tbody.innerHTML = currencies.map(c => {
    const isDefault = c.code === defCode;
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">${c.flag || '🌐'}</span>
            <strong>${c.code}</strong>
          </div>
        </td>
        <td>${escapeHtml(c.name || c.code)}</td>
        <td><code style="font-weight: 700; color: var(--accent-cyan); font-size: 13px;">${escapeHtml(c.symbol || '')}</code></td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 13px;">
            1 INR = <strong>${c.rate}</strong> ${c.code}
          </span>
          <br>
          <small class="muted" style="font-size: 10px;">
            (₹100 = ${c.symbol}${(100 * c.rate).toFixed(c.rate < 0.1 ? 2 : 0)} ${c.code})
          </small>
        </td>
        <td>
          ${isDefault 
            ? `<span class="badge badge-success" style="font-size: 11px;">⭐ Default</span>` 
            : `<button type="button" class="btn btn-sm btn-secondary" onclick="handleDefaultCurrencyChange('${c.code}')" style="font-size: 11px; padding: 2px 8px;">Set Default</button>`}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="openAddCurrencyModal('${c.code}')" title="Edit Exchange Rate">
              ✏️
            </button>
            <button type="button" class="btn btn-sm btn-danger" onclick="handleDeleteCurrency('${c.code}')" ${isDefault || currencies.length <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;" title="Cannot delete default or only currency"' : 'title="Remove Currency"'}>
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddCurrencyModal(editCode = null) {
  const title = document.getElementById('currencyModalTitle');
  const codeInp = document.getElementById('currencyCodeInput');
  const nameInp = document.getElementById('currencyNameInput');
  const symInp = document.getElementById('currencySymbolInput');
  const flagInp = document.getElementById('currencyFlagInput');
  const rateInp = document.getElementById('currencyRateInput');

  if (editCode && state.settings.currencies) {
    const cur = state.settings.currencies.find(c => c.code === editCode);
    if (cur) {
      title.textContent = `✏️ Edit Currency (${cur.code})`;
      codeInp.value = cur.code;
      codeInp.disabled = true;
      nameInp.value = cur.name || '';
      symInp.value = cur.symbol || '';
      flagInp.value = cur.flag || '';
      rateInp.value = cur.rate || '';
      openModal('currencyModal');
      return;
    }
  }

  title.textContent = '➕ Add Store Currency';
  codeInp.value = '';
  codeInp.disabled = false;
  nameInp.value = '';
  symInp.value = '';
  flagInp.value = '';
  rateInp.value = '';
  openModal('currencyModal');
}

async function handleSaveCurrency(event) {
  event.preventDefault();
  const code = document.getElementById('currencyCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('currencyNameInput').value.trim();
  const symbol = document.getElementById('currencySymbolInput').value.trim();
  const flag = document.getElementById('currencyFlagInput').value.trim();
  const rate = Number(document.getElementById('currencyRateInput').value);

  if (!code || !rate || rate <= 0) {
    showToast('Please provide valid Currency Code and positive Exchange Rate', 'error');
    return;
  }

  try {
    const res = await fetch('/api/currencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, symbol, flag, rate })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Currency ${code} saved successfully!`, 'success');
      closeModal('currencyModal');
      await fetchSettings();
    } else {
      showToast(data.error || 'Failed to save currency', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteCurrency(code) {
  if (!confirm(`Are you sure you want to remove "${code}" from your store currencies?`)) return;

  try {
    const res = await fetch(`/api/currencies/${encodeURIComponent(code)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Currency ${code} removed successfully!`, 'success');
      await fetchSettings();
    } else {
      showToast(data.error || 'Failed to delete currency', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDefaultCurrencyChange(newCode) {
  if (!newCode) return;
  try {
    const res = await fetch('/api/currencies/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Default store currency set to ${newCode}!`, 'success');
      await fetchSettings();
    } else {
      showToast(data.error || 'Failed to update default currency', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateCurrencyCalcPreview() {
  const inr = Number(document.getElementById('calcInputInr')?.value) || 0;
  const container = document.getElementById('currencyCalcResults');
  if (!container) return;

  const currencies = state.settings?.currencies || [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: 0.012 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rate: 1.0 },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', flag: '🇳🇵', rate: 1.6 }
  ];

  container.innerHTML = currencies.map(c => {
    let amount;
    if (c.code === 'USD' || c.code === 'EUR' || c.code === 'GBP' || c.rate < 0.1) {
      amount = (inr * c.rate).toFixed(2);
    } else {
      amount = Math.round(inr * c.rate).toLocaleString();
    }
    return `
      <span class="badge" style="background: rgba(0,210,255,0.12); color: #00d2ff; border: 1px solid rgba(0,210,255,0.3); font-size: 12px; padding: 4px 10px;">
        ${c.flag || '🌐'} ${c.symbol}${amount} ${c.code}
      </span>
    `;
  }).join('');
}

window.renderCurrenciesTable = renderCurrenciesTable;
window.openAddCurrencyModal = openAddCurrencyModal;
window.handleSaveCurrency = handleSaveCurrency;
window.handleDeleteCurrency = handleDeleteCurrency;
window.handleDefaultCurrencyChange = handleDefaultCurrencyChange;
window.updateCurrencyCalcPreview = updateCurrencyCalcPreview;
window.saveQuickVariantRow = saveQuickVariantRow;
window.testQuickVariantRow = testQuickVariantRow;
window.filterVariantMappingTable = filterVariantMappingTable;
window.toggleProductModalDeliveryFields = toggleProductModalDeliveryFields;

// ==========================================
// STOREFRONT & WEBSITE LIVE CMS CONTROLLER
// ==========================================

let webEditorConfig = null;

async function loadWebsiteEditorData() {
  try {
    const res = await fetch('/api/website-config');
    const data = await res.json();
    if (data.success && data.websiteConfig) {
      webEditorConfig = JSON.parse(JSON.stringify(data.websiteConfig));
    } else if (state.settings?.websiteConfig) {
      webEditorConfig = JSON.parse(JSON.stringify(state.settings.websiteConfig));
    } else {
      webEditorConfig = {};
    }
    populateWebsiteEditorFields();
  } catch (err) {
    console.error('Error loading website config:', err);
    if (state.settings?.websiteConfig) {
      webEditorConfig = JSON.parse(JSON.stringify(state.settings.websiteConfig));
      populateWebsiteEditorFields();
    }
  }
}

function populateWebsiteEditorFields() {
  if (!webEditorConfig) return;

  // 1. Branding
  setVal('webStoreName', webEditorConfig.storeName || state.settings?.storeName || 'White X Store');
  setVal('webTagline', webEditorConfig.tagline || 'Premium Undetected Cheats & Gaming Tools');
  setVal('webLogoUrl', webEditorConfig.logoUrl || 'logo.png');
  setVal('webAccentColor', webEditorConfig.accentColor || '#00e5ff');
  setVal('webAccentColorPicker', webEditorConfig.accentColor || '#00e5ff');
  setVal('webDiscordInvite', webEditorConfig.discordInvite || 'https://discord.gg/whitexstore');
  setVal('webTelegramUrl', webEditorConfig.telegramUrl || '');
  setVal('webYoutubeUrl', webEditorConfig.youtubeUrl || '');

  // 2. Announcement
  const ann = webEditorConfig.announcement || {};
  setCheckbox('webAnnounceEnabled', ann.enabled !== false);
  setVal('webAnnounceBadge', ann.badge || '⚡ LIVE UPDATE');
  setVal('webAnnounceText', ann.text || '');

  // 3. Hero
  const hero = webEditorConfig.hero || {};
  setVal('webHeroBadge', hero.badge || '🛡️ 100% Undetected • 0s Key Drop');
  setVal('webHeroTitle', hero.title || 'Dominate Every Match With Next-Gen Stealth Cheats');
  setVal('webHeroSubtitle', hero.subtitle || '');
  setVal('webHeroVideoUrl', hero.videoUrl || 'store_video.mp4');
  setCheckbox('webHeroShowVideo', hero.showVideo !== false);
  setVal('webHeroPrimaryText', hero.primaryBtnText || 'Browse Cheats Catalog');
  setVal('webHeroPrimaryLink', hero.primaryBtnLink || '#products');
  setVal('webHeroSecondaryText', hero.secondaryBtnText || 'Join Discord Server');
  setVal('webHeroSecondaryLink', hero.secondaryBtnLink || 'https://discord.gg/whitexstore');

  const stats = hero.stats || [
    { label: 'Active Gamers', value: '15,400+' },
    { label: 'Keys Delivered', value: '38,900+' },
    { label: 'Detection Rate', value: '0.0%' },
    { label: 'Instant Delivery', value: '< 1s' }
  ];

  stats.forEach((st, idx) => {
    if (idx < 4) {
      setVal(`webStatLabel${idx}`, st.label || '');
      setVal(`webStatVal${idx}`, st.value || '');
    }
  });

  // 4. Features
  if (!webEditorConfig.features) webEditorConfig.features = [];
  renderWebFeaturesList();

  // 5. Reviews
  if (!webEditorConfig.reviews) webEditorConfig.reviews = [];
  renderWebReviewsList();

  // 6. FAQs
  if (!webEditorConfig.faqs) webEditorConfig.faqs = [];
  renderWebFaqsList();

  // 7. Footer
  const footer = webEditorConfig.footer || {};
  setVal('webFooterAbout', footer.aboutText || '');
  setVal('webFooterDisclaimer', footer.disclaimer || '');
  setVal('webFooterCopyright', footer.copyright || '© 2026 White X Store. All rights reserved.');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

function setCheckbox(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(checked);
}

function renderWebFeaturesList() {
  const container = document.getElementById('webFeaturesList');
  if (!container) return;

  const features = webEditorConfig.features || [];
  if (features.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 10px;">No features added yet. Click "Add Feature Card" above.</p>`;
    return;
  }

  container.innerHTML = features.map((feat, idx) => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="width: 50px;">
        <label style="font-size: 11px;">Icon</label>
        <input type="text" class="form-input form-input-sm" value="${feat.icon || '⚡'}" oninput="webEditorConfig.features[${idx}].icon = this.value" style="text-align: center;">
      </div>
      <div style="flex: 1;">
        <label style="font-size: 11px;">Feature Title</label>
        <input type="text" class="form-input form-input-sm" value="${feat.title || ''}" oninput="webEditorConfig.features[${idx}].title = this.value" placeholder="Title">
        <label style="font-size: 11px; margin-top: 6px;">Description</label>
        <textarea class="form-input form-input-sm" rows="2" oninput="webEditorConfig.features[${idx}].description = this.value" placeholder="Brief feature summary">${feat.description || ''}</textarea>
      </div>
      <button type="button" class="btn btn-sm" style="color: #f43f5e; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); margin-top: 18px;" onclick="removeWebFeature(${idx})">
        🗑️
      </button>
    </div>
  `).join('');
}

function addNewWebFeature() {
  if (!webEditorConfig.features) webEditorConfig.features = [];
  webEditorConfig.features.push({
    icon: '⚡',
    title: 'New Advantage',
    description: 'Explain why your store is the best in gaming cheats and support.'
  });
  renderWebFeaturesList();
}

function removeWebFeature(idx) {
  if (!webEditorConfig.features) return;
  webEditorConfig.features.splice(idx, 1);
  renderWebFeaturesList();
}

function renderWebReviewsList() {
  const container = document.getElementById('webReviewsList');
  if (!container) return;

  const reviews = webEditorConfig.reviews || [];
  if (reviews.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 10px;">No reviews added yet. Click "Add Review" above.</p>`;
    return;
  }

  container.innerHTML = reviews.map((rev, idx) => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="flex: 1;">
        <div class="form-row" style="margin-bottom: 8px;">
          <div class="form-group flex-1">
            <label style="font-size: 11px;">Customer Name</label>
            <input type="text" class="form-input form-input-sm" value="${rev.author || ''}" oninput="webEditorConfig.reviews[${idx}].author = this.value" placeholder="e.g. GhostRider">
          </div>
          <div class="form-group flex-1">
            <label style="font-size: 11px;">Discord Tag</label>
            <input type="text" class="form-input form-input-sm" value="${rev.tag || ''}" oninput="webEditorConfig.reviews[${idx}].tag = this.value" placeholder="Ghost#1234">
          </div>
          <div class="form-group flex-1">
            <label style="font-size: 11px;">Product Bought</label>
            <input type="text" class="form-input form-input-sm" value="${rev.product || ''}" oninput="webEditorConfig.reviews[${idx}].product = this.value" placeholder="Android-Panel (30D)">
          </div>
          <div class="form-group" style="max-width: 90px;">
            <label style="font-size: 11px;">Stars (1-5)</label>
            <select class="form-input form-input-sm" onchange="webEditorConfig.reviews[${idx}].rating = Number(this.value)">
              <option value="5" ${rev.rating === 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐ (5)</option>
              <option value="4" ${rev.rating === 4 ? 'selected' : ''}>⭐⭐⭐⭐ (4)</option>
              <option value="3" ${rev.rating === 3 ? 'selected' : ''}>⭐⭐⭐ (3)</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size: 11px;">Testimonial Review</label>
          <textarea class="form-input form-input-sm" rows="2" oninput="webEditorConfig.reviews[${idx}].text = this.value" placeholder="What the customer said...">${rev.text || ''}</textarea>
        </div>
      </div>
      <button type="button" class="btn btn-sm" style="color: #f43f5e; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); margin-top: 20px;" onclick="removeWebReview(${idx})">
        🗑️
      </button>
    </div>
  `).join('');
}

function addNewWebReview() {
  if (!webEditorConfig.reviews) webEditorConfig.reviews = [];
  webEditorConfig.reviews.push({
    author: 'Verified Buyer',
    tag: 'Buyer#' + Math.floor(1000 + Math.random() * 9000),
    product: 'Android-Panel (30 Days)',
    rating: 5,
    text: 'Amazing undetected cheat, fast delivery, and very friendly support!',
    date: 'Just now'
  });
  renderWebReviewsList();
}

function removeWebReview(idx) {
  if (!webEditorConfig.reviews) return;
  webEditorConfig.reviews.splice(idx, 1);
  renderWebReviewsList();
}

function renderWebFaqsList() {
  const container = document.getElementById('webFaqsList');
  if (!container) return;

  const faqs = webEditorConfig.faqs || [];
  if (faqs.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 10px;">No FAQs added yet. Click "Add FAQ Item" above.</p>`;
    return;
  }

  container.innerHTML = faqs.map((faq, idx) => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="flex: 1;">
        <label style="font-size: 11px;">Question</label>
        <input type="text" class="form-input form-input-sm" value="${faq.q || ''}" oninput="webEditorConfig.faqs[${idx}].q = this.value" placeholder="e.g. How fast is delivery?">
        <label style="font-size: 11px; margin-top: 6px;">Answer</label>
        <textarea class="form-input form-input-sm" rows="2" oninput="webEditorConfig.faqs[${idx}].a = this.value" placeholder="Clear helpful answer for your customers">${faq.a || ''}</textarea>
      </div>
      <button type="button" class="btn btn-sm" style="color: #f43f5e; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); margin-top: 18px;" onclick="removeWebFaq(${idx})">
        🗑️
      </button>
    </div>
  `).join('');
}

function addNewWebFaq() {
  if (!webEditorConfig.faqs) webEditorConfig.faqs = [];
  webEditorConfig.faqs.push({
    q: 'How do I download and install the loader?',
    a: 'Once your payment is verified, you receive a direct loader download link with simple 1-click installer and tutorial video.'
  });
  renderWebFaqsList();
}

function removeWebFaq(idx) {
  if (!webEditorConfig.faqs) return;
  webEditorConfig.faqs.splice(idx, 1);
  renderWebFaqsList();
}

async function saveWebsiteEditorData() {
  try {
    const updated = {
      enabled: true,
      storeName: document.getElementById('webStoreName')?.value || 'White X Store',
      tagline: document.getElementById('webTagline')?.value || '',
      logoUrl: document.getElementById('webLogoUrl')?.value || 'logo.png',
      faviconUrl: document.getElementById('webLogoUrl')?.value || 'logo.png',
      accentColor: document.getElementById('webAccentColor')?.value || '#00e5ff',
      secondaryColor: '#8b5cf6',
      discordInvite: document.getElementById('webDiscordInvite')?.value || '',
      telegramUrl: document.getElementById('webTelegramUrl')?.value || '',
      youtubeUrl: document.getElementById('webYoutubeUrl')?.value || '',
      announcement: {
        enabled: document.getElementById('webAnnounceEnabled')?.checked ?? true,
        badge: document.getElementById('webAnnounceBadge')?.value || '⚡ LIVE UPDATE',
        text: document.getElementById('webAnnounceText')?.value || ''
      },
      hero: {
        badge: document.getElementById('webHeroBadge')?.value || '🛡️ 100% Undetected • 0s Key Drop',
        title: document.getElementById('webHeroTitle')?.value || '',
        subtitle: document.getElementById('webHeroSubtitle')?.value || '',
        showVideo: document.getElementById('webHeroShowVideo')?.checked ?? true,
        videoUrl: document.getElementById('webHeroVideoUrl')?.value || 'store_video.mp4',
        bannerUrl: 'https://i.imgur.com/8Qe87dE.png',
        primaryBtnText: document.getElementById('webHeroPrimaryText')?.value || 'Browse Cheats Catalog',
        primaryBtnLink: document.getElementById('webHeroPrimaryLink')?.value || '#products',
        secondaryBtnText: document.getElementById('webHeroSecondaryText')?.value || 'Join Discord Server',
        secondaryBtnLink: document.getElementById('webHeroSecondaryLink')?.value || 'https://discord.gg/whitexstore',
        stats: [
          { label: document.getElementById('webStatLabel0')?.value || 'Active Gamers', value: document.getElementById('webStatVal0')?.value || '15,400+' },
          { label: document.getElementById('webStatLabel1')?.value || 'Keys Delivered', value: document.getElementById('webStatVal1')?.value || '38,900+' },
          { label: document.getElementById('webStatLabel2')?.value || 'Detection Rate', value: document.getElementById('webStatVal2')?.value || '0.0%' },
          { label: document.getElementById('webStatLabel3')?.value || 'Instant Delivery', value: document.getElementById('webStatVal3')?.value || '< 1s' }
        ]
      },
      features: webEditorConfig?.features || [],
      reviews: webEditorConfig?.reviews || [],
      faqs: webEditorConfig?.faqs || [],
      footer: {
        aboutText: document.getElementById('webFooterAbout')?.value || '',
        disclaimer: document.getElementById('webFooterDisclaimer')?.value || '',
        copyright: document.getElementById('webFooterCopyright')?.value || '© 2026 White X Store. All rights reserved.'
      }
    };

    const res = await fetch('/api/website-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    const data = await res.json();
    if (data.success) {
      webEditorConfig = data.websiteConfig;
      if (state.settings) state.settings.websiteConfig = data.websiteConfig;
      
      const alertBox = document.getElementById('webEditorAlert');
      const alertMsg = document.getElementById('webEditorAlertMsg');
      if (alertBox && alertMsg) {
        alertMsg.textContent = '✅ All website details saved and updated successfully! Changes are live on your storefront.';
        alertBox.style.display = 'flex';
        setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
      }
    } else {
      alert('Failed to save website config: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error saving website config:', err);
    alert('Error saving website config: ' + err.message);
  }
}

function resetWebConfigToDefaults() {
  if (!confirm('Are you sure you want to restore the recommended professional storefront defaults?')) return;
  loadWebsiteEditorData();
}

window.loadWebsiteEditorData = loadWebsiteEditorData;
window.saveWebsiteEditorData = saveWebsiteEditorData;
window.addNewWebFeature = addNewWebFeature;
window.removeWebFeature = removeWebFeature;
window.addNewWebReview = addNewWebReview;
window.removeWebReview = removeWebReview;
window.addNewWebFaq = addNewWebFaq;
window.removeWebFaq = removeWebFaq;
window.resetWebConfigToDefaults = resetWebConfigToDefaults;

// ==========================================
// Discord Bot Embed Designer & Live Simulator
// ==========================================

const LUXURY_DISCORD_TEMPLATE = `╭──────────────────────────────────────────╮
  👑  **WHITE X STORE — OFFICIAL MARKETPLACE**
  *Your #1 Trusted Destination for Undetected Panels*
╰──────────────────────────────────────────╯

> ⚡ **Instant Key Delivery** • 🛡️ **Anti-Ban Protected** • 💳 **Multi-Currency / Instant Checkout**

### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘:
**1️⃣ Select Your Cheat / Panel:**
• Choose a product from the dropdown menu below (\`🛒 Select a Product / Panel...\`).

**2️⃣ Review Features, Prices & Live Status:**
• Once selected, an interactive live card will display all features, anti-ban status, and duration pricing (1D / 7D / 30D).

**3️⃣ Instant Payment & 0-Second Delivery:**
• Select your preferred duration plan and complete payment via eSewa (Nepal), UPI (India), Binance Pay (USD), or your Wallet Balance. License key is delivered instantly to your DM!

──────────────────────────────────────────
### 🚦 𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗨𝗦 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥𝗦:
• 🟢 **Safe / Undetected** : Fully Working *(Safe for Main Account)*
• 🟡 **Maintenance** : Under update *(Wait for announcement)*
• 🔴 **Patched / Offline** : Detected *(Do NOT buy or use right now)*

──────────────────────────────────────────
### 💳 𝗪𝗔𝗟𝗟𝗘𝗧 & 𝟭-𝗦𝗘𝗖𝗢𝗡𝗗 𝗖𝗛𝗘𝗖𝗞𝗢𝗨𝗧:
• Click **\`💳 My Wallet\`** below to check your current funds anytime.
• Click **\`➕ Add Balance / Top-up\`** to deposit funds and checkout with 1-click!`;

async function loadDiscordDesignerData() {
  if (!state.settings || Object.keys(state.settings).length === 0) {
    try {
      const res = await fetch('/api/settings');
      state.settings = await res.json();
    } catch (err) {
      console.warn('Could not load settings:', err);
    }
  }

  const s = state.settings || {};
  const shop = s.shopPage || {};
  const deal = s.dealPage || {};
  const pay = s.paymentPage || {};

  const storeName = s.storeName || 'White X Store';
  const color = shop.color || '#00d2ff';

  const elStoreName = document.getElementById('dsStoreName');
  if (elStoreName) elStoreName.value = storeName;

  const elColor = document.getElementById('dsEmbedColor');
  const elColorPicker = document.getElementById('dsEmbedColorPicker');
  if (elColor) elColor.value = color;
  if (elColorPicker) elColorPicker.value = color.startsWith('#') ? color : `#${color}`;

  const elAuthorName = document.getElementById('dsAuthorName');
  if (elAuthorName) elAuthorName.value = shop.authorName || `${storeName} • Official Automated Marketplace`;

  const elAuthorIcon = document.getElementById('dsAuthorIcon');
  if (elAuthorIcon) elAuthorIcon.value = shop.authorIcon || shop.thumbnailUrl || 'logo.png';

  const elEmbedTitle = document.getElementById('dsEmbedTitle');
  if (elEmbedTitle) elEmbedTitle.value = shop.title || `⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡`;

  const elThumbnail = document.getElementById('dsThumbnailUrl');
  if (elThumbnail) elThumbnail.value = shop.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png';

  const elBanner = document.getElementById('dsBannerUrl');
  if (elBanner) elBanner.value = shop.bannerUrl || 'https://i.imgur.com/8Qe87dE.png';

  const elFooter = document.getElementById('dsFooterText');
  if (elFooter) elFooter.value = shop.footer || `${storeName} • Select a product below to start • 24/7 Automated Delivery`;

  const elDesc = document.getElementById('dsEmbedDescription');
  if (elDesc) elDesc.value = shop.description && shop.description.trim() ? shop.description : LUXURY_DISCORD_TEMPLATE;

  const elDeal = document.getElementById('dsDealInstructions');
  if (elDeal) elDeal.value = deal.instructions || '1. Please confirm your order details above.\n2. Tap the 🤝 Make Deal / Pay Now button below when you are ready to make payment.\n3. The QR Code & Payment options will unlock instantly in this channel!';

  const elUpi = document.getElementById('dsUpiInstructions');
  if (elUpi) elUpi.value = pay.upiInstructions || '📱 Scan the QR Code below using Google Pay / PhonePe / Paytm / BHIM to complete payment!\nAfter payment, click 📸 Upload Proof from Gallery or submit your 12-digit UTR number below.';

  const elCard = document.getElementById('dsCardInstructions');
  if (elCard) elCard.value = pay.cardInstructions || 'Pay securely with your preferred payment gateway.\nAfter completing payment, submit your reference ID or payment screenshot.';

  const elChan = document.getElementById('dsTargetChannelId');
  if (elChan) elChan.value = s.shopChannelId || s.verificationChannelId || '';

  updateDiscordEmbedPreview();
}

function parseDiscordMarkdown(text) {
  if (!text) return '';

  // 1. Escape HTML
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Headings (### Title)
  out = out.replace(/^###\s+(.*)$/gim, '<div style="font-size: 14px; font-weight: 700; color: #f2f3f5; margin-top: 10px; margin-bottom: 4px;">$1</div>');

  // 3. Dividers (─────)
  out = out.replace(/^[─—–-]{5,}$/gim, '<div style="height: 1px; background: rgba(255,255,255,0.08); margin: 10px 0;"></div>');

  // 4. Blockquotes (&gt; Text)
  out = out.replace(/^&gt;\s*(.*)$/gim, '<div style="display: flex; gap: 8px; margin: 4px 0;"><div style="width: 4px; background: #4e5058; border-radius: 2px;"></div><div style="color: #dbdee1;">$1</div></div>');

  // 5. Bold (**text**)
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f2f3f5; font-weight: 700;">$1</strong>');

  // 6. Italic (*text*)
  out = out.replace(/\*(.*?)\*/g, '<em style="color: #dbdee1;">$1</em>');

  // 7. Inline Code (`code`)
  out = out.replace(/`([^`]+)`/g, '<code style="background: #2b2d31; color: #dbdee1; padding: 2px 5px; border-radius: 4px; font-family: Consolas, monospace; font-size: 12px;">$1</code>');

  // 8. Newlines to <br>
  out = out.replace(/\n/g, '<br>');

  return out;
}

function updateDiscordEmbedPreview() {
  const storeName = document.getElementById('dsStoreName')?.value || 'White X Store';
  let color = document.getElementById('dsEmbedColor')?.value || '#00d2ff';
  if (!color.startsWith('#')) color = `#${color}`;

  const authorName = document.getElementById('dsAuthorName')?.value || `${storeName} • Official Automated Marketplace`;
  const authorIcon = document.getElementById('dsAuthorIcon')?.value || 'logo.png';
  const embedTitle = document.getElementById('dsEmbedTitle')?.value || `⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡`;
  const thumbnailUrl = document.getElementById('dsThumbnailUrl')?.value || '';
  const bannerUrl = document.getElementById('dsBannerUrl')?.value || '';
  const footerText = document.getElementById('dsFooterText')?.value || `${storeName} • Select a product below to start • 24/7 Automated Delivery`;
  const descRaw = document.getElementById('dsEmbedDescription')?.value || '';

  // Update Preview Elements
  const prevBotName = document.getElementById('prevBotName');
  if (prevBotName) prevBotName.textContent = storeName;

  const prevCard = document.getElementById('prevEmbedCard');
  if (prevCard) prevCard.style.borderLeftColor = color;

  const prevAuthorName = document.getElementById('prevAuthorName');
  if (prevAuthorName) prevAuthorName.textContent = authorName;

  const prevAuthorIcon = document.getElementById('prevAuthorIcon');
  if (prevAuthorIcon) {
    if (authorIcon && authorIcon.trim()) {
      prevAuthorIcon.src = authorIcon;
      prevAuthorIcon.style.display = 'inline-block';
    } else {
      prevAuthorIcon.style.display = 'none';
    }
  }

  const prevTitle = document.getElementById('prevEmbedTitle');
  if (prevTitle) prevTitle.textContent = embedTitle;

  const prevDesc = document.getElementById('prevEmbedDesc');
  if (prevDesc) {
    prevDesc.innerHTML = parseDiscordMarkdown(descRaw);
  }

  const prevThumb = document.getElementById('prevThumbnailImg');
  if (prevThumb) {
    if (thumbnailUrl && thumbnailUrl.trim()) {
      prevThumb.src = thumbnailUrl;
      prevThumb.style.display = 'block';
    } else {
      prevThumb.style.display = 'none';
    }
  }

  const prevBanner = document.getElementById('prevBannerImg');
  if (prevBanner) {
    if (bannerUrl && bannerUrl.trim()) {
      prevBanner.src = bannerUrl;
      prevBanner.style.display = 'block';
    } else {
      prevBanner.style.display = 'none';
    }
  }

  const prevFooter = document.getElementById('prevFooterText');
  if (prevFooter) prevFooter.textContent = footerText;
}

function setDesignerColor(hex) {
  const elColor = document.getElementById('dsEmbedColor');
  const elColorPicker = document.getElementById('dsEmbedColorPicker');
  if (elColor) elColor.value = hex;
  if (elColorPicker) elColorPicker.value = hex;
  updateDiscordEmbedPreview();
}

function insertDesignerSnippet(snippetType) {
  const elDesc = document.getElementById('dsEmbedDescription');
  if (!elDesc) return;

  const storeName = document.getElementById('dsStoreName')?.value || 'WHITE X STORE';

  if (snippetType === 'frame') {
    const frame = `╭──────────────────────────────────────────╮\n  👑  **${storeName.toUpperCase()} — OFFICIAL MARKETPLACE**\n  *Your #1 Trusted Destination for Undetected Panels*\n╰──────────────────────────────────────────╯\n\n`;
    elDesc.value = frame + elDesc.value;
  } else if (snippetType === 'steps') {
    const steps = `\n### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘:\n**1️⃣ Select Your Cheat / Panel:** Choose a product from the dropdown menu below.\n**2️⃣ Review Features & Status:** Inspect features, anti-cheat status, and duration pricing in the private card.\n**3️⃣ 0-Second Delivery:** Complete payment via eSewa, UPI, Binance Pay, or Wallet for instant key delivery in your DM!\n\n`;
    elDesc.value += steps;
  } else if (snippetType === 'status') {
    const status = `\n──────────────────────────────────────────\n### 🚦 𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗨𝗦 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥𝗦:\n• 🟢 **Safe / Undetected** : Fully Working *(Safe for Main Account)*\n• 🟡 **Maintenance** : Under update *(Wait for announcement)*\n• 🔴 **Patched / Offline** : Detected *(Do NOT buy or use right now)*\n\n`;
    elDesc.value += status;
  } else if (snippetType === 'wallet') {
    const wallet = `\n──────────────────────────────────────────\n### 💳 𝗪𝗔𝗟𝗟𝗘𝗧 & 𝟭-𝗦𝗘𝗖𝗢𝗡𝗗 𝗖𝗛𝗘𝗖𝗞𝗢𝗨𝗧:\n• Click **\`💳 My Wallet\`** below to check your balance.\n• Click **\`➕ Add Balance / Top-up\`** to deposit funds and checkout with 1-click!\n\n`;
    elDesc.value += wallet;
  } else if (snippetType === 'restore') {
    if (!confirm('Restore the default luxury Discord embed template?')) return;
    elDesc.value = LUXURY_DISCORD_TEMPLATE;
  }

  updateDiscordEmbedPreview();
}

async function saveDiscordDesignerData() {
  const storeName = document.getElementById('dsStoreName')?.value.trim() || 'White X Store';
  let color = document.getElementById('dsEmbedColor')?.value.trim() || '#00d2ff';
  if (!color.startsWith('#')) color = `#${color}`;

  const authorName = document.getElementById('dsAuthorName')?.value.trim();
  const authorIcon = document.getElementById('dsAuthorIcon')?.value.trim();
  const title = document.getElementById('dsEmbedTitle')?.value.trim();
  const thumbnailUrl = document.getElementById('dsThumbnailUrl')?.value.trim();
  const bannerUrl = document.getElementById('dsBannerUrl')?.value.trim();
  const footer = document.getElementById('dsFooterText')?.value.trim();
  const description = document.getElementById('dsEmbedDescription')?.value;

  const dealInstructions = document.getElementById('dsDealInstructions')?.value;
  const upiInstructions = document.getElementById('dsUpiInstructions')?.value;
  const cardInstructions = document.getElementById('dsCardInstructions')?.value;
  const shopChannelId = document.getElementById('dsTargetChannelId')?.value.trim();

  const payload = {
    storeName,
    shopChannelId: shopChannelId || state.settings?.shopChannelId,
    shopPage: {
      title,
      description,
      bannerUrl,
      thumbnailUrl,
      color,
      footer,
      authorName,
      authorIcon
    },
    dealPage: {
      instructions: dealInstructions
    },
    paymentPage: {
      upiInstructions,
      cardInstructions
    }
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      state.settings = { ...state.settings, ...payload };
      alert('✅ All Discord Bot Embed settings and instructions saved successfully!');
    } else {
      alert('⚠️ Failed to save settings: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error saving Discord Designer settings:', err);
    alert('⚠️ Error saving settings: ' + err.message);
  }
}

async function deployShopEmbedFromDesigner() {
  const channelId = document.getElementById('dsTargetChannelId')?.value.trim();
  if (!channelId) {
    alert('Please enter a target Discord Channel ID before deploying!');
    document.getElementById('dsTargetChannelId')?.focus();
    return;
  }

  // Save changes first
  await saveDiscordDesignerData();

  try {
    const res = await fetch('/api/bot/shop-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 SUCCESS! Official Storefront Embed deployed to Discord channel: #${data.channelName}\nMessage ID: ${data.messageId}`);
    } else {
      alert('⚠️ Could not deploy to Discord: ' + (data.error || 'Make sure the bot is online and in the target server.'));
    }
  } catch (err) {
    console.error('Error deploying to Discord:', err);
    alert('⚠️ Deployment request failed: ' + err.message);
  }
}

window.loadDiscordDesignerData = loadDiscordDesignerData;
window.updateDiscordEmbedPreview = updateDiscordEmbedPreview;
window.setDesignerColor = setDesignerColor;
window.insertDesignerSnippet = insertDesignerSnippet;
window.saveDiscordDesignerData = saveDiscordDesignerData;
window.deployShopEmbedFromDesigner = deployShopEmbedFromDesigner;

// ------------------------------------------
// REDEEM / GIFT CODES MANAGEMENT
// ------------------------------------------
async function loadRedeemCodes() {
  const tbody = document.getElementById('redeemCodesTbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center muted">Loading redeem codes...</td></tr>';
  }

  try {
    const res = await fetch('/api/redeem-codes');
    const data = await res.json();
    state.redeemCodes = data.codes || [];

    const stats = data.stats || { total: 0, active: 0, totalClaimed: 0, totalValue: 0 };
    const elTot = document.getElementById('statRedeemTotal');
    const elAct = document.getElementById('statRedeemActive');
    const elCla = document.getElementById('statRedeemClaimed');
    const elVal = document.getElementById('statRedeemValue');

    if (elTot) elTot.textContent = stats.total;
    if (elAct) elAct.textContent = stats.active;
    if (elCla) elCla.textContent = stats.totalClaimed;
    if (elVal) elVal.textContent = `₹${stats.totalValue.toLocaleString()}`;

    renderRedeemCodesTable(state.redeemCodes);
  } catch (err) {
    console.error('Error loading redeem codes:', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="color: var(--accent-rose);">Failed to load redeem codes.</td></tr>';
    }
  }
}

function renderRedeemCodesTable(codes) {
  const tbody = document.getElementById('redeemCodesTbody');
  if (!tbody) return;

  if (!codes || codes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center muted" style="padding: 24px;">No redeem codes found. Click "Generate Code" above to create your first promo code!</td></tr>';
    return;
  }

  tbody.innerHTML = codes
    .map(c => {
      const now = Date.now();
      const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < now;
      const isMaxed = c.maxUses > 0 && c.usedCount >= c.maxUses;
      const isActive = c.isActive !== false && !isExpired && !isMaxed;

      let statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">🟢 Active</span>';
      if (!c.isActive) {
        statusBadge = '<span class="badge" style="background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.4);">⚫ Disabled</span>';
      } else if (isExpired) {
        statusBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">🟡 Expired</span>';
      } else if (isMaxed) {
        statusBadge = '<span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3);">🔴 Claimed Out</span>';
      }

      const rewardDisplay =
        c.type === 'item'
          ? `<div style="display: flex; align-items: center; gap: 6px;">
               <span style="font-size: 16px;">📦</span>
               <strong>${escapeHtml(c.productName || 'Store Item')}</strong>
               <span class="badge" style="background: rgba(0, 229, 255, 0.1); color: #00e5ff; font-size: 11px;">${escapeHtml(c.planDuration || '30 Days')}</span>
             </div>`
          : `<div style="display: flex; align-items: center; gap: 6px;">
               <span style="font-size: 16px;">💳</span>
               <strong style="color: #10b981;">₹${c.amount}</strong>
               <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-size: 11px;">Wallet Credit</span>
             </div>`;

      const claimsProgress =
        c.maxUses > 0
          ? `<div style="display: flex; align-items: center; gap: 8px;">
               <span><strong>${c.usedCount}</strong> / ${c.maxUses}</span>
               ${c.usedCount > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openClaimedByModal('${escapeHtml(c.code)}')" style="padding: 2px 6px; font-size: 10px;">👥 View (${c.usedCount})</button>` : ''}
             </div>`
          : `<span><strong>${c.usedCount}</strong> / ∞</span> ${c.usedCount > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openClaimedByModal('${escapeHtml(c.code)}')" style="padding: 2px 6px; font-size: 10px;">👥 View</button>` : ''}`;

      const expiryDisplay = c.expiresAt
        ? `<span style="font-size: 11px;">${new Date(c.expiresAt).toLocaleDateString()}</span>`
        : '<span class="muted" style="font-size: 11px;">No Expiry</span>';

      const createdDisplay = `
        <div style="font-size: 11px;">
          <div>${escapeHtml(c.createdBy || 'Staff')}</div>
          <span class="muted">${new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
      `;

      return `
        <tr id="row-redeem-${escapeHtml(c.code)}">
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <code style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-weight: 700; color: #00e5ff; letter-spacing: 0.5px;">${escapeHtml(c.code)}</code>
              <button type="button" class="btn btn-secondary btn-sm" onclick="copyRedeemCode('${escapeHtml(c.code)}')" title="Copy Code" style="padding: 3px 7px;">📋</button>
            </div>
            ${c.note ? `<div class="muted" style="font-size: 11px; margin-top: 3px;">📝 ${escapeHtml(c.note)}</div>` : ''}
          </td>
          <td>
            <span class="badge" style="font-size: 11px; text-transform: uppercase;">${c.type}</span>
          </td>
          <td>${rewardDisplay}</td>
          <td>${claimsProgress}</td>
          <td>${statusBadge}</td>
          <td>${createdDisplay}</td>
          <td>${expiryDisplay}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleRedeemCodeActive('${escapeHtml(c.code)}')" title="${c.isActive ? 'Disable Code' : 'Enable Code'}">
                ${c.isActive ? '⏸️' : '▶️'}
              </button>
              <button type="button" class="btn btn-danger btn-sm" onclick="deleteRedeemCode('${escapeHtml(c.code)}')" title="Delete Code">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function filterRedeemCodesTable() {
  const query = (document.getElementById('redeemSearchInput')?.value || '').toLowerCase().trim();
  if (!query) {
    renderRedeemCodesTable(state.redeemCodes);
    return;
  }
  const filtered = (state.redeemCodes || []).filter(c => {
    return (
      (c.code || '').toLowerCase().includes(query) ||
      (c.productName || '').toLowerCase().includes(query) ||
      (c.note || '').toLowerCase().includes(query) ||
      (c.createdBy || '').toLowerCase().includes(query) ||
      (c.type || '').toLowerCase().includes(query)
    );
  });
  renderRedeemCodesTable(filtered);
}

function openNewRedeemModal() {
  // 1. Immediately open the modal dialog without any blocking wait
  openModal('redeemModal');

  // 2. Reset form inputs
  setRedeemType('item');
  const customCodeInput = document.getElementById('redeemCustomCode');
  if (customCodeInput) customCodeInput.value = '';
  const maxUsesInput = document.getElementById('redeemMaxUses');
  if (maxUsesInput) maxUsesInput.value = '1';
  const expiryDaysInput = document.getElementById('redeemExpiryDays');
  if (expiryDaysInput) expiryDaysInput.value = '';
  const noteInput = document.getElementById('redeemNote');
  if (noteInput) noteInput.value = '';
  const walletAmountInput = document.getElementById('redeemWalletAmount');
  if (walletAmountInput) walletAmountInput.value = '';

  // 3. Populate product options asynchronously
  populateRedeemModalProducts();
}

async function populateRedeemModalProducts() {
  const select = document.getElementById('redeemProductSelect');
  if (!select) return;

  if (!Array.isArray(state.products) || state.products.length === 0) {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (Array.isArray(data)) state.products = data;
    } catch (err) {
      console.error('Failed to load products for redeem modal:', err);
    }
  }

  if (Array.isArray(state.products) && state.products.length > 0) {
    select.innerHTML = state.products
      .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.category || 'Cheat')})</option>`)
      .join('');
    updateRedeemPlanOptions();
  } else {
    select.innerHTML = '<option value="">No products available</option>';
  }
}

function setRedeemType(type) {
  const typeInput = document.getElementById('redeemType');
  if (typeInput) typeInput.value = type;
  const isItem = type === 'item';
  const itemGrp = document.getElementById('redeemItemGroup');
  const walletGrp = document.getElementById('redeemWalletGroup');
  const btnItem = document.getElementById('btnTypeItem');
  const btnWallet = document.getElementById('btnTypeWallet');

  if (itemGrp) itemGrp.style.display = isItem ? 'block' : 'none';
  if (walletGrp) walletGrp.style.display = isItem ? 'none' : 'block';

  if (btnItem) {
    btnItem.style.borderColor = isItem ? '#00e5ff' : 'var(--border-subtle)';
    btnItem.style.color = isItem ? '#00e5ff' : 'var(--text-muted)';
    btnItem.style.fontWeight = isItem ? '700' : '400';
  }
  if (btnWallet) {
    btnWallet.style.borderColor = !isItem ? '#10b981' : 'var(--border-subtle)';
    btnWallet.style.color = !isItem ? '#10b981' : 'var(--text-muted)';
    btnWallet.style.fontWeight = !isItem ? '700' : '400';
  }
}

function updateRedeemPlanOptions() {
  const prodId = document.getElementById('redeemProductSelect')?.value;
  const planSelect = document.getElementById('redeemPlanSelect');
  if (!planSelect) return;
  if (!prodId || !Array.isArray(state.products)) {
    planSelect.innerHTML = '<option value="30d">30 Days</option>';
    return;
  }

  const product = state.products.find(p => p.id === prodId);
  if (!product || !product.plans || Object.keys(product.plans).length === 0) {
    planSelect.innerHTML = '<option value="30d">30 Days</option>';
    return;
  }

  planSelect.innerHTML = Object.entries(product.plans)
    .map(([key, plan]) => `<option value="${escapeHtml(key)}">${escapeHtml(plan.label || `${plan.durationDays} Days`)} — ₹${plan.price}</option>`)
    .join('');
}

function generateRandomRedeemCodeField() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const input = document.getElementById('redeemCustomCode');
  if (input) {
    input.value = `WX-${rand(4)}-${rand(4)}-${rand(4)}`;
  }
}

async function handleCreateRedeemCode(e) {
  if (e && e.preventDefault) e.preventDefault();
  const type = document.getElementById('redeemType')?.value || 'item';
  const productId = document.getElementById('redeemProductSelect')?.value;
  const planKey = document.getElementById('redeemPlanSelect')?.value;
  const amount = Number(document.getElementById('redeemWalletAmount')?.value) || 0;
  const customCode = document.getElementById('redeemCustomCode')?.value.trim();
  const maxUses = document.getElementById('redeemMaxUses')?.value;
  const expiryDays = Number(document.getElementById('redeemExpiryDays')?.value) || 0;
  const note = document.getElementById('redeemNote')?.value.trim();

  if (type === 'item' && !productId) {
    alert('Please select a product/cheat for the item code.');
    return;
  }

  if (type === 'wallet' && amount <= 0) {
    alert('Please enter a valid wallet balance amount (minimum ₹1).');
    return;
  }

  const submitBtn = document.getElementById('btnSaveRedeemCode');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Generating...';
  }

  let expiresAt = null;
  if (expiryDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiryDays);
    expiresAt = exp.toISOString();
  }

  try {
    const res = await fetch('/api/redeem-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: customCode || null,
        type,
        productId,
        planKey,
        amount,
        maxUses,
        expiresAt,
        note
      })
    });
    const data = await res.json();
    if (data.success && data.code) {
      showToast(`🎁 Redeem code created: ${data.code.code}`, 'success');
      closeModal('redeemModal');
      loadRedeemCodes();
    } else {
      alert('Error: ' + (data.error || 'Failed to create redeem code'));
    }
  } catch (err) {
    console.error('Error creating redeem code:', err);
    alert('Request failed: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

function openBulkRedeemModal() {
  // 1. Immediately open bulk modal
  openModal('bulkRedeemModal');

  // 2. Reset form inputs
  setBulkRedeemType('item');
  const countInput = document.getElementById('bulkCount');
  if (countInput) countInput.value = '5';
  const prefixInput = document.getElementById('bulkPrefix');
  if (prefixInput) prefixInput.value = 'GIFT';
  const maxUsesInput = document.getElementById('bulkMaxUses');
  if (maxUsesInput) maxUsesInput.value = '1';
  const expiryDaysInput = document.getElementById('bulkExpiryDays');
  if (expiryDaysInput) expiryDaysInput.value = '';
  const noteInput = document.getElementById('bulkNote');
  if (noteInput) noteInput.value = '';
  const walletAmountInput = document.getElementById('bulkWalletAmount');
  if (walletAmountInput) walletAmountInput.value = '';
  const resultContainer = document.getElementById('bulkResultContainer');
  if (resultContainer) resultContainer.style.display = 'none';
  const outputArea = document.getElementById('bulkOutputArea');
  if (outputArea) outputArea.value = '';

  // 3. Populate product options asynchronously
  populateBulkModalProducts();
}

async function populateBulkModalProducts() {
  const select = document.getElementById('bulkProductSelect');
  if (!select) return;

  if (!Array.isArray(state.products) || state.products.length === 0) {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (Array.isArray(data)) state.products = data;
    } catch (err) {
      console.error('Failed to load products for bulk redeem modal:', err);
    }
  }

  if (Array.isArray(state.products) && state.products.length > 0) {
    select.innerHTML = state.products
      .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.category || 'Cheat')})</option>`)
      .join('');
    updateBulkPlanOptions();
  } else {
    select.innerHTML = '<option value="">No products available</option>';
  }
}

function setBulkRedeemType(type) {
  const typeInput = document.getElementById('bulkType');
  if (typeInput) typeInput.value = type;
  const isItem = type === 'item';
  const itemGrp = document.getElementById('bulkItemGroup');
  const walletGrp = document.getElementById('bulkWalletGroup');
  const btnItem = document.getElementById('btnBulkTypeItem');
  const btnWallet = document.getElementById('btnBulkTypeWallet');

  if (itemGrp) itemGrp.style.display = isItem ? 'block' : 'none';
  if (walletGrp) walletGrp.style.display = isItem ? 'none' : 'block';

  if (btnItem) {
    btnItem.style.borderColor = isItem ? '#00e5ff' : 'var(--border-subtle)';
    btnItem.style.color = isItem ? '#00e5ff' : 'var(--text-muted)';
    btnItem.style.fontWeight = isItem ? '700' : '400';
  }
  if (btnWallet) {
    btnWallet.style.borderColor = !isItem ? '#10b981' : 'var(--border-subtle)';
    btnWallet.style.color = !isItem ? '#10b981' : 'var(--text-muted)';
    btnWallet.style.fontWeight = !isItem ? '700' : '400';
  }
}

function updateBulkPlanOptions() {
  const prodId = document.getElementById('bulkProductSelect')?.value;
  const planSelect = document.getElementById('bulkPlanSelect');
  if (!planSelect) return;
  if (!prodId || !Array.isArray(state.products)) {
    planSelect.innerHTML = '<option value="30d">30 Days</option>';
    return;
  }

  const product = state.products.find(p => p.id === prodId);
  if (!product || !product.plans || Object.keys(product.plans).length === 0) {
    planSelect.innerHTML = '<option value="30d">30 Days</option>';
    return;
  }

  planSelect.innerHTML = Object.entries(product.plans)
    .map(([key, plan]) => `<option value="${escapeHtml(key)}">${escapeHtml(plan.label || `${plan.durationDays} Days`)} — ₹${plan.price}</option>`)
    .join('');
}

async function handleBulkCreateRedeemCodes(e) {
  if (e && e.preventDefault) e.preventDefault();
  const count = Number(document.getElementById('bulkCount')?.value) || 5;
  const prefix = document.getElementById('bulkPrefix')?.value.trim() || 'GIFT';
  const type = document.getElementById('bulkType')?.value || 'item';
  const productId = document.getElementById('bulkProductSelect')?.value;
  const planKey = document.getElementById('bulkPlanSelect')?.value;
  const amount = Number(document.getElementById('bulkWalletAmount')?.value) || 0;
  const maxUses = Number(document.getElementById('bulkMaxUses')?.value) || 1;
  const expiryDays = Number(document.getElementById('bulkExpiryDays')?.value) || 0;
  const note = document.getElementById('bulkNote')?.value.trim();

  if (type === 'item' && !productId) {
    alert('Please select a product/cheat for the item codes.');
    return;
  }

  if (type === 'wallet' && amount <= 0) {
    alert('Please enter a valid wallet balance amount (minimum ₹1).');
    return;
  }

  const submitBtn = e?.target ? e.target.querySelector('button[type="submit"]') : null;
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Generating...';
  }

  let expiresAt = null;
  if (expiryDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiryDays);
    expiresAt = exp.toISOString();
  }

  try {
    const res = await fetch('/api/redeem-codes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count,
        prefix,
        type,
        productId,
        planKey,
        amount,
        maxUses,
        expiresAt,
        note
      })
    });
    const data = await res.json();
    if (data.success && data.codes) {
      const outputText = data.codes.map(c => c.code).join('\n');
      document.getElementById('bulkOutputArea').value = outputText;
      document.getElementById('bulkResultContainer').style.display = 'block';
      showToast(`⚡ Generated ${data.count} codes successfully!`, 'success');
      loadRedeemCodes();
    } else {
      alert('Error: ' + (data.error || 'Failed to bulk generate codes'));
    }
  } catch (err) {
    console.error('Error in bulk generate:', err);
    alert('Request failed: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

function copyAllBulkCodes() {
  const text = document.getElementById('bulkOutputArea')?.value;
  if (!text) return;
  safeCopyToClipboard(text, '📋 All generated codes copied to clipboard!');
}

function copyRedeemCode(code) {
  if (!code) return;
  safeCopyToClipboard(code, `📋 Copied code: ${code}`);
}

function safeCopyToClipboard(text, toastMsg = 'Copied to clipboard!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(toastMsg, 'success');
    }).catch(() => {
      fallbackCopy(text, toastMsg);
    });
  } else {
    fallbackCopy(text, toastMsg);
  }
}

function fallbackCopy(text, toastMsg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(toastMsg, 'success');
  } catch (err) {
    prompt('Copy code manually:', text);
  }
}

async function deleteRedeemCode(code) {
  if (!confirm(`Are you sure you want to delete and revoke code "${code}"?`)) return;
  try {
    const res = await fetch(`/api/redeem-codes/${encodeURIComponent(code)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🗑️ Code "${code}" deleted.`, 'info');
      loadRedeemCodes();
    } else {
      alert('Error: ' + (data.error || 'Could not delete code'));
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
}

async function toggleRedeemCodeActive(code) {
  try {
    const res = await fetch(`/api/redeem-codes/${encodeURIComponent(code)}/toggle`, {
      method: 'PATCH'
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Code "${code}" status updated.`, 'info');
      loadRedeemCodes();
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
}

function openClaimedByModal(codeStr) {
  const code = (state.redeemCodes || []).find(c => c.code === codeStr);
  if (!code) return;
  document.getElementById('claimedByModalTitle').textContent = `👥 Claim History for "${code.code}"`;
  const tbody = document.getElementById('claimedByTbody');
  if (!tbody) return;

  const claims = code.claimedBy || [];
  if (claims.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center muted">No users have claimed this code yet.</td></tr>';
  } else {
    tbody.innerHTML = claims
      .map(c => `
        <tr>
          <td>
            <strong>${escapeHtml(c.username || 'User')}</strong>
            <div class="muted" style="font-size: 11px;">ID: ${escapeHtml(c.userId)}</div>
          </td>
          <td>${new Date(c.claimedAt).toLocaleString()}</td>
          <td>
            ${c.deliveredKey ? `<code style="color: #00e5ff; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${escapeHtml(c.deliveredKey)}</code>` : '<span class="muted">—</span>'}
          </td>
        </tr>
      `)
      .join('');
  }
  openModal('claimedByModal');
}

window.loadRedeemCodes = loadRedeemCodes;
window.renderRedeemCodesTable = renderRedeemCodesTable;
window.filterRedeemCodesTable = filterRedeemCodesTable;
window.openNewRedeemModal = openNewRedeemModal;
window.setRedeemType = setRedeemType;
window.updateRedeemPlanOptions = updateRedeemPlanOptions;
window.generateRandomRedeemCodeField = generateRandomRedeemCodeField;
window.handleCreateRedeemCode = handleCreateRedeemCode;
window.openBulkRedeemModal = openBulkRedeemModal;
window.setBulkRedeemType = setBulkRedeemType;
window.updateBulkPlanOptions = updateBulkPlanOptions;
window.handleBulkCreateRedeemCodes = handleBulkCreateRedeemCodes;
window.copyAllBulkCodes = copyAllBulkCodes;
window.copyRedeemCode = copyRedeemCode;
window.deleteRedeemCode = deleteRedeemCode;
window.toggleRedeemCodeActive = toggleRedeemCodeActive;
window.openClaimedByModal = openClaimedByModal;
window.populateRedeemModalProducts = populateRedeemModalProducts;
window.populateBulkModalProducts = populateBulkModalProducts;


