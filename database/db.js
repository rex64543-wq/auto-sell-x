const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(file, defaultValue = {}) {
  const filePath = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultValue;
  }
}

function saveJson(file, data) {
  const filePath = path.join(DATA_DIR, file);
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Default initial products matching the user's store catalog
const DEFAULT_PRODUCTS = {
  'android-panel': {
    id: 'android-panel',
    name: 'Android-Panel',
    category: 'Android',
    status: 'safe', // 'safe', 'maintenance', 'patched'
    version: 'v2.4',
    features: [
      '📱 Android Stealth Injector (Root & Non-Root)',
      '🎯 Auto Aimbot & Recoil Control (Smooth Aim)',
      '👁️ Player ESP, Distance, Health & Lines',
      '🛡️ Anti-Ban Bypass Security Engine',
      '⚡ High Performance & 120 FPS Support'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 150, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 500, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1200, currency: '₹' }
    },
    deliveryType: 'keyauth',
    keyauthConfig: { expiry: 30, mask: 'ANDROID-XXXXXX-XXXXXX', level: 1 },
    customApiConfig: {}
  },
  'external-panel': {
    id: 'external-panel',
    name: 'External-Panel',
    category: 'PC',
    status: 'safe',
    version: 'v1.0',
    features: [
      '💻 External Stealth Overlay (Undetected Engine)',
      '🎯 Custom Crosshair & Memory Aim Lock',
      '👁️ Player ESP, Vehicle & Loot Radar',
      '🛡️ Bypass Anti-Cheat Security',
      '⚡ High FPS & No Lag Performance'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 200, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 600, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1500, currency: '₹' }
    },
    deliveryType: 'keyauth',
    keyauthConfig: { expiry: 30, mask: 'EXTERNAL-XXXXXX-XXXXXX', level: 1 },
    customApiConfig: {}
  },
  'internal-panel': {
    id: 'internal-panel',
    name: 'Internal-Panel',
    category: 'PC',
    status: 'safe',
    version: 'v1.5',
    features: [
      '💻 Pure Internal DirectX Hook (Zero Delay)',
      '🎯 Silent Aim & Bullet Track Prediction',
      '👁️ Bone Glow ESP & Item Name Filter',
      '🛡️ Kernel-Level Anti-Detection Driver',
      '⚡ Stream Proof & Recording Safe'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 250, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 700, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1800, currency: '₹' }
    },
    deliveryType: 'keyauth',
    keyauthConfig: { expiry: 30, mask: 'INTERNAL-XXXXXX-XXXXXX', level: 1 },
    customApiConfig: {}
  },
  'uid-bypass': {
    id: 'uid-bypass',
    name: 'Uid-bypass',
    category: 'Bypass',
    status: 'safe',
    version: 'v3.0',
    features: [
      '🛡️ 100% Blacklist & Server Reset Protection',
      '🔒 Unique Device ID Randomizer',
      '🚀 Instant Matchmaking Fix',
      '⚡ Safe for Main Accounts'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 100, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 350, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 800, currency: '₹' }
    },
    deliveryType: 'stock',
    keyauthConfig: {},
    customApiConfig: {}
  },
  'emulator-bypass': {
    id: 'emulator-bypass',
    name: 'Emulator-Bypass',
    category: 'PC / Bypass',
    status: 'safe',
    version: 'v2.1',
    features: [
      '🛡️ Mobile Player Matchmaking in PC Emulator',
      '⚡ LDPlayer & BlueStacks 5 Native Support',
      '🔒 Anti-Report & Anti-Spectate Shield'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 150, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 450, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1000, currency: '₹' }
    },
    deliveryType: 'keyauth',
    keyauthConfig: { expiry: 30, mask: 'BYPASS-XXXXXX-XXXXXX', level: 1 },
    customApiConfig: {}
  },
  'silent-exe': {
    id: 'silent-exe',
    name: 'Silent-EXE',
    category: 'PC',
    status: 'safe',
    version: 'v1.8',
    features: [
      '💻 1-Click Silent Loader (No USB needed)',
      '🎯 Legit Silent Bullet Hitbox Expansion',
      '⚡ 100% Undetected Tournament Config'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 180, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 550, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1300, currency: '₹' }
    },
    deliveryType: 'stock',
    keyauthConfig: {},
    customApiConfig: {}
  },
  'silent-apk': {
    id: 'silent-apk',
    name: 'Silent-Apk',
    category: 'Android',
    status: 'safe',
    version: 'v2.0',
    features: [
      '📱 Modified Safe Client APK',
      '🎯 Magic Bullet & Headshot Rate 90%',
      '⚡ Works on 32-bit & 64-bit Android'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 150, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 450, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1100, currency: '₹' }
    },
    deliveryType: 'stock',
    keyauthConfig: {},
    customApiConfig: {}
  },
  'aimkill-apk': {
    id: 'aimkill-apk',
    name: 'Aimkill-Apk',
    category: 'Android',
    status: 'safe',
    version: 'v3.2',
    features: [
      '📱 Brutal Rage Aim Kill Mode',
      '🎯 Auto Fire When Target in Crosshair',
      '👁️ 360 Degree Warning Radar'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 200, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 600, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1400, currency: '₹' }
    },
    deliveryType: 'stock',
    keyauthConfig: {},
    customApiConfig: {}
  },
  'streamer-panel': {
    id: 'streamer-panel',
    name: 'Streamer-Panel',
    category: 'PC',
    status: 'safe',
    version: 'v4.0',
    features: [
      '💻 100% Invisible on OBS & Discord Screen Share',
      '🎯 Humanized Smoothing (Looks Natural on Stream)',
      '👁️ Stream-Proof Wallhack & Loot ESP'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 300, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 900, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 2200, currency: '₹' }
    },
    deliveryType: 'keyauth',
    keyauthConfig: { expiry: 30, mask: 'STREAM-XXXXXX-XXXXXX', level: 1 },
    customApiConfig: {}
  },
  'br-mods-panel': {
    id: 'br-mods-panel',
    name: 'Br-Mods-Panel',
    category: 'Android',
    status: 'patched',
    version: 'v1.0',
    features: [
      '📱 Heavy Mod Menu with Flying & Speed Hack',
      '🔴 Currently Detected by Anti-Cheat (Do NOT use right now)'
    ],
    plans: {
      '1d': { label: '1 Day', durationDays: 1, price: 250, currency: '₹' },
      '7d': { label: '7 Days', durationDays: 7, price: 750, currency: '₹' },
      '30d': { label: '30 Days', durationDays: 30, price: 1700, currency: '₹' }
    },
    deliveryType: 'stock',
    keyauthConfig: {},
    customApiConfig: {}
  }
};

const DEFAULT_WEBSITE_CONFIG = {
  enabled: true,
  storeName: 'White X Store',
  tagline: 'Premium Undetected Cheats & Gaming Tools',
  logoUrl: 'logo.png',
  faviconUrl: 'logo.png',
  accentColor: '#00e5ff',
  secondaryColor: '#8b5cf6',
  discordInvite: 'https://discord.gg/whitexstore',
  telegramUrl: 'https://t.me/whitexstore',
  youtubeUrl: '',
  announcement: {
    enabled: true,
    badge: '⚡ LIVE UPDATE',
    text: 'Free Fire & BGMI v2.4 Bypass Released! • 100% Undetected & Anti-Ban Active • Instant UPI & Crypto Automatic Key Delivery • Join our Discord for free keys & daily giveaways!'
  },
  hero: {
    badge: '🛡️ 100% Undetected • 0s Automated Key Delivery',
    title: 'Dominate Every Match With Next-Gen Stealth Cheats',
    subtitle: 'Engineered for pure precision and untouchable anti-ban stealth. Instant automated license delivery in 0 seconds with multi-currency checkout & 24/7 dedicated support.',
    showVideo: true,
    videoUrl: 'store_video.mp4',
    bannerUrl: 'https://i.imgur.com/8Qe87dE.png',
    primaryBtnText: 'Browse Cheats Catalog',
    primaryBtnLink: '#products',
    secondaryBtnText: 'Join Discord Server',
    secondaryBtnLink: 'https://discord.gg/whitexstore',
    stats: [
      { label: 'Active Gamers', value: '15,400+' },
      { label: 'Keys Delivered', value: '38,900+' },
      { label: 'Detection Rate', value: '0.0%' },
      { label: 'Instant Delivery', value: '< 1s' }
    ]
  },
  features: [
    {
      icon: '⚡',
      title: '0-Second Automated Delivery',
      description: 'Never wait for an admin. Keys, loaders, and instant setup guides are delivered directly upon payment confirmation.'
    },
    {
      icon: '🛡️',
      title: 'Kernel-Level Anti-Ban Bypass',
      description: 'Proprietary memory injection and device ID spoofing safeguards your main accounts against blacklist and server bans.'
    },
    {
      icon: '🎯',
      title: 'Stream-Proof & Ultra Smooth',
      description: 'Invisible on OBS, Discord screen share, and recording tools. Humanized smooth aim looks 100% legit.'
    },
    {
      icon: '💳',
      title: 'Universal Multi-Currency Pay',
      description: 'Pay easily with UPI (PhonePe, GPay, Paytm) for India, eSewa for Nepal, and Binance Pay (USDT) for International.'
    },
    {
      icon: '🔄',
      title: 'Auto Daily Status Watchdog',
      description: 'Real-time cheat status updates. If any game updates, panels automatically switch to safe maintenance mode.'
    },
    {
      icon: '💬',
      title: '24/7 Discord Live Support',
      description: 'Dedicated ticket staff and tutorial guides ready round-the-clock to assist with installation and setup.'
    }
  ],
  reviews: [
    {
      author: 'GhostRider_99',
      tag: 'Ghost#4120',
      product: 'Android-Panel (30 Days)',
      rating: 5,
      text: 'Best cheat I have ever used on Android. Been playing on my main account for 3 weeks now, reached Grandmaster with 0 ban. Instant key delivery too!',
      date: '2 days ago'
    },
    {
      author: 'PhantomX',
      tag: 'Phantom#8812',
      product: 'External-Panel (PC)',
      rating: 5,
      text: 'Stream proof actually works! Streamed on Discord with friends and nobody could tell I was using ESP. Smooth aimbot is insane.',
      date: '5 days ago'
    },
    {
      author: 'Aman_FF',
      tag: 'Aman#3310',
      product: 'Uid-bypass (7 Days)',
      rating: 5,
      text: 'Paid with PhonePe UPI, got the key in literally 2 seconds on the bot. Super fast service and developer is very helpful in tickets.',
      date: '1 week ago'
    },
    {
      author: 'Viper_Apex',
      tag: 'Viper#9021',
      product: 'Internal-Panel (30 Days)',
      rating: 5,
      text: 'Silent aim is pure magic. High FPS, no lag or stutter, and the bypass is rock solid. 10/10 recommend White X Store to everyone.',
      date: '2 weeks ago'
    }
  ],
  faqs: [
    {
      q: 'How fast do I receive my key after payment?',
      a: 'Delivery is 100% automated! Within seconds of completing payment via UPI, Crypto, or Cards, your license key and download instructions will appear on screen and in your Discord DM.'
    },
    {
      q: 'Is this cheat safe for my main account?',
      a: 'Yes! All products marked with the 🟢 Safe / Undetected badge are actively monitored by our bypass engine. We test every game update before marking products safe.'
    },
    {
      q: 'Do I need Root for Android Cheats?',
      a: 'Our Android-Panel supports BOTH Root and Non-Root (via safe virtual container). Detailed setup video is provided with every purchase.'
    },
    {
      q: 'Which payment methods are accepted?',
      a: 'We accept UPI (Google Pay, PhonePe, Paytm, BHIM QR) for India, eSewa for Nepal, and Binance Pay / USDT for International.'
    },
    {
      q: 'What if I need help setting up?',
      a: 'Our Discord support team is available 24/7. Join our Discord server and open a support ticket; our staff will guide you through screen-share or step-by-step instructions.'
    }
  ],
  footer: {
    aboutText: 'White X Store is the premier destination for private, high-performance game enhancements, stream-proof overlays, and stealth bypasses.',
    disclaimer: 'Disclaimer: All products and software are provided for educational and private testing purposes. We are not affiliated with game developers.',
    copyright: '© 2026 White X Store. All rights reserved.'
  }
};

const DEFAULT_SETTINGS = {
  verificationChannelId: null,
  logChannelId: null,
  customerRoleId: null,
  adminRoleId: null,
  ownerId: null,
  ticketCategoryId: null,
  storeName: 'White X Store',
  mode: 'direct', // 'direct' = No ticket channels created; all interactive checkout happens in-channel
  shopPage: {
    title: '⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡',
    description: '> ⚡ **Instant Key Delivery** • 🛡️ **Anti-Ban Protected** • 💳 **Multi-Currency / Instant Checkout**\n\n╭────────────────────────────────────────╮\n  👑 **WELCOME TO WHITE X STORE**\n  *Your #1 Trusted Destination for Undetected Panels & Cheats*\n╰────────────────────────────────────────╯\n\n### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘:\n**1️⃣ Select Your Cheat / Panel:**\n• Choose a product from the dropdown menu below (`🛒 Select a Product / Panel...`).\n\n**2️⃣ Review Features, Prices & Live Status:**\n• Once selected, an interactive live card will display all features, anti-ban status, and duration pricing (1D / 7D / 30D).\n\n**3️⃣ Instant Payment & 0-Second Delivery:**\n• Select your preferred duration plan and complete payment via **eSewa (Nepal)**, **UPI QR (India)**, **Binance Pay (International USD)**, or your **Wallet Balance**. Your license key will be delivered instantly to your DM!\n\n────────────────────────────────────────\n### 🚦 𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗨𝗦 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥𝗦:\n• 🟢 **Safe 🟢** : Fully Working & Undetected *(Safe for Main Account)*\n• 🟡 **Maintenance 🟡** : Under update *(Wait for announcement)*\n• 🔴 **Patched 🔴** : Offline / Detected *(Do NOT buy or use right now)*\n\n────────────────────────────────────────\n### 💳 𝗪𝗔𝗟𝗟𝗘𝗧 & 𝟭-𝗦𝗘𝗖𝗢𝗡𝗗 𝗖𝗛𝗘𝗖𝗞𝗢𝗨𝗧:\n• Click **`💳 My Wallet`** below to check your current funds anytime.\n• Click **`➕ Add Balance / Top-up`** to deposit funds and checkout with 1-click!',
    bannerUrl: 'https://i.imgur.com/8Qe87dE.png',
    thumbnailUrl: 'https://i.imgur.com/8Qe87dE.png',
    color: '#00d2ff',
    footer: 'White X Store • Select a product below to start • 24/7 Automated Delivery'
  },
  dealPage: {
    instructions: '1. Please confirm your order details above.\n2. Tap the **🤝 Make Deal / Pay Now** button below when you are ready to make payment.\n3. The QR Code & Payment options will unlock instantly in this channel!'
  },
  paymentPage: {
    upiInstructions: '📱 **Scan the QR Code below using Google Pay / PhonePe / Paytm / BHIM to complete payment!**\nAfter payment, click **📸 Upload Proof from Gallery** or submit your 12-digit UTR number below.',
    cardInstructions: 'Pay securely using your preferred payment gateway.\nAfter completing payment, submit your reference ID or payment screenshot.'
  },
  defaultCurrency: 'USD',
  currencies: [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: 0.012 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rate: 1.0 },
    { code: 'NPR', name: 'Nepali Rupee', symbol: 'रू', flag: '🇳🇵', rate: 1.6 }
  ],
  currencyRates: {
    USD: 0.012,
    INR: 1,
    NPR: 1.6
  },
  paymentMethods: {
    esewa: {
      enabled: true,
      name: 'eSewa (Nepal)',
      emoji: '🇳🇵',
      currency: 'NPR',
      number: '9826866639',
      payeeName: 'Manish Kumar Yadav',
      qrCodeUrl: 'assets/qr/esewa_nepal.png',
      details: '🇳🇵 **eSewa ID / Number:** `9826866639`\n👤 **Account Holder:** Manish Kumar Yadav\n📱 Scan the QR Code below using the eSewa App or use direct Send Money.\nAfter completing payment, submit your Transaction Code or payment screenshot.'
    },
    upi: {
      enabled: true,
      name: 'UPI / QR Code (India)',
      emoji: '🇮🇳',
      currency: 'INR',
      upiId: '9353351285@kotakbank',
      payeeName: 'OM YADAV',
      qrCodeUrl: 'assets/qr/upi_india.png',
      details: '🇮🇳 **UPI ID:** `9353351285@kotakbank`\n👤 **Payee Name:** OM YADAV\n📱 Scan the QR Code below using Google Pay / PhonePe / Paytm / BHIM to pay.\nAfter payment, submit your 12-digit UTR Number or payment screenshot.'
    },
    binance: {
      enabled: true,
      name: 'USD / International Payment (Binance Pay)',
      emoji: '🌐',
      currency: 'USD',
      number: 'User-7bad1',
      paymentLink: 'https://app.binance.com/uni-qr/TYyJ4S9Z',
      qrCodeUrl: 'assets/qr/binance_international.png',
      details: '🌐 **Binance Pay Link:** https://app.binance.com/uni-qr/TYyJ4S9Z\n👤 **Binance Pay ID / User:** `User-7bad1`\n🪙 Scan the QR Code using the Binance App or send USDT via the Pay Link.\nAfter completing payment, submit your Order ID or payment screenshot.'
    }
  },
  apiConnections: {},
  websiteConfig: DEFAULT_WEBSITE_CONFIG
};

class Database {
  constructor() {
    this.reloadAll();
  }

  // --- Real-Time Disk Sync Methods ---
  reloadProducts() {
    this.products = loadJson('products.json', DEFAULT_PRODUCTS);
    return this.products;
  }

  reloadSettings() {
    this.settings = loadJson('settings.json', DEFAULT_SETTINGS);
    return this.settings;
  }

  reloadStock() {
    this.stock = loadJson('stock.json', {});
    return this.stock;
  }

  reloadOrders() {
    this.orders = loadJson('orders.json', {});
    return this.orders;
  }

  reloadWallets() {
    this.wallets = loadJson('wallets.json', {});
    return this.wallets;
  }

  reloadRedeemCodes() {
    this.redeemCodes = loadJson('redeem_codes.json', {});
    return this.redeemCodes;
  }

  reloadAll() {
    this.reloadProducts();
    this.reloadSettings();
    this.reloadStock();
    this.reloadOrders();
    this.reloadWallets();
    this.reloadRedeemCodes();
  }

  // --- Products ---
  getAllProducts() {
    this.reloadProducts();
    return Object.values(this.products);
  }

  getProducts() {
    this.reloadProducts();
    return this.products;
  }

  getProduct(id) {
    if (!id) return null;
    this.reloadProducts();
    return this.products[id.toLowerCase()] || null;
  }

  saveProduct(product) {
    this.reloadProducts();
    const key = product.id.toLowerCase();
    this.products[key] = {
      ...(this.products[key] || {}),
      ...product
    };
    saveJson('products.json', this.products);
    return this.products[key];
  }

  updateProductField(id, updates) {
    this.reloadProducts();
    const key = id.toLowerCase();
    if (!this.products[key]) return null;

    this.products[key] = {
      ...this.products[key],
      ...updates
    };
    saveJson('products.json', this.products);
    return this.products[key];
  }

  updateProduct(id, updates) {
    this.reloadProducts();
    const key = id.toLowerCase();
    this.products[key] = {
      ...(this.products[key] || { id: key }),
      ...updates
    };
    saveJson('products.json', this.products);
    return this.products[key];
  }

  setProductStatus(id, status) {
    return this.updateProductField(id, { status });
  }

  setProductPricing(id, { price1d, price7d, price30d, currency } = {}) {
    return this.setProductPrice(id, price1d, price7d, price30d, currency);
  }

  setProductPrice(id, price1d, price7d, price30d, currency) {
    this.reloadProducts();
    const key = id.toLowerCase();
    if (!this.products[key]) return null;

    if (!this.products[key].plans) {
      this.products[key].plans = {};
    }

    const curr = currency || this.products[key].plans['1d']?.currency || this.products[key].currency || '₹';

    if (price1d !== undefined && price1d !== null) {
      this.products[key].plans['1d'] = {
        label: '1 Day',
        durationDays: 1,
        price: price1d,
        currency: curr
      };
    }
    if (price7d !== undefined && price7d !== null) {
      this.products[key].plans['7d'] = {
        label: '7 Days',
        durationDays: 7,
        price: price7d,
        currency: curr
      };
    }
    if (price30d !== undefined && price30d !== null) {
      this.products[key].plans['30d'] = {
        label: '30 Days',
        durationDays: 30,
        price: price30d,
        currency: curr
      };
    }

    saveJson('products.json', this.products);
    return this.products[key];
  }

  // --- Dynamic Multi-Currency System ---
  getCurrencies() {
    this.reloadSettings();
    if (Array.isArray(this.settings.currencies) && this.settings.currencies.length > 0) {
      return this.settings.currencies;
    }
    const rates = this.getCurrencyRates();
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: Number(rates.USD) || 0.012 },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rate: Number(rates.INR) || 1.0 },
      { code: 'NPR', name: 'Nepali Rupee', symbol: 'रू', flag: '🇳🇵', rate: Number(rates.NPR) || 1.6 }
    ];
  }

  getDefaultCurrency() {
    this.reloadSettings();
    return (this.settings.defaultCurrency || 'USD').toUpperCase();
  }

  setDefaultCurrency(currencyCode) {
    this.reloadSettings();
    const code = (currencyCode || 'USD').toUpperCase().trim();
    const currencies = this.getCurrencies();
    const found = currencies.find(c => c.code === code);
    if (!found) {
      throw new Error(`Currency "${code}" does not exist in store`);
    }
    this.settings.defaultCurrency = code;
    this.saveSettings();
    return code;
  }

  addCurrency({ code, name, symbol, flag, rate }) {
    this.reloadSettings();
    const cleanCode = (code || '').toUpperCase().trim();
    if (!cleanCode) throw new Error('Currency code is required (e.g. USD, EUR, AED)');
    const numericRate = Number(rate);
    if (isNaN(numericRate) || numericRate <= 0) throw new Error('Valid positive exchange rate is required');

    let currencies = [...this.getCurrencies()];
    const existingIndex = currencies.findIndex(c => c.code === cleanCode);
    const newEntry = {
      code: cleanCode,
      name: (name || cleanCode).trim(),
      symbol: (symbol || cleanCode).trim(),
      flag: (flag || '🌐').trim(),
      rate: numericRate
    };

    if (existingIndex >= 0) {
      currencies[existingIndex] = newEntry;
    } else {
      currencies.push(newEntry);
    }

    this.settings.currencies = currencies;
    if (!this.settings.currencyRates) this.settings.currencyRates = {};
    this.settings.currencyRates[cleanCode] = numericRate;

    this.saveSettings();
    return newEntry;
  }

  removeCurrency(currencyCode) {
    this.reloadSettings();
    const cleanCode = (currencyCode || '').toUpperCase().trim();
    if (!cleanCode) throw new Error('Currency code is required');

    let currencies = [...this.getCurrencies()];
    if (currencies.length <= 1) {
      throw new Error('Cannot delete the last remaining currency');
    }

    const initialLength = currencies.length;
    currencies = currencies.filter(c => c.code !== cleanCode);
    if (currencies.length === initialLength) {
      throw new Error(`Currency "${cleanCode}" not found`);
    }

    this.settings.currencies = currencies;
    if (this.settings.currencyRates) {
      delete this.settings.currencyRates[cleanCode];
    }

    if (this.settings.defaultCurrency === cleanCode) {
      this.settings.defaultCurrency = currencies[0].code;
    }

    this.saveSettings();
    return true;
  }

  getCurrencyRates() {
    this.reloadSettings();
    if (this.settings.currencyRates && Object.keys(this.settings.currencyRates).length > 0) {
      return this.settings.currencyRates;
    }
    const currencies = this.getCurrencies();
    const rates = {};
    currencies.forEach(c => { rates[c.code] = c.rate; });
    return rates;
  }

  convertCurrency(inrAmount, targetCurrency = null) {
    const defaultCurr = this.getDefaultCurrency();
    const curr = (targetCurrency || defaultCurr).toUpperCase();
    const currencies = this.getCurrencies();
    const curObj = currencies.find(c => c.code === curr);

    const rate = curObj ? Number(curObj.rate) : (Number(this.getCurrencyRates()[curr]) || 1);
    const symbol = curObj ? curObj.symbol : (curr === 'USD' ? '$' : (curr === 'NPR' ? 'रू' : '₹'));
    const flag = curObj ? curObj.flag : (curr === 'USD' ? '🇺🇸' : (curr === 'NPR' ? '🇳🇵' : '🇮🇳'));
    const name = curObj ? curObj.name : curr;

    let amount;
    if (curr === 'USD' || curr === 'EUR' || curr === 'GBP' || rate < 0.1) {
      amount = Math.round(Number(inrAmount || 0) * rate * 100) / 100;
    } else {
      amount = Math.round(Number(inrAmount || 0) * rate);
    }

    return {
      currency: curr,
      symbol,
      flag,
      name,
      rate,
      amount,
      formatted: `${symbol}${amount.toLocaleString()} ${curr}`
    };
  }

  getAllCurrencyConversions(inrAmount) {
    const currencies = this.getCurrencies();
    return currencies.map(c => this.convertCurrency(inrAmount, c.code));
  }

  getPlanMultiPrices(plan) {
    if (!plan) return { inr: 0, usd: 0, npr: 0 };
    const rates = this.getCurrencyRates();
    const inr = Number(plan.priceInr || plan.price || 0);
    const usd =
      plan.priceUsd !== undefined && plan.priceUsd !== null
        ? Number(plan.priceUsd)
        : Math.round(inr * (rates.USD || 0.012) * 100) / 100;
    const npr =
      plan.priceNpr !== undefined && plan.priceNpr !== null
        ? Number(plan.priceNpr)
        : Math.round(inr * (rates.NPR || 1.6));
    return { inr, usd, npr };
  }

  formatPlanPriceList(plan, targetCurrency = null) {
    if (targetCurrency && targetCurrency !== 'ALL') {
      const conv = this.convertCurrency(plan.price, targetCurrency);
      return `${conv.flag} **${conv.formatted}**`;
    }
    const { inr, usd, npr } = this.getPlanMultiPrices(plan);
    return `🇮🇳 **₹${inr.toLocaleString()} INR**  •  🇳🇵 **रू${npr.toLocaleString()} NPR**  •  🇺🇸 **$${usd} USD**`;
  }

  formatPlanPriceCompact(plan, targetCurrency = null) {
    if (targetCurrency && targetCurrency !== 'ALL') {
      const conv = this.convertCurrency(plan.price, targetCurrency);
      return conv.formatted;
    }
    const { inr, usd, npr } = this.getPlanMultiPrices(plan);
    return `₹${inr} | रू${npr} | $${usd}`;
  }

  formatPlanPriceUsdOnly(plan) {
    if (!plan) return '$0';
    const conv = this.convertCurrency(plan.price || 0, 'USD');
    return `$${conv.amount}`;
  }

  formatProductDropdownDesc(p) {
    let statusIndicator = 'Safe 🟢';
    if (p.status === 'maintenance') statusIndicator = 'Maintenance 🟡';
    if (p.status === 'patched') statusIndicator = 'Patched 🔴';

    let desc = '';
    if (p.plans && Object.keys(p.plans).length > 0) {
      const parts = [];
      if (p.plans['1d']) parts.push(`1D: ${this.formatPlanPriceUsdOnly(p.plans['1d'])}`);
      if (p.plans['7d']) parts.push(`7D: ${this.formatPlanPriceUsdOnly(p.plans['7d'])}`);
      if (p.plans['30d']) parts.push(`30D: ${this.formatPlanPriceUsdOnly(p.plans['30d'])}`);
      if (parts.length === 0) {
        Object.values(p.plans).forEach(pl => {
          parts.push(`${pl.label || 'Plan'}: ${this.formatPlanPriceUsdOnly(pl)}`);
        });
      }
      desc = `${parts.join(' • ')} [${statusIndicator}]`;
    } else {
      const conv = this.convertCurrency(p.price || 0, 'USD');
      desc = `Price: $${conv.amount} [${statusIndicator}]`;
    }
    return desc.slice(0, 100);
  }

  formatOrderAmountMulti(order, targetCurrency = null) {
    if (!order) return '';
    if (targetCurrency) {
      const conv = this.convertCurrency(order.amount, targetCurrency);
      return `${conv.flag} **${conv.formatted}**`;
    }
    const rates = this.getCurrencyRates();
    const inr = Number(order.amount || 0);
    const usd = Math.round(inr * (rates.USD || 0.012) * 100) / 100;
    const npr = Math.round(inr * (rates.NPR || 1.6));
    return `🇮🇳 **₹${inr.toLocaleString()} INR**  •  🇳🇵 **रू${npr.toLocaleString()} NPR**  •  🇺🇸 **$${usd} USD**`;
  }

  setCustomPlan(id, planKey, label, price, currency, durationDays) {
    this.reloadProducts();
    const key = id.toLowerCase();
    if (!this.products[key]) return null;

    if (!this.products[key].plans) {
      this.products[key].plans = {};
    }

    this.products[key].plans[planKey.toLowerCase()] = {
      label: label || planKey,
      price: Number(price),
      currency: currency || '₹',
      durationDays: Number(durationDays) || 30
    };

    saveJson('products.json', this.products);
    return this.products[key];
  }

  deleteCustomPlan(id, planKey) {
    this.reloadProducts();
    const key = id.toLowerCase();
    if (!this.products[key] || !this.products[key].plans) return null;

    delete this.products[key].plans[planKey.toLowerCase()];
    saveJson('products.json', this.products);
    return this.products[key];
  }

  deleteProduct(id) {
    this.reloadProducts();
    const key = id.toLowerCase();
    if (this.products[key]) {
      delete this.products[key];
      saveJson('products.json', this.products);
      if (this.stock[key]) {
        delete this.stock[key];
        saveJson('stock.json', this.stock);
      }
      return true;
    }
    return false;
  }

  // --- Stock (for local pool) ---
  getStock(productId) {
    this.reloadStock();
    return this.stock[productId.toLowerCase()] || [];
  }

  addStock(productId, keys) {
    this.reloadStock();
    const key = productId.toLowerCase();
    if (!this.stock[key]) {
      this.stock[key] = [];
    }
    const cleanKeys = keys.map(k => k.trim()).filter(Boolean);
    this.stock[key].push(...cleanKeys);
    saveJson('stock.json', this.stock);
    return this.stock[key].length;
  }

  popStockKey(productId) {
    this.reloadStock();
    const key = productId.toLowerCase();
    if (!this.stock[key] || this.stock[key].length === 0) {
      return null;
    }
    const poppedKey = this.stock[key].shift();
    saveJson('stock.json', this.stock);
    return poppedKey;
  }

  getStockCount(productId) {
    this.reloadStock();
    return (this.stock[productId.toLowerCase()] || []).length;
  }

  // --- Orders ---
  createOrder(orderData) {
    this.reloadOrders();
    const id = (Date.now().toString(36) + Math.random().toString(36).substring(2, 5)).toUpperCase();
    const order = {
      id,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      ...orderData
    };
    this.orders[id] = order;
    saveJson('orders.json', this.orders);
    return order;
  }

  getOrder(id) {
    if (!id) return null;
    this.reloadOrders();
    return this.orders[id.toUpperCase()] || null;
  }

  updateOrder(id, updates) {
    this.reloadOrders();
    const key = id.toUpperCase();
    if (!this.orders[key]) return null;
    this.orders[key] = {
      ...this.orders[key],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveJson('orders.json', this.orders);
    return this.orders[key];
  }

  getAllOrders() {
    this.reloadOrders();
    return Object.values(this.orders);
  }

  getOrders() {
    this.reloadOrders();
    return this.orders;
  }

  // --- Settings ---
  getSettings() {
    this.reloadSettings();
    return this.settings;
  }

  saveSettings() {
    return saveJson('settings.json', this.settings);
  }

  updateSettings(updates) {
    this.reloadSettings();
    this.settings = {
      ...this.settings,
      ...updates
    };
    saveJson('settings.json', this.settings);
    return this.settings;
  }

  getWebsiteConfig() {
    this.reloadSettings();
    if (!this.settings.websiteConfig) {
      this.settings.websiteConfig = JSON.parse(JSON.stringify(DEFAULT_WEBSITE_CONFIG));
      this.saveSettings();
    }
    return this.settings.websiteConfig;
  }

  updateWebsiteConfig(updates) {
    this.reloadSettings();
    const current = this.getWebsiteConfig();
    this.settings.websiteConfig = {
      ...current,
      ...updates
    };
    this.saveSettings();
    return this.settings.websiteConfig;
  }

  getAdminRole() {
    this.reloadSettings();
    return this.settings.adminRoleId || this.settings.staffRoleId || null;
  }

  isStaffOrOwner(memberOrUser, guild = null) {
    if (!memberOrUser) return false;
    const userId = memberOrUser.id || memberOrUser.user?.id;
    if (!userId) return false;
    const settings = this.getSettings();

    // 1. Check Server Owner (if guild is available)
    if (guild && guild.ownerId && userId === guild.ownerId) {
      return true;
    }

    // 2. Check configured ownerId in settings or .env
    const configuredOwnerId = settings.ownerId || process.env.OWNER_ID;
    if (configuredOwnerId && userId === configuredOwnerId) {
      return true;
    }

    // 3. Check Discord Administrator or ManageGuild permissions
    let member = (memberOrUser.roles || memberOrUser.permissions) ? memberOrUser : null;
    if (!member && guild && guild.members && guild.members.cache) {
      member = guild.members.cache.get(userId);
    }

    if (member && member.permissions && typeof member.permissions.has === 'function') {
      const { PermissionFlagsBits } = require('discord.js');
      if (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return true;
      }
    }

    // 4. Check Configured Staff / Admin Role
    const adminRoleId = settings.adminRoleId || settings.staffRoleId;
    if (adminRoleId && member && member.roles) {
      if (member.roles.cache && typeof member.roles.cache.has === 'function') {
        if (member.roles.cache.has(adminRoleId)) return true;
      } else if (Array.isArray(member.roles)) {
        if (member.roles.includes(adminRoleId)) return true;
      }
    }

    return false;
  }

  getPaymentMethods() {
    this.reloadSettings();
    return this.settings.paymentMethods || {};
  }

  updatePaymentMethod(key, config) {
    return this.savePaymentMethod(key, config);
  }

  savePaymentMethod(key, config) {
    this.reloadSettings();
    if (!this.settings.paymentMethods) {
      this.settings.paymentMethods = {};
    }
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    this.settings.paymentMethods[cleanKey] = {
      ...(this.settings.paymentMethods[cleanKey] || {}),
      ...config,
      key: cleanKey
    };
    saveJson('settings.json', this.settings);
    return this.settings.paymentMethods[cleanKey];
  }

  deletePaymentMethod(key) {
    this.reloadSettings();
    const cleanKey = key.toLowerCase();
    if (this.settings.paymentMethods && this.settings.paymentMethods[cleanKey]) {
      delete this.settings.paymentMethods[cleanKey];
      saveJson('settings.json', this.settings);
      return true;
    }
    return false;
  }

  // --- API Connections & Reseller Integrations ---
  getApiConnections() {
    this.reloadSettings();
    return this.settings.apiConnections || {};
  }

  getApiConnection(id) {
    if (!id) return null;
    this.reloadSettings();
    const connections = this.settings.apiConnections || {};
    return connections[id] || null;
  }

  saveApiConnection(id, config = {}) {
    this.reloadSettings();
    if (!this.settings.apiConnections) {
      this.settings.apiConnections = {};
    }
    const cleanId = (id || config.name || 'api_' + Date.now()).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    this.settings.apiConnections[cleanId] = {
      ...(this.settings.apiConnections[cleanId] || {}),
      id: cleanId,
      name: config.name || cleanId,
      type: config.type || 'custom_api', // 'custom_api' | 'smm_panel' | 'keyauth'
      url: config.url || '',
      apiKey: config.apiKey || '',
      method: (config.method || 'POST').toUpperCase(),
      headers: typeof config.headers === 'object' && config.headers !== null ? config.headers : {},
      responseKeyPath: config.responseKeyPath || '',
      notes: config.notes || '',
      enabled: config.enabled !== false,
      updatedAt: new Date().toISOString()
    };
    saveJson('settings.json', this.settings);
    return this.settings.apiConnections[cleanId];
  }

  deleteApiConnection(id) {
    this.reloadSettings();
    const cleanId = (id || '').toLowerCase();
    if (this.settings.apiConnections && this.settings.apiConnections[cleanId]) {
      delete this.settings.apiConnections[cleanId];
      saveJson('settings.json', this.settings);
      return true;
    }
    return false;
  }

  updateProductVariantMapping(productId, { apiConnectionId, variantMapping, customApiConfig, deliveryType } = {}) {
    this.reloadProducts();
    const key = (productId || '').toLowerCase();
    if (!this.products[key]) return null;

    if (apiConnectionId !== undefined) {
      this.products[key].apiConnectionId = apiConnectionId;
    }
    if (deliveryType !== undefined) {
      this.products[key].deliveryType = deliveryType;
    }
    if (variantMapping && typeof variantMapping === 'object') {
      this.products[key].variantMapping = {
        ...(this.products[key].variantMapping || {}),
        ...variantMapping
      };
      // Keep individual plans[planKey].variantId in sync
      if (this.products[key].plans) {
        for (const [planKey, varId] of Object.entries(variantMapping)) {
          if (this.products[key].plans[planKey]) {
            this.products[key].plans[planKey].variantId = String(varId).trim();
          }
        }
      }
    }
    if (customApiConfig && typeof customApiConfig === 'object') {
      this.products[key].customApiConfig = {
        ...(this.products[key].customApiConfig || {}),
        ...customApiConfig
      };
    }

    saveJson('products.json', this.products);
    return this.products[key];
  }

  // --- Wallet System ---
  getWallets() {
    this.reloadWallets();
    return this.wallets;
  }

  getUserBalance(userId) {
    this.reloadWallets();
    const wallet = this.wallets[userId];
    return wallet ? Number(wallet.balance || 0) : 0;
  }

  addWalletBalance(userId, amount, note = 'Top-up') {
    this.reloadWallets();
    if (!this.wallets[userId]) {
      this.wallets[userId] = {
        balance: 0,
        currency: '₹',
        history: []
      };
    }

    const numAmount = Math.max(0, Number(amount));
    this.wallets[userId].balance = Math.round((Number(this.wallets[userId].balance || 0) + numAmount) * 100) / 100;

    if (!Array.isArray(this.wallets[userId].history)) {
      this.wallets[userId].history = [];
    }

    this.wallets[userId].history.unshift({
      id: (Date.now().toString(36) + Math.random().toString(36).substring(2, 4)).toUpperCase(),
      type: 'credit',
      amount: numAmount,
      note,
      date: new Date().toISOString()
    });

    if (this.wallets[userId].history.length > 30) {
      this.wallets[userId].history = this.wallets[userId].history.slice(0, 30);
    }

    saveJson('wallets.json', this.wallets);
    return this.wallets[userId].balance;
  }

  deductWalletBalance(userId, amount, note = 'Purchase') {
    this.reloadWallets();
    if (!this.wallets[userId]) return false;

    const currentBal = Number(this.wallets[userId].balance || 0);
    const numAmount = Number(amount);

    if (currentBal < numAmount) return false;

    this.wallets[userId].balance = Math.round((currentBal - numAmount) * 100) / 100;

    if (!Array.isArray(this.wallets[userId].history)) {
      this.wallets[userId].history = [];
    }

    this.wallets[userId].history.unshift({
      id: (Date.now().toString(36) + Math.random().toString(36).substring(2, 4)).toUpperCase(),
      type: 'debit',
      amount: numAmount,
      note,
      date: new Date().toISOString()
    });

    if (this.wallets[userId].history.length > 30) {
      this.wallets[userId].history = this.wallets[userId].history.slice(0, 30);
    }

    saveJson('wallets.json', this.wallets);
    return true;
  }

  setWalletBalance(userId, amount, note = 'Manual adjustment') {
    this.reloadWallets();
    if (!this.wallets[userId]) {
      this.wallets[userId] = {
        balance: 0,
        currency: '₹',
        history: []
      };
    }

    const numAmount = Math.max(0, Number(amount));
    this.wallets[userId].balance = numAmount;

    if (!Array.isArray(this.wallets[userId].history)) {
      this.wallets[userId].history = [];
    }

    this.wallets[userId].history.unshift({
      id: (Date.now().toString(36) + Math.random().toString(36).substring(2, 4)).toUpperCase(),
      type: 'set',
      amount: numAmount,
      note,
      date: new Date().toISOString()
    });

    saveJson('wallets.json', this.wallets);
    return this.wallets[userId].balance;
  }

  getWalletHistory(userId) {
    this.reloadWallets();
    return this.wallets[userId]?.history || [];
  }

  // --- Redeem / Gift Codes System ---
  getAllRedeemCodes() {
    this.reloadRedeemCodes();
    return Object.values(this.redeemCodes).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getRedeemCode(code) {
    if (!code) return null;
    this.reloadRedeemCodes();
    return this.redeemCodes[code.toUpperCase().trim()] || null;
  }

  generateCodeString(prefix = 'WX') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randPart = (len) => {
      let res = '';
      for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return res;
    };
    const cleanPrefix = (prefix || 'WX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${cleanPrefix}-${randPart(4)}-${randPart(4)}-${randPart(4)}`;
  }

  saveRedeemCode(codeData) {
    this.reloadRedeemCodes();
    const cleanCode = (codeData.code || '').toUpperCase().trim();
    if (!cleanCode) return null;
    this.redeemCodes[cleanCode] = {
      ...(this.redeemCodes[cleanCode] || {}),
      ...codeData,
      code: cleanCode
    };
    saveJson('redeem_codes.json', this.redeemCodes);
    return this.redeemCodes[cleanCode];
  }

  createRedeemCode(params = {}) {
    this.reloadRedeemCodes();
    const codeStr = (params.code && params.code.trim())
      ? params.code.toUpperCase().trim()
      : this.generateCodeString(params.prefix || 'WX');

    const type = params.type === 'wallet' ? 'wallet' : 'item';
    let productName = params.productName || null;
    let planDuration = params.planDuration || null;
    let amount = Number(params.amount || 0);

    if (type === 'item' && params.productId) {
      const prod = this.getProduct(params.productId);
      if (prod) {
        productName = prod.name;
        if (params.planKey && prod.plans && prod.plans[params.planKey]) {
          const plan = prod.plans[params.planKey];
          planDuration = plan.label || `${plan.durationDays} Days`;
          amount = Number(plan.price || 0);
        }
      }
    }

    const newCode = {
      code: codeStr,
      type,
      productId: params.productId || null,
      productName: productName || (type === 'wallet' ? 'Wallet Credit' : 'Store Item'),
      planKey: params.planKey || '30d',
      planDuration: planDuration || (type === 'wallet' ? null : '30 Days'),
      amount,
      currency: params.currency || '₹',
      maxUses: params.maxUses !== undefined ? Number(params.maxUses) : 1,
      usedCount: 0,
      isActive: params.isActive !== false,
      expiresAt: params.expiresAt || null,
      createdBy: params.createdBy || 'Staff',
      note: params.note || '',
      createdAt: new Date().toISOString(),
      claimedBy: []
    };

    this.redeemCodes[codeStr] = newCode;
    saveJson('redeem_codes.json', this.redeemCodes);
    return newCode;
  }

  bulkCreateRedeemCodes(items = []) {
    this.reloadRedeemCodes();
    const created = [];
    for (const item of items) {
      const codeStr = (item.code && item.code.trim())
        ? item.code.toUpperCase().trim()
        : this.generateCodeString(item.prefix || 'WX');

      const type = item.type === 'wallet' ? 'wallet' : 'item';
      let productName = item.productName || null;
      let planDuration = item.planDuration || null;
      let amount = Number(item.amount || 0);

      if (type === 'item' && item.productId) {
        const prod = this.getProduct(item.productId);
        if (prod) {
          productName = prod.name;
          if (item.planKey && prod.plans && prod.plans[item.planKey]) {
            const plan = prod.plans[item.planKey];
            planDuration = plan.label || `${plan.durationDays} Days`;
            amount = Number(plan.price || 0);
          }
        }
      }

      const newCode = {
        code: codeStr,
        type,
        productId: item.productId || null,
        productName: productName || (type === 'wallet' ? 'Wallet Credit' : 'Store Item'),
        planKey: item.planKey || '30d',
        planDuration: planDuration || (type === 'wallet' ? null : '30 Days'),
        amount,
        currency: item.currency || '₹',
        maxUses: item.maxUses !== undefined ? Number(item.maxUses) : 1,
        usedCount: 0,
        isActive: item.isActive !== false,
        expiresAt: item.expiresAt || null,
        createdBy: item.createdBy || 'Staff',
        note: item.note || '',
        createdAt: new Date().toISOString(),
        claimedBy: []
      };

      this.redeemCodes[codeStr] = newCode;
      created.push(newCode);
    }

    saveJson('redeem_codes.json', this.redeemCodes);
    return created;
  }

  deleteRedeemCode(code) {
    if (!code) return false;
    this.reloadRedeemCodes();
    const cleanCode = code.toUpperCase().trim();
    if (this.redeemCodes[cleanCode]) {
      delete this.redeemCodes[cleanCode];
      saveJson('redeem_codes.json', this.redeemCodes);
      return true;
    }
    return false;
  }

  toggleRedeemCodeStatus(code) {
    if (!code) return null;
    this.reloadRedeemCodes();
    const cleanCode = code.toUpperCase().trim();
    if (this.redeemCodes[cleanCode]) {
      this.redeemCodes[cleanCode].isActive = !this.redeemCodes[cleanCode].isActive;
      saveJson('redeem_codes.json', this.redeemCodes);
      return this.redeemCodes[cleanCode];
    }
    return null;
  }

  claimRedeemCode(codeStr, user) {
    this.reloadRedeemCodes();
    if (!codeStr) return { success: false, reason: 'Please provide a valid redeem code.' };
    const cleanCode = codeStr.toUpperCase().trim();
    const code = this.redeemCodes[cleanCode];
    if (!code) {
      return { success: false, reason: 'Invalid or unknown redeem code. Please verify the code and try again.' };
    }
    if (code.isActive === false) {
      return { success: false, reason: 'This redeem code has been disabled by the store staff.' };
    }
    if (code.expiresAt) {
      const exp = new Date(code.expiresAt);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return { success: false, reason: `This redeem code has expired on ${exp.toLocaleDateString()}.` };
      }
    }
    const maxUses = Number(code.maxUses || 1);
    const usedCount = Number(code.usedCount || 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      return { success: false, reason: 'This redeem code has already reached its maximum claim limit!' };
    }
    if (!Array.isArray(code.claimedBy)) {
      code.claimedBy = [];
    }
    const alreadyClaimed = code.claimedBy.some(c => c.userId === user.id);
    if (alreadyClaimed) {
      return { success: false, reason: 'You have already claimed this redeem code!' };
    }

    code.usedCount = usedCount + 1;
    const claimRecord = {
      userId: user.id,
      username: user.tag || user.username || 'User',
      claimedAt: new Date().toISOString(),
      deliveredKey: null
    };
    code.claimedBy.push(claimRecord);
    this.saveRedeemCode(code);

    return {
      success: true,
      codeData: code,
      claimRecord
    };
  }

  recordClaimKey(codeStr, userId, deliveredKey) {
    this.reloadRedeemCodes();
    const cleanCode = (codeStr || '').toUpperCase().trim();
    const code = this.redeemCodes[cleanCode];
    if (!code || !Array.isArray(code.claimedBy)) return;
    const record = code.claimedBy.slice().reverse().find(c => c.userId === userId);
    if (record) {
      record.deliveredKey = deliveredKey;
      this.saveRedeemCode(code);
    }
  }
}

module.exports = new Database();
