const crypto = require('crypto');
const db = require('../../database/db');

// In-memory stores
const captchaStore = new Map(); // captchaId -> { code, expiresAt }
const sessionStore = new Map(); // token -> { username, createdAt, expiresAt }
const rateLimitStore = new Map(); // ip -> { count, lockedUntil }

// Cleanup expired captchas and sessions every 2 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, data] of captchaStore.entries()) {
    if (now > data.expiresAt) captchaStore.delete(id);
  }
  for (const [token, data] of sessionStore.entries()) {
    if (now > data.expiresAt) sessionStore.delete(token);
  }
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.lockedUntil && data.count === 0) rateLimitStore.delete(ip);
  }
}, 120000);
if (cleanupTimer && cleanupTimer.unref) cleanupTimer.unref();

/**
 * Generate cryptographic hash with salt
 */
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

/**
 * Get or initialize Admin Credentials from db settings or environment
 */
function getAdminCredentials() {
  const settings = db.getSettings();
  if (settings.adminAuth && settings.adminAuth.username && settings.adminAuth.passwordHash) {
    return settings.adminAuth;
  }

  // Default initial credentials: admin / admin (or .env if set)
  const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(defaultPassword, salt);

  const adminAuth = {
    username: defaultUsername,
    salt,
    passwordHash,
    updatedAt: new Date().toISOString()
  };

  settings.adminAuth = adminAuth;
  db.saveSettings();
  return adminAuth;
}

/**
 * Update Admin Credentials
 */
function updateAdminCredentials(newUsername, newPassword) {
  if (!newUsername || newUsername.trim().length < 3) {
    throw new Error('Username must be at least 3 characters long');
  }
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long');
  }

  const settings = db.getSettings();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);

  settings.adminAuth = {
    username: newUsername.trim(),
    salt,
    passwordHash,
    updatedAt: new Date().toISOString()
  };

  db.saveSettings();
  // Invalidate all existing sessions on password change
  sessionStore.clear();
  return { username: settings.adminAuth.username };
}

/**
 * Authenticate username and password
 */
function authenticateUser(username, password) {
  const creds = getAdminCredentials();
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  if (username.trim().toLowerCase() !== creds.username.toLowerCase()) {
    return { success: false, error: 'Invalid username or password' };
  }

  const computedHash = hashPassword(password, creds.salt);
  if (computedHash !== creds.passwordHash) {
    return { success: false, error: 'Invalid username or password' };
  }

  return { success: true, username: creds.username };
}

/**
 * Rate Limiting / Brute Force Prevention
 */
function checkRateLimit(ip) {
  const record = rateLimitStore.get(ip) || { count: 0, lockedUntil: 0 };
  const now = Date.now();

  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, count: record.count };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    // Lock out for 5 minutes
    record.lockedUntil = now + 5 * 60 * 1000;
  }

  rateLimitStore.set(ip, record);
  return record;
}

function recordSuccessfulLogin(ip) {
  rateLimitStore.delete(ip);
}

/**
 * Dynamic SVG CAPTCHA Generator
 * Creates an attractive, high-contrast, distorted security CAPTCHA
 */
function generateCaptcha() {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Avoid 0/O, 1/I/l
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  const width = 180;
  const height = 54;
  const captchaId = crypto.randomUUID();

  // Noise lines
  let linesSvg = '';
  const lineColors = ['#00d2ff', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * 20);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(width - Math.random() * 20);
    const y2 = Math.floor(Math.random() * height);
    const qx = Math.floor(Math.random() * width);
    const qy = Math.floor(Math.random() * height);
    const color = lineColors[Math.floor(Math.random() * lineColors.length)];
    linesSvg += `<path d="M${x1},${y1} Q${qx},${qy} ${x2},${y2}" stroke="${color}" stroke-width="${1 + Math.random() * 1.5}" fill="none" opacity="0.6"/>`;
  }

  // Noise dots
  let dotsSvg = '';
  for (let i = 0; i < 28; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = (Math.random() * 1.8 + 0.6).toFixed(1);
    const color = lineColors[Math.floor(Math.random() * lineColors.length)];
    dotsSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.5"/>`;
  }

  // Render Characters with distortion and rotation
  const charColors = ['#00d2ff', '#ffffff', '#38bdf8', '#4ade80', '#fbbf24', '#f43f5e', '#a78bfa'];
  let textElements = '';
  const startX = 18;
  const spacing = 32;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = startX + i * spacing + (Math.random() * 4 - 2);
    const y = 36 + (Math.random() * 6 - 3);
    const rot = Math.floor(Math.random() * 36 - 18);
    const fontSize = Math.floor(Math.random() * 6 + 26);
    const color = charColors[i % charColors.length];

    textElements += `
      <text x="${x}" y="${y}" 
        font-family="'JetBrains Mono', 'Courier New', monospace" 
        font-weight="bold" 
        font-size="${fontSize}" 
        fill="${color}" 
        transform="rotate(${rot}, ${x}, ${y})"
        style="letter-spacing: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">
        ${char}
      </text>
    `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width}" ${height}" style="background: linear-gradient(135deg, #0b101b 0%, #111a2e 100%); border-radius: 8px; border: 1px solid rgba(0,210,255,0.25); user-select: none;">
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grid)"/>
      ${dotsSvg}
      ${linesSvg}
      ${textElements}
    </svg>
  `.trim();

  // Store captcha code valid for 3 minutes
  captchaStore.set(captchaId, {
    code: code.toUpperCase(),
    expiresAt: Date.now() + 3 * 60 * 1000
  });

  return { captchaId, svg };
}

/**
 * Verify submitted CAPTCHA
 */
function verifyCaptcha(captchaId, inputCode) {
  if (!captchaId) {
    return { valid: false, error: 'Captcha identifier is missing. Please refresh captcha.' };
  }
  const record = captchaStore.get(captchaId);
  if (!record) {
    return { valid: false, error: 'Captcha has expired. Please click reload to get a new code.' };
  }

  // Single-use guarantee: consume immediately
  captchaStore.delete(captchaId);

  if (Date.now() > record.expiresAt) {
    return { valid: false, error: 'Captcha expired. Please click reload.' };
  }

  const cleanInput = String(inputCode || '').trim().toUpperCase();
  if (cleanInput !== record.code) {
    return { valid: false, error: 'Incorrect CAPTCHA code. Please try again.' };
  }

  return { valid: true };
}

/**
 * Session Token Management
 */
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  // Valid for 24 hours
  sessionStore.set(token, {
    username,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  });
  return token;
}

function verifyToken(token) {
  if (!token) return { valid: false };
  const session = sessionStore.get(token);
  if (!session) return { valid: false };
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return { valid: false };
  }
  return { valid: true, username: session.username };
}

function revokeSession(token) {
  if (token) sessionStore.delete(token);
}

/**
 * Express Middleware: Require Authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-auth-token'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = String(customHeader).trim();
  }

  const auth = verifyToken(token);
  if (!auth.valid) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid admin authentication token required',
      code: 'AUTH_REQUIRED'
    });
  }

  req.adminUser = auth.username;
  next();
}

module.exports = {
  getAdminCredentials,
  updateAdminCredentials,
  authenticateUser,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin,
  generateCaptcha,
  verifyCaptcha,
  createSession,
  verifyToken,
  revokeSession,
  requireAuth
};
