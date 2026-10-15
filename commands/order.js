const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Look up orders and revenue statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View full details for an order')
        .addStringOption(opt =>
          opt.setName('order_id').setDescription('Order ID (e.g. 1A2B3C)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stats').setDescription('View store revenue and order statistics')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const orderId = interaction.options.getString('order_id').toUpperCase().trim();
      const order = db.getOrder(orderId);

      if (!order) {
        return interaction.reply({ content: `❌ Order \`#${orderId}\` not found!`, ephemeral: true });
      }

      let color = 0xf1c40f;
      if (order.status === 'completed') color = 0x2ecc71;
      if (order.status === 'declined') color = 0xe74c3c;

      const embed = new EmbedBuilder()
        .setTitle(`🧾 Order Details: #${order.id}`)
        .setColor(color)
        .addFields(
          { name: 'Status', value: `\`${order.status.toUpperCase()}\``, inline: true },
          { name: 'Buyer', value: `<@${order.userId}> (\`${order.userId}\`)`, inline: true },
          { name: 'Product', value: `**${order.productName || order.productId}**`, inline: true },
          { name: 'Amount', value: `**${order.amount} ${order.currency}**`, inline: true },
          { name: 'Method', value: `${(order.paymentMethod || 'N/A').toUpperCase()}`, inline: true },
          { name: 'Created At', value: `<t:${Math.floor(new Date(order.createdAt).getTime() / 1000)}:f>`, inline: true },
          { name: 'Transaction ID / UTR', value: `\`\`\`${order.txId || 'None'}\`\`\``, inline: false }
        );

      if (order.licenseKey) {
        embed.addFields({
          name: '🔑 Delivered License Key',
          value: `||${order.licenseKey}||`,
          inline: false
        });
      }

      if (order.approvedBy) {
        embed.addFields({
          name: 'Staff Action',
          value: `Approved by: **${order.approvedBy}**`,
          inline: true
        });
      } else if (order.declinedBy) {
        embed.addFields({
          name: 'Staff Action',
          value: `Declined by: **${order.declinedBy}**\nReason: *${order.declineReason}*`,
          inline: true
        });
      }

      if (order.proofUrl) {
        embed.setImage(order.proofUrl);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'stats') {
      const allOrders = db.getAllOrders();
      let totalRevenue = 0;
      let completedCount = 0;
      let pendingCount = 0;
      let declinedCount = 0;

      for (const o of allOrders) {
        if (o.status === 'completed') {
          completedCount++;
          totalRevenue += Number(o.amount || 0);
        } else if (o.status === 'pending_verification' || o.status === 'pending_payment') {
          pendingCount++;
        } else if (o.status === 'declined') {
          declinedCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Store & Revenue Statistics')
        .setColor(0x9b59b6)
        .addFields(
          { name: '💰 Total Completed Revenue', value: `**$${totalRevenue.toFixed(2)}**`, inline: true },
          { name: '✅ Completed Orders', value: `**${completedCount}**`, inline: true },
          { name: '⏳ Pending Orders', value: `**${pendingCount}**`, inline: true },
          { name: '❌ Declined Orders', value: `**${declinedCount}**`, inline: true },
          { name: '📦 Total Products', value: `**${db.getAllProducts().length}**`, inline: true }
        )
        .setFooter({ text: 'Auto Sell Analytics' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
