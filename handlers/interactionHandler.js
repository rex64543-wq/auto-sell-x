const purchaseFlow = require('./purchaseFlow');
const adminVerifyFlow = require('./adminVerifyFlow');

class InteractionHandler {
  constructor() {
    this.commands = new Map();
  }

  registerCommand(command) {
    this.commands.set(command.data.name, command);
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      }
    } catch (err) {
      console.error('Unhandled interaction error:', err);
      const errorMsg = '⚠️ An error occurred while processing this action.';
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
        }
      } catch (replyErr) {
        // Ignored
      }
    }
  }

  async handleSlashCommand(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({ content: 'Unknown command', ephemeral: true });
    }

    const db = require('../database/db');
    const cmdName = interaction.commandName;
    const subCmd = interaction.options?.getSubcommand(false);

    // List of management commands that strictly require Staff Role or Server/Bot Owner
    const staffOnlyCommands = ['product', 'stock', 'setup', 'order', 'payment'];
    let requiresStaff = false;

    if (staffOnlyCommands.includes(cmdName)) {
      requiresStaff = true;
    } else if (cmdName === 'shop' && subCmd === 'send') {
      requiresStaff = true;
    } else if (cmdName === 'wallet' && ['add', 'set', 'remove'].includes(subCmd)) {
      requiresStaff = true;
    } else if (cmdName === 'currency' && ['set_default', 'add', 'remove'].includes(subCmd)) {
      requiresStaff = true;
    }

    if (requiresStaff) {
      const isAuthorized = db.isStaffOrOwner(interaction.member || interaction.user, interaction.guild);
      if (!isAuthorized) {
        const settings = db.getSettings();
        const roleText = settings.adminRoleId ? `<@&${settings.adminRoleId}>` : '**Staff / Admin Role**';
        return interaction.reply({
          content: `🚫 **Access Denied!**\nThis management command is restricted to the **Server Owner** and members with the ${roleText}.\n\n*Normal members can use commands like \`/shop\` and \`/help\`.*`,
          ephemeral: true
        });
      }
    }

    try {
      console.log(`[SlashCommand] Executing /${cmdName} ${subCmd || ''} for ${interaction.user?.tag || interaction.user?.id}...`);
      await command.execute(interaction);
      console.log(`[SlashCommand] Successfully completed /${cmdName}`);
    } catch (cmdErr) {
      console.error(`[SlashCommand] Error executing /${cmdName}:`, cmdErr);
      const errMsg = `❌ Error executing \`/${cmdName}\`: ${cmdErr.message}`;
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: errMsg, ephemeral: true });
        } else {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
      } catch (_) {}
    }
  }

  async handleSelectMenu(interaction) {
    const customId = interaction.customId;

    if (customId === 'shop_browse_products') {
      const selectedValue = interaction.values[0];
      await purchaseFlow.handleProductSelection(interaction, selectedValue);
    } else if (customId === 'shop_select_plan') {
      const raw = interaction.values[0].replace('plan_', '');
      const lastUnderscore = raw.lastIndexOf('_');
      const productId = raw.substring(0, lastUnderscore);
      const planKey = raw.substring(lastUnderscore + 1);

      await purchaseFlow.handlePlanSelection(interaction, productId, planKey);
    } else if (customId.startsWith('shop_select_payment_method')) {
      const raw = interaction.values[0].replace('toggle_pay_', '');
      const lastUnderscore = raw.lastIndexOf('_');
      const orderId = raw.substring(0, lastUnderscore);
      const method = raw.substring(lastUnderscore + 1) || 'upi';

      const defaultCurr = require('../database/db').getDefaultCurrency();
      const order = require('../database/db').getOrder(orderId);
      const currency = order ? (order.selectedCurrency || defaultCurr) : defaultCurr;

      await purchaseFlow.renderPaymentScreen(interaction, orderId, method, currency);
    } else if (customId.startsWith('shop_select_currency_')) {
      // Currency Exchange dropdown selected
      const defaultCurr = require('../database/db').getDefaultCurrency();
      const orderId = customId.replace('shop_select_currency_', '');
      const raw = interaction.values[0].replace('currency_exchange_', '');
      const lastUnderscore = raw.lastIndexOf('_');
      const currency = raw.substring(lastUnderscore + 1) || defaultCurr;

      const order = require('../database/db').getOrder(orderId);
      const method = order ? (order.paymentMethod || 'upi') : 'upi';

      await purchaseFlow.renderPaymentScreen(interaction, orderId, method, currency);
    } else if (customId.startsWith('shop_select_preview_currency_')) {
      // Product preview Currency Exchange dropdown selected
      const productId = customId.replace('shop_select_preview_currency_', '');
      const currency = interaction.values[0].replace('preview_curr_', '');

      await purchaseFlow.handleProductSelection(interaction, productId, currency);
    }
  }

  async handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('select_plan_')) {
      // customId format: select_plan_{productId}_{planKey}
      const raw = customId.replace('select_plan_', '');
      const lastUnderscore = raw.lastIndexOf('_');
      const productId = raw.substring(0, lastUnderscore);
      const planKey = raw.substring(lastUnderscore + 1);

      await purchaseFlow.handlePlanSelection(interaction, productId, planKey);
    } else if (customId.startsWith('pay_now_')) {
      const orderId = customId.replace('pay_now_', '');
      await purchaseFlow.renderPaymentScreen(interaction, orderId, 'upi');
    } else if (customId.startsWith('toggle_pay_')) {
      // format: toggle_pay_{orderId}_{method}
      const raw = customId.replace('toggle_pay_', '');
      const parts = raw.split('_');
      const orderId = parts[0];
      const method = parts[1] || 'upi';

      await purchaseFlow.renderPaymentScreen(interaction, orderId, method);
    } else if (customId.startsWith('gallery_proof_')) {
      const orderId = customId.replace('gallery_proof_', '');
      await purchaseFlow.handleGalleryProof(interaction, orderId);
    } else if (customId.startsWith('submit_proof_')) {
      const orderId = customId.replace('submit_proof_', '');
      await purchaseFlow.openProofModal(interaction, orderId);
    } else if (customId.startsWith('cancel_order_')) {
      const orderId = customId.replace('cancel_order_', '');
      await purchaseFlow.handleCancelOrder(interaction, orderId);
    } else if (customId.startsWith('close_ticket_')) {
      const orderId = customId.replace('close_ticket_', '');
      await purchaseFlow.handleCloseTicket(interaction, orderId);
    } else if (customId === 'back_to_shop') {
      await purchaseFlow.handleBackToShop(interaction);
    } else if (customId.startsWith('back_to_product_')) {
      const raw = customId.replace('back_to_product_', '');
      const parts = raw.split('_');
      const orderId = parts[0];
      const productId = parts.slice(1).join('_');
      const db = require('../database/db');
      db.updateOrder(orderId, { status: 'cancelled' });
      await purchaseFlow.handleProductSelection(interaction, productId);
    } else if (customId === 'wallet_view') {
      await purchaseFlow.handleWalletView(interaction);
    } else if (customId === 'wallet_close' || customId === 'preview_close') {
      await purchaseFlow.handleDismiss(interaction);
    } else if (customId.startsWith('back_to_wallet_')) {
      const orderId = customId.replace('back_to_wallet_', '');
      const db = require('../database/db');
      db.updateOrder(orderId, { status: 'cancelled' });
      await purchaseFlow.handleWalletView(interaction);
    } else if (customId === 'wallet_topup') {
      await purchaseFlow.openWalletTopupModal(interaction);
    } else if (customId === 'shop_live_status') {
      await purchaseFlow.handleShopLiveStatus(interaction);
    } else if (customId === 'shop_help') {
      await purchaseFlow.handleShopHelp(interaction);
    } else if (customId.startsWith('buy_wallet_')) {
      const orderId = customId.replace('buy_wallet_', '');
      await purchaseFlow.handleBuyWithWallet(interaction, orderId);
    } else if (customId.startsWith('admin_approve_')) {
      const db = require('../database/db');
      if (!db.isStaffOrOwner(interaction.member || interaction.user, interaction.guild)) {
        return interaction.reply({
          content: '🚫 **Access Denied!** Only Server Owners and Staff with the authorized role can approve payments.',
          ephemeral: true
        });
      }
      const orderId = customId.replace('admin_approve_', '');
      await adminVerifyFlow.handleApprove(interaction, orderId);
    } else if (customId.startsWith('admin_decline_')) {
      const db = require('../database/db');
      if (!db.isStaffOrOwner(interaction.member || interaction.user, interaction.guild)) {
        return interaction.reply({
          content: '🚫 **Access Denied!** Only Server Owners and Staff with the authorized role can decline payments.',
          ephemeral: true
        });
      }
      const orderId = customId.replace('admin_decline_', '');
      await adminVerifyFlow.openDeclineModal(interaction, orderId);
    }
  }

  async handleModalSubmit(interaction) {
    const customId = interaction.customId;

    if (customId === 'modal_wallet_topup') {
      await purchaseFlow.handleWalletTopupSubmit(interaction);
    } else if (customId.startsWith('modal_proof_')) {
      const orderId = customId.replace('modal_proof_', '');
      await purchaseFlow.handleProofSubmit(interaction, orderId);
    } else if (customId.startsWith('modal_decline_')) {
      const orderId = customId.replace('modal_decline_', '');
      await adminVerifyFlow.handleDeclineSubmit(interaction, orderId);
    }
  }
}

module.exports = new InteractionHandler();
