const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure channels, store name, payment details, and roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Store Name
    .addSubcommand(sub =>
      sub
        .setName('store_name')
        .setDescription('Change the store name (e.g. White X Store)')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Store name to display in embeds and footers').setRequired(true)
        )
    )
    // First Page Banner & Media Setup
    .addSubcommand(sub =>
      sub
        .setName('banner')
        .setDescription('Set the banner photo, image, or animated video GIF on the first shop page')
        .addStringOption(opt =>
          opt
            .setName('url')
            .setDescription('Direct link to photo, image, or video GIF (e.g. https://imgur.com/...)')
            .setRequired(true)
        )
    )
    // First Page Text & Content Setup
    .addSubcommand(sub =>
      sub
        .setName('page_shop')
        .setDescription('Customize the first page title, description, thumbnail, and color')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Embed title for first page').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('description').setDescription('Main guide / instruction text').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('thumbnail_url').setDescription('Thumbnail icon URL').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('color').setDescription('Hex color code (e.g. #00d2ff or #ff0055)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('footer').setDescription('Footer text').setRequired(false)
        )
    )
    // UPI Setup
    .addSubcommand(sub =>
      sub
        .setName('upi')
        .setDescription('Configure UPI ID & Payee Name for dynamic QR codes')
        .addStringOption(opt =>
          opt.setName('upi_id').setDescription('Your UPI ID (e.g. milindy783@okaxis)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('payee_name').setDescription('Payee name to encode in QR code').setRequired(false)
        )
    )
    // Card Setup
    .addSubcommand(sub =>
      sub
        .setName('card')
        .setDescription('Configure Credit/Debit Card checkout payment link')
        .addStringOption(opt =>
          opt
            .setName('payment_link')
            .setDescription('Card payment link (Stripe / Razorpay / custom)')
            .setRequired(true)
        )
    )
    // Channels
    .addSubcommand(sub =>
      sub
        .setName('channels')
        .setDescription('Configure staff verification channel and sales log channel')
        .addChannelOption(opt =>
          opt
            .setName('verification_channel')
            .setDescription('Channel where staff review & approve manual payments')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('Channel where public successful sales logs are posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('ticket_category')
            .setDescription('Category where private order tickets will be created')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
    )
    // Mode Setup
    .addSubcommand(sub =>
      sub
        .setName('mode')
        .setDescription('Configure payment screen mode: ticket (private room for client & admin) or direct')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Payment Screen Mode')
            .setRequired(true)
            .addChoices(
              { name: 'Private Ticket Room (Client & Admin Only)', value: 'ticket' },
              { name: 'Direct In-Shop Ephemeral Card', value: 'direct' }
            )
        )
    )
    // Roles
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Configure Staff/Admin management role or Customer role')
        .addRoleOption(opt =>
          opt.setName('admin_role').setDescription('Staff role with full bot command management access').setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName('customer_role').setDescription('Role granted to buyers after payment approval').setRequired(false)
        )
    )
    // Admin Password Reset
    .addSubcommand(sub =>
      sub
        .setName('admin_password')
        .setDescription('Change or reset the web dashboard admin username and password (Owner only)')
        .addStringOption(opt =>
          opt.setName('password').setDescription('New master password (minimum 4 characters)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('username').setDescription('New admin username (default: admin)').setRequired(false)
        )
    )
    // View
    .addSubcommand(sub => sub.setName('view').setDescription('View all current bot settings and configuration')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const settings = db.getSettings();

    if (subcommand === 'store_name') {
      const name = interaction.options.getString('name');
      db.updateSettings({ storeName: name });

      if (settings.paymentMethods?.upi) {
        db.updatePaymentMethod('upi', { payeeName: name });
      }

      await interaction.reply({
        content: `✅ Store name updated to **${name}**!`,
        ephemeral: true
      });
    } else if (subcommand === 'banner') {
      const url = interaction.options.getString('url');
      const shopPage = settings.shopPage || {};
      shopPage.bannerUrl = url;

      db.updateSettings({ shopPage });

      await interaction.reply({
        content: `✅ First page banner photo/video GIF updated to:\n${url}`,
        ephemeral: true
      });
    } else if (subcommand === 'page_shop') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const thumbnailUrl = interaction.options.getString('thumbnail_url');
      const color = interaction.options.getString('color');
      const footer = interaction.options.getString('footer');

      const shopPage = {
        ...(settings.shopPage || {}),
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(color ? { color } : {}),
        ...(footer ? { footer } : {})
      };

      db.updateSettings({ shopPage });

      await interaction.reply({
        content: `✅ First page display settings updated! Run \`/shop send\` to view changes.`,
        ephemeral: true
      });
    } else if (subcommand === 'upi') {
      const upiId = interaction.options.getString('upi_id');
      const payeeName = interaction.options.getString('payee_name') || settings.storeName || 'White X Store';

      db.updatePaymentMethod('upi', {
        enabled: true,
        upiId,
        payeeName
      });

      await interaction.reply({
        content: `✅ UPI ID updated to \`${upiId}\` with Payee Name: **${payeeName}**! QR codes will now auto-generate with this ID.`,
        ephemeral: true
      });
    } else if (subcommand === 'card') {
      const paymentLink = interaction.options.getString('payment_link');
      db.updatePaymentMethod('credit', {
        enabled: true,
        paymentLink
      });

      await interaction.reply({
        content: `✅ Credit/Debit Card payment link updated to:\n${paymentLink}`,
        ephemeral: true
      });
    } else if (subcommand === 'channels') {
      const vChan = interaction.options.getChannel('verification_channel');
      const lChan = interaction.options.getChannel('log_channel');
      const tCat = interaction.options.getChannel('ticket_category');

      const updates = {};
      if (vChan) updates.verificationChannelId = vChan.id;
      if (lChan) updates.logChannelId = lChan.id;
      if (tCat) updates.ticketCategoryId = tCat.id;

      db.updateSettings(updates);

      await interaction.reply({
        content: `✅ Channels updated!\n` +
          `- Verification Channel: ${vChan ? `<#${vChan.id}>` : (settings.verificationChannelId ? `<#${settings.verificationChannelId}>` : 'Not set')}\n` +
          `- Public Log Channel: ${lChan ? `<#${lChan.id}>` : (settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not set')}\n` +
          `- Ticket Category: ${tCat ? `📁 ${tCat.name} (\`${tCat.id}\`)` : (settings.ticketCategoryId ? `<#${settings.ticketCategoryId}>` : 'Server Root')}`,
        ephemeral: true
      });
    } else if (subcommand === 'mode') {
      const modeType = interaction.options.getString('type');
      db.updateSettings({ mode: modeType });

      await interaction.reply({
        content: `✅ Payment screen mode updated to: **${modeType === 'ticket' ? 'Private Ticket Room (Client & Admin Only)' : 'Direct In-Shop Ephemeral Card'}**!`,
        ephemeral: true
      });
    } else if (subcommand === 'role') {
      const adminRole = interaction.options.getRole('admin_role');
      const customerRole = interaction.options.getRole('customer_role');

      if (!adminRole && !customerRole) {
        return interaction.reply({
          content: '⚠️ Please specify either `admin_role` or `customer_role` (or both) to configure!',
          ephemeral: true
        });
      }

      const updates = {};
      const messages = [];

      if (adminRole) {
        updates.adminRoleId = adminRole.id;
        messages.push(`🛡️ **Staff / Admin Role** set to <@&${adminRole.id}> (Authorized for bot management commands)`);
      }
      if (customerRole) {
        updates.customerRoleId = customerRole.id;
        messages.push(`🎖️ **Customer Role** set to <@&${customerRole.id}> (Auto-granted to buyers)`);
      }

      db.updateSettings(updates);

      await interaction.reply({
        content: `✅ **Roles Updated Successfully!**\n${messages.join('\n')}`,
        ephemeral: true
      });
    } else if (subcommand === 'admin_password') {
      const security = require('../dashboard/auth/security');
      const newPassword = interaction.options.getString('password');
      const newUsername = interaction.options.getString('username') || 'admin';

      try {
        security.updateAdminCredentials(newUsername, newPassword);
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🔐 Website Admin Password Changed')
          .setDescription(
            `The master credentials for the Web Control Center have been updated successfully!\n\n` +
            `• **Admin Username:** \`${newUsername}\`\n` +
            `• **New Password:** \`••••••••\` *(Updated securely)*\n` +
            `• **Web Dashboard:** [https://white-x-store.onrender.com](https://white-x-store.onrender.com)\n\n` +
            `⚠️ *All existing browser sessions have been invalidated. Please log into the dashboard with your new password.*`
          )
          .setFooter({ text: 'Auto Sell Bot • Security Guardian' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      }
    } else if (subcommand === 'view') {
      const methods = settings.paymentMethods || {};
      const shopPage = settings.shopPage || {};

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Current Store Configuration (All Editable)')
        .setColor(0x00d2ff)
        .addFields(
          { name: '🏪 Store Name', value: `**${settings.storeName || 'White X Store'}**`, inline: true },
          { name: '📱 UPI ID', value: `\`${methods.upi?.upiId || 'Not set'}\``, inline: true },
          { name: '🖼️ First Page Banner', value: `${shopPage.bannerUrl || 'Default'}`, inline: false },
          { name: '💳 Card Gateway Link', value: `${methods.credit?.paymentLink || 'Not set'}`, inline: false },
          {
            name: '🚨 Staff Verification Channel',
            value: settings.verificationChannelId ? `<#${settings.verificationChannelId}>` : '❌ Not configured',
            inline: true
          },
          {
            name: '📢 Public Sales Log Channel',
            value: settings.logChannelId ? `<#${settings.logChannelId}>` : '❌ Not configured',
            inline: true
          },
          {
            name: '🛡️ Staff / Admin Role',
            value: settings.adminRoleId ? `<@&${settings.adminRoleId}>` : '❌ None (Server Owner only)',
            inline: true
          },
          {
            name: '🎖️ Customer Role',
            value: settings.customerRoleId ? `<@&${settings.customerRoleId}>` : '❌ None',
            inline: true
          },
          {
            name: '🔒 Payment Screen Mode',
            value: settings.mode === 'ticket' ? '`Private Ticket (Client & Admin Only)`' : '`Direct In-Shop`',
            inline: true
          },
          {
            name: '📁 Ticket Category',
            value: settings.ticketCategoryId ? `<#${settings.ticketCategoryId}>` : '`Server Root (No Category)`',
            inline: true
          }
        )
        .setFooter({ text: 'All settings can be edited via /setup or in database/data/settings.json' });

      if (shopPage.bannerUrl) {
        embed.setImage(shopPage.bannerUrl);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
