const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const redeemService = require('../services/redeemService');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim and redeem a store gift code for cheats or wallet balance')
    .addStringOption(opt =>
      opt
        .setName('code')
        .setDescription('Enter the gift / redeem code (e.g. WX-XXXX-XXXX-XXXX)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const codeStr = interaction.options.getString('code').trim();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    const result = await redeemService.claim(
      interaction.user,
      codeStr,
      interaction.guild,
      interaction.client
    );

    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Claim Failed')
        .setColor(0xf43f5e)
        .setDescription(`**${result.reason || 'Could not redeem code.'}**`)
        .setFooter({ text: `${storeName} • If you think this is an error, please open a support ticket.` })
        .setTimestamp();

      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Success - Item
    if (result.type === 'item') {
      const successEmbed = new EmbedBuilder()
        .setTitle('🎉 GIFT CODE REDEEMED SUCCESSFULLY!')
        .setColor(0x00e5ff)
        .setDescription(
          `Congratulations <@${interaction.user.id}>! You have successfully claimed your store item:\n\n` +
          `╭──────────────────────────────────────────╮\n` +
          `  📦 **ITEM:** \`${result.productName}\`\n` +
          `  ⏱️ **DURATION:** \`${result.planDuration}\`\n` +
          `  🏷️ **REDEEMED CODE:** \`${result.code}\`\n` +
          `╰──────────────────────────────────────────╯\n\n` +
          `🔑 **YOUR LICENSE KEY:**\n` +
          `\`\`\`${result.licenseKey}\`\`\`\n` +
          `*(Click to reveal: ||${result.licenseKey}||)*\n\n` +
          `📨 **Private Backup:** A copy of this key has also been delivered to your **Discord DMs**!`
        )
        .setFooter({ text: `${storeName} • 24/7 Automated Delivery` })
        .setTimestamp();

      if (result.downloadUrl) {
        successEmbed.addFields({
          name: '📥 Download Loader & Files',
          value: `[Click Here to Download](${result.downloadUrl})`,
          inline: false
        });
      }

      if (result.instructions) {
        successEmbed.addFields({
          name: '📖 Setup & Injection Guide',
          value: `${result.instructions}`,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [successEmbed] });
    }

    // Success - Wallet
    if (result.type === 'wallet') {
      const walletEmbed = new EmbedBuilder()
        .setTitle('🎉 WALLET GIFT CODE REDEEMED!')
        .setColor(0x2ecc71)
        .setDescription(
          `Congratulations <@${interaction.user.id}>! Your wallet has been credited:\n\n` +
          `╭──────────────────────────────────────────╮\n` +
          `  💰 **AMOUNT CREDITED:** \`₹${result.amount}\`\n` +
          `  💳 **NEW WALLET BALANCE:** \`₹${result.newBalance.toFixed(2)}\`\n` +
          `  🏷️ **REDEEMED CODE:** \`${result.code}\`\n` +
          `╰──────────────────────────────────────────╯\n\n` +
          `⚡ You can use your wallet balance anytime to purchase cheats instantly using **1-Click Checkout**!`
        )
        .setFooter({ text: `${storeName} • Wallet System` })
        .setTimestamp();

      return interaction.editReply({ embeds: [walletEmbed] });
    }
  }
};
