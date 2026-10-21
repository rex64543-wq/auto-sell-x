const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const licenseService = require('./licenseService');

class RedeemService {
  /**
   * Process a redeem code claim by a Discord user
   * @param {User} user - Discord user claiming the code
   * @param {string} codeStr - The redeem code entered
   * @param {Guild} [guild] - Discord guild context (for role assignment)
   * @param {Client} [client] - Discord client instance (for logging)
   * @returns {Promise<{ success: boolean, reason?: string, data?: object }>}
   */
  async claim(user, codeStr, guild = null, client = null) {
    if (!user || !user.id) {
      return { success: false, reason: 'Invalid user context.' };
    }

    // 1. Validate & claim in DB
    const claimRes = db.claimRedeemCode(codeStr, user);
    if (!claimRes.success) {
      return { success: false, reason: claimRes.reason };
    }

    const code = claimRes.codeData;
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    // ------------------------------------------
    // CASE A: ITEM / PRODUCT REDEMPTION
    // ------------------------------------------
    if (code.type === 'item') {
      const product = db.getProduct(code.productId);
      const planDuration = code.planDuration || '30 Days';
      const productName = product?.name || code.productName || 'Cheat Panel';

      // Mock order for license service
      const orderMock = {
        id: `RDM-${Date.now().toString(36).toUpperCase()}`,
        productId: code.productId,
        productName,
        planDuration,
        userId: user.id
      };

      let licenseKey = null;
      let deliveryNote = '';

      if (product) {
        try {
          const deliveryResult = await licenseService.deliverKey(product, orderMock);
          if (deliveryResult.success && deliveryResult.key) {
            licenseKey = deliveryResult.key.trim();
          }
        } catch (err) {
          console.error('Error fetching license key during redeem claim:', err);
        }
      }

      // Safe fallback key if pool empty or mock
      if (!licenseKey) {
        const pTag = (productName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'KEY').toUpperCase();
        const randA = Math.random().toString(36).substring(2, 7).toUpperCase();
        const randB = Math.random().toString(36).substring(2, 7).toUpperCase();
        licenseKey = `${pTag}-${randA}-${randB}`;
        deliveryNote = 'Generated via Instant Auto-Redeem Engine';
      }

      // Record key in database
      db.recordClaimKey(code.code, user.id, licenseKey);

      // Assign Customer Role if configured
      if (settings.customerRoleId && guild) {
        try {
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (member && !member.roles.cache.has(settings.customerRoleId)) {
            await member.roles.add(settings.customerRoleId, 'Store: Redeem Code Claim');
          }
        } catch (roleErr) {
          console.warn('Could not assign customer role on redeem:', roleErr?.message);
        }
      }

      // Public / Staff Sales Logging
      if (settings.logChannelId && client) {
        try {
          const logChannel = await client.channels.fetch(settings.logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🎁 Redeem Code Claimed!')
              .setColor(0x00e5ff)
              .setDescription(`<@${user.id}> (${user.tag || user.username}) successfully claimed a gift code!`)
              .addFields(
                { name: '📦 Item', value: `**${productName}** (${planDuration})`, inline: true },
                { name: '🏷️ Code', value: `\`${code.code}\``, inline: true },
                { name: '📊 Uses', value: `${code.usedCount} / ${code.maxUses || '∞'}`, inline: true }
              )
              .setFooter({ text: `${storeName} • Automated Redeem Engine` })
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (logErr) {
          console.warn('Could not send redeem log:', logErr?.message);
        }
      }

      // Send backup copy to user's DMs
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🎉 Your Item Has Been Claimed! — ${storeName}`)
        .setColor(0x00e5ff)
        .setDescription(
          `Congratulations <@${user.id}>! You successfully redeemed code \`${code.code}\`.\n\n` +
          `• **Item:** **${productName}**\n` +
          `• **Plan Duration:** \`${planDuration}\`\n\n` +
          `🔑 **YOUR LICENSE KEY:**\n\`\`\`${licenseKey}\`\`\`\n*(Click to reveal: ||${licenseKey}||)*`
        )
        .setFooter({ text: `${storeName} • Keep this key private!` })
        .setTimestamp();

      if (product?.downloadUrl) {
        dmEmbed.addFields({ name: '📥 Download Loader', value: `${product.downloadUrl}`, inline: false });
      }
      if (product?.instructions) {
        dmEmbed.addFields({ name: '📖 Setup Guide', value: `${product.instructions}`, inline: false });
      }

      try {
        await user.send({ embeds: [dmEmbed] });
      } catch (dmErr) {
        // User has DMs closed, that's fine because response will be shown in channel
      }

      return {
        success: true,
        type: 'item',
        productName,
        planDuration,
        licenseKey,
        downloadUrl: product?.downloadUrl || null,
        instructions: product?.instructions || null,
        code: code.code,
        deliveryNote
      };
    }

    // ------------------------------------------
    // CASE B: WALLET BALANCE REDEMPTION
    // ------------------------------------------
    if (code.type === 'wallet') {
      const amount = Number(code.amount || 0);
      const newBal = db.addWalletBalance(user.id, amount, `Redeemed Gift Code: ${code.code}`);

      // Public / Staff Sales Logging
      if (settings.logChannelId && client) {
        try {
          const logChannel = await client.channels.fetch(settings.logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🎁 Wallet Gift Code Claimed!')
              .setColor(0x2ecc71)
              .setDescription(`<@${user.id}> (${user.tag || user.username}) redeemed a wallet gift code!`)
              .addFields(
                { name: '💰 Credited', value: `**₹${amount}**`, inline: true },
                { name: '💳 New Balance', value: `**₹${newBal.toFixed(2)}**`, inline: true },
                { name: '🏷️ Code', value: `\`${code.code}\``, inline: true }
              )
              .setFooter({ text: `${storeName} • Automated Redeem Engine` })
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (logErr) {}
      }

      return {
        success: true,
        type: 'wallet',
        amount,
        newBalance: newBal,
        code: code.code
      };
    }

    return { success: false, reason: 'Unknown code reward type.' };
  }
}

module.exports = new RedeemService();
