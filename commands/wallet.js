const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('View and manage user wallet balances')
    // Balance
    .addSubcommand(sub =>
      sub
        .setName('balance')
        .setDescription('Check your or another member’s wallet balance')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false)
        )
    )
    // Admin Add
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add balance to a user’s wallet (Admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to credit balance to').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('amount').setDescription('Amount to add (e.g. 500)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('note').setDescription('Reason / reference note').setRequired(false)
        )
    )
    // Admin Set
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set exact balance for a user (Admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to set balance for').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('amount').setDescription('New balance amount').setRequired(true)
        )
    )
    // Admin Remove
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Deduct balance from a user’s wallet (Admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to deduct from').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('amount').setDescription('Amount to deduct').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('note').setDescription('Reason / note').setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    if (subcommand === 'balance') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const balance = db.getUserBalance(targetUser.id);
      const history = db.getWalletHistory(targetUser.id);

      let historyText = '*No recent transactions.*';
      if (history.length > 0) {
        historyText = history
          .slice(0, 5)
          .map(h => {
            const icon = h.type === 'credit' ? '🟢 +' : '🔴 -';
            const dateStr = `<t:${Math.floor(new Date(h.date).getTime() / 1000)}:R>`;
            return `${icon} ₹${h.amount} • *${h.note}* (${dateStr})`;
          })
          .join('\n');
      }

      const embed = new EmbedBuilder()
        .setTitle(`💳 ${storeName} Wallet — ${targetUser.username}`)
        .setColor(0x00d2ff)
        .setDescription(
          `• 👤 **Member:** <@${targetUser.id}>\n` +
          `• 💰 **Current Balance:** **₹${balance.toFixed(2)}**\n\n` +
          `📜 **Recent Activity:**\n${historyText}`
        )
        .setFooter({ text: 'Use balance to buy products instantly!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      // Admin check
      if (
        !interaction.memberPermissions ||
        (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator) &&
          !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild))
      ) {
        return interaction.reply({
          content: '⛔ You do not have permission to manage user wallets. (Admin required)',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getNumber('amount');
      const note = interaction.options.getString('note') || 'Staff adjustment';

      if (subcommand === 'add') {
        const newBal = db.addWalletBalance(targetUser.id, amount, note);
        await interaction.reply({
          content: `✅ Added **₹${amount}** to <@${targetUser.id}>'s wallet!\nNew balance: **₹${newBal.toFixed(2)}**.`,
          ephemeral: true
        });
      } else if (subcommand === 'set') {
        const newBal = db.setWalletBalance(targetUser.id, amount, 'Staff set balance');
        await interaction.reply({
          content: `✅ Set <@${targetUser.id}>'s wallet balance to **₹${newBal.toFixed(2)}**.`,
          ephemeral: true
        });
      } else if (subcommand === 'remove') {
        const ok = db.deductWalletBalance(targetUser.id, amount, note);
        if (!ok) {
          const currentBal = db.getUserBalance(targetUser.id);
          return interaction.reply({
            content: `⚠️ Cannot deduct ₹${amount}: user only has ₹${currentBal.toFixed(2)} in their wallet.`,
            ephemeral: true
          });
        }
        const newBal = db.getUserBalance(targetUser.id);
        await interaction.reply({
          content: `✅ Deducted **₹${amount}** from <@${targetUser.id}>'s wallet.\nNew balance: **₹${newBal.toFixed(2)}**.`,
          ephemeral: true
        });
      }
    }
  }
};
