const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Manage local stock pool for license keys')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add serial/license keys to a product')
        .addStringOption(opt =>
          opt.setName('product_id').setDescription('Product ID to add stock for').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('keys')
            .setDescription('Keys separated by commas or line breaks')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Check current stock count for a product')
        .addStringOption(opt =>
          opt.setName('product_id').setDescription('Product ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear all stock for a product')
        .addStringOption(opt =>
          opt.setName('product_id').setDescription('Product ID').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const productId = interaction.options.getString('product_id').toLowerCase().trim();
    const product = db.getProduct(productId);

    if (!product) {
      return interaction.reply({
        content: `❌ Product with ID \`${productId}\` not found! Use \`/product list\` to check.`,
        ephemeral: true
      });
    }

    if (subcommand === 'add') {
      const rawKeys = interaction.options.getString('keys');
      // Split by newline or comma
      const keysList = rawKeys
        .split(/[\n,]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keysList.length === 0) {
        return interaction.reply({ content: '❌ No valid keys found in input.', ephemeral: true });
      }

      const totalCount = db.addStock(productId, keysList);

      await interaction.reply({
        content: `✅ Added **${keysList.length}** keys to **${product.name}**!\nTotal stock now: **${totalCount}** keys.`,
        ephemeral: true
      });
    } else if (subcommand === 'view') {
      const count = db.getStockCount(productId);
      await interaction.reply({
        content: `📦 Product **${product.name}** currently has **${count}** keys available in stock.`,
        ephemeral: true
      });
    } else if (subcommand === 'clear') {
      db.stock[productId] = [];
      const count = db.getStockCount(productId);
      await interaction.reply({
        content: `🧹 Cleared all stock for **${product.name}**. Current stock: **0**.`,
        ephemeral: true
      });
    }
  }
};
