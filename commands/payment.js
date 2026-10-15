const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payment')
    .setDescription('Configure payment methods and payment addresses/instructions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('Configure a payment method')
        .addStringOption(opt =>
          opt
            .setName('method')
            .setDescription('Payment method to configure')
            .setRequired(true)
            .addChoices(
              { name: 'UPI / QR Code', value: 'upi' },
              { name: 'Credit / Debit Card', value: 'credit' },
              { name: 'Cryptocurrency (USDT / LTC / BTC)', value: 'crypto' },
              { name: 'PayPal (F&F)', value: 'paypal' }
            )
        )
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable or disable this payment method').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('details')
            .setDescription('Wallet addresses, UPI ID, payment link or instructions')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('upi_id')
            .setDescription('UPI ID for auto QR generation (e.g. milindy783@okaxis)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('card_link')
            .setDescription('Credit/Debit Card payment link (e.g. Stripe checkout URL)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view').setDescription('View current payment methods and instructions')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const settings = db.getSettings();

    if (subcommand === 'config') {
      const method = interaction.options.getString('method');
      const enabled = interaction.options.getBoolean('enabled');
      const details = interaction.options.getString('details');
      const upiId = interaction.options.getString('upi_id');
      const cardLink = interaction.options.getString('card_link');

      const existingConfig = settings.paymentMethods[method] || {};
      const updatedConfig = {
        ...existingConfig,
        enabled,
        ...(details !== null ? { details } : {}),
        ...(upiId ? { upiId } : {}),
        ...(cardLink ? { paymentLink: cardLink } : {})
      };

      db.updatePaymentMethod(method, updatedConfig);

      await interaction.reply({
        content: `✅ Payment method **${method.toUpperCase()}** updated! Enabled: **${enabled ? 'YES' : 'NO'}**.`,
        ephemeral: true
      });
    } else if (subcommand === 'view') {
      const methods = settings.paymentMethods || {};
      const embed = new EmbedBuilder()
        .setTitle('💳 Configured Payment Methods')
        .setColor(0x00d2ff)
        .setDescription('Here are the payment methods shown to buyers:');

      for (const [key, conf] of Object.entries(methods)) {
        let extra = '';
        if (conf.upiId) extra += `\n**UPI ID:** \`${conf.upiId}\``;
        if (conf.paymentLink) extra += `\n**Card Link:** \`${conf.paymentLink}\``;

        embed.addFields({
          name: `${conf.enabled ? '🟢' : '🔴'} ${conf.name || key.toUpperCase()}`,
          value: `**Status:** ${conf.enabled ? 'Enabled' : 'Disabled'}${extra}\n\`\`\`\n${conf.details || 'No details set'}\n\`\`\``,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
