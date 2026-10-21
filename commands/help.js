const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display guide and command list for the Auto Sell Bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Auto Sell Bot — Complete Guide')
      .setColor(0x5865f2)
      .setDescription(
        'This bot allows you to sell digital products & license keys with **manual payment verification** and **automated API delivery**!'
      )
      .addFields(
        {
          name: '🚀 Quick Setup Steps (Admins)',
          value:
            '1. `/setup channels` — Set your Staff Verification channel and Sales Log channel.\n' +
            '2. `/payment config` — Enable and set wallet addresses / UPI ID / PayPal for payments.\n' +
            '3. `/product add` — Create your digital product (Choose KeyAuth, Custom REST API, or Stock).\n' +
            '4. `/product config_keyauth` or `/product config_api` — Set your API details.\n' +
            '5. `/shop send #channel` — Send the store catalog to your shop channel!'
        },
        {
          name: '🛒 How Manual Verification & Delivery Works',
          value:
            '• **Customer clicks Buy** -> selects payment method -> receives wallet/UPI details.\n' +
            '• **Customer submits proof** (Transaction ID / UTR / Screenshot link).\n' +
            '• **Bot sends Verification card** to your Staff channel with **[✅ Approve & Deliver]** and **[❌ Decline]** buttons.\n' +
            '• **When Staff clicks Approve**:\n' +
            '   ↳ Bot automatically fetches/generates the license key from your API.\n' +
            '   ↳ Bot securely delivers the key to the customer via DM and order ticket.\n' +
            '   ↳ Customer receives the Customer Role & transaction is logged in sales channel!'
        },
        {
          name: '🛠️ Command Reference',
          value:
            '`/shop send` - Post shop catalog in channel\n' +
            '`/claim` - Claim a gift or promotional redeem code\n' +
            '`/redeem generate` - Generate promotional gift codes (Staff)\n' +
            '`/wallet` - Check your wallet balance and recent activity\n' +
            '`/product add` - Add a new product\n' +
            '`/product config_keyauth` - Configure KeyAuth Seller API\n' +
            '`/product config_api` - Configure Custom REST API\n' +
            '`/product list` - List all products\n' +
            '`/stock add` - Add license keys to stock\n' +
            '`/payment config` - Configure payment methods\n' +
            '`/order view` - Look up an order by ID\n' +
            '`/order stats` - Check revenue and order metrics\n' +
            '`/currency convert` - Exchange & convert money between currencies\n' +
            '`/currency rates` - View supported store currencies\n' +
            '`/setup view` - View current bot settings'
        }
      )
      .setFooter({ text: 'Auto Sell Bot • Ready to serve' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
