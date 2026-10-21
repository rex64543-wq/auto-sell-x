const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');
const redeemService = require('../services/redeemService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem gift codes or generate promotional codes (Staff)')
    .addSubcommand(sub =>
      sub
        .setName('claim')
        .setDescription('Claim a store gift code for cheats or wallet balance')
        .addStringOption(opt =>
          opt
            .setName('code')
            .setDescription('Enter the gift code (e.g. WX-XXXX-XXXX-XXXX)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('generate')
        .setDescription('Generate a new redeem code (Staff only)')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Reward type')
            .setRequired(true)
            .addChoices(
              { name: '📦 Store Item / Cheat Panel', value: 'item' },
              { name: '💳 Wallet Balance', value: 'wallet' }
            )
        )
        .addStringOption(opt =>
          opt
            .setName('product')
            .setDescription('Product ID (required if item type, e.g. android-panel)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('plan')
            .setDescription('Duration Plan key (e.g. 1d, 7d, 30d — default: 30d)')
            .setRequired(false)
        )
        .addNumberOption(opt =>
          opt
            .setName('amount')
            .setDescription('Wallet amount in ₹ INR (required if wallet type)')
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption(opt =>
          opt
            .setName('custom_code')
            .setDescription('Optional custom code (leave empty for random code)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('max_uses')
            .setDescription('Maximum times this code can be claimed (default: 1)')
            .setRequired(false)
            .setMinValue(1)
        )
        .addIntegerOption(opt =>
          opt
            .setName('days_valid')
            .setDescription('Days until code expires (e.g. 7, 30 — default: never)')
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption(opt =>
          opt
            .setName('note')
            .setDescription('Optional label or note (e.g. Giveaway Winner)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View active redeem codes (Staff only)')
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete or revoke a redeem code (Staff only)')
        .addStringOption(opt =>
          opt
            .setName('code')
            .setDescription('The code to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const settings = db.getSettings();
    const storeName = settings.storeName || 'White X Store';

    // ------------------------------------------
    // 1. CLAIM SUBCOMMAND (ANY USER)
    // ------------------------------------------
    if (subcommand === 'claim') {
      await interaction.deferReply({ ephemeral: true });
      const codeStr = interaction.options.getString('code').trim();

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

      if (result.type === 'item') {
        const successEmbed = new EmbedBuilder()
          .setTitle('🎉 GIFT CODE REDEEMED SUCCESSFULLY!')
          .setColor(0x00e5ff)
          .setDescription(
            `Congratulations <@${interaction.user.id}>! You have claimed your store item:\n\n` +
            `• **Item:** \`${result.productName}\`\n` +
            `• **Plan Duration:** \`${result.planDuration}\`\n` +
            `• **Redeemed Code:** \`${result.code}\`\n\n` +
            `🔑 **YOUR LICENSE KEY:**\n\`\`\`${result.licenseKey}\`\`\`\n` +
            `*(Click to reveal: ||${result.licenseKey}||)*\n\n` +
            `📨 A private backup has also been delivered to your **Discord DMs**!`
          )
          .setFooter({ text: `${storeName} • 24/7 Automated Delivery` })
          .setTimestamp();

        if (result.downloadUrl) {
          successEmbed.addFields({
            name: '📥 Download Loader',
            value: `[Click Here to Download](${result.downloadUrl})`,
            inline: false
          });
        }
        if (result.instructions) {
          successEmbed.addFields({
            name: '📖 Setup Guide',
            value: `${result.instructions}`,
            inline: false
          });
        }

        return interaction.editReply({ embeds: [successEmbed] });
      }

      if (result.type === 'wallet') {
        const walletEmbed = new EmbedBuilder()
          .setTitle('🎉 WALLET GIFT CODE REDEEMED!')
          .setColor(0x2ecc71)
          .setDescription(
            `Congratulations <@${interaction.user.id}>! Your wallet balance has been updated:\n\n` +
            `• **Amount Credited:** \`₹${result.amount}\`\n` +
            `• **New Balance:** \`₹${result.newBalance.toFixed(2)}\`\n` +
            `• **Redeemed Code:** \`${result.code}\``
          )
          .setFooter({ text: `${storeName} • Wallet System` })
          .setTimestamp();

        return interaction.editReply({ embeds: [walletEmbed] });
      }
    }

    // ------------------------------------------
    // STAFF PERMISSIONS CHECK FOR OTHER SUBCOMMANDS
    // ------------------------------------------
    const isStaff = db.isStaffOrOwner(interaction.member || interaction.user, interaction.guild);
    if (!isStaff) {
      return interaction.reply({
        content: '🔒 You do not have permission to manage store redeem codes. (Staff / Owner only)',
        ephemeral: true
      });
    }

    // ------------------------------------------
    // 2. GENERATE SUBCOMMAND (STAFF)
    // ------------------------------------------
    if (subcommand === 'generate') {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type');
      const productId = interaction.options.getString('product')?.toLowerCase().trim();
      const planKey = (interaction.options.getString('plan') || '30d').toLowerCase().trim();
      const amount = interaction.options.getNumber('amount') || 0;
      const customCode = interaction.options.getString('custom_code')?.trim();
      const maxUses = interaction.options.getInteger('max_uses') || 1;
      const daysValid = interaction.options.getInteger('days_valid');
      const note = interaction.options.getString('note') || '';

      if (type === 'item') {
        if (!productId) {
          return interaction.editReply({
            content: '❌ Please specify a `product` ID when generating an item code. (e.g. `android-panel`)'
          });
        }
        const prod = db.getProduct(productId);
        if (!prod) {
          return interaction.editReply({
            content: `❌ Product with ID \`${productId}\` does not exist in store! Use \`/product list\` to check.`
          });
        }
      } else if (type === 'wallet') {
        if (!amount || amount <= 0) {
          return interaction.editReply({
            content: '❌ Please specify a valid `amount` greater than 0 for wallet gift codes.'
          });
        }
      }

      let expiresAt = null;
      if (daysValid && daysValid > 0) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + daysValid);
        expiresAt = expDate.toISOString();
      }

      const createdCode = db.createRedeemCode({
        code: customCode || null,
        type,
        productId,
        planKey,
        amount,
        maxUses,
        expiresAt,
        note,
        createdBy: `${interaction.user.tag || interaction.user.username} (Discord)`
      });

      const genEmbed = new EmbedBuilder()
        .setTitle('🎁 Redeem Code Generated Successfully!')
        .setColor(0x00e5ff)
        .setDescription(
          `Share this code with players so they can claim it using \`/claim code:${createdCode.code}\` or \`/redeem claim\`!\n\n` +
          `╭──────────────────────────────────────────╮\n` +
          `  🏷️ **CODE:** \`${createdCode.code}\`\n` +
          `  🎁 **REWARD:** ${type === 'item' ? `\`${createdCode.productName} (${createdCode.planDuration})\`` : `\`₹${createdCode.amount} Wallet Balance\``}\n` +
          `  👥 **MAX CLAIMS:** \`${createdCode.maxUses} Uses\`\n` +
          `  ⏳ **EXPIRES:** ${expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : '\`Never\`'}\n` +
          (note ? `  📝 **NOTE:** \`${note}\`\n` : '') +
          `╰──────────────────────────────────────────╯\n\n` +
          `📋 **Quick Copy:**\n\`\`\`${createdCode.code}\`\`\``
        )
        .setFooter({ text: `${storeName} • Staff Code Generator` })
        .setTimestamp();

      return interaction.editReply({ embeds: [genEmbed] });
    }

    // ------------------------------------------
    // 3. LIST SUBCOMMAND (STAFF)
    // ------------------------------------------
    if (subcommand === 'list') {
      await interaction.deferReply({ ephemeral: true });

      const allCodes = db.getAllRedeemCodes();
      if (allCodes.length === 0) {
        return interaction.editReply({
          content: 'ℹ️ No redeem codes created yet. Use `/redeem generate` or the Web Dashboard to create one!'
        });
      }

      const activeCodes = allCodes.filter(c => c.isActive && (!c.maxUses || c.usedCount < c.maxUses)).slice(0, 15);

      const listEmbed = new EmbedBuilder()
        .setTitle(`🎁 Store Redeem Codes (${allCodes.length} Total)`)
        .setColor(0x00d2ff)
        .setDescription(
          activeCodes.length === 0
            ? '*No active codes currently waiting to be claimed.*'
            : activeCodes
                .map(
                  (c, i) =>
                    `**${i + 1}.** \`${c.code}\` — ${
                      c.type === 'item' ? `📦 **${c.productName}** (${c.planDuration})` : `💳 **₹${c.amount}**`
                    } • Claims: \`${c.usedCount}/${c.maxUses || '∞'}\` ${
                      c.expiresAt ? `• Exp: <t:${Math.floor(new Date(c.expiresAt).getTime() / 1000)}:d>` : ''
                    }`
                )
                .join('\n\n')
        )
        .setFooter({ text: `${storeName} • Showing recent active codes` })
        .setTimestamp();

      return interaction.editReply({ embeds: [listEmbed] });
    }

    // ------------------------------------------
    // 4. DELETE SUBCOMMAND (STAFF)
    // ------------------------------------------
    if (subcommand === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      const targetCode = interaction.options.getString('code').trim();

      const success = db.deleteRedeemCode(targetCode);
      if (!success) {
        return interaction.editReply({
          content: `❌ Redeem code \`${targetCode}\` was not found.`
        });
      }

      return interaction.editReply({
        content: `✅ Successfully deleted and revoked redeem code \`${targetCode.toUpperCase()}\`.`
      });
    }
  }
};
