const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const adminVerifyFlow = require('./adminVerifyFlow');
const licenseService = require('../services/licenseService');
const ticketService = require('../services/ticketService');

/**
 * Helper to safely check if a string is a valid HTTP/HTTPS URL
 */
function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Helper to attach local QR image files or set remote image URLs
 */
function attachQrImage(qrUrlOrPath, embed, files) {
  if (!qrUrlOrPath) return;
  if (isValidHttpUrl(qrUrlOrPath)) {
    embed.setImage(qrUrlOrPath);
    return;
  }

  let resolvedPath = path.isAbsolute(qrUrlOrPath)
    ? qrUrlOrPath
    : path.join(__dirname, '..', qrUrlOrPath.replace(/^\/+/, ''));

  if (!fs.existsSync(resolvedPath)) {
    const inPublic = path.join(__dirname, '..', 'dashboard', 'public', qrUrlOrPath.replace(/^\/+/, ''));
    if (fs.existsSync(inPublic)) resolvedPath = inPublic;
  }

  if (fs.existsSync(resolvedPath)) {
    const ext = path.extname(resolvedPath).slice(1) || 'png';
    const filename = `payment_qr_${Date.now()}.${ext}`;
    const attachment = new AttachmentBuilder(resolvedPath, { name: filename });
    embed.setImage(`attachment://${filename}`);
    files.push(attachment);
  }
}

class PurchaseFlow {
  /**
   * Step 1: User selected a product from dropdown; display Private Live Preview Card
   */
  async handleProductSelection(interaction, rawProductId, previewCurrency = null) {
    const productId = rawProductId.replace('panel_', '').toLowerCase().trim();
    const product = db.getProduct(productId);

    if (!product) {
      return interaction.reply({
        content: `❌ Product "${productId}" not found!`,
        ephemeral: true
      });
    }

    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    // Status formatting
    let statusText = 'Safe 🟢';
    let isPatched = false;
    if (product.status === 'maintenance') statusText = 'Maintenance 🟡';
    if (product.status === 'patched') {
      statusText = 'Patched 🔴';
      isPatched = true;
    }

    // Features list formatting
    let featuresText = '';
    if (Array.isArray(product.features) && product.features.length > 0) {
      featuresText = product.features.map(f => `• ${f}`).join('\n');
    } else {
      featuresText = `• 💻 ${product.description || 'Premium Undetected Quality'}\n• ⚡ 24/7 Automated Key Delivery`;
    }

    // Plans list formatting
    const defaultCurr = db.getDefaultCurrency();
    const activeCurrency = (previewCurrency || defaultCurr).toUpperCase();

    let plansText = '';
    const planOptions = [];

    if (product.plans && Object.keys(product.plans).length > 0) {
      for (const [key, plan] of Object.entries(product.plans)) {
        const icon = key === '1d' ? '⏱️' : (key === '7d' ? '📅' : (key === '30d' ? '🗓️' : '⚡'));
        const priceList = db.formatPlanPriceList(plan, activeCurrency);
        const compactPrice = db.formatPlanPriceCompact(plan, activeCurrency);

        plansText += `• ${icon} **${plan.label}:**\n   ┗ ${priceList}\n`;

        planOptions.push({
          label: `${plan.label} (${compactPrice})`.slice(0, 100),
          description: `Price: ${compactPrice} • Instant Key Delivery`.slice(0, 100),
          value: `plan_${product.id}_${key}`,
          emoji: icon
        });
      }
    } else {
      const singlePlan = { price: product.price || 0, currency: product.currency || '₹' };
      const priceList = db.formatPlanPriceList(singlePlan, activeCurrency);
      const compactPrice = db.formatPlanPriceCompact(singlePlan, activeCurrency);
      plansText += `• ⏱️ **Lifetime / Default:**\n   ┗ ${priceList}\n`;

      planOptions.push({
        label: `Standard License (${compactPrice})`.slice(0, 100),
        description: `Price: ${compactPrice} • Instant Key Delivery`.slice(0, 100),
        value: `plan_${product.id}_default`,
        emoji: '⚡'
      });
    }

    const planSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_select_plan')
      .setPlaceholder(
        isPatched
          ? '🔴 Product currently patched / disabled'
          : '⏱️ Select Duration Plan (1D / 7D / 30D / Lifetime)...'
      )
      .setDisabled(isPatched)
      .addOptions(planOptions.slice(0, 25));

    const planRow = new ActionRowBuilder().addComponents(planSelectMenu);

    // Currency Exchange Dropdown for Product Preview
    const allConvs = db.getAllCurrencyConversions(100);
    const currPreviewOptions = [
      {
        label: '🌐 Multi-Currency (Show All)',
        description: 'Display pricing in all store currencies',
        value: 'preview_curr_ALL',
        emoji: '🌐',
        default: previewCurrency === 'ALL'
      }
    ];

    for (const c of allConvs) {
      currPreviewOptions.push({
        label: `${c.flag} ${c.currency} — ${c.name}`,
        description: `Show duration prices in ${c.currency} (${c.symbol})`,
        value: `preview_curr_${c.currency}`,
        emoji: c.flag,
        default: activeCurrency === c.currency && previewCurrency !== 'ALL'
      });
    }

    const currPreviewMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_select_preview_currency_${product.id}`)
      .setPlaceholder(`💱 Currency: ${activeCurrency === 'ALL' ? '🌐 All Currencies' : activeCurrency} (Click to switch currency)...`)
      .addOptions(currPreviewOptions.slice(0, 25));

    const currPreviewRow = new ActionRowBuilder().addComponents(currPreviewMenu);

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_shop')
        .setLabel('🔙 Back')
        .setStyle(ButtonStyle.Secondary)
    );

    const embedColor = settings.shopPage?.color
      ? parseInt(settings.shopPage.color.replace('#', ''), 16)
      : 0x00d2ff;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `${storeName} • Verified Product Inspection`,
        iconURL: settings.shopPage?.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setTitle(`📦 ${product.name} ${product.version ? `(${product.version})` : ''} — Live Specifications`)
      .setDescription(
        `╭──────────────────────────────────────────╮\n` +
        `  📦  **${product.name.toUpperCase()}** ${product.version ? `\`${product.version}\`` : ''}\n` +
        `  *Category: ${product.category || 'PC'} • Platform Engine*\n` +
        `╰──────────────────────────────────────────╯\n\n` +
        `> 🛡️ **Anti-Cheat Status:** ${statusText}\n` +
        `> ⚡ **Delivery Engine:** 0-Second Automated Key Drop\n` +
        `> 👁️ **Protection:** Kernel-Level Stealth Bypass\n\n` +
        `🔥 **PANEL FEATURES & CAPABILITIES:**\n` +
        `${featuresText}\n\n` +
        `──────────────────────────────────────────\n` +
        `💰 **AVAILABLE DURATION PLANS ${previewCurrency && previewCurrency !== 'ALL' ? `(${previewCurrency})` : '(MULTI-CURRENCY)'}:**\n` +
        `${plansText}\n` +
        `👇 *Select a duration plan from the dropdown menu below to proceed to checkout!*`
      )
      .setFooter({
        text: `${storeName} • 24/7 Automated Delivery • Status: ${statusText}`
      })
      .setTimestamp();

    const rows = [planRow, currPreviewRow, backRow];

    if (
      interaction.customId?.startsWith('shop_select_preview_currency_') ||
      (interaction.isButton() && interaction.customId.startsWith('back_to_product_'))
    ) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
      await interaction.editReply({
        embeds: [embed],
        components: rows
      });
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({
        embeds: [embed],
        components: rows
      });
    } else {
      await interaction.followUp({
        embeds: [embed],
        components: rows,
        ephemeral: true
      });
    }
  }

  /**
   * Step 2: User clicked a duration plan; create order & open private ticket channel
   */
  async handlePlanSelection(interaction, productId, planKey) {
    const product = db.getProduct(productId);
    if (!product) {
      return interaction.reply({ content: '❌ Product not found.', ephemeral: true });
    }

    const settings = db.getSettings();

    let plan = product.plans ? product.plans[planKey] : null;
    if (!plan) {
      plan = {
        label: 'Standard',
        price: product.price || 100,
        currency: product.currency || '₹',
        durationDays: 30
      };
    }

    const defaultCurr = db.getDefaultCurrency();
    let initialMethod = 'binance';
    if (defaultCurr === 'INR') initialMethod = 'upi';
    else if (defaultCurr === 'NPR') initialMethod = 'esewa';
    else if (defaultCurr === 'USD') initialMethod = 'binance';

    // Create Order in DB
    const order = db.createOrder({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      productId: product.id,
      productName: product.name,
      planKey,
      planDuration: plan.label,
      durationDays: plan.durationDays || 30,
      amount: plan.price,
      currency: plan.currency || '₹',
      selectedCurrency: defaultCurr,
      paymentMethod: initialMethod,
      deliveryType: product.deliveryType || 'keyauth'
    });

    // Check mode: ticket vs direct (default: direct / no tickets)
    const isTicketMode = settings.mode === 'ticket';

    if (isTicketMode && interaction.guild) {
      try {
        const ticketChannel = await ticketService.createOrderTicket(
          interaction.guild,
          interaction.user,
          order,
          product
        );

        db.updateOrder(order.id, { ticketChannelId: ticketChannel.id });

        await interaction.reply({
          content: `✅ **Your Private Order Room has been created!**\n👉 Please click here to view payment details & complete checkout: <#${ticketChannel.id}>\n*(Visible ONLY to you and the store staff)*`,
          ephemeral: true
        });

        await this.sendPaymentScreenToChannel(ticketChannel, order, initialMethod, defaultCurr);
        return;
      } catch (ticketErr) {
        console.error('Failed to create ticket channel, falling back to direct:', ticketErr);
      }
    }

    // DIRECT NO-TICKET METHOD: Render the payment screen with QR code & toggles directly in this channel (ephemeral)
    await this.renderPaymentScreen(interaction, order.id, initialMethod, defaultCurr);
  }

  /**
   * Helper to build the payment embed and component rows
   */
  /**
   * Helper to build the payment embed and component rows with Currency Exchange Dropdown
   */
  buildPaymentMessageData(order, selectedMethod = 'upi', selectedCurrency = null) {
    const settings = db.getSettings();
    const payments = settings.paymentMethods || {};
    const storeName = settings.storeName || 'White X Store';
    const isTopup = order.type === 'wallet_topup';

    const defaultCurr = db.getDefaultCurrency();
    const currentCurrency = (selectedCurrency || order.selectedCurrency || defaultCurr).toUpperCase();
    const inrAmount = Number(order.amount || 0);
    const conv = db.convertCurrency(inrAmount, currentCurrency);
    const allConvs = db.getAllCurrencyConversions(inrAmount);

    const rates = db.getCurrencyRates();
    const usdAmount = (inrAmount * (rates.USD || 0.012)).toFixed(2);
    const nprAmount = Math.round(inrAmount * (rates.NPR || 1.6));

    // 1. Currency Exchange Dropdown Menu
    const currencyOptions = allConvs.map(c => ({
      label: `${c.flag} ${c.currency} — ${c.name} (${c.formatted})`.slice(0, 100),
      description: `${c.name} • Total Due: ${c.formatted}`.slice(0, 100),
      value: `currency_exchange_${order.id}_${c.currency}`,
      emoji: c.flag,
      default: c.currency === currentCurrency
    }));

    const currencySelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_select_currency_${order.id}`)
      .setPlaceholder(`💱 Currency Exchange (Selected: ${conv.flag} ${conv.currency} — ${conv.formatted})...`)
      .addOptions(currencyOptions.slice(0, 25));

    const currencyRow = new ActionRowBuilder().addComponents(currencySelectMenu);

    // 2. Payment Method Dropdown Menu
    const paymentMethods = payments || {};
    const enabledEntries = Object.entries(paymentMethods).filter(([k, m]) => m && m.enabled !== false);

    let currentMethod = selectedMethod;
    if (!enabledEntries.some(([k]) => k === currentMethod)) {
      currentMethod = enabledEntries.length > 0 ? enabledEntries[0][0] : 'upi';
    }

    const selectOptions = [];
    for (const [key, pm] of enabledEntries) {
      let icon = pm.emoji;
      if (!icon) {
        if (key === 'upi') icon = '🇮🇳';
        else if (key === 'esewa') icon = '🇳🇵';
        else if (key === 'binance') icon = '🌐';
        else if (key === 'credit') icon = '💳';
        else if (key === 'crypto') icon = '🪙';
        else if (key === 'paypal') icon = '🅿️';
        else if (key.includes('jazz') || key.includes('easy')) icon = '🇵🇰';
        else icon = '💳';
      }

      let desc = '';
      if (key === 'upi') desc = `Pay ₹${inrAmount} INR via UPI QR (9353351285@kotakbank)`;
      else if (key === 'esewa') desc = `Pay रू${nprAmount} NPR via eSewa (9826866639)`;
      else if (key === 'binance') desc = `Pay $${usdAmount} USDT via Binance Pay (User-7bad1)`;
      else if (key === 'credit') desc = `Instant Card Gateway ($${usdAmount} USD / ₹${inrAmount} INR)`;
      else if (key === 'crypto') desc = `Pay with USDT TRC20, LTC, or BTC ($${usdAmount} USD)`;
      else if (key === 'paypal') desc = `Pay via PayPal Friends & Family ($${usdAmount} USD)`;
      else if (pm.details) desc = pm.details.split('\n')[0].slice(0, 100);
      else desc = `Pay securely using ${pm.name || key}`;

      selectOptions.push({
        label: `${pm.name || key.toUpperCase()}`.slice(0, 100),
        description: desc.slice(0, 100),
        value: `toggle_pay_${order.id}_${key}`,
        emoji: icon,
        default: key === currentMethod
      });
    }

    if (selectOptions.length === 0) {
      selectOptions.push({
        label: 'UPI / Direct Contact',
        description: 'Contact store staff to complete payment',
        value: `toggle_pay_${order.id}_upi`,
        emoji: '📱',
        default: true
      });
    }

    const paymentSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_select_payment_method_${order.id}`)
      .setPlaceholder('💳 Choose Payment Method (Nepal / India / International)...')
      .addOptions(selectOptions.slice(0, 25));

    const toggleRow = new ActionRowBuilder().addComponents(paymentSelectMenu);

    // 3. Action Buttons
    const userBalance = db.getUserBalance(order.userId);
    const actionButtons = [];

    if (!isTopup && userBalance >= order.amount) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`buy_wallet_${order.id}`)
          .setLabel(`⚡ Buy with Wallet (₹${userBalance})`)
          .setStyle(ButtonStyle.Success)
      );
    }

    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`submit_proof_${order.id}`)
        .setLabel('✍️ Submit Payment Proof')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`gallery_proof_${order.id}`)
        .setLabel('📸 Upload Proof (Bot DM / Pic Ticket)')
        .setStyle(ButtonStyle.Success)
    );

    if (order.ticketChannelId) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`close_ticket_${order.id}`)
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (isTopup) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`back_to_wallet_${order.id}`)
          .setLabel('🔙 Back')
          .setStyle(ButtonStyle.Secondary)
      );
    } else {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`back_to_product_${order.id}_${order.productId}`)
          .setLabel('🔙 Back')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const actionRow = new ActionRowBuilder().addComponents(actionButtons);
    const embed = new EmbedBuilder().setColor(isTopup ? 0x9b59b6 : 0x00d2ff);
    const files = [];

    // Common Currency Exchange Block for Embed
    const currencyExchangeBlock =
      `💱 **CURRENCY EXCHANGE & AMOUNT DUE:**\n` +
      `• **Selected Currency:** ${conv.flag} **${conv.name} (${conv.currency})**\n` +
      `• **Exchanged Total Due:** **${conv.symbol}${conv.amount.toLocaleString()} ${conv.currency}**\n\n`;

    if (currentMethod === 'esewa') {
      // 🇳🇵 NEPAL (eSewa)
      const esewaConfig = payments.esewa || {};
      const esewaId = esewaConfig.number || esewaConfig.eSewaId || '9826866639';
      const payeeName = esewaConfig.payeeName || 'Manish Kumar Yadav';
      const exactDueNpr = conv.currency === 'NPR' ? `${conv.symbol}${conv.amount.toLocaleString()} NPR` : `रू${nprAmount} NPR`;

      embed
        .setTitle(`🇳🇵 eSEWA PAYMENT & QR CODE — Order #${order.id}`)
        .setDescription(
          `╭──────────────────────────────────────────╮\n` +
          `  🧾  **ORDER PAYMENT & VERIFICATION**\n` +
          `  *Order ID: #${order.id} • 0s Key Drop*\n` +
          `╰──────────────────────────────────────────╯\n\n` +
          `> 👤 **Buyer:** <@${order.userId}>\n` +
          `> 📦 **Item:** \`${isTopup ? 'Wallet Top-up' : order.productName}\`\n` +
          (isTopup ? '' : `> ⏱️ **Duration Plan:** \`${order.planDuration || '30 Days'}\`\n`) +
          `> 💰 **Total Amount (NPR):** **${exactDueNpr}** *(Base: ₹${inrAmount} INR)*\n\n` +
          currencyExchangeBlock +
          `🇳🇵 **eSEWA PAYMENT DETAILS:**\n` +
          `• **eSewa ID / Mobile:** \`${esewaId}\`\n` +
          `• **Account Holder:** \`${payeeName}\`\n` +
          `• **Total Due:** **${exactDueNpr}**\n\n` +
          `⚡ **HOW TO GET YOUR KEY:**\n` +
          `1️⃣ Scan the **eSewa QR Code** above using your eSewa App or use direct Send Money.\n` +
          `2️⃣ Send the exact amount: **${exactDueNpr}**.\n` +
          `3️⃣ After completing payment, copy the Transaction Code or save your payment screenshot.\n` +
          `4️⃣ Click **\`📸 Upload Proof\`** or **\`✍️ Submit Payment Proof\`** below!\n\n` +
          `📌 *Once verified, your license key and setup guide will be delivered directly to your DM.*`
        )
        .setFooter({ text: `${storeName} • Order #${order.id} • Nepal (eSewa) Gateway` })
        .setTimestamp();

      attachQrImage(esewaConfig.qrCodeUrl || 'assets/qr/esewa_nepal.png', embed, files);

    } else if (currentMethod === 'upi') {
      // 🇮🇳 INDIA (UPI / QR Code)
      const upiConfig = payments.upi || {};
      const upiId = upiConfig.upiId || '9353351285@kotakbank';
      const payeeName = upiConfig.payeeName || 'OM YADAV';

      const title = isTopup
        ? `💳 WALLET TOP-UP QR — Order #${order.id}`
        : `🇮🇳 UPI & QR CODE CHECKOUT — Order #${order.id}`;

      embed
        .setTitle(title)
        .setDescription(
          `╭──────────────────────────────────────────╮\n` +
          `  🧾  **ORDER PAYMENT & VERIFICATION**\n` +
          `  *Order ID: #${order.id} • 0s Key Drop*\n` +
          `╰──────────────────────────────────────────╯\n\n` +
          `> 👤 **Buyer:** <@${order.userId}>\n` +
          `> 📦 **Item:** \`${isTopup ? 'Wallet Top-up' : order.productName}\`\n` +
          (isTopup ? '' : `> ⏱️ **Duration Plan:** \`${order.planDuration || '30 Days'}\`\n`) +
          `> 💰 **Total Amount:** **₹${order.amount} INR** *(${conv.formatted})*\n\n` +
          currencyExchangeBlock +
          `📱 **UPI & QR CODE PAYMENT DETAILS:**\n` +
          `• **UPI ID:** \`${upiId}\`\n` +
          `• **Payee Name:** \`${payeeName}\`\n` +
          `• **Total Due:** **₹${order.amount} INR**\n\n` +
          `⚡ **HOW TO GET YOUR KEY:**\n` +
          `1️⃣ Scan the QR code above using Google Pay, PhonePe, Paytm, or BHIM.\n` +
          `2️⃣ After completing payment, copy the 12-digit UTR / Reference ID or save your screenshot.\n` +
          `3️⃣ Click **\`📸 Upload Proof\`** or **\`✍️ Submit Payment Proof\`** below!\n\n` +
          `📌 *Your 12-digit UTR will be verified and your license key delivered automatically.*`
        )
        .setFooter({ text: `${storeName} • Order #${order.id} • India (UPI) Gateway` })
        .setTimestamp();

      const customQr = upiConfig.qrCodeUrl || 'assets/qr/upi_india.png';
      attachQrImage(customQr, embed, files);

    } else if (currentMethod === 'binance') {
      // 🌐 INTERNATIONAL (Binance Pay / Crypto)
      const binanceConfig = payments.binance || {};
      const payId = binanceConfig.number || 'User-7bad1';
      const payLink = binanceConfig.paymentLink || 'https://app.binance.com/uni-qr/TYyJ4S9Z';

      embed
        .setTitle(`🌐 BINANCE PAY (INTERNATIONAL) — Order #${order.id}`)
        .setDescription(
          `╭──────────────────────────────────────────╮\n` +
          `  🧾  **ORDER PAYMENT & VERIFICATION**\n` +
          `  *Order ID: #${order.id} • 0s Key Drop*\n` +
          `╰──────────────────────────────────────────╯\n\n` +
          `> 👤 **Buyer:** <@${order.userId}>\n` +
          `> 📦 **Item:** \`${isTopup ? 'Wallet Top-up' : order.productName}\`\n` +
          (isTopup ? '' : `> ⏱️ **Duration Plan:** \`${order.planDuration || '30 Days'}\`\n`) +
          `> 💰 **Total Amount (USD):** **$${usdAmount} USDT** *(Base: ₹${inrAmount} INR)*\n\n` +
          currencyExchangeBlock +
          `🌐 **BINANCE PAY DETAILS:**\n` +
          `• **Binance Pay ID / User:** \`${payId}\`\n` +
          `• **Direct Pay Link:** [Click Here to Pay with Binance](${payLink})\n` +
          `• **Amount Due:** **$${usdAmount} USDT / USD**\n\n` +
          `⚡ **HOW TO GET YOUR KEY:**\n` +
          `1️⃣ Open the Binance app, scan the QR code above, or click the direct payment link.\n` +
          `2️⃣ Transfer the exact amount: **$${usdAmount} USDT**.\n` +
          `3️⃣ After completing payment, copy the Order ID or save your payment screenshot.\n` +
          `4️⃣ Click **\`📸 Upload Proof\`** or **\`✍️ Submit Payment Proof\`** below!\n\n` +
          `📌 *Cryptocurrency payments are verified 24/7 with instant key delivery.*`
        )
        .setFooter({ text: `${storeName} • Order #${order.id} • International (Binance Pay) Gateway` })
        .setTimestamp();

      attachQrImage(binanceConfig.qrCodeUrl || 'assets/qr/binance_international.png', embed, files);

    } else {
      // Any other custom payment method
      const customConfig = payments[currentMethod] || {};
      const methodName = customConfig.name || currentMethod.toUpperCase();
      const accountLine = customConfig.number || customConfig.upiId || customConfig.paymentLink || '';
      const details = customConfig.details || customConfig.instructions || 'Contact staff for account details.';

      embed
        .setTitle(`💳 ${methodName} — Order #${order.id}`)
        .setDescription(
          `Hello <@${order.userId}>! Pay securely using **${methodName}**:\n\n` +
          `• **Item:** ${isTopup ? '**Wallet Top-up**' : order.productName}\n` +
          (isTopup ? '' : `• **Plan Duration:** \`${order.planDuration || '30 Days'}\`\n`) +
          currencyExchangeBlock +
          `• **Amount Due:** **${conv.formatted}** *(Base: ₹${inrAmount} INR)*\n\n` +
          (accountLine ? `📱 **Account / Details:** \`${accountLine}\`\n\n` : '') +
          `📋 **Payment Instructions:**\n` +
          `\`\`\`\n${details}\n\`\`\`\n` +
          `📌 *After completing payment, click **✍️ Submit Payment Proof** or **📸 Upload Proof** to submit your screenshot!*`
        )
        .setFooter({ text: `Order #${order.id} | Selected: ${conv.currency} | ${methodName} Gateway` });

      if (customConfig.qrCodeUrl || customConfig.qrCode) {
        attachQrImage(customConfig.qrCodeUrl || customConfig.qrCode, embed, files);
      }
    }

    return { embed, currencyRow, toggleRow, actionRow, files };
  }

  /**
   * Sends the initial payment screen into the private ticket channel
   */
  async sendPaymentScreenToChannel(channel, order, selectedMethod = 'upi', selectedCurrency = null) {
    const { embed, currencyRow, toggleRow, actionRow, files } = this.buildPaymentMessageData(
      order,
      selectedMethod,
      selectedCurrency
    );

    const welcomeNotice =
      `👋 Welcome <@${order.userId}> to your private checkout room!\n` +
      `🔒 **This room is visible ONLY to you and the store staff.**\n\n` +
      `📸 **Direct Gallery Upload:** After completing payment, simply send/attach your payment screenshot directly in this chat!\n` +
      `✍️ Or click the **Submit Payment Proof** button below.`;

    const sentMsg = await channel.send({
      content: welcomeNotice,
      embeds: [embed],
      components: [currencyRow, toggleRow, actionRow],
      files: files || []
    });

    db.updateOrder(order.id, { paymentMessageId: sentMsg.id });
    return sentMsg;
  }

  /**
   * Step 3: User clicked toggle or "Pay Now"; render/update Payment Screen
   */
  async renderPaymentScreen(interaction, orderId, selectedMethod = 'upi', selectedCurrency = null) {
    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.reply({ content: '❌ Order not found or expired.', ephemeral: true });
    }

    const defaultCurr = db.getDefaultCurrency();
    const currentCurrency = (selectedCurrency || order.selectedCurrency || defaultCurr).toUpperCase();
    db.updateOrder(orderId, {
      paymentMethod: selectedMethod,
      selectedCurrency: currentCurrency
    });

    const { embed, currencyRow, toggleRow, actionRow, files } = this.buildPaymentMessageData(
      order,
      selectedMethod,
      currentCurrency
    );

    const components = [currencyRow, toggleRow, actionRow];

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
      await interaction.editReply({
        embeds: [embed],
        components,
        files: files || []
      });
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [embed],
        components,
        files: files || []
      });
    } else {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({
        embeds: [embed],
        components,
        files: files || []
      });
    }
  }

  /**
   * Direct Gallery Screenshot received in Ticket Channel
   */
  async handleAttachmentProof(message, order) {
    const attachment = message.attachments.first();
    if (!attachment || !attachment.url) return;

    const isTopup = order.type === 'wallet_topup';

    const updatedOrder = db.updateOrder(order.id, {
      status: 'pending_verification',
      proofUrl: attachment.url,
      submittedAt: new Date().toISOString()
    });

    const receivedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ Payment Screenshot Received! (Order #${order.id})`)
      .setDescription(
        `Thank you <@${message.author.id}>! Your payment screenshot has been sent to our staff team for manual verification.\n\n` +
        `• **Item:** ${isTopup ? 'Wallet Top-up' : order.productName}\n` +
        `• **Amount:** **${order.currency}${order.amount}**\n\n` +
        `⏳ **Status:** Verification in progress!\n` +
        (isTopup
          ? `Staff will verify and credit **₹${order.amount}** to your Wallet Balance shortly!`
          : `Staff will verify your payment. Your **License Key** will be delivered directly here and to your **Discord DMs**!`)
      )
      .setImage(attachment.url)
      .setFooter({ text: 'Auto Sell System • Verification Pending' })
      .setTimestamp();

    await message.channel.send({ embeds: [receivedEmbed] });

    // Send verification card to staff channel
    await adminVerifyFlow.sendVerificationCardToStaff(message.client, updatedOrder);
  }

  /**
   * Instant 1-Click Purchase using Wallet Balance
   */
  async handleBuyWithWallet(interaction, orderId) {
    await interaction.deferUpdate().catch(() => {});

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.followUp({ content: '❌ Order not found.', ephemeral: true });
    }

    const userBalance = db.getUserBalance(interaction.user.id);
    if (userBalance < order.amount) {
      return interaction.followUp({
        content: `⚠️ Insufficient wallet balance! You have ₹${userBalance.toFixed(2)}, but this product requires ₹${order.amount}. Please top-up first.`,
        ephemeral: true
      });
    }

    // Deduct wallet balance
    const successDeduct = db.deductWalletBalance(
      interaction.user.id,
      order.amount,
      `Purchased ${order.productName} (${order.planDuration || '30 Days'})`
    );

    if (!successDeduct) {
      return interaction.followUp({ content: '❌ Failed to process wallet deduction.', ephemeral: true });
    }

    const product = db.getProduct(order.productId);
    const deliveryResult = await licenseService.deliverKey(product, order);

    let licenseKey = deliveryResult.success
      ? deliveryResult.key
      : `${(product?.name || 'KEY').toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Mark completed
    db.updateOrder(orderId, {
      status: 'completed',
      licenseKey,
      paymentMethod: 'wallet',
      approvedBy: 'Auto-Wallet System',
      completedAt: new Date().toISOString()
    });

    const settings = db.getSettings();
    if (settings.customerRoleId && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(order.userId).catch(() => null);
        if (member && !member.roles.cache.has(settings.customerRoleId)) {
          await member.roles.add(settings.customerRoleId, 'Auto Sell: Wallet purchase');
        }
      } catch (err) {}
    }

    const newBalance = db.getUserBalance(interaction.user.id);

    const buyerEmbed = new EmbedBuilder()
      .setTitle(`🎉 Instant Wallet Purchase Successful! (Order #${order.id})`)
      .setColor(0x2ecc71)
      .setDescription(
        `Your purchase for **${product?.name || order.productName}** was completed instantly using your Wallet balance!\n\n` +
        `• 💰 **Price Deducted:** **₹${order.amount}**\n` +
        `• 💳 **Remaining Wallet Balance:** **₹${newBalance.toFixed(2)}**\n` +
        `• ⏳ **Duration:** ${order.planDuration || '30 Days'}`
      )
      .addFields({
        name: '🔑 Your License Key',
        value: `\`\`\`${licenseKey}\`\`\`\n*(Click to reveal: ||${licenseKey}||)*`,
        inline: false
      })
      .setFooter({ text: 'Delivered instantly • White X Store' })
      .setTimestamp();

    if (product?.downloadUrl) {
      buyerEmbed.addFields({ name: '📥 Download Link', value: `${product.downloadUrl}`, inline: false });
    }
    if (product?.instructions) {
      buyerEmbed.addFields({ name: '📖 Instructions', value: `${product.instructions}`, inline: false });
    }

    // Send DM to buyer
    try {
      await interaction.user.send({ embeds: [buyerEmbed] });
    } catch (dmErr) {}

    const finishedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ Order #${order.id} Completed with Wallet!`)
      .setDescription(
        `Your license key has been delivered to your **Discord DMs** and posted below!\n\n` +
        `• **Product:** ${product?.name || order.productName} (${order.planDuration || '30 Days'})\n` +
        `• **License Key:** ||\`${licenseKey}\`||\n` +
        `• **Remaining Wallet Balance:** **₹${newBalance.toFixed(2)}**`
      )
      .setFooter({ text: 'Thank you for shopping with White X Store!' });

    // If inside ticket channel, post delivery and schedule close
    if (order.ticketChannelId && interaction.channelId === order.ticketChannelId) {
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`close_ticket_${order.id}`)
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({
        content: `🎉 <@${order.userId}> **Purchase complete! License key delivered below:**`,
        embeds: [finishedEmbed],
        components: [closeRow]
      });

      // Schedule auto-close in 30 seconds
      ticketService.closeTicket(interaction.channel, 30000, 'Wallet purchase complete');
    } else {
      await interaction.editReply({
        embeds: [finishedEmbed],
        components: []
      });
    }

    // Public sales log
    if (settings.logChannelId) {
      try {
        const logChannel = await interaction.client.channels.fetch(settings.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🛒 Instant Wallet Sale!')
            .setColor(0x2ecc71)
            .setDescription(`<@${order.userId}> purchased **${product?.name || order.productName}** with Wallet Balance!`)
            .addFields(
              { name: '💰 Price', value: `₹${order.amount}`, inline: true },
              { name: '🧾 Order ID', value: `#${order.id}`, inline: true }
            )
            .setFooter({ text: 'Auto Sell Logs' })
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {}
    }
  }

  /**
   * Wallet View handler
   */
  async handleWalletView(interaction) {
    const settings = db.getSettings();
    const balance = db.getUserBalance(interaction.user.id);
    const history = db.getWalletHistory(interaction.user.id);

    let historyText = '*No transactions yet.*';
    if (history.length > 0) {
      historyText = history
        .slice(-5)
        .reverse()
        .map(h => {
          const icon = h.type === 'credit' ? '🟢 +' : '🔴 -';
          const dateStr = `<t:${Math.floor(new Date(h.date).getTime() / 1000)}:R>`;
          return `${icon} ₹${h.amount} • *${h.note}* (${dateStr})`;
        })
        .join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(`💳 ${settings.storeName || 'White X Store'} — Your Wallet`)
      .setColor(0x00d2ff)
      .setDescription(
        `Welcome <@${interaction.user.id}>! Use your wallet to purchase any product instantly without waiting for payment verification.\n\n` +
        `💰 **Available Balance:** **₹${balance.toFixed(2)}**\n\n` +
        `📜 **Recent Transaction History:**\n${historyText}`
      )
      .setFooter({ text: 'White X Store Wallet • Fast & Secure' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wallet_topup')
        .setLabel('➕ Add Balance / Top-up')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wallet_view')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('back_to_shop')
        .setLabel('🔙 Back')
        .setStyle(ButtonStyle.Secondary)
    );

    if (
      interaction.isButton() &&
      (interaction.customId === 'wallet_view' || interaction.customId.startsWith('back_to_wallet_'))
    ) {
      await interaction.update({ embeds: [embed], components: [row] });
    } else {
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }

  /**
   * Open Modal to enter top-up amount
   */
  async openWalletTopupModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_wallet_topup')
      .setTitle('Add Balance to Wallet');

    const amountInput = new TextInputBuilder()
      .setCustomId('topup_amount')
      .setLabel('Enter Amount to Add (₹ INR)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 150, 500, 1000')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(6);

    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    await interaction.showModal(modal);
  }

  /**
   * Top-up Modal submitted -> create order & open private ticket channel
   */
  async handleWalletTopupSubmit(interaction) {
    const rawAmount = interaction.fields.getTextInputValue('topup_amount');
    const amount = Number(rawAmount.replace(/[^0-9.]/g, ''));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: '❌ Please enter a valid numerical amount (e.g. 200, 500).',
        ephemeral: true
      });
    }

    const order = db.createOrder({
      type: 'wallet_topup',
      userId: interaction.user.id,
      guildId: interaction.guildId,
      productId: 'wallet_topup',
      productName: 'Wallet Balance Top-up',
      amount,
      currency: '₹',
      paymentMethod: 'upi',
      deliveryType: 'wallet'
    });

    const settings = db.getSettings();
    const isTicketMode = settings.mode === 'ticket';

    if (isTicketMode && interaction.guild) {
      try {
        const ticketChannel = await ticketService.createOrderTicket(
          interaction.guild,
          interaction.user,
          order,
          null
        );

        db.updateOrder(order.id, { ticketChannelId: ticketChannel.id });

        await interaction.reply({
          content: `✅ **Private Top-up Room Created!**\n👉 Please click here to view payment details & QR code: <#${ticketChannel.id}>\n*(Visible ONLY to you and the store staff)*`,
          ephemeral: true
        });

        await this.sendPaymentScreenToChannel(ticketChannel, order, 'upi');
        return;
      } catch (err) {
        console.error('Failed to create topup ticket channel, falling back:', err);
      }
    }

    // DIRECT NO-TICKET METHOD: Render the payment screen with QR code directly in this channel (ephemeral)
    await this.renderPaymentScreen(interaction, order.id, 'upi');
  }

  /**
   * Step 4A: Gallery proof upload — 100% Private via Bot DM OR Auto-Created Ticket for Pic Only
   */
  async handleGalleryProof(interaction, orderId) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.editReply({ content: '❌ Order not found or expired.' });
    }

    if (order.status !== 'pending_payment') {
      return interaction.editReply({
        content: `⚠️ This order is already in state: ${order.status.toUpperCase()}`
      });
    }

    const isTopup = order.type === 'wallet_topup';
    const product = db.getProduct(order.productId);

    // If user is already inside their private ticket channel
    if (order.ticketChannelId && interaction.channelId === order.ticketChannelId) {
      return interaction.editReply({
        content:
          `📸 **You are already in your private room!**\n` +
          `Please click the **+** icon in the chat bar below to attach and send your payment screenshot directly here.\n` +
          `*(Only you and staff can see this channel)*`
      });
    }

    // 1. Send Direct Message to the buyer
    const dmEmbed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setTitle(`📸 Upload Payment Screenshot — Order #${order.id}`)
      .setDescription(
        `Hello <@${interaction.user.id}>!\n\n` +
        `• **Item:** **${isTopup ? 'Wallet Top-up' : order.productName}**\n` +
        (isTopup ? '' : `• **Plan Duration:** \`${order.planDuration || 'Standard'}\`\n`) +
        `• **Total Amount:** **${order.currency}${order.amount}**\n\n` +
        `📥 **Direct DM Screenshot Upload (100% Private):**\n` +
        `Please attach and send your payment screenshot image directly in this DM chat!\n\n` +
        `🔒 *No other server members can ever see your payment proof. Our staff team will review your screenshot and deliver your license key / balance directly here.*`
      )
      .setFooter({ text: 'Auto Sell System • 100% Private DM' })
      .setTimestamp();

    let dmSent = false;
    try {
      await interaction.user.send({ embeds: [dmEmbed] });
      dmSent = true;
    } catch (e) {
      dmSent = false;
    }

    // 2. If in a server, Auto-Create Private Ticket for Pic Only (or fetch existing)
    let ticketChannel = null;
    if (interaction.guild) {
      if (order.ticketChannelId && interaction.guild.channels.cache.has(order.ticketChannelId)) {
        ticketChannel = interaction.guild.channels.cache.get(order.ticketChannelId);
      } else {
        try {
          ticketChannel = await ticketService.createPicTicket(
            interaction.guild,
            interaction.user,
            order,
            product
          );
          db.updateOrder(order.id, { ticketChannelId: ticketChannel.id });

          const picTicketEmbed = new EmbedBuilder()
            .setColor(0x00d2ff)
            .setTitle(`📸 Private Proof Room — Order #${order.id}`)
            .setDescription(
              `👋 Welcome <@${interaction.user.id}> to your private proof upload room!\n\n` +
              `🔒 **This channel is visible ONLY to you and the store staff.**\n` +
              `• **Item:** ${isTopup ? 'Wallet Top-up' : order.productName} (${order.planDuration || 'Standard'})\n` +
              `• **Amount Due:** **${order.currency}${order.amount}**\n\n` +
              `📸 **How to Submit:**\n` +
              `Click the **+** button in the chat bar below, select your payment screenshot from your gallery, and send it directly here!\n\n` +
              `⚡ *Our system will immediately capture your screenshot and send it to staff for 1-click approval.*`
            )
            .setFooter({ text: 'Auto Sell System • Private Pic-Only Verification' })
            .setTimestamp();

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`close_ticket_${order.id}`)
              .setLabel('🔒 Close Room')
              .setStyle(ButtonStyle.Secondary)
          );

          await ticketChannel.send({
            content: `👋 <@${interaction.user.id}> Please attach and send your payment screenshot here:`,
            embeds: [picTicketEmbed],
            components: [closeRow]
          });
        } catch (err) {
          console.error('Failed to auto-create pic ticket channel:', err);
        }
      }
    }

    // 3. Ephemeral reply in channel
    let responseText = '';
    const responseButtons = [];

    if (ticketChannel) {
      responseText +=
        `✅ **Private Proof Room Created!**\n` +
        `👉 Please click here to upload your screenshot: <#${ticketChannel.id}>\n` +
        `*(Visible ONLY to you and staff — zero public visibility)*\n\n`;

      responseButtons.push(
        new ButtonBuilder()
          .setLabel('📁 Go to Private Pic Room')
          .setURL(`https://discord.com/channels/${interaction.guildId}/${ticketChannel.id}`)
          .setStyle(ButtonStyle.Link)
      );
    }

    if (dmSent) {
      responseText +=
        `📩 **Bot DM Also Available:**\n` +
        `We have also sent a private message to your **Direct Messages (DMs)** with <@${interaction.client.user.id}>. You can upload your screenshot in DMs or in your private ticket room!`;
    } else if (!ticketChannel) {
      responseText +=
        `⚠️ Your Discord DMs appear to be closed. Please enable DMs from server members or contact staff for assistance.`;
    }

    const actionRow = responseButtons.length > 0 ? [new ActionRowBuilder().addComponents(responseButtons)] : [];

    await interaction.editReply({
      content: responseText,
      components: actionRow
    });
  }

  /**
   * Step 4B: Open Modal for UTR / Proof submission (text alternative)
   */
  async openProofModal(interaction, orderId) {
    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.reply({
        content: '❌ Order not found or expired.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_proof_${order.id}`)
      .setTitle(`Submit Payment Proof — #${order.id}`);

    const utrInput = new TextInputBuilder()
      .setCustomId('utr_id')
      .setLabel('UTR / Transaction ID / Ref Number')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter 12-digit UTR (e.g. 412345678901) or TX Hash')
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(100);

    const proofUrlInput = new TextInputBuilder()
      .setCustomId('proof_url')
      .setLabel('Screenshot Image Link (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://imgur.com/... or paste image URL')
      .setRequired(false);

    const remarksInput = new TextInputBuilder()
      .setCustomId('remarks')
      .setLabel('Your Name / Remarks / In-Game ID (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Sender name or extra notes...')
      .setRequired(false)
      .setMaxLength(300);

    modal.addComponents(
      new ActionRowBuilder().addComponents(utrInput),
      new ActionRowBuilder().addComponents(proofUrlInput),
      new ActionRowBuilder().addComponents(remarksInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Step 5: Modal submitted; record UTR, notify buyer & send verification card to staff
   */
  async handleProofSubmit(interaction, orderId) {
    await interaction.deferUpdate().catch(() => {});

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.followUp({ content: '❌ Order not found.', ephemeral: true });
    }

    const utrId = interaction.fields.getTextInputValue('utr_id');
    const rawProofUrl = interaction.fields.getTextInputValue('proof_url') || null;
    const remarks = interaction.fields.getTextInputValue('remarks') || null;

    // Safely validate URL so setImage NEVER throws
    const hasValidProofUrl = isValidHttpUrl(rawProofUrl);
    const proofUrl = hasValidProofUrl ? rawProofUrl.trim() : null;

    const updatedOrder = db.updateOrder(orderId, {
      status: 'pending_verification',
      txId: utrId,
      proofUrl,
      notes: remarks,
      submittedAt: new Date().toISOString()
    });

    const isTopup = order.type === 'wallet_topup';

    const submittedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ Payment Proof Submitted (Order #${order.id})`)
      .setDescription(
        `Thank you! Your payment proof has been submitted to our staff team for manual verification.\n\n` +
        `• **Item:** ${isTopup ? 'Wallet Top-up' : order.productName}\n` +
        `• **Total Amount:** **${order.currency}${order.amount}**\n` +
        `• **UTR / Transaction ID:** \`${utrId}\`\n\n` +
        `⏳ **Verification in progress!**\n` +
        (isTopup
          ? `Your **Wallet Balance** will be credited automatically once staff verifies the payment!`
          : `As soon as an administrator verifies your payment, your **License Key** will be automatically sent to your **Discord DMs**!`)
      )
      .setFooter({ text: 'Auto Sell System • Verification Pending' })
      .setTimestamp();

    if (hasValidProofUrl) {
      submittedEmbed.setImage(proofUrl);
    }

    // If inside ticket channel, post confirmation
    if (order.ticketChannelId && interaction.channelId === order.ticketChannelId) {
      await interaction.channel.send({ embeds: [submittedEmbed] });
    } else {
      await interaction.editReply({
        embeds: [submittedEmbed],
        components: []
      }).catch(async () => {
        await interaction.followUp({ embeds: [submittedEmbed], ephemeral: true }).catch(() => {});
      });
    }

    await adminVerifyFlow.sendVerificationCardToStaff(interaction.client, updatedOrder);
  }

  /**
   * Handle Close Ticket button
   */
  async handleCloseTicket(interaction, orderId) {
    const order = db.getOrder(orderId);
    if (order && order.status === 'pending_payment') {
      db.updateOrder(orderId, { status: 'cancelled' });
    }

    await interaction.reply({
      content: '🔒 **Closing and deleting this ticket room in 5 seconds...**'
    });

    ticketService.closeTicket(interaction.channel, 5000, 'Closed by user button');
  }

  /**
   * Cancel an order
   */
  async handleCancelOrder(interaction, orderId) {
    const order = db.getOrder(orderId);
    if (order) db.updateOrder(orderId, { status: 'cancelled' });

    const buttons = [];
    if (order && order.type === 'wallet_topup') {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('wallet_view')
          .setLabel('🔙 Back')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('back_to_shop')
          .setLabel('🔙 Back')
          .setStyle(ButtonStyle.Primary)
      );
    }

    const row = new ActionRowBuilder().addComponents(buttons);

    await interaction.update({
      content: `❌ Order #${orderId} was cancelled.`,
      embeds: [],
      components: [row]
    });
  }

  /**
   * Builds the official Store Catalog message for in-channel navigation
   */
  buildShopCatalogMessage() {
    const products = db.getAllProducts();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';
    const shopPage = settings.shopPage || {};

    const color = shopPage.color
      ? parseInt(shopPage.color.replace('#', ''), 16)
      : 0x00d2ff;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${storeName} • Official Automated Marketplace`,
        iconURL: shopPage.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setTitle(shopPage.title || '⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡')
      .setDescription(
        shopPage.description ||
          '> ⚡ **Instant Key Delivery** • 🛡️ **Anti-Ban Protected** • 💳 **Multi-Currency / Instant Checkout**\n\n' +
          '### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘:\n' +
          '**1️⃣ Select Your Cheat:** Choose your desired panel from the dropdown menu below.\n' +
          '**2️⃣ Review Features & Status:** Inspect live pricing & anti-cheat status in the private card.\n' +
          '**3️⃣ 0-Second Delivery:** Complete payment via eSewa, UPI, Binance Pay, or Wallet for instant key delivery!'
      )
      .setFooter({
        text: shopPage.footer || `${storeName} • Select a product below to start • 24/7 Automated Delivery`
      })
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

    return { embeds: [embed], components: [menuRow, actionRow] };
  }

  /**
   * Handle Back to Shop navigation
   */
  async handleBackToShop(interaction) {
    const data = this.buildShopCatalogMessage();
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await interaction.update(data);
    } else {
      await interaction.reply({ ...data, ephemeral: true });
    }
  }

  /**
   * Fallback for any legacy dismiss
   */
  async handleDismiss(interaction) {
    await this.handleBackToShop(interaction);
  }
  /**
   * Quick live cheat status breakdown
   */
  async handleShopLiveStatus(interaction) {
    const products = db.getAllProducts();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    let safeList = [];
    let maintList = [];
    let patchedList = [];

    products.forEach(p => {
      let icon = p.category === 'Android' ? '📱' : (p.category === 'Bypass' ? '🛡️' : '💻');
      let line = `${icon} **${p.name}** \`(${p.version || 'v1.0'})\``;
      if (p.plans && Object.keys(p.plans).length > 0) {
        const prices = Object.values(p.plans).map(pl => `${pl.label}: ${db.formatPlanPriceCompact(pl)}`).join(' • ');
        line += `\n   ┗ 💰 *${prices}*`;
      }
      if (p.status === 'safe') safeList.push(line);
      else if (p.status === 'maintenance') maintList.push(line);
      else patchedList.push(line);
    });

    const embed = new EmbedBuilder()
      .setColor(0x00d2ff)
      .setAuthor({
        name: `${storeName} • Real-Time Cheat Status`,
        iconURL: settings.shopPage?.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setTitle('📊 Live Panel & Cheat Status Matrix')
      .setDescription(
        'Real-time operational status of all bypasses, loaders, and panels in our store.\n' +
        'Always verify safety status before deploying on your primary account!\n' +
        '────────────────────────────────────────'
      )
      .setTimestamp()
      .setFooter({ text: `${storeName} • Live Anti-Cheat Monitor` });

    const addChunkedFields = (titlePrefix, list, emoji) => {
      if (!list || list.length === 0) return;
      let currentChunk = [];
      let currentLength = 0;
      let chunkIndex = 1;

      for (const item of list) {
        if (currentLength + item.length + 1 > 950) {
          const title = chunkIndex === 1 && list.length <= currentChunk.length 
            ? `${emoji} ${titlePrefix} (${list.length})` 
            : `${emoji} ${titlePrefix} (Part ${chunkIndex})`;
          embed.addFields({ name: title, value: currentChunk.join('\n') });
          currentChunk = [];
          currentLength = 0;
          chunkIndex++;
        }
        currentChunk.push(item);
        currentLength += item.length + 1;
      }

      if (currentChunk.length > 0) {
        const title = chunkIndex === 1 
          ? `${emoji} ${titlePrefix} (${list.length})` 
          : `${emoji} ${titlePrefix} (Part ${chunkIndex})`;
        embed.addFields({ name: title, value: currentChunk.join('\n') });
      }
    };

    addChunkedFields('SAFE & UNDETECTED', safeList, '🟢');
    addChunkedFields('UNDER MAINTENANCE', maintList, '🟡');
    addChunkedFields('DETECTED / PATCHED', patchedList, '🔴');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_shop')
        .setLabel('🔙 Back')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  /**
   * Help & buying guide
   */
  async handleShopHelp(interaction) {
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `${storeName} • Buyer Assistance & Guide`,
        iconURL: settings.shopPage?.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setTitle('❓ How to Buy & Frequently Asked Questions')
      .setDescription(
        'Welcome to **White X Store**! Here is everything you need to know about purchasing and using our services:\n\n' +
        '**1️⃣ How do I purchase a cheat?**\n' +
        '• Click the Dropdown Menu on the main catalog and choose your game/panel.\n' +
        '• Select your duration plan (1 Day / 7 Days / 30 Days).\n' +
        '• Pay using UPI QR, Cards, Crypto, or Wallet.\n\n' +
        '**2️⃣ How long does delivery take?**\n' +
        '• **Instant!** As soon as your payment is verified or paid with Wallet Balance, the bot sends your license key and download link straight to your Discord DM.\n\n' +
        '**3️⃣ How does the Wallet work?**\n' +
        '• Click **`➕ Add Balance / Top-up`** on the main store page.\n' +
        '• Enter the amount and scan UPI to pay.\n' +
        '• Once credited, you can buy any cheat in **1 second** with zero wait time!\n\n' +
        '**4️⃣ Need Support or Have Questions?**\n' +
        '• If you encounter any issue, contact staff or open a support ticket in our server.'
      )
      .setFooter({ text: `${storeName} • 24/7 Automated Delivery` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_shop')
        .setLabel('🔙 Back')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

module.exports = new PurchaseFlow();
