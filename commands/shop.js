const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Manage and display the store interface')
    .addSubcommand(sub =>
      sub
        .setName('send')
        .setDescription('Send the official Auto Sell store message to a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the store embed in')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('preview').setDescription('Preview the store interface ephemerally')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const products = db.getAllProducts();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';
    const shopPage = settings.shopPage || {};

    if (products.length === 0) {
      return interaction.reply({
        content: '⚠️ You have no products configured yet! Use `/product add` first to create your items.',
        ephemeral: true
      });
    }

    const color = shopPage.color
      ? parseInt(shopPage.color.replace('#', ''), 16)
      : 0x00d2ff;

    const defaultDesc = 
      `╭──────────────────────────────────────────╮\n` +
      `  👑  **${storeName.toUpperCase()} — OFFICIAL MARKETPLACE**\n` +
      `  *Your #1 Trusted Destination for Undetected Panels*\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `> ⚡ **0s Instant Key Delivery** • 🛡️ **Kernel Anti-Ban** • 💳 **Multi-Currency**\n\n` +
      `### 🛒 𝗛𝗢𝗪 𝗧𝗢 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘 / 𝗞𝗔𝗜𝗦𝗘 𝗞𝗛𝗔𝗥𝗜𝗗𝗘𝗜𝗡:\n` +
      `**1️⃣ Select Your Cheat:** Niche diye gaye menu se product choose karein.\n` +
      `**2️⃣ Review Features & Status:** Private Live Card mein live status aur duration prices dekhein.\n` +
      `**3️⃣ 0-Second Delivery:** UPI QR, Card, Crypto ya Wallet se pay karke key DM mein turant payein!\n\n` +
      `──────────────────────────────────────────\n` +
      `### 🚦 𝗟𝗜𝗩𝗘 𝗦𝗧𝗔𝗧𝗨𝗦 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥𝗦:\n` +
      `• 🟢 **Safe / Undetected** : Fully Working *(Safe for Main Account)*\n` +
      `• 🟡 **Maintenance** : Under update *(Wait for announcement)*\n` +
      `• 🔴 **Patched / Offline** : Detected *(Do NOT buy or use right now)*\n\n` +
      `──────────────────────────────────────────\n` +
      `### 💳 𝗪𝗔𝗟𝗟𝗘𝗧 & 𝟭-𝗦𝗘𝗖𝗢𝗡𝗗 𝗖𝗛𝗘𝗖𝗞𝗢𝗨𝗧:\n` +
      `• Click **\`💳 My Wallet\`** below to check your current funds anytime.\n` +
      `• Click **\`➕ Add Balance / Top-up\`** to deposit funds and checkout with 1-click!`;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${storeName} • Official Automated Marketplace`,
        iconURL: shopPage.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setTitle(shopPage.title || `⚡ 𝐖𝐇𝐈𝐓𝐄 𝐗 𝐒𝐓𝐎𝐑𝐄 — 𝐎𝐅𝐅𝐈𝐂𝐈𝐀𝐋 𝐂𝐀𝐓𝐀𝐋𝐎𝐆 ⚡`)
      .setDescription(shopPage.description && shopPage.description.trim() ? shopPage.description : defaultDesc)
      .setFooter({
        text: shopPage.footer || `${storeName} • Select a product below to start • 24/7 Automated Delivery`
      })
      .setTimestamp();

    if (shopPage.thumbnailUrl) {
      embed.setThumbnail(shopPage.thumbnailUrl);
    }

    // Set first page banner photo or video GIF
    if (shopPage.bannerUrl) {
      embed.setImage(shopPage.bannerUrl);
    }

    // Build select menu options formatted exactly like the screenshot
    const selectOptions = products.map(p => {
      let icon = '💻';
      if (p.category === 'Android') icon = '📱';
      if (p.category === 'Bypass') icon = '🛡️';

      // Status indicator
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
      .addOptions(selectOptions.slice(0, 25)); // Discord allows max 25 options per menu

    const menuRow = new ActionRowBuilder().addComponents(selectMenu);

    // Down buttons on first page for wallet & balance add & quick status & help
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wallet_view')
        .setLabel('💳 My Wallet')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wallet_topup')
        .setLabel('➕ Add Balance / Top-up')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('shop_live_status')
        .setLabel('📊 Live Status')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('shop_help')
        .setLabel('❓ Help & Guide')
        .setStyle(ButtonStyle.Secondary)
    );

    const components = [menuRow, actionRow];

    // Check for promotional video in assets or dashboard/public
    const localVideo = path.join(__dirname, '..', 'assets', 'store_video.mp4');
    const pubVideo = path.join(__dirname, '..', 'dashboard', 'public', 'store_video.mp4');
    const videoFile = fs.existsSync(localVideo) ? localVideo : (fs.existsSync(pubVideo) ? pubVideo : null);
    const files = videoFile ? [new AttachmentBuilder(videoFile, { name: 'store_preview.mp4' })] : [];

    if (subcommand === 'send') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ embeds: [embed], components, files });
      await interaction.editReply({
        content: `✅ Store catalog successfully sent to ${channel}!`
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        files,
        ephemeral: true
      });
    }
  }
};
