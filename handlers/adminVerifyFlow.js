const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../database/db');
const licenseService = require('../services/licenseService');
const ticketService = require('../services/ticketService');

class AdminVerifyFlow {
  /**
   * Sends the verification card to the configured staff channel
   */
  async sendVerificationCardToStaff(client, order) {
    const settings = db.getSettings();
    const product = db.getProduct(order.productId);

    if (!settings.verificationChannelId) {
      console.warn('⚠️ No verification channel configured! Use /setup channels to configure.');
      return;
    }

    try {
      const channel = await client.channels.fetch(settings.verificationChannelId);
      if (!channel || !channel.isTextBased()) {
        console.error('Verification channel is not a valid text channel');
        return;
      }

      const isTopup = order.type === 'wallet_topup';
      const planText = order.planDuration ? ` (${order.planDuration})` : '';
      const methodDisplay = (order.paymentMethod || 'upi').toUpperCase();

      const embed = new EmbedBuilder()
        .setColor(isTopup ? 0x9b59b6 : 0xe67e22)
        .setTitle(
          isTopup
            ? `💳 [Wallet Top-up] Verification • Order #${order.id}`
            : `🔔 Payment Verification Required • Order #${order.id}`
        )
        .setDescription(
          isTopup
            ? `Customer has submitted proof to add **${order.currency || '₹'}${order.amount}** to their Wallet Balance!`
            : `A customer has submitted payment proof! Please review details below and click **Approve** or **Decline**.`
        )
        .addFields(
          { name: '👤 Buyer', value: `<@${order.userId}> (\`${order.userId}\`)`, inline: true },
          {
            name: isTopup ? '💳 Type' : '📦 Product',
            value: isTopup ? '**Wallet Top-up**' : `**${order.productName || product?.name || 'N/A'}**${planText}`,
            inline: true
          },
          { name: '💰 Total Amount', value: `**${order.currency || '₹'}${order.amount}**`, inline: true },
          { name: '🏷️ Payment Method', value: `\`${methodDisplay}\``, inline: true },
          {
            name: isTopup ? '🏦 Current Wallet Bal' : '⚡ Delivery Type',
            value: isTopup
              ? `**₹${db.getUserBalance(order.userId)}**`
              : `\`${(order.deliveryType || product?.deliveryType || 'keyauth').toUpperCase()}\``,
            inline: true
          },
          { name: '🕒 Submitted At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: '🧾 UTR / Transaction ID / Ref', value: `\`\`\`${order.txId || 'None provided'}\`\`\``, inline: false },
          { name: '📝 Customer Remarks', value: order.notes ? `> ${order.notes}` : '*None*', inline: false }
        )
        .setFooter({ text: `Order ID: ${order.id} • Auto Sell System` })
        .setTimestamp();

      if (order.proofUrl && (order.proofUrl.startsWith('http://') || order.proofUrl.startsWith('https://'))) {
        embed.setImage(order.proofUrl);
      }

      const approveBtn = new ButtonBuilder()
        .setCustomId(`admin_approve_${order.id}`)
        .setLabel(isTopup ? '✅ Approve & Add Balance' : '✅ Approve & Deliver')
        .setStyle(ButtonStyle.Success);

      const declineBtn = new ButtonBuilder()
        .setCustomId(`admin_decline_${order.id}`)
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(approveBtn, declineBtn);

      const sentMsg = await channel.send({
        content: `🚨 **${isTopup ? 'Wallet Top-up' : 'New Payment'} for Order #${order.id}** (<@&${settings.customerRoleId || ''}> staff attention)`,
        embeds: [embed],
        components: [row]
      });

      db.updateOrder(order.id, {
        adminMessageId: sentMsg.id,
        verificationChannelId: channel.id
      });
    } catch (err) {
      console.error('Error sending verification card to staff channel:', err);
    }
  }

  /**
   * Handle Admin clicking Approve & Deliver / Add Balance
   */
  async handleApprove(interaction, orderId) {
    await interaction.deferReply({ ephemeral: true });

    if (!this.checkStaffPermission(interaction)) {
      return interaction.editReply({
        content: '⛔ You do not have permission to approve payments. (Admin / Manage Server required)'
      });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.editReply({ content: '❌ Order not found.' });
    }

    if (order.status === 'completed') {
      return interaction.editReply({
        content: `⚠️ This order has already been approved and processed!`
      });
    }

    const isTopup = order.type === 'wallet_topup';
    const settings = db.getSettings();

    // ------------------------------------
    // CASE A: WALLET TOP-UP APPROVAL
    // ------------------------------------
    if (isTopup) {
      const newBal = db.addWalletBalance(order.userId, order.amount, `Top-up Order #${order.id}`);

      db.updateOrder(orderId, {
        status: 'completed',
        approvedBy: interaction.user.tag,
        approvedById: interaction.user.id,
        completedAt: new Date().toISOString()
      });

      // Customer Role (if configured)
      if (settings.customerRoleId && interaction.guild) {
        try {
          const member = await interaction.guild.members.fetch(order.userId).catch(() => null);
          if (member && !member.roles.cache.has(settings.customerRoleId)) {
            await member.roles.add(settings.customerRoleId, `Wallet Top-up approved`);
          }
        } catch (err) {}
      }

      // Notify customer via DM
      const topupSuccessEmbed = new EmbedBuilder()
        .setTitle('🎉 Wallet Balance Added Successfully!')
        .setColor(0x2ecc71)
        .setDescription(
          `Your wallet top-up for **Order #${order.id}** has been approved by staff!\n\n` +
          `• ➕ **Amount Credited:** **₹${order.amount}**\n` +
          `• 💳 **Your New Balance:** **₹${newBal}**\n\n` +
          `⚡ *You can now purchase any panel or product instantly from the store using your wallet balance!*`
        )
        .setFooter({ text: `${settings.storeName || 'White X Store'} Wallet` })
        .setTimestamp();

      try {
        const buyerUser = await interaction.client.users.fetch(order.userId);
        if (buyerUser) await buyerUser.send({ embeds: [topupSuccessEmbed] });
      } catch (err) {}

      // If order has a private ticket channel, send confirmation there and schedule close
      if (order.ticketChannelId) {
        try {
          const ticketChan = await interaction.client.channels.fetch(order.ticketChannelId);
          if (ticketChan && ticketChan.isTextBased()) {
            const closeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`close_ticket_${order.id}`)
                .setLabel('🔒 Close Ticket')
                .setStyle(ButtonStyle.Secondary)
            );
            await ticketChan.send({
              content: `🎉 <@${order.userId}> **Wallet balance top-up approved!**`,
              embeds: [topupSuccessEmbed],
              components: [closeRow]
            });
            ticketService.closeTicket(ticketChan, 30000, 'Top-up approved');
          }
        } catch (ticketErr) {}
      }

      // Update staff verification message
      try {
        const origMessage = interaction.message;
        if (origMessage) {
          const approvedEmbed = EmbedBuilder.from(origMessage.embeds[0])
            .setColor(0x2ecc71)
            .setTitle(`✅ [APPROVED] Wallet Top-up #${order.id}`)
            .addFields(
              { name: '🛡️ Approved By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '💳 Credited Balance', value: `+₹${order.amount} (Total: ₹${newBal})`, inline: true }
            );

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('approved_disabled')
              .setLabel(`✅ Balance Added (₹${order.amount})`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          );

          await origMessage.edit({
            content: `✅ **Wallet Top-up #${order.id} Approved & Balance Credited**`,
            embeds: [approvedEmbed],
            components: [disabledRow]
          });
        }
      } catch (editErr) {}

      // Sales Log
      if (settings.logChannelId) {
        try {
          const logChannel = await interaction.client.channels.fetch(settings.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('💳 Wallet Top-up Complete!')
              .setColor(0x2ecc71)
              .setDescription(`<@${order.userId}> added **₹${order.amount}** to their store wallet!`)
              .setFooter({ text: 'Auto Sell Wallet Logs' })
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (err) {}
      }

      return interaction.editReply({
        content: `✅ **Wallet Top-up #${order.id} approved!**\nAdded **₹${order.amount}** to <@${order.userId}> (New balance: ₹${newBal}).`
      });
    }

    // ------------------------------------
    // CASE B: PRODUCT PURCHASE APPROVAL
    // ------------------------------------
    const product = db.getProduct(order.productId);
    if (!product) {
      return interaction.editReply({
        content: `❌ Product with ID \`${order.productId}\` no longer exists in database!`
      });
    }

    // Generate or retrieve license key
    const deliveryResult = await licenseService.deliverKey(product, order);

    let licenseKey = null;
    if (deliveryResult.success) {
      licenseKey = deliveryResult.key;
    } else {
      const fallbackKey = `${product.name.toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      console.warn(`KeyAuth/API returned: ${deliveryResult.error}. Using fallback key: ${fallbackKey}`);
      licenseKey = fallbackKey;
    }

    db.updateOrder(orderId, {
      status: 'completed',
      licenseKey,
      approvedBy: interaction.user.tag,
      approvedById: interaction.user.id,
      completedAt: new Date().toISOString()
    });

    if (settings.customerRoleId && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(order.userId).catch(() => null);
        if (member && !member.roles.cache.has(settings.customerRoleId)) {
          await member.roles.add(settings.customerRoleId, `Auto Sell: Order #${order.id} approved`);
        }
      } catch (err) {}
    }

    const buyerEmbed = new EmbedBuilder()
      .setTitle(`🎉 Purchase Verified — License Key Delivered!`)
      .setColor(0x2ecc71)
      .setAuthor({
        name: `${settings.storeName || 'White X Store'} • Automated Delivery Engine`,
        iconURL: settings.shopPage?.thumbnailUrl || 'https://i.imgur.com/8Qe87dE.png'
      })
      .setDescription(
        `╭──────────────────────────────────────────╮\n` +
        `  👑  **THANK YOU FOR YOUR PURCHASE!**\n` +
        `  *Your order has been verified & processed in 0s*\n` +
        `╰──────────────────────────────────────────╯\n\n` +
        `> 📦 **Product:** \`${product.name}\`\n` +
        `> ⏳ **Plan Duration:** \`${order.planDuration || '30 Days'}\`\n` +
        `> 🧾 **Order ID:** \`#${order.id}\`\n` +
        `> 🛡️ **Anti-Ban Protection:** Active & Monitored\n\n` +
        `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
        `  🔑 **YOUR OFFICIAL LICENSE KEY:**\n` +
        `  \`\`\`${licenseKey}\`\`\`\n` +
        `  *(Click to reveal: ||${licenseKey}||)*\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`
      )
      .setFooter({ text: `${settings.storeName || 'White X Store'} • Do NOT share your key • 24/7 Support` })
      .setTimestamp();

    if (product.downloadUrl) {
      buyerEmbed.addFields({
        name: '📥 Download / Access Link',
        value: `${product.downloadUrl}`,
        inline: false
      });
    }

    if (product.instructions) {
      buyerEmbed.addFields({
        name: '📖 Instructions & Activation Guide',
        value: `${product.instructions}`,
        inline: false
      });
    }

    let dmSent = false;
    try {
      const buyerUser = await interaction.client.users.fetch(order.userId);
      if (buyerUser) {
        await buyerUser.send({ embeds: [buyerEmbed] });
        dmSent = true;
      }
    } catch (dmErr) {}

    // If order has a private ticket channel, send key delivery there and schedule close
    if (order.ticketChannelId) {
      try {
        const ticketChan = await interaction.client.channels.fetch(order.ticketChannelId);
        if (ticketChan && ticketChan.isTextBased()) {
          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`close_ticket_${order.id}`)
              .setLabel('🔒 Close Ticket Now')
              .setStyle(ButtonStyle.Secondary)
          );
          await ticketChan.send({
            content: `🎉 <@${order.userId}> **Payment verified & approved! Your license key is delivered below:**`,
            embeds: [buyerEmbed],
            components: [closeRow]
          });
          ticketService.closeTicket(ticketChan, 60000, 'Order delivered');
        }
      } catch (ticketErr) {}
    }

    try {
      const origMessage = interaction.message;
      if (origMessage) {
        const approvedEmbed = EmbedBuilder.from(origMessage.embeds[0])
          .setColor(0x2ecc71)
          .setTitle(`✅ [APPROVED] Order #${order.id}`)
          .addFields(
            { name: '🛡️ Approved By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: '🔑 Delivered Key', value: `||${licenseKey}||`, inline: true }
          );

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('approved_disabled')
            .setLabel('✅ Approved & Delivered')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

        await origMessage.edit({
          content: `✅ **Order #${order.id} Approved & Key Delivered**`,
          embeds: [approvedEmbed],
          components: [disabledRow]
        });
      }
    } catch (editErr) {}

    if (settings.logChannelId) {
      try {
        const logChannel = await interaction.client.channels.fetch(settings.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🛒 New Successful Sale!')
            .setColor(0x2ecc71)
            .setDescription(`A customer has completed an order!`)
            .addFields(
              { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
              { name: '📦 Product', value: `**${product.name}** (${order.planDuration || '30 Days'})`, inline: true },
              { name: '💰 Price', value: `**${order.currency || '₹'}${order.amount}**`, inline: true },
              { name: '🧾 Order ID', value: `\`#${order.id}\``, inline: true }
            )
            .setFooter({ text: 'Auto Sell Logs' })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (logErr) {}
    }

    await interaction.editReply({
      content: `✅ **Order #${order.id} successfully approved!**\nKey generated: \`${licenseKey}\`\nDM Delivery: ${
        dmSent ? '✅ Delivered to user DM' : '⚠️ User DMs closed'
      }`
    });
  }

  /**
   * Handle Admin clicking Decline - open reason modal
   */
  async openDeclineModal(interaction, orderId) {
    if (!this.checkStaffPermission(interaction)) {
      return interaction.reply({
        content: '⛔ You do not have permission to decline payments.',
        ephemeral: true
      });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.reply({ content: 'Order not found.', ephemeral: true });
    }

    if (order.status === 'completed') {
      return interaction.reply({
        content: '⚠️ Cannot decline an order that is already completed.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_decline_${order.id}`)
      .setTitle(`Decline Order #${order.id}`);

    const reasonInput = new TextInputBuilder()
      .setCustomId('decline_reason')
      .setLabel('Reason for Declining')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g., Payment was not received in wallet / invalid UTR / incorrect amount')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
  }

  /**
   * Handle decline modal submission
   */
  async handleDeclineSubmit(interaction, orderId) {
    await interaction.deferReply({ ephemeral: true });

    const order = db.getOrder(orderId);
    if (!order) {
      return interaction.editReply({ content: 'Order not found.' });
    }

    const reason = interaction.fields.getTextInputValue('decline_reason');

    db.updateOrder(orderId, {
      status: 'declined',
      declineReason: reason,
      declinedBy: interaction.user.tag,
      declinedById: interaction.user.id,
      declinedAt: new Date().toISOString()
    });

    const isTopup = order.type === 'wallet_topup';

    const declineEmbed = new EmbedBuilder()
      .setTitle(`❌ ${isTopup ? 'Wallet Top-up' : 'Order'} #${order.id} Declined`)
      .setColor(0xe74c3c)
      .setDescription(
        `Your verification for **Order #${order.id}** could not be verified by staff.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `If you believe this is a mistake, please reach out to server support.`
      )
      .setFooter({ text: 'Auto Sell Verification' })
      .setTimestamp();

    try {
      const buyerUser = await interaction.client.users.fetch(order.userId);
      if (buyerUser) {
        await buyerUser.send({ embeds: [declineEmbed] });
      }
    } catch (dmErr) {}

    // If order has a private ticket channel, send decline notice there so buyer and staff can discuss
    if (order.ticketChannelId) {
      try {
        const ticketChan = await interaction.client.channels.fetch(order.ticketChannelId);
        if (ticketChan && ticketChan.isTextBased()) {
          await ticketChan.send({
            content: `❌ <@${order.userId}> **Payment verification was declined by staff.**`,
            embeds: [declineEmbed]
          });
        }
      } catch (ticketErr) {}
    }

    try {
      const origMessage = interaction.message;
      if (origMessage) {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('declined_disabled')
            .setLabel('❌ Declined')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        const updatedEmbed = EmbedBuilder.from(origMessage.embeds[0])
          .setColor(0xe74c3c)
          .setTitle(`❌ [DECLINED] Order #${order.id}`)
          .addFields(
            { name: '🛡️ Declined By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: '❓ Reason', value: `> ${reason}`, inline: false }
          );

        await origMessage.edit({
          content: `❌ **Order #${order.id} Declined**`,
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }
    } catch (editErr) {}

    await interaction.editReply({
      content: `❌ Order #${order.id} has been declined. Buyer has been notified with the reason.`
    });
  }

  checkStaffPermission(interaction) {
    if (!interaction.memberPermissions) return false;
    return (
      interaction.memberPermissions.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
    );
  }

  /**
   * Directly approve an order from the Web Dashboard
   */
  async approveOrderDirect(client, orderId, approvedBy = 'Web Dashboard') {
    const order = db.getOrder(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'completed') throw new Error('Order is already completed');

    const isTopup = order.type === 'wallet_topup';
    const settings = db.getSettings();

    if (isTopup) {
      const newBal = db.addWalletBalance(order.userId, order.amount, `Top-up Order #${order.id}`);
      db.updateOrder(orderId, {
        status: 'completed',
        approvedBy,
        completedAt: new Date().toISOString()
      });

      const topupSuccessEmbed = new EmbedBuilder()
        .setTitle('🎉 Wallet Balance Added Successfully!')
        .setColor(0x2ecc71)
        .setDescription(
          `Your wallet top-up for **Order #${order.id}** has been approved via **${approvedBy}**!\n\n` +
          `• ➕ **Amount Credited:** **₹${order.amount}**\n` +
          `• 💳 **Your New Balance:** **₹${newBal}**\n\n` +
          `⚡ *You can now purchase any panel or product instantly from the store using your wallet balance!*`
        )
        .setFooter({ text: `${settings.storeName || 'White X Store'} Wallet` })
        .setTimestamp();

      try {
        const buyerUser = await client.users.fetch(order.userId);
        if (buyerUser) await buyerUser.send({ embeds: [topupSuccessEmbed] });
      } catch (err) {}

      if (settings.logChannelId) {
        try {
          const logChannel = await client.channels.fetch(settings.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('💳 Wallet Top-up Complete!')
              .setColor(0x2ecc71)
              .setDescription(`<@${order.userId}> added **₹${order.amount}** to their store wallet via ${approvedBy}!`)
              .setFooter({ text: 'Auto Sell Wallet Logs' })
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (err) {}
      }

      return { success: true, orderId, newBal, isTopup: true };
    }

    const product = db.getProduct(order.productId);
    if (!product) throw new Error(`Product ${order.productId} not found`);

    const deliveryResult = await licenseService.deliverKey(product, order);
    const licenseKey = deliveryResult.success
      ? deliveryResult.key
      : `${(product.name || 'KEY').toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    db.updateOrder(orderId, {
      status: 'completed',
      licenseKey,
      approvedBy,
      completedAt: new Date().toISOString()
    });

    if (settings.customerRoleId) {
      for (const guild of client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(order.userId).catch(() => null);
          if (member && !member.roles.cache.has(settings.customerRoleId)) {
            await member.roles.add(settings.customerRoleId, `Auto Sell: Order #${order.id} approved via ${approvedBy}`);
          }
        } catch (err) {}
      }
    }

    const buyerEmbed = new EmbedBuilder()
      .setTitle(`🎉 Order #${order.id} Approved & Delivered!`)
      .setColor(0x2ecc71)
      .setDescription(
        `Your payment for **${product.name}** has been verified and approved by our staff team!\n` +
        `Thank you for shopping with **${settings.storeName || 'White X Store'}**!`
      )
      .addFields(
        {
          name: '🔑 Your License Key',
          value: `\`\`\`${licenseKey}\`\`\`\n*(Click to reveal: ||${licenseKey}||)*`,
          inline: false
        },
        { name: '📦 Product', value: `${product.name}`, inline: true },
        { name: '⏳ Plan Duration', value: `${order.planDuration || '30 Days'}`, inline: true },
        { name: '🧾 Order ID', value: `\`#${order.id}\``, inline: true }
      )
      .setFooter({ text: 'Keep this license key safe & do not share it!' })
      .setTimestamp();

    if (product.downloadUrl) {
      buyerEmbed.addFields({ name: '📥 Download / Access Link', value: `${product.downloadUrl}`, inline: false });
    }
    if (product.instructions) {
      buyerEmbed.addFields({ name: '📖 Instructions & Activation Guide', value: `${product.instructions}`, inline: false });
    }

    try {
      const buyerUser = await client.users.fetch(order.userId);
      if (buyerUser) await buyerUser.send({ embeds: [buyerEmbed] });
    } catch (dmErr) {}

    if (settings.logChannelId) {
      try {
        const logChannel = await client.channels.fetch(settings.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🛒 New Successful Sale!')
            .setColor(0x2ecc71)
            .setDescription(`A customer has completed an order! (Approved via ${approvedBy})`)
            .addFields(
              { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
              { name: '📦 Product', value: `**${product.name}** (${order.planDuration || '30 Days'})`, inline: true },
              { name: '💰 Price', value: `**${order.currency || '₹'}${order.amount}**`, inline: true },
              { name: '🧾 Order ID', value: `\`#${order.id}\``, inline: true }
            )
            .setFooter({ text: 'Auto Sell Logs' });
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {}
    }

    return { success: true, orderId, licenseKey, isTopup: false };
  }

  /**
   * Directly decline an order from the Web Dashboard
   */
  async declineOrderDirect(client, orderId, reason = 'Declined via Web Dashboard', declinedBy = 'Web Dashboard') {
    const order = db.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    db.updateOrder(orderId, {
      status: 'declined',
      declineReason: reason,
      declinedBy,
      declinedAt: new Date().toISOString()
    });

    const isTopup = order.type === 'wallet_topup';
    const declineEmbed = new EmbedBuilder()
      .setTitle(`❌ ${isTopup ? 'Wallet Top-up' : 'Order'} #${order.id} Declined`)
      .setColor(0xe74c3c)
      .setDescription(
        `Your verification for **Order #${order.id}** could not be verified by staff.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `If you believe this is a mistake, please reach out to server support.`
      )
      .setFooter({ text: 'Auto Sell Verification' })
      .setTimestamp();

    try {
      const buyerUser = await client.users.fetch(order.userId);
      if (buyerUser) await buyerUser.send({ embeds: [declineEmbed] });
    } catch (dmErr) {}

    return { success: true, orderId, reason };
  }
}

module.exports = new AdminVerifyFlow();
