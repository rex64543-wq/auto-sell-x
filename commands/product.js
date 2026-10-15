const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('product')
    .setDescription('Manage products, edit pricing, plans, status, and features')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Subcommand: Set Price (Quick 1D/7D/30D price changer)
    .addSubcommand(sub =>
      sub
        .setName('set_price')
        .setDescription('Quickly edit prices for 1 Day, 7 Days, and 30 Days')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID (e.g. external-panel)').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('price_1d').setDescription('New 1-Day price (e.g. 200)').setRequired(false)
        )
        .addNumberOption(opt =>
          opt.setName('price_7d').setDescription('New 7-Days price (e.g. 600)').setRequired(false)
        )
        .addNumberOption(opt =>
          opt.setName('price_30d').setDescription('New 30-Days price (e.g. 1500)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('currency').setDescription('Currency symbol (e.g. ₹ or $)').setRequired(false)
        )
    )
    // Subcommand: Plan Add (Add or edit custom duration plan like Lifetime)
    .addSubcommand(sub =>
      sub
        .setName('plan_add')
        .setDescription('Add or update a custom duration plan (e.g. Lifetime or 15 Days)')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID (e.g. external-panel)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('plan_id').setDescription('Plan key (e.g. lifetime or 15d)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('label').setDescription('Display label (e.g. Lifetime VIP or 15 Days)').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('price').setDescription('Price for this plan (e.g. 3000)').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('duration_days').setDescription('Duration in days (e.g. 99999 for lifetime)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('currency').setDescription('Currency symbol (default: ₹)').setRequired(false)
        )
    )
    // Subcommand: Plan Delete
    .addSubcommand(sub =>
      sub
        .setName('plan_delete')
        .setDescription('Delete a specific plan duration from a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('plan_id').setDescription('Plan key to remove (e.g. 1d, 7d, lifetime)').setRequired(true)
        )
    )
    // Subcommand: Plans View
    .addSubcommand(sub =>
      sub
        .setName('plans_view')
        .setDescription('View all current plans and pricing for a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID').setRequired(true)
        )
    )
    // Subcommand: Edit existing product general info
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit product name, category, status, version, and features')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID to edit').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('name').setDescription('New product display name').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('category').setDescription('New category (PC, Android, Bypass)').setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Live status indicator')
            .setRequired(false)
            .addChoices(
              { name: 'Safe 🟢 (Undetected)', value: 'safe' },
              { name: 'Maintenance 🟡 (Updating)', value: 'maintenance' },
              { name: 'Patched 🔴 (Offline/Detected)', value: 'patched' }
            )
        )
        .addStringOption(opt =>
          opt.setName('version').setDescription('Version tag (e.g. v2.5)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('features').setDescription('Features separated by comma or semicolon').setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('delivery_type')
            .setDescription('License delivery source')
            .setRequired(false)
            .addChoices(
              { name: 'KeyAuth API (Auto-generated)', value: 'keyauth' },
              { name: 'Custom REST API', value: 'custom_api' },
              { name: 'Local Stock Pool', value: 'stock' }
            )
        )
    )
    // Subcommand: Set Status
    .addSubcommand(sub =>
      sub
        .setName('set_status')
        .setDescription('Quickly change the live safety status of a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('New status')
            .setRequired(true)
            .addChoices(
              { name: 'Safe 🟢', value: 'safe' },
              { name: 'Maintenance 🟡', value: 'maintenance' },
              { name: 'Patched 🔴', value: 'patched' }
            )
        )
    )
    // Subcommand: Add new product
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a new product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Unique product ID (e.g. my-panel)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('name').setDescription('Product display name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('category').setDescription('Category (e.g. PC or Android)').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('price_1d').setDescription('1 Day price (e.g. 150)').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('price_7d').setDescription('7 Days price (e.g. 500)').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('price_30d').setDescription('30 Days price (e.g. 1200)').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('delivery_type')
            .setDescription('How license keys are generated/delivered')
            .setRequired(true)
            .addChoices(
              { name: 'KeyAuth API (Auto-generated)', value: 'keyauth' },
              { name: 'Custom REST API (Webhook / Endpoint)', value: 'custom_api' },
              { name: 'Local Stock Pool (Uploaded keys)', value: 'stock' }
            )
        )
        .addStringOption(opt =>
          opt.setName('currency').setDescription('Currency code (default: ₹)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('version').setDescription('Version (default: v1.0)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('features').setDescription('Features separated by comma').setRequired(false)
        )
    )
    // Subcommand: Configure KeyAuth
    .addSubcommand(sub =>
      sub
        .setName('config_keyauth')
        .setDescription('Configure KeyAuth API settings for a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID to configure').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('seller_key').setDescription('Your KeyAuth Seller Key').setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('expiry').setDescription('License duration in days (default 30)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('mask').setDescription('Key format mask (e.g. XXXXXX-XXXXXX-XXXXXX)').setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('level').setDescription('Key level (default 1)').setRequired(false)
        )
    )
    // Subcommand: Configure Custom API
    .addSubcommand(sub =>
      sub
        .setName('config_api')
        .setDescription('Configure Custom REST API connection for a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID to configure').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('url').setDescription('API URL endpoint').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('method').setDescription('HTTP Method (POST or GET)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('api_key').setDescription('Bearer Token or API Secret Key').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('response_key_path').setDescription('JSON path to license key').setRequired(false)
        )
    )
    // Subcommand: List
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all existing products and their editable configs')
    )
    // Subcommand: Delete
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a product')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Product ID to delete').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set_price') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({
          content: `❌ Product with ID \`${id}\` not found! Use \`/product list\` to check.`,
          ephemeral: true
        });
      }

      const p1d = interaction.options.getNumber('price_1d');
      const p7d = interaction.options.getNumber('price_7d');
      const p30d = interaction.options.getNumber('price_30d');
      const currency = interaction.options.getString('currency');

      const updated = db.setProductPrice(id, p1d, p7d, p30d, currency);

      const embed = new EmbedBuilder()
        .setTitle(`💰 Pricing Updated: ${updated.name}`)
        .setColor(0x00d2ff)
        .setDescription(`New prices have been saved for **${updated.name}** (\`${id}\`):`)
        .addFields(
          { name: '⏱️ 1 Day', value: `${updated.plans['1d']?.currency || '₹'}${updated.plans['1d']?.price}`, inline: true },
          { name: '📅 7 Days', value: `${updated.plans['7d']?.currency || '₹'}${updated.plans['7d']?.price}`, inline: true },
          { name: '🗓️ 30 Days', value: `${updated.plans['30d']?.currency || '₹'}${updated.plans['30d']?.price}`, inline: true }
        )
        .setFooter({ text: 'Changes will appear on the next /shop send' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'plan_add') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      const planId = interaction.options.getString('plan_id').toLowerCase().trim();
      const label = interaction.options.getString('label');
      const price = interaction.options.getNumber('price');
      const durationDays = interaction.options.getInteger('duration_days') || 30;
      const currency = interaction.options.getString('currency') || '₹';

      const updated = db.setCustomPlan(id, planId, label, price, currency, durationDays);

      await interaction.reply({
        content: `✅ Plan **${label}** (\`${planId}\`) set for **${updated.name}** at **${currency}${price}** (${durationDays} days)!`,
        ephemeral: true
      });
    } else if (subcommand === 'plan_delete') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const planId = interaction.options.getString('plan_id').toLowerCase().trim();

      const updated = db.deleteCustomPlan(id, planId);
      if (!updated) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      await interaction.reply({
        content: `✅ Plan \`${planId}\` removed from product **${updated.name}**!`,
        ephemeral: true
      });
    } else if (subcommand === 'plans_view') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 Active Plans & Pricing: ${product.name}`)
        .setColor(0x00d2ff)
        .setDescription(`Product ID: \`${product.id}\` | Status: \`${product.status.toUpperCase()}\``);

      if (product.plans && Object.keys(product.plans).length > 0) {
        for (const [key, plan] of Object.entries(product.plans)) {
          embed.addFields({
            name: `🔹 ${plan.label} (Key: \`${key}\`)`,
            value: `**Price:** ${plan.currency || '₹'}${plan.price}\n**Duration:** ${plan.durationDays || 'N/A'} days`,
            inline: true
          });
        }
      } else {
        embed.setDescription('No duration plans configured for this product.');
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'edit') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      const name = interaction.options.getString('name');
      const category = interaction.options.getString('category');
      const status = interaction.options.getString('status');
      const version = interaction.options.getString('version');
      const featuresRaw = interaction.options.getString('features');
      const deliveryType = interaction.options.getString('delivery_type');

      const updates = {};
      if (name) updates.name = name;
      if (category) updates.category = category;
      if (status) updates.status = status;
      if (version) updates.version = version;
      if (deliveryType) updates.deliveryType = deliveryType;

      if (featuresRaw) {
        updates.features = featuresRaw.split(/[,;\n]+/).map(f => f.trim()).filter(Boolean);
      }

      const updated = db.updateProductField(id, updates);

      await interaction.reply({
        content: `✅ Product **${updated.name}** details updated successfully!`,
        ephemeral: true
      });
    } else if (subcommand === 'set_status') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const status = interaction.options.getString('status');

      const updated = db.updateProductField(id, { status });
      if (!updated) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      let badge = 'Safe 🟢';
      if (status === 'maintenance') badge = 'Maintenance 🟡';
      if (status === 'patched') badge = 'Patched 🔴';

      await interaction.reply({
        content: `✅ Product **${updated.name}** status changed to **${badge}**!`,
        ephemeral: true
      });
    } else if (subcommand === 'add') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const name = interaction.options.getString('name');
      const category = interaction.options.getString('category');
      const price1d = interaction.options.getNumber('price_1d');
      const price7d = interaction.options.getNumber('price_7d');
      const price30d = interaction.options.getNumber('price_30d');
      const deliveryType = interaction.options.getString('delivery_type');
      const currency = interaction.options.getString('currency') || '₹';
      const version = interaction.options.getString('version') || 'v1.0';
      const featuresRaw = interaction.options.getString('features') || '';

      const features = featuresRaw
        ? featuresRaw.split(/[,;\n]+/).map(f => f.trim()).filter(Boolean)
        : [
            `💻 ${name} High Performance`,
            `🎯 Precision Target Accuracy`,
            `🛡️ Undetected Engine Protection`
          ];

      const product = {
        id,
        name,
        category,
        status: 'safe',
        version,
        features,
        plans: {
          '1d': { label: '1 Day', durationDays: 1, price: price1d, currency },
          '7d': { label: '7 Days', durationDays: 7, price: price7d, currency },
          '30d': { label: '30 Days', durationDays: 30, price: price30d, currency }
        },
        deliveryType,
        keyauthConfig: {},
        customApiConfig: {}
      };

      db.saveProduct(product);

      await interaction.reply({
        content: `✅ Product **${name}** (\`${id}\`) added successfully with 1D/7D/30D plans!`,
        ephemeral: true
      });
    } else if (subcommand === 'config_keyauth') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      const sellerKey = interaction.options.getString('seller_key');
      const expiry = interaction.options.getInteger('expiry');
      const mask = interaction.options.getString('mask');
      const level = interaction.options.getInteger('level');

      product.keyauthConfig = {
        ...product.keyauthConfig,
        ...(sellerKey ? { sellerKey } : {}),
        ...(expiry ? { expiry } : {}),
        ...(mask ? { mask } : {}),
        ...(level ? { level } : {})
      };
      product.deliveryType = 'keyauth';

      db.saveProduct(product);

      await interaction.reply({
        content: `✅ KeyAuth API configuration updated for product **${product.name}**!`,
        ephemeral: true
      });
    } else if (subcommand === 'config_api') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const product = db.getProduct(id);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${id}\` not found!`, ephemeral: true });
      }

      const url = interaction.options.getString('url');
      const method = interaction.options.getString('method') || 'POST';
      const apiKey = interaction.options.getString('api_key') || null;
      const responseKeyPath = interaction.options.getString('response_key_path') || 'key';

      product.customApiConfig = { url, method, apiKey, responseKeyPath };
      product.deliveryType = 'custom_api';

      db.saveProduct(product);

      await interaction.reply({
        content: `✅ Custom REST API configuration updated for **${product.name}**!\n- Endpoint: \`${url}\`\n- Method: \`${method}\`\n- Key Path: \`${responseKeyPath}\``,
        ephemeral: true
      });
    } else if (subcommand === 'list') {
      const products = db.getAllProducts();
      if (products.length === 0) {
        return interaction.reply({
          content: 'No products found. Use `/product add` to create one.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 All Store Products & Plans')
        .setColor(0x00d2ff)
        .setDescription(
          `Total Products: **${products.length}**\n*Edit prices with \`/product set_price\` or custom plans with \`/product plan_add\`!*`
        );

      for (const p of products) {
        let statusBadge = 'Safe 🟢';
        if (p.status === 'maintenance') statusBadge = 'Maintenance 🟡';
        if (p.status === 'patched') statusBadge = 'Patched 🔴';

        let plansStr = '';
        if (p.plans && Object.keys(p.plans).length > 0) {
          plansStr = Object.values(p.plans)
            .map(pl => `${pl.label}: ${pl.currency || '₹'}${pl.price}`)
            .join(' | ');
        } else {
          plansStr = `Price: ${p.price}`;
        }

        embed.addFields({
          name: `${p.name} (ID: \`${p.id}\`) • ${statusBadge}`,
          value: `**Category:** ${p.category || 'PC'} | **Version:** ${p.version || 'v1.0'}\n**Pricing:** ${plansStr}\n**Delivery:** \`${(p.deliveryType || 'keyauth').toUpperCase()}\``,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'delete') {
      const id = interaction.options.getString('id').toLowerCase().trim();
      const removed = db.deleteProduct(id);

      if (removed) {
        await interaction.reply({ content: `✅ Product \`${id}\` deleted.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Product \`${id}\` not found.`, ephemeral: true });
      }
    }
  }
};
